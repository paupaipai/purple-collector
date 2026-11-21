import { useCallback, useMemo } from 'react';

import { t } from '../lib/i18n';
import { albumStats, keys, refreshIfStale, refreshNow, useAlbumsCatalog, useMyCards } from '../lib/queries';
import { AlbumWithStats } from '../lib/types';

/**
 * Albumes con mi progreso. Catalogo y "mis cartas" salen de la cache
 * compartida: ya no se descarga user_cards con un join por album.
 */
export function useAlbums(userId: string | null) {
  const catalog = useAlbumsCatalog();
  const mine = useMyCards(userId);

  const albums: AlbumWithStats[] = useMemo(() => {
    if (!catalog.data) return [];
    const { owned, notCollecting } = albumStats(mine.userCards, mine.details);
    const { albums: list, versions, countByAlbum } = catalog.data;
    return list.map(album => ({
      ...album,
      versions: versions.filter(v => v.album_id === album.id),
      total_cards: (countByAlbum[album.id] || 0) - (notCollecting[album.id] || 0),
      owned_cards: owned[album.id] || 0,
    }));
  }, [catalog.data, mine.userCards, mine.details]);

  const refetch = useCallback(() => {
    refreshNow(keys.albumsCatalog);
    refreshNow(keys.userCards(userId));
  }, [userId]);
  const silentRefetch = useCallback(() => {
    refreshIfStale(keys.albumsCatalog);
    refreshIfStale(keys.userCards(userId));
    refreshIfStale(keys.myCardDetails(userId));
  }, [userId]);

  return {
    albums,
    loading: catalog.isLoading || mine.loading,
    error: catalog.error ? t('errorAlbums') : null,
    refetch,
    silentRefetch,
  };
}
