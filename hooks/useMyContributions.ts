import { useCallback, useEffect, useState } from 'react';

import { COMMUNITY_REVIEW_BUCKET } from '../lib/constants';
import { getCardImageUrl, supabase } from '../lib/supabase';
import { ImageStatus } from '../lib/types';

/**
 * Lo que esta persona ha aportado, con el resultado de cada cosa.
 *
 * Es el bucle que faltaba. Hasta ahora se podia aportar una imagen o proponer
 * una card y no habia NINGUN sitio donde enterarse de si se aprobo o se
 * rechazo: habia que acordarse de la card e ir a mirarla al album. Quien aporta
 * sin saber en que quedo no aporta una segunda vez.
 *
 * Junta dos tablas porque son dos cosas distintas que se aportan:
 *
 *   - `card_images`      una imagen para una card que YA existe
 *   - `card_submissions` una card que no estaba en el catalogo
 *
 * Las dos tienen el mismo ciclo (pending -> approved | rejected) y el mismo
 * motivo de rechazo, asi que en la lista se ven igual y solo las distingue una
 * etiqueta. Para quien aporta, "mande algo y esto paso" es una sola historia.
 */

export type ContributionKind = 'image' | 'card';

export interface MyContribution {
  /** Unico entre las dos tablas: los ids se repiten. */
  key: string;
  kind: ContributionKind;
  status: ImageStatus;
  /** Nombre de la card: el propuesto, o el de la card que ya existia. */
  title: string;
  /** Album y miembro, para ubicarla sin abrir nada. */
  subtitle: string;
  createdAt: string;
  /** Firmada si sigue en revision, publica si ya se aprobo. */
  thumbUrl: string | null;
  rejectionReason: string | null;
  /** Para saltar al album cuando ya esta publicada. */
  albumId: number | null;
}

// 10 minutos: lo que dura mirar la lista, sin dejar URLs vivas de mas.
const SIGNED_URL_TTL_SECONDS = 600;

export function useMyContributions(userId: string | null) {
  const [items, setItems] = useState<MyContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    // Las dos policies de lectura ("contributor reads own" y "submitter reads
    // own") ya devuelven solo lo propio; el filtro explicito esta para que la
    // consulta diga lo que quiere, no para protegerla.
    const [images, subs] = await Promise.all([
      supabase
        .from('card_images')
        .select('id, card_id, status, rejection_reason, created_at, bucket_id, storage_path')
        .eq('contributed_by', userId)
        .eq('source_type', 'community')
        .order('created_at', { ascending: false }),
      supabase
        .from('card_submissions')
        .select(`
          id, status, rejection_reason, created_at, bucket_id, storage_path,
          member, card_name, album_id,
          albums ( name )
        `)
        .eq('submitted_by', userId)
        .order('created_at', { ascending: false }),
    ]);

    if (images.error || subs.error) {
      setError((images.error ?? subs.error)!.message);
      setLoading(false);
      return;
    }

    // Las imagenes aportadas no llevan el nombre de la card encima: hay que
    // preguntarlo. Una sola consulta para todas.
    const cardIds = Array.from(new Set((images.data ?? []).map((r: any) => r.card_id as number)));
    const { data: cards } = cardIds.length > 0
      ? await supabase
          .from('cards_full')
          .select('id, card_name, member, album_id, album_name')
          .in('id', cardIds)
      : { data: [] as any[] };

    const cardById = new Map<number, any>((cards ?? []).map((c: any) => [c.id, c]));

    // Una sola llamada para firmar todo lo que sigue en el bucket privado: una
    // por fila serian N viajes para pintar una lista.
    const privatePaths = [
      ...(images.data ?? []),
      ...(subs.data ?? []),
    ]
      .filter((r: any) => r.bucket_id === COMMUNITY_REVIEW_BUCKET)
      .map((r: any) => r.storage_path as string);

    const urlByPath = new Map<string, string>();
    if (privatePaths.length > 0) {
      const { data: signed } = await supabase.storage
        .from(COMMUNITY_REVIEW_BUCKET)
        .createSignedUrls(privatePaths, SIGNED_URL_TTL_SECONDS);
      for (const s of signed ?? []) {
        if ((s as any).signedUrl && !(s as any).error) {
          urlByPath.set((s as any).path, (s as any).signedUrl);
        }
      }
    }

    /** Publica si ya salio del bucket de revision; firmada si sigue dentro. */
    const thumbFor = (row: any): string | null =>
      row.bucket_id === COMMUNITY_REVIEW_BUCKET
        ? urlByPath.get(row.storage_path) ?? null
        : getCardImageUrl({
            primary_image_path: row.storage_path,
            primary_image_bucket: row.bucket_id,
          });

    const fromImages: MyContribution[] = (images.data ?? []).map((row: any) => {
      const card = cardById.get(row.card_id);
      return {
        key: `img-${row.id}`,
        kind: 'image' as const,
        status: row.status as ImageStatus,
        title: card?.card_name ?? `#${row.card_id}`,
        subtitle: [card?.album_name, card?.member].filter(Boolean).join(' · '),
        createdAt: row.created_at,
        thumbUrl: thumbFor(row),
        rejectionReason: row.rejection_reason,
        albumId: card?.album_id ?? null,
      };
    });

    const fromSubs: MyContribution[] = (subs.data ?? []).map((row: any) => ({
      key: `sub-${row.id}`,
      kind: 'card' as const,
      status: row.status as ImageStatus,
      title: row.card_name,
      subtitle: [row.albums?.name, row.member].filter(Boolean).join(' · '),
      createdAt: row.created_at,
      thumbUrl: thumbFor(row),
      rejectionReason: row.rejection_reason,
      albumId: row.album_id ?? null,
    }));

    // Las dos listas vienen ordenadas por separado; se mezclan por fecha para
    // que lo ultimo que mandaste este arriba, sea del tipo que sea.
    setItems(
      [...fromImages, ...fromSubs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { items, loading, error, refetch: fetchAll };
}

/**
 * Cuanto hay esperando revision, para el acceso de admin.
 *
 * `head: true` con `count: 'exact'`: no se bajan las filas, solo se cuentan. La
 * bandeja ya las trae enteras cuando se abre; aca solo hace falta el numero.
 */
export function usePendingModerationCount(isAdmin: boolean) {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!isAdmin) {
      setCount(0);
      return;
    }
    const [images, subs, reports] = await Promise.all([
      supabase.from('card_images').select('id', { count: 'exact', head: true })
        .eq('status', 'pending').eq('source_type', 'community'),
      supabase.from('card_submissions').select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase.from('image_reports').select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
    ]);
    setCount((images.count ?? 0) + (subs.count ?? 0) + (reports.count ?? 0));
  }, [isAdmin]);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  return { count, refetch: fetchCount };
}
