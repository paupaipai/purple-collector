import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import type { CropRect } from './contributions';
import { COMMUNITY_REVIEW_BUCKET } from './constants';
import { supabase } from './supabase';

/**
 * "Ajustar encuadre" en moderacion: la admin recorta un aporte pendiente antes
 * de aprobarlo (p. ej. para quitar bordes del fondo).
 *
 * Sin cambios en la base ni en la edge function:
 *   1. se recorta en el cliente (misma pieza que usa el aporte),
 *   2. se sube a la carpeta de la ADMIN en el bucket de revision (la policy
 *      "community review insert own" lo permite),
 *   3. se apunta la fila card_images al archivo nuevo (policy admin all) y se
 *      borra el original,
 *   4. la pantalla aprueba como siempre: moderate-card-image mueve el archivo
 *      nuevo al bucket publico.
 * contributed_by no cambia: el aporte y su punto siguen siendo de la usuaria.
 */

const MAX_WIDTH = 800;

/**
 * Fuente que el manipulador puede abrir. En web, una URL de otro origen
 * "ensucia" el canvas y no se puede exportar: se descarga como blob y se usa
 * su URL local.
 */
export async function loadForAdjust(signedUrl: string): Promise<
  { ok: true; uri: string; width: number; height: number } | { ok: false; detail: string }
> {
  try {
    let uri = signedUrl;
    if (Platform.OS === 'web') {
      const blob = await (await fetch(signedUrl)).blob();
      uri = URL.createObjectURL(blob);
    }
    const rendered = await ImageManipulator.manipulate(uri).renderAsync();
    return { ok: true, uri, width: rendered.width, height: rendered.height };
  } catch (err: any) {
    return { ok: false, detail: String(err?.message ?? err) };
  }
}

export async function applyAdjust(params: {
  cardImageId: number;
  adminId: string;
  oldPath: string;
  sourceUri: string;
  crop: CropRect;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  const { cardImageId, adminId, oldPath, sourceUri, crop } = params;
  try {
    const ctx = ImageManipulator.manipulate(sourceUri).crop(crop);
    if (crop.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
    const saved = await (await ctx.renderAsync()).saveAsync({
      // Mismo formato que un aporte nuevo (lib/contributions.ts).
      compress: 0.75,
      format: SaveFormat.JPEG,
    });

    const body = await (await fetch(saved.uri)).arrayBuffer();
    const newPath = `${adminId}/adjusted/${Crypto.randomUUID()}.jpg`;

    const { error: upErr } = await supabase.storage
      .from(COMMUNITY_REVIEW_BUCKET)
      .upload(newPath, body, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
    if (upErr) return { ok: false, detail: upErr.message };

    // Solo si sigue pendiente: si otra sesion ya la resolvio, no se toca.
    const { data: updated, error: dbErr } = await supabase
      .from('card_images')
      .update({ storage_path: newPath, width: saved.width, height: saved.height, byte_size: body.byteLength })
      .eq('id', cardImageId)
      .eq('status', 'pending')
      .select('id');
    if (dbErr || !updated?.length) {
      await supabase.storage.from(COMMUNITY_REVIEW_BUCKET).remove([newPath]);
      return { ok: false, detail: dbErr?.message ?? 'La imagen ya no está pendiente.' };
    }

    // El original ya no lo referencia nada. Best-effort.
    await supabase.storage.from(COMMUNITY_REVIEW_BUCKET).remove([oldPath]);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, detail: String(err?.message ?? err) };
  }
}
