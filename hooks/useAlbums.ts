import { useState, useEffect, useCallback } from 'react';
import { supabase, fetchAllRows } from '../lib/supabase';
import { AlbumWithStats, AlbumVersion } from '../lib/types';
import { t } from '../lib/i18n';

export function useAlbums(userId: string | null) {
  const [albums, setAlbums] = useState<AlbumWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlbums = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    const userCardsQuery = userId
      ? supabase.from('user_cards').select('status, cards!inner(album_id)').eq('user_id', userId).in('status', ['have', 'not_collecting'])
      : Promise.resolve({ data: null as any, error: null });

    const [
      { data: albumsData, error: aErr },
      { data: versionsData },
      cardCounts,
      { data: userCardsData },
    ] = await Promise.all([
      supabase.from('albums').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('album_versions').select('*').order('sort_order'),
      fetchAllRows<{ album_id: number }>('cards', 'album_id'),
      userCardsQuery,
    ]);

    if (aErr || !albumsData) {
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

    const result: AlbumWithStats[] = albumsData.map(album => ({
      ...album,
      versions: (versionsData || []).filter((v: AlbumVersion) => v.album_id === album.id),
      total_cards: (cardCounts || []).filter((c: any) => c.album_id === album.id).length - (notCollectingByAlbum[album.id] || 0),
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
