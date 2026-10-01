import { useState, useEffect, useCallback } from 'react';
import { Image } from 'expo-image';
import { supabase, getCardImageUrl } from '../lib/supabase';
import { Album, CardWithStatus, CardStatus } from '../lib/types';
import { t } from '../lib/i18n';
import { COUNTRY_ORDER, DRAW_TYPE_ORDER } from '../lib/constants';

export function useAlbumCards(albumId: number | null, userId: string | null) {
  const [cards, setCards] = useState<CardWithStatus[]>([]);
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `silent` evita el spinner cuando la pantalla ya tiene datos en pantalla:
  // es lo que permite refrescar al volver al album sin que parpadee la grilla.
  // Mismo patron que useCollection, useWishlist y useEraAlbums.
  const fetchCards = useCallback(async (silent = false) => {
    if (!albumId) return;
    if (!silent) setLoading(true);
    setError(null);

    let results;
    try {
      // Right after a cold start (e.g. opening the app from a tapped
      // notification), the network can still be settling — without a
      // timeout a hung request here would leave this screen spinning
      // forever instead of surfacing the retryable error state below.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('album fetch timed out')), 8000)
      );
      // `cards_full` ya trae country, draw_type y category_sort_order, asi que
      // no hace falta pedirlos aparte ni recomponerlos en cliente.
      results = await Promise.race([
        Promise.all([
          supabase.from('albums').select('*').eq('id', albumId).single(),
          supabase.from('cards_full').select('*').eq('album_id', albumId),
        ]),
        timeout,
      ]);
    } catch (err) {
      console.error('Error fetching cards:', err);
      setError(t('errorCards'));
      setLoading(false);
      return;
    }

    const [
      { data: albumData },
      { data: cardsData, error: fetchError },
    ] = results;

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

    const combined: CardWithStatus[] = cardsData.map((card: any) => ({
      ...card,
      // card_categories.sort_order es nullable en el schema (hoy no hay ninguno
      // nulo); el 999 conserva el comportamiento de orden que habia antes.
      category_sort_order: card.category_sort_order ?? 999,
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

    // Precarga la imagen ya resuelta por la vista, no la ruta legacy cruda:
    // si una card tiene una aportacion aprobada, es esa la que se va a mostrar.
    const imageUrls = cardsData
      .map((c: any) => getCardImageUrl(c))
      .filter((u: string | null): u is string => !!u);
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

  // Memoizadas, y esto NO es cosmetico: las pantallas hacen
  //   useFocusEffect(useCallback(() => silentRefetch(), [silentRefetch]))
  // y useFocusEffect depende de la identidad del callback. Si estas funciones
  // se recrearan en cada render, el efecto se volveria a disparar despues de
  // cada setState que el propio fetch provoca: refrescar -> render -> nueva
  // identidad -> refrescar. Medido antes de arreglarlo: 87 consultas en 25
  // segundos con la app QUIETA.
  const refetchNow = useCallback(() => fetchCards(false), [fetchCards]);
  const refetchSilently = useCallback(() => fetchCards(true), [fetchCards]);

  return {
    cards, album, loading, error,
    setCardStatus, clearCardStatus, setDuplicateCount,
    refetch: refetchNow,
    silentRefetch: refetchSilently,
  };
}
