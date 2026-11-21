import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo } from 'react';

import { t } from '../lib/i18n';
import {
  albumStats, keys, refreshIfStale, refreshNow,
  useAlbumsCatalog, useCollectionTypesCatalog, useErasCatalog, useMyCards,
} from '../lib/queries';
import { getPhotocardUrl } from '../lib/supabase';
import { AlbumEraWithAlbums, AlbumWithStats } from '../lib/types';

/**
 * Eras y albumes de un tipo de coleccion, con mi progreso. Todo sale de la
 * cache compartida (catalogo + mis cartas): entrar a otro tipo no pide nada
 * nuevo si el catalogo ya esta cargado.
 */
export function useEraAlbums(collectionTypeId: number | null, userId: string | null) {
  const types = useCollectionTypesCatalog();
  const eras = useErasCatalog();
  const catalog = useAlbumsCatalog();
  const mine = useMyCards(userId);

  const type = useMemo(
    () => (types.data ?? []).find((ct: any) => ct.id === collectionTypeId) ?? null,
    [types.data, collectionTypeId],
  );

  const result: AlbumEraWithAlbums[] = useMemo(() => {
    if (!eras.data || !catalog.data || collectionTypeId == null) return [];
    const { owned, notCollecting } = albumStats(mine.userCards, mine.details);
    const { albums, versions, countByAlbum } = catalog.data;
    return eras.data
      .filter((e: any) => e.collection_type_id === collectionTypeId)
      .map((era: any) => ({
        ...era,
        albums: albums
          .filter((a: any) => a.era_id === era.id)
          .map((album: any): AlbumWithStats => ({
            ...album,
            versions: versions.filter(v => v.album_id === album.id),
            total_cards: (countByAlbum[album.id] || 0) - (notCollecting[album.id] || 0),
            owned_cards: owned[album.id] || 0,
          })),
      }));
  }, [eras.data, catalog.data, mine.userCards, mine.details, collectionTypeId]);

  // Portadas: se precargan una vez por tipo.
  const coverKey = result.map(e => e.id).join(',');
  useEffect(() => {
    const urls = result.flatMap(e => e.albums)
      .filter((a: any) => a.cover_image_url)
      .map((a: any) => getPhotocardUrl(a.cover_image_url));
    if (urls.length > 0) Image.prefetch(urls);
  }, [coverKey]);

  const refetch = useCallback(() => {
    refreshNow(keys.erasCatalog);
    refreshNow(keys.albumsCatalog);
    refreshNow(keys.userCards(userId));
  }, [userId]);
  const silentRefetch = useCallback(() => {
    refreshIfStale(keys.erasCatalog);
    refreshIfStale(keys.albumsCatalog);
    refreshIfStale(keys.userCards(userId));
    refreshIfStale(keys.myCardDetails(userId));
  }, [userId]);

  return {
    eras: result,
    typeName: type?.name ?? '',
    typeNameEn: type?.name_en ?? null,
    typeColor: type?.color ?? '',
    typeIcon: type?.icon ?? '',
    loading: eras.isLoading || catalog.isLoading || types.isLoading,
    error: eras.error || catalog.error ? t('errorAlbums') : null,
    refetch,
    silentRefetch,
  };
}
