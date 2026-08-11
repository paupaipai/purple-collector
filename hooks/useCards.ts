import { useState, useEffect, useCallback } from 'react';
import { Image } from 'expo-image';
import { supabase, getPhotocardUrl } from '../lib/supabase';
import { Album, CardWithStatus, CardStatus } from '../lib/types';
import { t } from '../lib/i18n';
import { COUNTRY_ORDER, DRAW_TYPE_ORDER } from '../lib/constants';

export function useAlbumCards(albumId: number | null, userId: string | null) {
  const [cards, setCards] = useState<CardWithStatus[]>([]);
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    if (!albumId) return;
    setLoading(true);
    setError(null);

    const [
      { data: albumData },
      { data: cardsData, error: fetchError },
      { data: cardExtraData },
      { data: categoryData },
    ] = await Promise.all([
      supabase.from('albums').select('*').eq('id', albumId).single(),
      supabase.from('cards_full').select('*').eq('album_id', albumId),
      supabase.from('cards').select('id, country, draw_type').eq('album_id', albumId),
      supabase.from('card_categories').select('id, sort_order'),
    ]);

    if (albumData) setAlbum(albumData);

    if (fetchError || !cardsData) {
      console.error('Error fetching cards:', fetchError);
      setError(t('errorCards'));
      setLoading(false);
      return;
    }

    let statusMap: Record<number, CardStatus> = {};
    let dupMap: Record<number, number> = {};
    if (userId) {
      const cardIds = cardsData.map((c: any) => c.id);
      const { data: ucData } = await supabase
        .from('user_cards')
        .select('card_id, status')
        .eq('user_id', userId)
        .in('card_id', cardIds);

      if (ucData) {
        ucData.forEach((uc: any) => {
          statusMap[uc.card_id] = uc.status;
          dupMap[uc.card_id] = 0;
        });
      }
    }

    const countryMap: Record<number, string | null> = {};
    const drawTypeMap: Record<number, string | null> = {};
    (cardExtraData || []).forEach((c: any) => {
      countryMap[c.id] = c.country;
      drawTypeMap[c.id] = c.draw_type;
    });

    const categoryOrderMap: Record<number, number> = {};
    (categoryData || []).forEach((c: any) => { categoryOrderMap[c.id] = c.sort_order; });

    const combined: CardWithStatus[] = cardsData.map((card: any) => ({
      ...card,
      country: countryMap[card.id] ?? null,
      draw_type: drawTypeMap[card.id] ?? null,
      category_sort_order: categoryOrderMap[card.category_id] ?? 999,
      status: statusMap[card.id] || null,
      duplicate_count: dupMap[card.id] ?? 0,
    }));

    combined.sort((a, b) => {
      const drawA = DRAW_TYPE_ORDER[a.draw_type ?? 'R1'] ?? DRAW_TYPE_ORDER.R1;
      const drawB = DRAW_TYPE_ORDER[b.draw_type ?? 'R1'] ?? DRAW_TYPE_ORDER.R1;
      if (drawA !== drawB) return drawA - drawB;

      const countryA = COUNTRY_ORDER[a.country ?? ''] ?? Infinity;
      const countryB = COUNTRY_ORDER[b.country ?? ''] ?? Infinity;
      if (countryA !== countryB) return countryA - countryB;

      return a.card_name.localeCompare(b.card_name);
    });

    setCards(combined);
    setLoading(false);

    const imageUrls = cardsData
      .filter((c: any) => c.image_url)
      .map((c: any) => getPhotocardUrl(c.image_url));
    if (imageUrls.length > 0) Image.prefetch(imageUrls);
  }, [albumId, userId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const setCardStatus = useCallback(async (cardId: number, status: CardStatus) => {
    if (!userId) return;

    // Optimistic update
    setCards(prev =>
      prev.map(c => c.id === cardId ? { ...c, status } : c)
    );

    const { error } = await supabase
      .from('user_cards')
      .upsert(
        { user_id: userId, card_id: cardId, status },
        { onConflict: 'user_id,card_id' }
      );

    if (error) {
      console.error('Error setting status:', error);
      fetchCards();
    }
  }, [userId, fetchCards]);

  const clearCardStatus = useCallback(async (cardId: number) => {
    if (!userId) return;
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: null } : c));
    const { error } = await supabase
      .from('user_cards')
      .delete()
      .eq('user_id', userId)
      .eq('card_id', cardId);
    if (error) {
      console.error('Error clearing status:', error);
      fetchCards();
    }
  }, [userId, fetchCards]);

  const setDuplicateCount = useCallback(async (cardId: number, count: number) => {
    if (!userId) return;
    const clamped = Math.max(0, count);
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, duplicate_count: clamped } : c));
    await supabase
      .from('user_cards')
      .upsert({ user_id: userId, card_id: cardId, duplicate_count: clamped }, { onConflict: 'user_id,card_id' });
  }, [userId]);

  return { cards, album, loading, error, setCardStatus, clearCardStatus, setDuplicateCount, refetch: fetchCards };
}
