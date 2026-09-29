import { supabase } from './supabase';
import { ReportReason } from './types';

/**
 * Reportar una imagen del catalogo (FASE G).
 *
 * Funciona sobre CUALQUIER imagen, no solo las aportadas: reportar una legacy
 * por copyright es el caso que mas importa, porque las 4503 del catalogo actual
 * son de terceros.
 *
 * El cliente no puede elegir nada sensible: la policy
 * "image_reports reporter creates own" exige en su WITH CHECK que
 * `reported_by = auth.uid()`, que el estado nazca `open`, y que los campos de
 * resolucion vengan vacios. Un cliente modificado no puede reportar en nombre de
 * otra persona ni dar su propio reporte por resuelto.
 */

export type ReportFailure =
  | 'no_session'
  | 'no_image'      // la card no tiene imagen que reportar
  | 'already'       // ya reporto esta imagen
  | 'failed';

export type ReportResult = { ok: true } | { ok: false; reason: ReportFailure; detail?: string };

/** Codigo de violacion de unico en Postgres, via PostgREST. */
const UNIQUE_VIOLATION = '23505';

export async function submitImageReport(params: {
  cardImageId: number | null;
  userId: string | null;
  reason: ReportReason;
  detail?: string;
}): Promise<ReportResult> {
  const { cardImageId, userId, reason, detail } = params;
  if (!userId) return { ok: false, reason: 'no_session' };
  if (cardImageId == null) return { ok: false, reason: 'no_image' };

  const { error } = await supabase.from('image_reports').insert({
    card_image_id: cardImageId,
    reported_by: userId,
    reason,
    detail: detail?.trim() || null,
  });

  if (error) {
    // El unique (card_image_id, reported_by) es lo que impide que una misma
    // persona reporte dos veces la misma imagen. Se traduce a un mensaje
    // entendible en vez de mostrar el error de la base.
    if ((error as any).code === UNIQUE_VIOLATION) {
      return { ok: false, reason: 'already' };
    }
    return { ok: false, reason: 'failed', detail: error.message };
  }

  return { ok: true };
}

/**
 * Los `card_images.id` que esta persona ya reporto, para no ofrecerle reportar
 * dos veces. Se apoya en la policy "image_reports reporter reads own": solo
 * devuelve sus propias filas.
 */
export async function fetchMyReportedImages(
  userId: string | null,
  cardImageIds: number[],
): Promise<Set<number>> {
  if (!userId || cardImageIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('image_reports')
    .select('card_image_id')
    .eq('reported_by', userId)
    .in('card_image_id', cardImageIds);

  if (error || !data) return new Set();
  return new Set(data.map((row: any) => row.card_image_id as number));
}
