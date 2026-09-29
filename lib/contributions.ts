import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';

import {
  CONTRIBUTION_MAX_BYTES,
  CONTRIBUTION_MIME_TYPES,
  CONTRIBUTION_TERMS_VERSION,
  COMMUNITY_REVIEW_BUCKET,
} from './constants';
import { supabase } from './supabase';

/**
 * Flujo de aporte de una imagen a una card (FASE D).
 *
 * El envio siempre nace como `community` + `pending` en el bucket PRIVADO de
 * revision. Nada de eso es decision del cliente: la policy
 * "card_images contributor submits own" lo exige en su WITH CHECK, asi que un
 * cliente modificado que intente marcarse `approved`, `is_primary` o escribir
 * en el bucket publico es rechazado por la base.
 *
 * La ruta es `<auth.uid()>/<uuid>.<ext>`, que es lo que espera la policy de
 * Storage "community review insert own": deriva la propiedad del primer
 * segmento del path, sin join.
 */

export type ContributionFailure =
  | 'cancelled'      // el usuario cerro el selector
  | 'permission'     // no dio permiso de galeria
  | 'too_large'      // supera CONTRIBUTION_MAX_BYTES
  | 'bad_type'       // mime fuera de la whitelist
  | 'no_session'     // sin userId
  | 'upload_failed'  // fallo la subida a Storage
  | 'insert_failed'; // fallo el registro en card_images

export type ContributionResult =
  | { ok: true; storagePath: string }
  | { ok: false; reason: ContributionFailure; detail?: string };

/** Extension a partir del mime, para no confiar en el nombre del archivo. */
function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Abre la galeria y devuelve el asset elegido, ya validado contra los limites
 * del bucket. Se valida ANTES de subir para dar un error legible en vez de un
 * 400 del storage.
 */
export async function pickContributionImage(): Promise<
  { ok: true; asset: ImagePicker.ImagePickerAsset } | { ok: false; reason: ContributionFailure }
> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { ok: false, reason: 'permission' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    // Las photocards son 55x85mm, o sea 2:3. Encuadrar aca evita que la grilla
    // recorte la imagen despues.
    aspect: [2, 3],
    quality: 0.9,
    exif: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return { ok: false, reason: 'cancelled' };
  }

  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? '';

  if (!CONTRIBUTION_MIME_TYPES.includes(mimeType)) {
    return { ok: false, reason: 'bad_type' };
  }
  if (asset.fileSize != null && asset.fileSize > CONTRIBUTION_MAX_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  return { ok: true, asset };
}

/**
 * Sube el asset y registra la aportacion.
 *
 * `acceptedTerms` no es decorativo: la constraint
 * card_images_community_has_terms rechaza la fila sin `terms_accepted_at` y
 * `terms_version`, asi que no hay forma de registrar un aporte sin dejar
 * constancia de que se aceptaron los terminos.
 */
export async function submitContribution(params: {
  cardId: number;
  userId: string | null;
  asset: ImagePicker.ImagePickerAsset;
}): Promise<ContributionResult> {
  const { cardId, userId, asset } = params;
  if (!userId) return { ok: false, reason: 'no_session' };

  const mimeType = asset.mimeType ?? 'image/jpeg';
  const storagePath = `${userId}/${Crypto.randomUUID()}.${extensionFor(mimeType)}`;

  // En React Native no hay Blob util para el SDK de storage; el camino fiable
  // es leer el file:// como ArrayBuffer.
  let body: ArrayBuffer;
  try {
    const response = await fetch(asset.uri);
    body = await response.arrayBuffer();
  } catch (err: any) {
    return { ok: false, reason: 'upload_failed', detail: String(err?.message ?? err) };
  }

  const { error: uploadError } = await supabase.storage
    .from(COMMUNITY_REVIEW_BUCKET)
    .upload(storagePath, body, { contentType: mimeType, upsert: false });

  if (uploadError) {
    return { ok: false, reason: 'upload_failed', detail: uploadError.message };
  }

  const { error: insertError } = await supabase.from('card_images').insert({
    card_id: cardId,
    bucket_id: COMMUNITY_REVIEW_BUCKET,
    storage_path: storagePath,
    source_type: 'community',
    status: 'pending',
    is_primary: false,
    contributed_by: userId,
    terms_accepted_at: new Date().toISOString(),
    terms_version: CONTRIBUTION_TERMS_VERSION,
    width: asset.width ?? null,
    height: asset.height ?? null,
    byte_size: asset.fileSize ?? null,
  });

  if (insertError) {
    // El objeto ya subio pero la fila no entro. Sin esto quedaria un huerfano
    // en el bucket que nada referencia -- exactamente los 33 que la auditoria
    // encontro en `photocards`. La policy de DELETE del bucket de revision
    // permite al autor borrar lo propio, asi que esta limpieza si es posible.
    await supabase.storage.from(COMMUNITY_REVIEW_BUCKET).remove([storagePath]);
    return { ok: false, reason: 'insert_failed', detail: insertError.message };
  }

  return { ok: true, storagePath };
}

/**
 * Los card_id del usuario que tienen una aportacion propia sin resolver.
 *
 * La policy "card_images contributor reads own" es la que hace esto posible sin
 * exponer nada: solo devuelve las filas de quien consulta.
 */
export async function fetchMyPendingContributions(
  userId: string | null,
  cardIds: number[],
): Promise<Set<number>> {
  if (!userId || cardIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('card_images')
    .select('card_id')
    .eq('contributed_by', userId)
    .eq('status', 'pending')
    .in('card_id', cardIds);

  if (error || !data) return new Set();
  return new Set(data.map((row: any) => row.card_id as number));
}
