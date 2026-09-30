import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

/**
 * Moderación de aportaciones de imagen (FASE G).
 *
 * Es la pieza que faltaba para cerrar el circuito del catálogo comunitario.
 * Aprobar no es solo cambiar un estado: la imagen vive en un bucket PRIVADO
 * mientras está pendiente, así que hay que MOVERLA al bucket público. Eso no se
 * puede hacer desde el cliente ni desde el dashboard con comodidad, y es la
 * razón por la que CONTRIBUTIONS_ENABLED estaba apagado.
 *
 *   POST { action: "approve",  cardImageId: number }
 *   POST { action: "reject",   cardImageId: number, reason: string }
 *   POST { action: "takedown", cardImageId: number, reason: string, reportId?: number }
 */

const REVIEW_BUCKET = "photocard-community-review";
const PUBLIC_BUCKET = "photocard-community";

// El panel de moderación es web, igual que el de notificaciones, así que
// necesita CORS real (preflight + headers en la respuesta).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CardImageRow = {
  id: number;
  card_id: number;
  bucket_id: string;
  storage_path: string;
  source_type: string;
  status: string;
  contributed_by: string | null;
};

/**
 * Mueve el objeto entre buckets: descarga, sube al destino, y solo borra el
 * origen cuando la fila ya apunta al destino.
 *
 * Se usa download + upload en vez de storage.copy({ destinationBucket }) a
 * propósito: copy entre buckets depende de la versión del SDK que resuelva Deno,
 * y esto funciona igual en cualquiera. Las imágenes están limitadas a 5 MiB por
 * el bucket, así que pasar los bytes por la función es asumible.
 */
async function copyToPublicBucket(
  storage: any,
  fromPath: string,
  toPath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: blob, error: downloadError } = await storage
    .from(REVIEW_BUCKET)
    .download(fromPath);

  if (downloadError || !blob) {
    return { ok: false, error: `download failed: ${downloadError?.message ?? "empty body"}` };
  }

  const { error: uploadError } = await storage
    .from(PUBLIC_BUCKET)
    .upload(toPath, blob, { contentType: blob.type || "image/jpeg", upsert: false });

  if (uploadError) {
    return { ok: false, error: `upload failed: ${uploadError.message}` };
  }

  return { ok: true };
}

