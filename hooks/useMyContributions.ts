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

/**
 * Si esta persona tiene handle publico.
 *
 * Sin handle, lo que aporta sale SIN FIRMAR: la pastilla `@` de la grilla solo
 * aparece si card_images.contributor_handle tiene algo. Nada se lo decia, asi
 * que se aportaba y la atribucion no salia nunca sin explicacion.
 */
export function useMyHandle(userId: string | null) {
  const [handle, setHandle] = useState<string | null>(null);

  const fetchHandle = useCallback(async () => {
    if (!userId) {
      setHandle(null);
      return;
    }
    const { data } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', userId)
      .single();
    setHandle(data?.username ?? null);
  }, [userId]);

  useEffect(() => { fetchHandle(); }, [fetchHandle]);

  return { handle, refetch: fetchHandle };
}

export function useMyContributions(userId: string | null) {
  const [items, setItems] = useState<MyContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
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
          member, card_name, album_id, created_card_id,
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

    // Dos motivos para mirar cards_full: las imagenes aportadas no llevan el
    // nombre de la card encima, y una propuesta APROBADA necesita la imagen de
    // la card que creo -- su propio storage_path apunta al bucket de revision,
    // de donde la edge function ya borro el objeto al publicarlo.
    const cardIds = Array.from(new Set([
      ...(images.data ?? []).map((r: any) => r.card_id as number),
      ...(subs.data ?? []).map((r: any) => r.created_card_id as number | null).filter(Boolean),
    ])) as number[];
    const { data: cards } = cardIds.length > 0
      ? await supabase
          .from('cards_full')
          .select('id, card_name, member, album_id, album_name, primary_image_path, primary_image_bucket')
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

    // Aprobar una propuesta crea ADEMAS una fila en card_images, porque asi es
    // como la imagen queda publicada. Pero para quien aporto es UNA sola cosa:
    // sin esto su propuesta aparecia dos veces, como "Card nueva" y como
    // "Imagen para una card existente".
    //
    // Se identifica por el NOMBRE DE ARCHIVO, que es el uuid que genero la
    // subida y viaja con la imagen pase lo que pase. Antes se comparaba la ruta
    // entera (`<cardId>/<archivo>`) y bastaba mover la imagen de card para que
    // dejara de emparejar y el aporte volviera a salir dos veces.
    //
    // Sigue sin usarse card_id, que seria lo obvio: asi, si mas adelante aporta
    // OTRA imagen a esa misma card, esa si se ve -- otro envio, otro uuid.
    const nombreArchivo = (ruta: string) => String(ruta).split('/').pop();
    const publicadaPorPropuesta = new Set(
      (subs.data ?? [])
        .filter((r: any) => r.status === 'approved' && r.created_card_id)
        .map((r: any) => nombreArchivo(r.storage_path)),
    );

    const fromImages: MyContribution[] = (images.data ?? [])
      .filter((row: any) => !publicadaPorPropuesta.has(nombreArchivo(row.storage_path)))
      .map((row: any) => {
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

    const fromSubs: MyContribution[] = (subs.data ?? []).map((row: any) => {
      // Una propuesta aprobada ya no tiene imagen propia: su storage_path
      // apunta al bucket de revision y ese objeto se borro al publicarla. La
      // que hay que enseñar es la de la card que creo.
      const creada = row.created_card_id ? cardById.get(row.created_card_id) : null;
      const thumb = creada?.primary_image_path
        ? getCardImageUrl({
            primary_image_path: creada.primary_image_path,
            primary_image_bucket: creada.primary_image_bucket,
          })
        : thumbFor(row);

      return {
        key: `sub-${row.id}`,
        kind: 'card' as const,
        status: row.status as ImageStatus,
        title: row.card_name,
        subtitle: [row.albums?.name, row.member].filter(Boolean).join(' · '),
        createdAt: row.created_at,
        thumbUrl: thumb,
        rejectionReason: row.rejection_reason,
        albumId: row.album_id ?? null,
      };
    });

    // Las dos listas vienen ordenadas por separado; se mezclan por fecha para
    // que lo ultimo que mandaste este arriba, sea del tipo que sea.
    setItems(
      [...fromImages, ...fromSubs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Memoizadas, y esto NO es cosmetico: las pantallas hacen
  //   useFocusEffect(useCallback(() => silentRefetch(), [silentRefetch]))
  // y useFocusEffect depende de la identidad del callback. Si estas funciones
  // se recrearan en cada render, el efecto se volveria a disparar despues de
  // cada setState que el propio fetch provoca: refrescar -> render -> nueva
  // identidad -> refrescar. Medido antes de arreglarlo: 87 consultas en 25
  // segundos con la app QUIETA.
  const refetchNow = useCallback(() => fetchAll(false), [fetchAll]);
  const refetchSilently = useCallback(() => fetchAll(true), [fetchAll]);

  return {
    items, loading, error,
    refetch: refetchNow,
    silentRefetch: refetchSilently,
  };
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
