import { QueryClient, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';

import { COUNTRY_ORDER, DRAW_TYPE_ORDER } from './constants';
import { fetchAllByIds, fetchAllPages, getCardThumbUrl, supabase } from './supabase';
import { Album, AlbumVersion, CardFull, CardStatus, CardWithStatus } from './types';

/**
 * Datos compartidos entre pantallas (TanStack Query).
 *
 * POR QUE: antes cada pantalla (Inicio, Coleccion, Wishlist, Perfil, album)
 * pedia por su cuenta las mismas cosas, y las volvia a pedir enteras cada vez
 * que se entraba. Con una wishlist de 3.300 cartas, abrir el Perfil eran ~20
 * pedidos; cambiar de pestaña, otros tantos. Eso saturaba Supabase.
 *
 * AHORA:
 *  - "Mis cartas" (user_cards: estado y duplicados) se piden UNA vez para toda
 *    la app, y el detalle de esas cartas (cards_full) tambien una vez; si
 *    despues aparece una carta nueva, se pide solo esa.
 *  - El catalogo (albumes, versiones, conteos, tipos, eras) cambia poco: se
 *    reutiliza 15 minutos.
 *  - Al volver a una pantalla solo se pide de nuevo si lo guardado tiene mas
 *    de STALE_MS ("silentRefetch"). El boton de reintentar fuerza.
 *  - Marcar una carta actualiza la cache al instante (lib/myCards.ts): todas
 *    las pantallas lo ven sin pedir nada.
 */

const STALE_MS = 2 * 60_000;
const CATALOG_STALE_MS = 15 * 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_MS,
      gcTime: 30 * 60_000,
      // Lo decide cada pantalla al enfocarse; en web, ademas, el foco de la
      // ventana dispararia pedidos que nadie pidio.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const keys = {
  userCards: (uid: string | null) => ['userCards', uid] as const,
  myCardDetails: (uid: string | null) => ['myCardDetails', uid] as const,
  albumsCatalog: ['albumsCatalog'] as const,
  erasCatalog: ['erasCatalog'] as const,
  collectionTypes: ['collectionTypes'] as const,
  memberCounts: ['memberCounts'] as const,
  albumCards: (albumId: number | null) => ['albumCards', albumId] as const,
};

/** Refresca solo lo que este viejo (lo que hacia "silentRefetch" al enfocar). */
export function refreshIfStale(queryKey: readonly unknown[]) {
  return queryClient.refetchQueries({ queryKey, stale: true, type: 'active' });
}

/** Fuerza un pedido nuevo (reintentar / tirar para refrescar). */
export function refreshNow(queryKey: readonly unknown[]) {
  return queryClient.refetchQueries({ queryKey, type: 'active' });
}

// ---------------------------------------------------------------------------
// Mis cartas
// ---------------------------------------------------------------------------

export type UserCardRow = { status: CardStatus | null; duplicate_count: number };
export type UserCardsMap = Record<number, UserCardRow>;
export type CardDetailsMap = Record<number, CardFull>;

async function fetchUserCards(uid: string): Promise<UserCardsMap> {
  const { data, error } = await fetchAllPages<{ card_id: number; status: CardStatus | null; duplicate_count: number | null }>(
    () => supabase.from('user_cards').select('card_id, status, duplicate_count').eq('user_id', uid),
  );
  if (error) throw error;
  const map: UserCardsMap = {};
  data.forEach(r => { map[r.card_id] = { status: r.status, duplicate_count: r.duplicate_count ?? 0 }; });
  return map;
}

async function fetchDetails(ids: number[]): Promise<CardDetailsMap> {
  const map: CardDetailsMap = {};
  if (ids.length === 0) return map;
  const { data, error } = await fetchAllByIds<CardFull>(
    ids,
    chunk => supabase.from('cards_full').select('*').in('id', chunk),
  );
  if (error) throw error;
  data.forEach(c => { map[c.id] = c; });
  return map;
}

/** Ids con algun estado (los que hay que conocer en detalle). */
const idsWithStatus = (m: UserCardsMap) =>
  Object.keys(m).map(Number).filter(id => m[id].status != null);

/**
 * Mis cartas + su detalle. Lo usan Coleccion, Wishlist, Perfil y los
 * contadores de albumes: un solo pedido para todas.
 */
export function useMyCards(uid: string | null) {
  const userCards = useQuery({
    queryKey: keys.userCards(uid),
    queryFn: () => fetchUserCards(uid!),
    enabled: !!uid,
  });

  const details = useQuery({
    queryKey: keys.myCardDetails(uid),
    // Pedido completo (al cargar o cuando esta viejo): asi tambien se
    // actualizan las imagenes que cambiaron al aprobar aportes.
    queryFn: () => fetchDetails(idsWithStatus(userCards.data ?? {})),
    enabled: !!uid && !!userCards.data,
    staleTime: 10 * 60_000,
  });

  // Si aparece una carta con estado que no esta en el detalle (marcada en otro
  // dispositivo, por ejemplo), se pide SOLO esa y se suma.
  const missing = useMemo(() => {
    if (!userCards.data || !details.data) return [];
    return idsWithStatus(userCards.data).filter(id => !details.data![id]);
  }, [userCards.data, details.data]);

  useEffect(() => {
    if (!uid || missing.length === 0 || details.isFetching) return;
    let cancelled = false;
    fetchDetails(missing).then(extra => {
      if (cancelled) return;
      queryClient.setQueryData<CardDetailsMap>(keys.myCardDetails(uid), prev => ({ ...(prev ?? {}), ...extra }));
    }).catch(err => console.error('[myCards] detalle faltante:', err));
    return () => { cancelled = true; };
  }, [uid, missing.join(','), details.isFetching]);

  return {
    userCards: userCards.data,
    details: details.data,
    loading: !!uid && (userCards.isLoading || details.isLoading),
    error: userCards.error || details.error,
  };
}

