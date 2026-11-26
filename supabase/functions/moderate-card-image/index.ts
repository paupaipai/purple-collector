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
 *   POST { action: "approve",  cardImageId: number, mode?: "new" | "replace", note?: string }
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
  side: "front" | "back";
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
    .upload(toPath, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: false,
      // El nombre es unico y el archivo nunca cambia: cache de 1 año. Con el
      // de 1 hora por defecto, cada visitante volvia a bajarla cada hora.
      cacheControl: "31536000",
    });

  if (uploadError) {
    return { ok: false, error: `upload failed: ${uploadError.message}` };
  }

  return { ok: true };
}

/**
 * Push a quien aportó la imagen reemplazada, a todos sus dispositivos. Es el
 * mismo canal (Expo) que send-notification, pero dirigido a una persona.
 */
async function notifyReplaced(admin: any, userId: string, cardId: number, lostPoints: boolean) {
  const { data: rows, error } = await admin.from("push_tokens").select("token").eq("user_id", userId);
  if (error) {
    console.error("[moderate-card-image] push_tokens select failed:", error);
    return;
  }
  const tokens = Array.from(new Set((rows ?? []).map((r: { token: string }) => r.token))).filter(Boolean);
  if (tokens.length === 0) return;
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(tokens.map((to) => ({
      to,
      title: "Tu aporte fue reemplazado",
      body: lostPoints
        ? "Tu aporte ha sido reemplazado por una imagen de mejor calidad. Los 0,5 puntos correspondientes se han reasignado a la nueva contribución. ¡Gracias por ayudarnos a mejorar nuestro catálogo! 💜"
        : "Tu aporte ha sido reemplazado por una imagen de mejor calidad. ¡Gracias por ayudarnos a mejorar nuestro catálogo! 💜",
      data: { type: "contribution_replaced", cardId, url: "/my-contributions" },
      sound: "default",
    }))),
  }).catch((e) => {
    console.error("[moderate-card-image] push failed:", e);
    return null;
  });
  if (res && !res.ok) console.error("[moderate-card-image] push failed:", res.status, await res.text().catch(() => ""));
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
  const mode = body.mode === "new" || body.mode === "replace" ? body.mode : "auto";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

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
    .select("id, card_id, bucket_id, storage_path, source_type, status, contributed_by, side")
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

  // Bajar la primaria anterior del mismo lado y subir esta se hace en UNA
  // transacción, con la fila bloqueada (moderate_approve_image). Antes eran dos
  // updates sueltos: con un doble clic en el mantenedor, la segunda llamada
  // bajaba la imagen que la primera acababa de aprobar y el lado quedaba vacío
  // (pasó en la card 2186). Ahora la segunda sale con already_moderated.
  //
  // mode: "new" (el lado no tiene imagen community vigente), "replace"
  // (reemplazo por calidad: los 0,5 pasan a esta) o, si no viene, "auto" para
  // el mantenedor viejo: reemplaza si hay vigente, como antes.
  const { data: approved, error: approveError } = await ctx.supabaseAdmin
    .rpc("moderate_approve_image", {
      p_image_id: row.id,
      p_mode: mode,
      p_bucket: PUBLIC_BUCKET,
      p_path: publicPath,
      p_actor: userId,
      p_note: note || null,
    })
    .single<{ approved_id: number; replaced_id: number | null; replaced_user: string | null; replaced_was_scoring: boolean; mode: string }>();

  if (approveError || !approved) {
    // La fila no cambió: se deshace la copia pública y no queda nada servido.
    await ctx.supabaseAdmin.storage.from(PUBLIC_BUCKET).remove([publicPath]);
    const message = approveError?.message ?? "";
    const known = ["already_moderated", "side_has_image", "side_empty"].find((code) => message.includes(code));
    if (known) {
      return Response.json({ success: false, error: known }, { status: 409 });
    }
    console.error("[moderate-card-image] approve failed:", approveError);
    return Response.json({ success: false, error: "Could not approve the image" }, { status: 500 });
  }

  // Aviso a quien perdió el lado por un reemplazo de calidad. No a quien
  // mejoró su propia imagen: no perdió nada. Best-effort: la aprobación ya está.
  if (approved.replaced_user && approved.replaced_user !== row.contributed_by) {
    await notifyReplaced(ctx.supabaseAdmin, approved.replaced_user, row.card_id, approved.replaced_was_scoring);
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
    mode: approved.mode,
    replacedImageId: approved.replaced_id,
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
