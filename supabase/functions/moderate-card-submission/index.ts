import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

/**
 * Moderación de propuestas de cards nuevas.
 *
 * Es la contraparte de moderate-card-image, pero aprobar aquí hace bastante
 * más que cambiar un estado: CREA una card en el catálogo. En una sola
 * aprobación pasan cuatro cosas que tienen que quedar todas o ninguna:
 *
 *   1. nace la fila en `cards` (con un code único derivado de la taxonomía),
 *   2. la imagen se mueve del bucket privado de revisión al público,
 *   3. se registra en `card_images` como community/approved/primary,
 *   4. la propuesta queda approved apuntando a la card creada.
 *
 * No hay transacción posible: los pasos 2 y 3 cruzan Storage y Postgres. Así que
 * se hacen en ese orden y cada fallo deshace lo anterior a mano. El orden no es
 * casual: lo reversible va primero (una card recién creada se borra sin dejar
 * rastro) y lo irreversible al final (borrar el objeto de revisión es lo último,
 * y es best-effort).
 *
 * `card_submissions` NO tiene grant de UPDATE para authenticated, ni siquiera
 * para un admin. Esta función es el único camino, precisamente para que no
 * exista un atajo que deje una propuesta aprobada sin card, o una card sin
 * imagen.
 *
 *   POST { action: "approve", submissionId: number }
 *   POST { action: "reject",  submissionId: number, reason: string }
 */

const REVIEW_BUCKET = "photocard-community-review";
const PUBLIC_BUCKET = "photocard-community";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SubmissionRow = {
  id: number;
  submitted_by: string | null;
  status: string;
  album_id: number;
  version_id: number | null;
  category_id: number;
  card_set_id: number | null;
  member: string;
  card_name: string;
  bucket_id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
};

/**
 * Trozo de código: mayúsculas y solo alfanuméricos.
 *
 * "J-Hope" tiene que quedar en "JHOPE", que es como aparece en los 4503 codes
 * que ya existen (LYH-V-JHOPE-ALBUM). Quitar el guion y no cambiarlo por otro
 * es lo que mantiene la convención.
 */
