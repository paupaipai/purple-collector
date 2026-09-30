import * as ImagePicker from 'expo-image-picker';

import {
  COMMUNITY_REVIEW_BUCKET,
  CONTRIBUTION_TERMS_VERSION,
} from './constants';
import { ContributionFailure, CropRect, uploadReviewImage } from './contributions';
import { supabase } from './supabase';
import { CardSubmission } from './types';

/**
 * Proponer una card que NO esta en el catalogo.
 *
 * Es el hermano de submitContribution(): ahi se aporta una imagen para una card
 * que ya existe, aca se aporta la card entera. La diferencia no es de grado,
 * es de tabla: `card_images.card_id` es NOT NULL, asi que una card que todavia
 * no existe no cabe ahi y vive en `card_submissions` hasta que se apruebe.
 *
 * Igual que en el otro flujo, el cliente no decide nada sensible: la policy
 * "card_submissions submitter creates own" exige en su WITH CHECK que el estado
 * nazca `pending`, que la imagen este en el bucket privado, que la autoria sea
 * la propia y que los campos de revision vengan vacios.
 */

/** Motivos de rechazo de una propuesta. Van a rejection_reason. */
export type SubmissionRejectReason =
  | 'already_exists'   // la card ya esta en el catalogo
  | 'wrong_taxonomy'   // album, set o categoria equivocados
  | 'low_quality'
  | 'no_rights'
  | 'not_a_photocard';

export type SubmissionFailure =
  | ContributionFailure
  | 'duplicate'        // ya tiene una propuesta igual esperando
  | 'incomplete';      // falta un campo obligatorio

export type SubmissionResult =
  | { ok: true; id: number }
  | { ok: false; reason: SubmissionFailure; detail?: string };

/** Lo que el formulario junta antes de enviar. */
export interface NewCardDraft {
  albumId: number | null;
  versionId: number | null;
  categoryId: number | null;
  cardSetId: number | null;
  member: string | null;
  cardName: string;
  notes: string;
}

/**
 * Motivo de rechazo -> clave de i18n.
 *
 * `rejection_reason` guarda el valor del enum tal cual ('wrong_card'), porque
 * es lo que se puede consultar y agrupar despues. Pero eso es un dato interno:
 * a quien aporto hay que decirle "No corresponde a la card", no el token. Sin
 * esta traduccion la pantalla de aportes le enseñaba literalmente `wrong_card`.
 *
 * Devuelve null cuando no lo reconoce, y ahi se muestra el texto tal cual: los
 * retiros por reporte escriben un motivo libre, que ya es una frase.
 */
export function rejectionReasonKey(reason: string | null): string | null {
  if (!reason) return null;
  const known: Record<string, string> = {
    // aportaciones de imagen
    wrong_card: 'rejectWrongCard',
    low_quality: 'rejectLowQuality',
    no_rights: 'rejectNoRights',
    duplicate: 'rejectDuplicate',
    // propuestas de card nueva
    already_exists: 'submissionRejectExists',
    wrong_taxonomy: 'submissionRejectTaxonomy',
    not_a_photocard: 'submissionRejectNotPhotocard',
    // retiros que vienen de un reporte
    copyright: 'reportCopyright',
    inappropriate: 'reportInappropriate',
  };
  return known[reason] ?? null;
}

/** Codigo de violacion de unico en Postgres, via PostgREST. */
const UNIQUE_VIOLATION = '23505';

/**
 * Los campos sin los que no se puede enviar.
 *
 * Se comprueba aca y no solo en el boton para que el mismo criterio valga si
 * algun dia se envia desde otro sitio. Version y card set quedan fuera a
 * proposito: hay albums que no tienen ninguna de las dos cosas.
 */
export function isDraftComplete(draft: NewCardDraft): boolean {
  return (
    draft.albumId != null &&
    draft.categoryId != null &&
    !!draft.member &&
    draft.cardName.trim().length >= 2
  );
}

export async function submitNewCard(params: {
  userId: string | null;
  draft: NewCardDraft;
  asset: ImagePicker.ImagePickerAsset;
  /** Encuadre elegido en ImageCropper. Sin el se recorta al centro. */
  crop?: CropRect;
}): Promise<SubmissionResult> {
  const { userId, draft, asset, crop } = params;
  if (!userId) return { ok: false, reason: 'no_session' };
  if (!isDraftComplete(draft)) return { ok: false, reason: 'incomplete' };

  // La imagen se sube en la subcarpeta 'cards' para poder distinguir en el
  // bucket una propuesta de card nueva de un aporte a una card existente.
  const uploaded = await uploadReviewImage({ userId, asset, crop, folder: 'cards' });
  if (!uploaded.ok) return uploaded;

  const { data, error } = await supabase
    .from('card_submissions')
    .insert({
      submitted_by: userId,
      album_id: draft.albumId,
      version_id: draft.versionId,
      category_id: draft.categoryId,
      card_set_id: draft.cardSetId,
      member: draft.member,
      card_name: draft.cardName.trim(),
      notes: draft.notes.trim() || null,
      bucket_id: COMMUNITY_REVIEW_BUCKET,
      storage_path: uploaded.storagePath,
      width: uploaded.width,
      height: uploaded.height,
      byte_size: uploaded.byteSize,
      terms_accepted_at: new Date().toISOString(),
      terms_version: CONTRIBUTION_TERMS_VERSION,
      // era_id y collection_type_id NO se mandan: los deriva el trigger del
      // album, para que no pueda entrar una fila incoherente.
    })
    .select('id')
    .single();

  if (error) {
    // El objeto ya subio pero la fila no entro: sin esta limpieza quedaria un
    // huerfano en el bucket que nada referencia. La policy
    // "community review delete own or admin" permite borrar lo propio.
    await supabase.storage.from(COMMUNITY_REVIEW_BUCKET).remove([uploaded.storagePath]);

    // El indice card_submissions_no_dup_pending es lo que impide mandar dos
    // veces la misma card mientras la primera espera revision.
    if ((error as any).code === UNIQUE_VIOLATION) {
      return { ok: false, reason: 'duplicate' };
    }
    return { ok: false, reason: 'insert_failed', detail: error.message };
  }

  return { ok: true, id: data.id as number };
}

/**
 * Las propuestas de esta persona, para poder ver en que quedaron.
 *
 * Se apoya en "card_submissions submitter reads own": devuelve solo sus filas,
 * sin filtro del cliente de por medio.
 */
export async function fetchMySubmissions(
  userId: string | null,
): Promise<CardSubmission[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('card_submissions')
    .select('*')
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as CardSubmission[];
}

/** Cuantas propuestas propias estan esperando revision. */
export async function countMyPendingSubmissions(userId: string | null): Promise<number> {
  if (!userId) return 0;

  const { count, error } = await supabase
    .from('card_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_by', userId)
    .eq('status', 'pending');

  if (error) return 0;
  return count ?? 0;
}

/**
 * Retirar una propuesta propia antes de que la revisen.
 *
 * Borra la fila y el objeto. El orden importa: primero la fila, porque si
 * fallara el borrado del objeto quedaria un huerfano invisible en un bucket
 * privado, mientras que al reves quedaria una propuesta apuntando a una imagen
 * que ya no existe y la bandeja mostraria un hueco.
 */
export async function withdrawSubmission(params: {
  id: number;
  storagePath: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('card_submissions')
    .delete()
    .eq('id', params.id)
    .eq('status', 'pending');

  if (error) return { ok: false, error: error.message };

  await supabase.storage.from(COMMUNITY_REVIEW_BUCKET).remove([params.storagePath]);
  return { ok: true };
}