/** Mezcla detalle + estado para las cartas que cumplen `pick`. */
export function combine(
  userCards: UserCardsMap | undefined,
  details: CardDetailsMap | undefined,
  pick: (row: UserCardRow) => boolean,
): CardWithStatus[] {
  if (!userCards || !details) return [];
  const out: CardWithStatus[] = [];
  for (const key of Object.keys(userCards)) {
    const id = Number(key);
    const row = userCards[id];
    const card = details[id];
    if (!card || !pick(row)) continue;
    out.push({ ...card, status: row.status, duplicate_count: row.duplicate_count });
  }
  return out;
}

/** Tengo / no colecciono por album, para los contadores de progreso. */
export function albumStats(userCards: UserCardsMap | undefined, details: CardDetailsMap | undefined) {
  const owned: Record<number, number> = {};
  const notCollecting: Record<number, number> = {};
  if (!userCards || !details) return { owned, notCollecting };
  for (const key of Object.keys(userCards)) {
    const id = Number(key);
    const aid = details[id]?.album_id;
    if (!aid) continue;
    const s = userCards[id].status;
    if (s === 'have') owned[aid] = (owned[aid] || 0) + 1;
    else if (s === 'not_collecting') notCollecting[aid] = (notCollecting[aid] || 0) + 1;
  }
  return { owned, notCollecting };
}

// ---------------------------------------------------------------------------
// Catalogo
// ---------------------------------------------------------------------------

export interface AlbumsCatalog {
  albums: Album[];
  versions: AlbumVersion[];
  countByAlbum: Record<number, number>;
}

export function useAlbumsCatalog() {
  return useQuery({
    queryKey: keys.albumsCatalog,
    staleTime: CATALOG_STALE_MS,
    queryFn: async (): Promise<AlbumsCatalog> => {
      const [a, v, c] = await Promise.all([
        supabase.from('albums').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('album_versions').select('*').order('sort_order'),
        supabase.from('album_card_counts').select('album_id, total'),
      ]);
      if (a.error || !a.data || c.error || !c.data) throw a.error ?? c.error ?? new Error('albums');
      const countByAlbum: Record<number, number> = {};
      c.data.forEach((r: any) => { countByAlbum[r.album_id] = r.total; });
      return { albums: a.data as Album[], versions: (v.data ?? []) as AlbumVersion[], countByAlbum };
    },
  });
}

export function useErasCatalog() {
  return useQuery({
    queryKey: keys.erasCatalog,
    staleTime: CATALOG_STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from('album_eras').select('*').order('sort_order');
      if (error || !data) throw error ?? new Error('eras');
      return data as any[];
    },
  });
}

export function useCollectionTypesCatalog() {
  return useQuery({
    queryKey: keys.collectionTypes,
    staleTime: CATALOG_STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from('collection_types').select('*').eq('is_active', true).order('sort_order');
      if (error || !data) throw error ?? new Error('types');
      return data as any[];
    },
  });
}

export function useMemberCounts() {
  return useQuery({
    queryKey: keys.memberCounts,
    staleTime: CATALOG_STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from('member_card_counts').select('member, is_group, total');
      if (error) throw error;
      return (data ?? []) as { member: string; is_group: boolean; total: number }[];
    },
  });
}

/** Cartas de un album (catalogo). El estado de cada una sale de useMyCards. */
export function useAlbumCatalogCards(albumId: number | null) {
  return useQuery({
    queryKey: keys.albumCards(albumId),
    enabled: albumId != null,
    // Las imagenes cambian al aprobar aportes: algo mas corto que el resto
    // del catalogo.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('album fetch timed out')), 8000));
      const [albumRes, cardsRes] = await Promise.race([
        Promise.all([
          supabase.from('albums').select('*').eq('id', albumId!).single(),
          supabase.from('cards_full').select('*').eq('album_id', albumId!),
        ]),
        timeout,
      ]);
      if (cardsRes.error || !cardsRes.data) throw cardsRes.error ?? new Error('cards');

      const cards = (cardsRes.data as any[]).map(c => ({ ...c, category_sort_order: c.category_sort_order ?? 999 })) as CardFull[];
      cards.sort((a: any, b: any) => {
        const drawA = DRAW_TYPE_ORDER[a.draw_type ?? 'R1'] ?? DRAW_TYPE_ORDER.R1;
        const drawB = DRAW_TYPE_ORDER[b.draw_type ?? 'R1'] ?? DRAW_TYPE_ORDER.R1;
        if (drawA !== drawB) return drawA - drawB;
        const countryA = COUNTRY_ORDER[a.country ?? ''] ?? Infinity;
        const countryB = COUNTRY_ORDER[b.country ?? ''] ?? Infinity;
        if (countryA !== countryB) return countryA - countryB;
        return a.card_name.localeCompare(b.card_name);
      });

      const urls = cards.map(c => getCardThumbUrl(c as any)).filter((u): u is string => !!u);
      if (urls.length > 0) Image.prefetch(urls);

      return { album: (albumRes.data ?? null) as Album | null, cards };
    },
  });
}