const protectedHandler = withSupabase({ auth: ["user"] }, async (req, ctx) => {
  const userId = ctx.userClaims?.id;
  if (!userId) {
    return Response.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  // Mismo gate que send-notification. is_admin() en SQL no sirve acá porque
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
  const cardImageId = typeof body.cardImageId === "number" ? body.cardImageId : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reportId = typeof body.reportId === "number" ? body.reportId : null;

  if (action !== "approve" && action !== "reject" && action !== "takedown") {
    return Response.json(
      { success: false, error: 'action must be "approve", "reject" or "takedown"' },
      { status: 400 },
    );
  }
  if (cardImageId == null) {
    return Response.json({ success: false, error: "cardImageId is required" }, { status: 400 });
  }
  // La constraint card_images_rejected_has_reason lo exige de todos modos; acá
  // se valida antes para devolver un 400 legible en vez de un 500 de Postgres.
  if ((action === "reject" || action === "takedown") && !reason) {
    return Response.json(
      { success: false, error: `reason is required when ${action}ing` },
      { status: 400 },
    );
  }

  const { data: row, error: rowError } = await ctx.supabaseAdmin
    .from("card_images")
    .select("id, card_id, bucket_id, storage_path, source_type, status, contributed_by")
    .eq("id", cardImageId)
    .maybeSingle<CardImageRow>();

  if (rowError) {
    console.error("[moderate-card-image] card_images select failed:", rowError);
    return Response.json({ success: false, error: "Could not load the image" }, { status: 500 });
  }
  if (!row) {
    return Response.json({ success: false, error: "Image not found" }, { status: 404 });
  }

  const reviewedAt = new Date().toISOString();

  // --------------------------------------------------------------- takedown ---
  // Retirar una imagen YA PUBLICADA. Es la única acción que aplica también a las
  // legacy, y por eso existe: el 99,98% del catálogo lo es, y un reclamo de
  // copyright sin forma de retirar es un buzón sin salida (tarea 37).
  if (action === "takedown") {
    if (row.status !== "approved") {
      return Response.json(
        { success: false, error: `Only an approved image can be taken down (got ${row.status})` },
        { status: 409 },
      );
    }

    // ORDEN INVERSO al de approve, y a propósito: acá lo que oculta la imagen es
    // el cambio en la base, así que va PRIMERO. Si el borrado del objeto fallara
    // después, la imagen ya no se muestra y sólo queda un huérfano. Al revés, un
    // borrado exitoso con la base sin actualizar dejaría la app pidiendo un
    // objeto que ya no existe.
    if (row.source_type === "legacy") {
      // La fila legacy se conserva como rastro de que existió: la constraint
      // card_images_legacy_is_approved no deja marcarla 'rejected', así que se
      // le quita is_primary, que es lo que la vista mira.
      const { error: imageError } = await ctx.supabaseAdmin
        .from("card_images")
        .update({
          is_primary: false,
          reviewed_by: userId,
          reviewed_at: reviewedAt,
          // Marca explícita: la app la usa para mostrar "Imagen retirada" en vez
          // de "Sin imagen". No se puede deducir de is_primary, porque una
          // aportación rechazada también lo pierde y eso no es un retiro.
          taken_down_at: reviewedAt,
        })
        .eq("id", row.id);

      if (imageError) {
        console.error("[moderate-card-image] legacy takedown update failed:", imageError);
        return Response.json({ success: false, error: "Could not take down the image" }, { status: 500 });
      }

      // EXCEPCIÓN DOCUMENTADA A LA DECISIÓN D1: se vacía cards.image_path.
      // Sin esto la imagen seguiría visible, porque getCardImageUrl() cae de
      // vuelta a esa columna y la Android v1 la lee directamente. El filtro por
      // storage_path evita pisar la columna si ya apunta a otra cosa.
      const { error: cardError } = await ctx.supabaseAdmin
        .from("cards")
        .update({ image_path: null })
        .eq("id", row.card_id)
        .eq("image_path", row.storage_path);

      if (cardError) {
        console.error("[moderate-card-image] cards.image_path clear failed:", cardError);
        return Response.json({ success: false, error: "Could not take down the image" }, { status: 500 });
      }
    } else {
      const { error: imageError } = await ctx.supabaseAdmin
        .from("card_images")
        .update({
          status: "rejected",
          rejection_reason: reason,
          is_primary: false,
          reviewed_by: userId,
          reviewed_at: reviewedAt,
          taken_down_at: reviewedAt,
        })
        .eq("id", row.id);

      if (imageError) {
        console.error("[moderate-card-image] community takedown update failed:", imageError);
        return Response.json({ success: false, error: "Could not take down the image" }, { status: 500 });
      }
    }

    // Ahora sí el objeto. Best-effort: la imagen ya está oculta.
    const { error: removeError } = await ctx.supabaseAdmin.storage
      .from(row.bucket_id)
      .remove([row.storage_path]);
    if (removeError) {
      console.error("[moderate-card-image] leftover after takedown:", row.storage_path, removeError);
    }

    // Si el takedown vino de un reporte, se cierra con el resultado correcto.
    if (reportId != null) {
      const { error: reportError } = await ctx.supabaseAdmin
        .from("image_reports")
        .update({
          status: "resolved_removed",
          resolved_by: userId,
          resolved_at: reviewedAt,
          resolution_note: reason,
        })
        .eq("id", reportId)
        .eq("status", "open");
      if (reportError) {
        console.error("[moderate-card-image] report close failed:", reportError);
      }
    }

    return Response.json({
      success: true,
      action: "takedown",
      cardImageId: row.id,
      cardId: row.card_id,
      sourceType: row.source_type,
    });
  }

  // De acá en adelante sólo se moderan aportaciones pendientes. Esto hace la
  // función idempotente de hecho: reintentar sobre algo ya resuelto devuelve 409
  // en vez de mover el objeto por segunda vez o pisar quién la revisó.
  if (row.source_type !== "community") {
    return Response.json(
      { success: false, error: `Only community images can be moderated (got ${row.source_type})` },
      { status: 409 },
    );
  }
  if (row.status !== "pending") {
    return Response.json(
      { success: false, error: `Image is already ${row.status}` },
      { status: 409 },
    );
  }

  // ---------------------------------------------------------------- reject ---
  if (action === "reject") {
    // El objeto se conserva en el bucket privado: no es accesible públicamente,
    // y mantenerlo permite que el contributor entienda qué se rechazó. La
    // retención/limpieza es una decisión aparte, no de esta función.
    const { error: updateError } = await ctx.supabaseAdmin
      .from("card_images")
      .update({
        status: "rejected",
        rejection_reason: reason,
        reviewed_by: userId,
        reviewed_at: reviewedAt,
        is_primary: false,
      })
      .eq("id", row.id)
      .eq("status", "pending");

    if (updateError) {
      console.error("[moderate-card-image] reject update failed:", updateError);
      return Response.json({ success: false, error: "Could not reject the image" }, { status: 500 });
    }

    return Response.json({ success: true, action: "reject", cardImageId: row.id });
  }

  // --------------------------------------------------------------- approve ---
  // La ruta en el bucket público se organiza por card, no por usuario: ahí ya no
  // importa quién la subió (eso vive en contributed_by) sino a qué card
  // pertenece, y así el takedown de una card es un prefijo.
  const fileName = row.storage_path.split("/").pop() ?? `${row.id}.jpg`;
  const publicPath = `${row.card_id}/${fileName}`;

  const copied = await copyToPublicBucket(ctx.supabaseAdmin.storage, row.storage_path, publicPath);
  if (!copied.ok) {
    console.error("[moderate-card-image] copy to public bucket failed:", copied.error);
    return Response.json(
      { success: false, error: "Could not move the image to the public bucket" },
      { status: 500 },
    );
  }

  // La primaria es única por (card_id, source_type) entre las aprobadas, así que
  // hay que bajar la community primaria anterior ANTES de subir esta. La legacy
  // no se toca: es otro source_type y sigue siendo el fallback.
  const { error: demoteError } = await ctx.supabaseAdmin
    .from("card_images")
    .update({ is_primary: false })
    .eq("card_id", row.card_id)
    .eq("source_type", "community")
    .eq("status", "approved")
    .eq("is_primary", true);

  if (demoteError) {
    console.error("[moderate-card-image] demote previous primary failed:", demoteError);
    await ctx.supabaseAdmin.storage.from(PUBLIC_BUCKET).remove([publicPath]);
    return Response.json({ success: false, error: "Could not approve the image" }, { status: 500 });
  }

  const { error: updateError } = await ctx.supabaseAdmin
    .from("card_images")
    .update({
      status: "approved",
      bucket_id: PUBLIC_BUCKET,
      storage_path: publicPath,
      is_primary: true,
      reviewed_by: userId,
      reviewed_at: reviewedAt,
      rejection_reason: null,
    })
    .eq("id", row.id)
    .eq("status", "pending");

  if (updateError) {
    // La fila sigue apuntando al bucket privado, así que el estado es coherente:
    // se deshace la copia pública y no queda nada servido por error.
    console.error("[moderate-card-image] approve update failed:", updateError);
    await ctx.supabaseAdmin.storage.from(PUBLIC_BUCKET).remove([publicPath]);
    return Response.json({ success: false, error: "Could not approve the image" }, { status: 500 });
  }

  // Último paso y best-effort a propósito: la fila ya apunta al bucket público,
  // así que si esto falla sólo queda una copia extra en el bucket privado, que no
  // es accesible y nada referencia. Fallar acá sería peor que dejar el sobrante.
  const { error: removeError } = await ctx.supabaseAdmin.storage
    .from(REVIEW_BUCKET)
    .remove([row.storage_path]);
  if (removeError) {
    console.error("[moderate-card-image] leftover in review bucket:", row.storage_path, removeError);
  }

  return Response.json({
    success: true,
    action: "approve",
    cardImageId: row.id,
    cardId: row.card_id,
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
