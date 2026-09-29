import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

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
  | 'unavailable'    // el modulo nativo no esta en este build
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

/** Proporcion real de una photocard: 55x85mm. */
const PHOTOCARD_ASPECT = 2 / 3;
/** Techo de ancho. Las legacy del catalogo rondan los 160px, asi que sobra. */
const MAX_WIDTH = 1000;

/**
 * Deja la imagen en 2:3 exacto y a un tamano razonable.
 *
 * Hace falta porque `allowsEditing` del picker NO es consistente entre
 * plataformas: la opcion `aspect` solo la respeta Android; iOS ignora el aspect
 * y fuerza un recorte CUADRADO; y en web no hay recorte en absoluto. Confiar en
 * ella producia catalogos distintos segun el dispositivo -- el primer aporte de
 * prueba entro en 158x162, casi cuadrado.
 *
 * Asi que el encuadre se decide en codigo: se toma el mayor rectangulo 2:3
 * CENTRADO que quepa en la imagen. En Android el usuario ya recorto a 2:3, asi
 * que esto no le quita nada; en iOS y web corrige lo que el picker no hizo.
 *
 * El formato se conserva: un PNG sigue siendo PNG. Pasarlo todo a JPEG seria
 * mas liviano, pero aplastaria la transparencia de un recorte con fondo
 * transparente.
 */
async function normalizeToPhotocard(
  asset: ImagePicker.ImagePickerAsset,
  mimeType: string,
): Promise<{ uri: string; width: number; height: number } | null> {
  const w = asset.width;
  const h = asset.height;
  if (!w || !h) return null;

  let cropW = w;
  let cropH = Math.round(w / PHOTOCARD_ASPECT);
  if (cropH > h) {
    cropH = h;
    cropW = Math.round(h * PHOTOCARD_ASPECT);
  }

  const context = ImageManipulator.manipulate(asset.uri).crop({
    originX: Math.round((w - cropW) / 2),
    originY: Math.round((h - cropH) / 2),
    width: cropW,
    height: cropH,
  });

  if (cropW > MAX_WIDTH) context.resize({ width: MAX_WIDTH });

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.85,
    format: mimeType === 'image/png' ? SaveFormat.PNG : SaveFormat.JPEG,
  });

  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/**
 * Abre la galeria y devuelve el asset elegido, ya validado contra los limites
 * del bucket. Se valida ANTES de subir para dar un error legible en vez de un
 * 400 del storage.
 */
export async function pickContributionImage(): Promise<
  { ok: true; asset: ImagePicker.ImagePickerAsset } | { ok: false; reason: ContributionFailure }
> {
  // expo-image-picker es un modulo nativo: en un dev client o un build anterior
  // a su instalacion no existe, y llamarlo lanza. Sin este guard, tocar
  // "Aportar imagen" reventaria la pantalla en vez de dar un aviso.
  let result: ImagePicker.ImagePickerResult;
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { ok: false, reason: 'permission' };

    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Solo Android respeta `aspect`, asi que el cropper nativo solo se ofrece
      // ahi. En iOS forzaria un recorte cuadrado y en web no hace nada; en esas
      // dos el encuadre lo resuelve normalizeToPhotocard().
      allowsEditing: Platform.OS === 'android',
      aspect: [2, 3],
      quality: 0.9,
      exif: false,
    });
  } catch (err) {
    console.error('[contributions] image picker unavailable:', err);
    return { ok: false, reason: 'unavailable' };
  }

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { ok: false, reason: 'cancelled' };
  }

  // Ni el tamano ni el mime del original se validan aca: normalizeToPhotocard()
  // recorta, reescala y reencoda, asi que lo que importa es el archivo
  // RESULTANTE. Validar el original rechazaria una foto de movil de 8 MP que
  // normalizada pesa 200 kB.
  return { ok: true, asset: result.assets[0] };
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

  const sourceMime = asset.mimeType ?? 'image/jpeg';

  // Si el normalizado falla se sube el original: es mejor un aporte con mal
  // encuadre --que el moderador puede rechazar-- que perderlo entero.
  let normalized: { uri: string; width: number; height: number } | null = null;
  try {
    normalized = await normalizeToPhotocard(asset, sourceMime);
  } catch (err) {
    console.error('[contributions] no se pudo normalizar el encuadre:', err);
  }

  // El mime tiene que describir el archivo que se sube, no el que se eligio:
  // normalizeToPhotocard() siempre devuelve PNG o JPEG, asi que un HEIC del
  // carrete llega al bucket como JPEG. Subirlo con el mime original lo haria
  // rechazar por la whitelist.
  const finalMime = normalized
    ? (sourceMime === 'image/png' ? 'image/png' : 'image/jpeg')
    : sourceMime;

  // Solo hace falta comprobar la whitelist en el camino de respaldo: lo que sale
  // del normalizador siempre es png o jpeg.
  if (!normalized && !CONTRIBUTION_MIME_TYPES.includes(finalMime)) {
    return { ok: false, reason: 'bad_type' };
  }

  const finalUri = normalized?.uri ?? asset.uri;
  const finalWidth = normalized?.width ?? asset.width ?? null;
  const finalHeight = normalized?.height ?? asset.height ?? null;
  const storagePath = `${userId}/${Crypto.randomUUID()}.${extensionFor(finalMime)}`;

  // En React Native no hay Blob util para el SDK de storage; el camino fiable
  // es leer el file:// como ArrayBuffer.
  let body: ArrayBuffer;
  try {
    const response = await fetch(finalUri);
    body = await response.arrayBuffer();
  } catch (err: any) {
    return { ok: false, reason: 'upload_failed', detail: String(err?.message ?? err) };
  }

  // Ahora si: el limite del bucket se comprueba sobre los bytes reales, justo
  // antes de mandarlos, para dar un error legible en vez de un 400 del storage.
  if (body.byteLength > CONTRIBUTION_MAX_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  const { error: uploadError } = await supabase.storage
    .from(COMMUNITY_REVIEW_BUCKET)
    .upload(storagePath, body, { contentType: finalMime, upsert: false });

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
    width: finalWidth,
    height: finalHeight,
    // El tamano del asset original ya no aplica tras recortar y reescalar; el
    // real es el del buffer que se acaba de subir.
    byte_size: body.byteLength,
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
