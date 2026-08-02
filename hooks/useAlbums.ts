import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AlbumWithStats, AlbumVersion } from '../lib/types';
import { t } from '../lib/i18n';

export function useAlbums(userId: string | null) {
  const [albums, setAlbums] = useState<AlbumWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlbums = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    const ownedQuery = userId
      ? supabase.from('user_cards').select('card_id, cards!inner(album_id)').eq('user_id', userId).eq('status', 'have')
      : Promise.resolve({ data: null as any, error: null });

    const [
      { data: albumsData, error: aErr },
      { data: versionsData },
      { data: cardCounts },
      { data: ownedData },
    ] = await Promise.all([
      supabase.from('albums').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('album_versions').select('*').order('sort_order'),
      supabase.from('cards').select('album_id'),
      ownedQuery,
    ]);

    if (aErr || !albumsData) {
      console.error('Error fetching albums:', aErr);
      setError(t('errorAlbums'));
      setLoading(false);
      return;
    }

    const ownedByAlbum: Record<number, number> = {};
    if (ownedData) {
      ownedData.forEach((uc: any) => {
        const aid = uc.cards.album_id;
        ownedByAlbum[aid] = (ownedByAlbum[aid] || 0) + 1;
      });
    }

    const result: AlbumWithStats[] = albumsData.map(album => ({
      ...album,
      versions: (versionsData || []).filter((v: AlbumVersion) => v.album_id === album.id),
      total_cards: (cardCounts || []).filter((c: any) => c.album_id === album.id).length,
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
