import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { supabase, getPhotocardUrl } from '../lib/supabase';
import { AlbumEraWithAlbums, AlbumVersion, AlbumWithStats } from '../lib/types';
import { t } from '../lib/i18n';

export function useEraAlbums(collectionTypeId: number | null, userId: string | null) {
  const [eras, setEras] = useState<AlbumEraWithAlbums[]>([]);
  const [typeName, setTypeName] = useState('');
  const [typeColor, setTypeColor] = useState('');
  const [typeIcon, setTypeIcon] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEraAlbums = useCallback(async (silent = false) => {
    if (!collectionTypeId) return;
    if (!silent) setLoading(true);
    setError(null);

    // Step 1: eras + type info en paralelo
    const [
      { data: typeData },
      { data: erasData, error: erasError },
    ] = await Promise.all([
      supabase.from('collection_types').select('name, color, icon').eq('id', collectionTypeId).single(),
      supabase.from('album_eras').select('*').eq('collection_type_id', collectionTypeId).order('sort_order'),
    ]);

    if (erasError || !erasData) {
      setError(t('errorAlbums'));
      setLoading(false);
      return;
    }

    if (typeData) {
      setTypeName(typeData.name);
      setTypeColor(typeData.color);
      setTypeIcon(typeData.icon || '');
    }

    const eraIds = erasData.map((e: any) => e.id);

    if (eraIds.length === 0) {
      setEras([]);
      setLoading(false);
      return;
    }

    // Step 2: álbumes filtrados por era_id directamente en Supabase
    const ownedQuery = userId
      ? supabase
          .from('user_cards')
          .select('card_id, cards!inner(album_id)')
          .eq('user_id', userId)
          .eq('status', 'have')
      : Promise.resolve({ data: null as any, error: null });

    const [
      { data: albumsData, error: albumsError },
      { data: versionsData },
      { data: cardCounts },
      { data: ownedData },
    ] = await Promise.all([
      supabase.from('albums').select('*').in('era_id', eraIds).eq('is_active', true).order('sort_order'),
      supabase.from('album_versions').select('*').order('sort_order'),
      supabase.from('cards').select('album_id'),
      ownedQuery,
    ]);

    // Owned count per album
    const ownedByAlbum: Record<number, number> = {};
    if (ownedData) {
      ownedData.forEach((uc: any) => {
        const aid = uc.cards?.album_id;
        if (aid) ownedByAlbum[aid] = (ownedByAlbum[aid] || 0) + 1;
      });
    }

    // Total cards per album
    const totalByAlbum: Record<number, number> = {};
    (cardCounts || []).forEach((c: any) => {
      totalByAlbum[c.album_id] = (totalByAlbum[c.album_id] || 0) + 1;
    });

    const albums = albumsData || [];

    // Build eras with their albums
    const result: AlbumEraWithAlbums[] = erasData.map((era: any) => ({
      ...era,
      albums: albums
        .filter((a: any) => a.era_id === era.id)
        .map((album: any): AlbumWithStats => ({
          ...album,
          versions: (versionsData || []).filter((v: AlbumVersion) => v.album_id === album.id),
          total_cards: totalByAlbum[album.id] || 0,
          owned_cards: ownedByAlbum[album.id] || 0,
        })),
    }));

    setEras(result);
    setLoading(false);

    const coverUrls = albums
      .filter((a: any) => a.cover_image_url)
      .map((a: any) => getPhotocardUrl(a.cover_image_url));
    if (coverUrls.length > 0) Image.prefetch(coverUrls);
  }, [collectionTypeId, userId]);

  useEffect(() => { fetchEraAlbums(); }, [fetchEraAlbums]);

  return {
    eras,
    typeName,
    typeColor,
    typeIcon,
    loading,
    error,
    refetch: () => fetchEraAlbums(false),
    silentRefetch: () => fetchEraAlbums(true),
  };
}
