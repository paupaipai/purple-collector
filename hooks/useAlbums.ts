import { useState, useEffect, useCallback } from 'react';
import { fetchAllPages, supabase } from '../lib/supabase';
import { AlbumWithStats, AlbumVersion } from '../lib/types';
import { t } from '../lib/i18n';

export function useAlbums(userId: string | null) {
  const [albums, setAlbums] = useState<AlbumWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlbums = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    // Paginado: sin esto, un usuario con mas de 1000 filas en have/not_collecting
    // veia mal el "owned" de sus ultimos albumes, porque PostgREST cortaba la
    // lista en 1000 y los albumes que quedaban fuera contaban 0.
    const userCardsQuery = userId
      ? fetchAllPages<any>(() => supabase.from('user_cards').select('status, cards!inner(album_id)').eq('user_id', userId).in('status', ['have', 'not_collecting']))
      : Promise.resolve({ data: null as any, error: null });

    const [
      { data: albumsData, error: aErr },
      { data: versionsData },
      { data: cardCounts },
      { data: userCardsData },
    ] = await Promise.all([
      supabase.from('albums').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('album_versions').select('*').order('sort_order'),
      // Vista agregada: ~130 filas en una sola peticion. Antes se bajaba la
      // tabla `cards` completa (4500+ filas en 5 viajes secuenciales, ~3s)
      // solo para contar cuantas cards tiene cada album, y encima se repetia
      // en cada useFocusEffect.
      supabase.from('album_card_counts').select('album_id, total'),
      userCardsQuery,
    ]);

    if (aErr || !albumsData || !cardCounts) {
      console.error('Error fetching albums:', aErr);
      setError(t('errorAlbums'));
      setLoading(false);
      return;
    }

    // "not_collecting" cards are excluded from total_cards below — they
    // shouldn't count toward an album's completion total.
    const ownedByAlbum: Record<number, number> = {};
    const notCollectingByAlbum: Record<number, number> = {};
    if (userCardsData) {
      userCardsData.forEach((uc: any) => {
        const aid = uc.cards.album_id;
        if (uc.status === 'have') ownedByAlbum[aid] = (ownedByAlbum[aid] || 0) + 1;
        else if (uc.status === 'not_collecting') notCollectingByAlbum[aid] = (notCollectingByAlbum[aid] || 0) + 1;
      });
    }

    const countByAlbum: Record<number, number> = {};
    (cardCounts || []).forEach((c: any) => { countByAlbum[c.album_id] = c.total; });

    const result: AlbumWithStats[] = albumsData.map(album => ({
      ...album,
      versions: (versionsData || []).filter((v: AlbumVersion) => v.album_id === album.id),
      total_cards: (countByAlbum[album.id] || 0) - (notCollectingByAlbum[album.id] || 0),
      owned_cards: ownedByAlbum[album.id] || 0,
    }));

    setAlbums(result);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  return {
    albums,
    loading,
    error,
    refetch: () => fetchAlbums(false),
    silentRefetch: () => fetchAlbums(true),
  };
}