function slug(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Un code libre siguiendo la convención del catálogo:
 * ALBUM[-VERSION]-MIEMBRO-CATEGORIA.
 *
 * `cards.code` es UNIQUE, así que si ya está ocupado se numera. Se consulta en
 * vez de confiar en el primer intento porque dos propuestas de la misma card en
 * el mismo álbum generan exactamente el mismo code base.
 */
async function buildUniqueCode(
  supabaseAdmin: any,
  parts: { albumShort: string; versionShort: string | null; member: string; categoryShort: string },
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const base = [
    slug(parts.albumShort),
    parts.versionShort ? slug(parts.versionShort) : null,
    slug(parts.member),
    slug(parts.categoryShort),
  ].filter(Boolean).join("-");

  // Se piden todos los que empiezan por el base de una vez, en vez de sondear
  // uno por uno: son pocos y así no se hacen N viajes.
  const { data, error } = await supabaseAdmin
    .from("cards")
    .select("code")
    .like("code", `${base}%`);

  if (error) return { ok: false, error: error.message };

  const taken = new Set<string>((data ?? []).map((r: any) => r.code as string));
  if (!taken.has(base)) return { ok: true, code: base };

  for (let n = 2; n <= 99; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return { ok: true, code: candidate };
  }
  return { ok: false, error: `no free code for ${base}` };
}

const protectedHandler = withSupabase({ auth: ["user"] }, async (req, ctx) => {
  const userId = ctx.userClaims?.id;
  if (!userId) {
    return Response.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  // Mismo gate que moderate-card-image: is_admin() en SQL no sirve acá porque
  // supabaseAdmin usa service_role y auth.uid() sería null.
  const { data: profile, error: profileError } = await ctx.supabaseAdmin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  if (profileError || !profile?.is_admin) {
    return Response.json({ success: false, error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = typeof body.action === "string" ? body.action : "";
  const submissionId = typeof body.submissionId === "number" ? body.submissionId : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (action !== "approve" && action !== "reject") {
    return Response.json(
      { success: false, error: 'action must be "approve" or "reject"' },
      { status: 400 },
    );
  }
  if (submissionId == null) {
    return Response.json({ success: false, error: "submissionId is required" }, { status: 400 });
  }
  // La constraint card_submissions_rejected_has_reason lo exige igual; acá se
  // valida antes para devolver un 400 legible en vez de un 500 de Postgres.
  if (action === "reject" && !reason) {
    return Response.json(
      { success: false, error: "reason is required when rejecting" },
      { status: 400 },
    );
  }

  const { data: row, error: rowError } = await ctx.supabaseAdmin
    .from("card_submissions")
    .select(
      "id, submitted_by, status, album_id, version_id, category_id, card_set_id, " +
      "member, card_name, bucket_id, storage_path, width, height, byte_size, " +
      "terms_accepted_at, terms_version",
    )
    .eq("id", submissionId)
    .maybeSingle<SubmissionRow>();

  if (rowError) {
    console.error("[moderate-card-submission] select failed:", rowError);
    return Response.json({ success: false, error: "Could not load the submission" }, { status: 500 });
  }
  if (!row) {
    return Response.json({ success: false, error: "Submission not found" }, { status: 404 });
  }
  // Hace la función idempotente de hecho: reintentar sobre algo ya resuelto
  // devuelve 409 en vez de crear una segunda card.
  if (row.status !== "pending") {
    return Response.json(
      { success: false, error: `Submission is already ${row.status}` },
      { status: 409 },
    );
  }

  const reviewedAt = new Date().toISOString();

  // ---------------------------------------------------------------- reject ---
  if (action === "reject") {
    // El objeto se conserva en el bucket privado: no es accesible públicamente,
    // y mantenerlo permite entender qué se rechazó. La retención es una decisión
    // aparte, no de esta función.
    const { error: updateError } = await ctx.supabaseAdmin
      .from("card_submissions")
      .update({
        status: "rejected",
        rejection_reason: reason,
        reviewed_by: userId,
        reviewed_at: reviewedAt,
      })
      .eq("id", row.id)
      .eq("status", "pending");

    if (updateError) {
      console.error("[moderate-card-submission] reject failed:", updateError);
      return Response.json({ success: false, error: "Could not reject the submission" }, { status: 500 });
    }

    return Response.json({ success: true, action: "reject", submissionId: row.id });
  }

  // --------------------------------------------------------------- approve ---

  // Los datos de catálogo que la card hereda. El card set es el que trae
  // retailer, país y draw type: es el nivel que describe CÓMO se distribuyó la
  // card, y copiarlos evita que la card nueva salga sin esa información
  // mientras sus hermanas del mismo set sí la tienen.
  const [album, category, version, cardSet] = await Promise.all([
    ctx.supabaseAdmin.from("albums").select("short_name, release_date").eq("id", row.album_id).maybeSingle(),
    ctx.supabaseAdmin.from("card_categories").select("short_name").eq("id", row.category_id).maybeSingle(),
    row.version_id
      ? ctx.supabaseAdmin.from("album_versions").select("short_name, name").eq("id", row.version_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.card_set_id
      ? ctx.supabaseAdmin.from("card_sets").select("retailer, country, draw_type").eq("id", row.card_set_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (!album.data || !category.data) {
    return Response.json(
      { success: false, error: "The album or category of this submission no longer exists" },
      { status: 409 },
    );
  }

  const built = await buildUniqueCode(ctx.supabaseAdmin, {
    albumShort: album.data.short_name,
    versionShort: version.data?.short_name ?? version.data?.name ?? null,
    member: row.member,
    categoryShort: category.data.short_name,
  });
  if (!built.ok) {
    console.error("[moderate-card-submission] code generation failed:", built.error);
    return Response.json({ success: false, error: "Could not generate a card code" }, { status: 500 });
  }

  // El nombre completo y el emoji del miembro no se piden en el formulario: ya
  // están en las 4503 cards del catálogo, así que se copian de una hermana. Es
  // un dato del miembro, no de la card.
  const { data: sibling } = await ctx.supabaseAdmin
    .from("cards")
    .select("member_full_name, member_emoji")
    .eq("member", row.member)
    .not("member_full_name", "is", null)
    .limit(1)
    .maybeSingle();

  // 1. La card. `is_visible` se pone en true EXPLÍCITAMENTE: la columna tiene
  //    default false, así que sin esto la card se crearía invisible y la
  //    propuesta quedaría aprobada sin que nadie viera nada nuevo.
  const { data: created, error: cardError } = await ctx.supabaseAdmin
    .from("cards")
    .insert({
      album_id: row.album_id,
      version_id: row.version_id,
      category_id: row.category_id,
      card_set_id: row.card_set_id,
      member: row.member,
      member_full_name: sibling?.member_full_name ?? null,
      member_emoji: sibling?.member_emoji ?? null,
      card_name: row.card_name,
      code: built.code,
      rarity: "Common",
      is_group: row.member === "Group",
      is_blurred: false,
      is_visible: true,
      retailer: cardSet.data?.retailer ?? null,
      country: cardSet.data?.country ?? null,
      draw_type: cardSet.data?.draw_type ?? null,
      release_date: album.data.release_date ?? null,
      // image_path se deja en null a propósito: es la ruta LEGACY, y esta card
      // no tiene legacy. Su imagen vive en card_images, que es de donde la
      // resuelve cards_full.
      image_path: null,
    })
    .select("id")
    .single();

  if (cardError || !created) {
    console.error("[moderate-card-submission] card insert failed:", cardError);
    return Response.json({ success: false, error: "Could not create the card" }, { status: 500 });
  }
  const cardId = created.id as number;

  /** Deshace lo hecho hasta el punto en que algo falló. */
  const unwind = async (steps: { publicPath?: string; cardImageId?: number }) => {
    if (steps.cardImageId) {
      await ctx.supabaseAdmin.from("card_images").delete().eq("id", steps.cardImageId);
    }
    if (steps.publicPath) {
      await ctx.supabaseAdmin.storage.from(PUBLIC_BUCKET).remove([steps.publicPath]);
    }
    // La card se borra al final: es lo único que puede tener filas colgando.
    await ctx.supabaseAdmin.from("cards").delete().eq("id", cardId);
  };

  // 2. La imagen al bucket público, bajo el prefijo de la card recién creada.
  //    Se usa download + upload y no copy({ destinationBucket }) por lo mismo
  //    que en moderate-card-image: copy entre buckets depende de la versión del
  //    SDK que resuelva Deno, y esto funciona igual en cualquiera.
  const fileName = row.storage_path.split("/").pop() ?? `${row.id}.jpg`;
  const publicPath = `${cardId}/${fileName}`;

  const { data: blob, error: downloadError } = await ctx.supabaseAdmin.storage
    .from(REVIEW_BUCKET)
    .download(row.storage_path);

  if (downloadError || !blob) {
    console.error("[moderate-card-submission] download failed:", downloadError);
    await unwind({});
    return Response.json({ success: false, error: "Could not read the submitted image" }, { status: 500 });
  }

  const { error: uploadError } = await ctx.supabaseAdmin.storage
    .from(PUBLIC_BUCKET)
    .upload(publicPath, blob, { contentType: blob.type || "image/jpeg", upsert: false });

  if (uploadError) {
    console.error("[moderate-card-submission] upload failed:", uploadError);
    await unwind({});
    return Response.json({ success: false, error: "Could not publish the image" }, { status: 500 });
  }

  // 3. El registro de la imagen. Nace ya aprobada y primaria: la propuesta
  //    entera se acaba de revisar, no tiene sentido pedir una segunda revisión
  //    de su imagen. `contributed_by` es quien propuso, no quien aprobó, que es
  //    lo que hace que la atribución (@handle) salga bien en la grilla.
  const { data: image, error: imageError } = await ctx.supabaseAdmin
    .from("card_images")
    .insert({
      card_id: cardId,
      bucket_id: PUBLIC_BUCKET,
      storage_path: publicPath,
      source_type: "community",
      status: "approved",
      is_primary: true,
      contributed_by: row.submitted_by,
      terms_accepted_at: row.terms_accepted_at,
      terms_version: row.terms_version,
      width: row.width,
      height: row.height,
      byte_size: row.byte_size,
      reviewed_by: userId,
      reviewed_at: reviewedAt,
    })
    .select("id")
    .single();

  if (imageError || !image) {
    console.error("[moderate-card-submission] card_images insert failed:", imageError);
    await unwind({ publicPath });
    return Response.json({ success: false, error: "Could not register the image" }, { status: 500 });
  }

  // 4. La propuesta. La constraint card_submissions_approved_has_card exige
  //    created_card_id, así que este paso no puede mentir sobre el resultado.
  const { error: updateError } = await ctx.supabaseAdmin
    .from("card_submissions")
    .update({
      status: "approved",
      created_card_id: cardId,
      reviewed_by: userId,
      reviewed_at: reviewedAt,
      rejection_reason: null,
    })
    .eq("id", row.id)
    .eq("status", "pending");

  if (updateError) {
    console.error("[moderate-card-submission] submission update failed:", updateError);
    await unwind({ publicPath, cardImageId: image.id as number });
    return Response.json({ success: false, error: "Could not approve the submission" }, { status: 500 });
  }

  // Último paso y best-effort a propósito: la propuesta ya apunta a la card y la
  // imagen ya está publicada, así que si esto falla sólo queda una copia extra
  // en un bucket privado que nada referencia. Fallar acá sería peor que dejar
  // el sobrante.
  const { error: removeError } = await ctx.supabaseAdmin.storage
    .from(REVIEW_BUCKET)
    .remove([row.storage_path]);
  if (removeError) {
    console.error("[moderate-card-submission] leftover in review bucket:", row.storage_path, removeError);
  }

  return Response.json({
    success: true,
    action: "approve",
    submissionId: row.id,
    cardId,
    code: built.code,
    storagePath: publicPath,
  });
});

export default {
  fetch: async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const res = await protectedHandler(req);
    const headers = new Headers(res.headers);
    for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
    return new Response(res.body, { status: res.status, headers });
  },
};
