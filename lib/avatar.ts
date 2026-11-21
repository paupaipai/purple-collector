import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';

import type { CropRect } from './contributions';
import { supabase } from './supabase';

/**
 * Avatar propio.
 *
 * Se guarda PEQUEÑO a proposito: 256x256 en JPEG al 70 %, que deja el archivo
 * en unos 15-30 kB. En un circulo de 96 px (el mas grande de la app) no se
 * nota diferencia con el original. El bucket rechaza mas de 150 kB.
 *
 * En la base solo va la ruta (`<uid>/avatar-<n>.jpg`); una regla de la tabla
 * impide apuntar a otra cosa. El nombre cambia en cada subida para que ninguna
 * cache muestre el avatar anterior.
 */

export const AVATAR_BUCKET = 'avatars';
const SIZE = 256;
const QUALITY = 0.7;

export type AvatarResult = { ok: true; path: string } | { ok: false; detail: string };

export function avatarPublicUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Recorta (cuadrado), reduce a 256x256 y comprime. */
async function shrink(asset: ImagePickerAsset, crop?: CropRect) {
  const w = asset.width;
  const h = asset.height;
  const side = Math.min(w, h);
  const rect = crop ?? {
    originX: Math.round((w - side) / 2),
    originY: Math.round((h - side) / 2),
    width: side,
    height: side,
  };
  const rendered = await ImageManipulator.manipulate(asset.uri)
    .crop(rect)
    .resize({ width: SIZE, height: SIZE })
    .renderAsync();
  return rendered.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
}

export async function uploadAvatar(
  userId: string,
  asset: ImagePickerAsset,
  crop: CropRect | undefined,
  previousPath: string | null,
): Promise<AvatarResult> {
  try {
    const small = await shrink(asset, crop);
    const body = await (await fetch(small.uri)).arrayBuffer();
    const path = `${userId}/avatar-${Date.now()}.jpg`;

    const { error: upErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, body, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
    if (upErr) return { ok: false, detail: upErr.message };

    const { error: dbErr } = await supabase
      .from('user_profiles')
      .update({ avatar_url: path })
      .eq('id', userId);
    if (dbErr) {
      // Sin la fila actualizada el archivo no lo referencia nada: se borra.
      await supabase.storage.from(AVATAR_BUCKET).remove([path]);
      return { ok: false, detail: dbErr.message };
    }

    // El anterior ya no se usa. Best-effort: si falla solo queda un huerfano.
    if (previousPath && previousPath !== path) {
      await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
    }
    return { ok: true, path };
  } catch (err: any) {
    return { ok: false, detail: String(err?.message ?? err) };
  }
}

export async function removeAvatar(userId: string, path: string | null): Promise<AvatarResult> {
  const { error } = await supabase.from('user_profiles').update({ avatar_url: null }).eq('id', userId);
  if (error) return { ok: false, detail: error.message };
  if (path) await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  return { ok: true, path: '' };
}

/** Ruta del avatar propio (null si no tiene). */
export function useMyAvatar(userId: string | null) {
  const [path, setPath] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) { setPath(null); return; }
    const { data } = await supabase.from('user_profiles').select('avatar_url').eq('id', userId).single();
    setPath(data?.avatar_url ?? null);
  }, [userId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { path, url: avatarPublicUrl(path), setPath, refetch };
}
