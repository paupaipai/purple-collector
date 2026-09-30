import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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
  | 'unavailable'    // el modulo nativo no esta en este build
  | 'read_failed'    // se eligio una foto pero no se pudo leer
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

/** Rectangulo de recorte en pixeles de la imagen original. */
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * Deja la imagen en 2:3 exacto y a un tamano razonable.
 *
 * El encuadre lo elige la persona en ImageCropper y llega aqui como `crop`. Si
 * no llega --por ejemplo si algo fallo antes-- se cae al mayor rectangulo 2:3
 * CENTRADO, que al menos garantiza la proporcion.
 *
 * El encuadre NO puede delegarse en `allowsEditing` del picker: `aspect` solo lo
 * respeta Android, iOS lo ignora y fuerza un recorte cuadrado, y web no recorta.
 * El primer aporte de prueba entro en 158x162 por eso.
 *
 * El formato se conserva: un PNG sigue siendo PNG. Pasarlo todo a JPEG seria
 * mas liviano, pero aplastaria la transparencia de un recorte con fondo
 * transparente.
 */
export async function normalizeToPhotocard(
  asset: ImagePicker.ImagePickerAsset,
  mimeType: string,
  crop?: CropRect,
): Promise<{ uri: string; width: number; height: number } | null> {
  const w = asset.width;
  const h = asset.height;
  if (!w || !h) return null;

  let rect = crop;
  if (!rect) {
    let cropW = w;
    let cropH = Math.round(w / PHOTOCARD_ASPECT);
    if (cropH > h) {
      cropH = h;
      cropW = Math.round(h * PHOTOCARD_ASPECT);
    }
    rect = {
      originX: Math.round((w - cropW) / 2),
      originY: Math.round((h - cropH) / 2),
      width: cropW,
      height: cropH,
    };
  }

  const cropW = rect.width;
  const context = ImageManipulator.manipulate(asset.uri).crop(rect);

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
  //
  // Pedir el permiso sirve ademas para SABER si el modulo esta: si esta llamada
  // pasa, el modulo existe, y cualquier fallo posterior es de la foto elegida,
  // no del build. Sin esa distincion todo error acababa diciendo "actualiza la
  // app", que manda a la persona a hacer algo que no arregla nada.
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { ok: false, reason: 'permission' };
  } catch (err) {
    console.error('[contributions] image picker unavailable:', err);
    return { ok: false, reason: 'unavailable' };
  }

  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Sin el cropper nativo: se comporta distinto en cada plataforma. El
      // encuadre lo elige la persona en ImageCropper, que es igual en las tres.
      allowsEditing: false,
      quality: 0.9,
      exif: false,
      // "Cannot load representation of type public.jpeg": con el modo por
      // defecto, PHPicker intenta entregar la representacion ACTUAL del asset y
      // falla si no puede producir un jpeg a partir de ella. `compatible` le
      // pide la representacion mas compatible, transcodificando si hace falta.
      // Es el caso de las HEIC y de las fotos optimizadas en iCloud.
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
  } catch (err) {
    // Aca el modulo ya demostro que existe, asi que esto es la foto: puede ser
    // un asset que iOS no logra materializar, o uno que ya no esta.
    console.error('[contributions] no se pudo leer la foto elegida:', err);
    return { ok: false, reason: 'read_failed' };
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
/**
 * Sube una imagen al bucket PRIVADO de revision y devuelve lo que hace falta
 * para registrarla.
 *
 * Esta separado del insert porque hay dos cosas que se aportan --una imagen
 * para una card existente (`card_images`) y una card nueva entera
 * (`card_submissions`)-- y la parte de la imagen es exactamente la misma. Lo
 * unico que cambia es el prefijo de la ruta, que sirve para saber de un vistazo
 * que hay en el bucket.
 *
 * La ruta empieza SIEMPRE por el uid porque la policy de Storage
 * "community review insert own" deriva la propiedad del primer segmento del
 * path; los segmentos siguientes son libres.
 */
export async function uploadReviewImage(params: {
  userId: string;
  asset: ImagePicker.ImagePickerAsset;
  crop?: CropRect;
  /** Segundo segmento de la ruta. 'cards' para una propuesta de card nueva. */
  folder?: string;
}): Promise<
  | {
      ok: true;
      storagePath: string;
      mime: string;
      width: number | null;
      height: number | null;
      byteSize: number;
    }
  | { ok: false; reason: ContributionFailure; detail?: string }
> {
  const { userId, asset, crop, folder } = params;
  const sourceMime = asset.mimeType ?? 'image/jpeg';

  // Si el normalizado falla se sube el original: es mejor un aporte con mal
  // encuadre --que el moderador puede rechazar-- que perderlo entero.
  let normalized: { uri: string; width: number; height: number } | null = null;
  try {
    normalized = await normalizeToPhotocard(asset, sourceMime, crop);
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
  const segments = [userId, folder, `${Crypto.randomUUID()}.${extensionFor(finalMime)}`];
  const storagePath = segments.filter(Boolean).join('/');

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

  return {
    ok: true,
    storagePath,
    mime: finalMime,
    width: normalized?.width ?? asset.width ?? null,
    height: normalized?.height ?? asset.height ?? null,
    byteSize: body.byteLength,
  };
}

/**
 * Sube el asset y registra la aportacion.
 *
 * Los terminos no son decorativos: la constraint
 * card_images_community_has_terms rechaza la fila sin `terms_accepted_at` y
 * `terms_version`, asi que no hay forma de registrar un aporte sin dejar
 * constancia de que se aceptaron.
 */
export async function submitContribution(params: {
  cardId: number;
  userId: string | null;
  asset: ImagePicker.ImagePickerAsset;
  /** Encuadre elegido en ImageCropper. Sin el se recorta al centro. */
  crop?: CropRect;
}): Promise<ContributionResult> {
  const { cardId, userId, asset, crop } = params;
  if (!userId) return { ok: false, reason: 'no_session' };

  const uploaded = await uploadReviewImage({ userId, asset, crop });
  if (!uploaded.ok) return uploaded;

  const { error: insertError } = await supabase.from('card_images').insert({
    card_id: cardId,
    bucket_id: COMMUNITY_REVIEW_BUCKET,
    storage_path: uploaded.storagePath,
    source_type: 'community',
    status: 'pending',
    is_primary: false,
    contributed_by: userId,
    terms_accepted_at: new Date().toISOString(),
    terms_version: CONTRIBUTION_TERMS_VERSION,
    width: uploaded.width,
    height: uploaded.height,
    // El tamano del asset original ya no aplica tras recortar y reescalar; el
    // real es el del buffer que se acaba de subir.
    byte_size: uploaded.byteSize,
  });

  if (insertError) {
    // El objeto ya subio pero la fila no entro. Sin esto quedaria un huerfano
    // en el bucket que nada referencia -- exactamente los 33 que la auditoria
    // encontro en `photocards`. La policy de DELETE del bucket de revision
    // permite al autor borrar lo propio, asi que esta limpieza si es posible.
    await supabase.storage.from(COMMUNITY_REVIEW_BUCKET).remove([uploaded.storagePath]);
    return { ok: false, reason: 'insert_failed', detail: insertError.message };
  }

  return { ok: true, storagePath: uploaded.storagePath };
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
