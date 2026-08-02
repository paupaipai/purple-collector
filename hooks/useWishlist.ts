import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CardWithStatus, CardStatus } from '../lib/types';
import { t } from '../lib/i18n';

export function useWishlist(userId: string | null) {
  const [cards, setCards] = useState<CardWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWishlist = useCallback(async (silent = false) => {
    if (!userId) {
      setCards([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);

    const { data: ucData, error: ucError } = await supabase
      .from('user_cards')
      .select('card_id, status')
      .eq('user_id', userId)
      .in('status', ['want', 'otw']);

    if (ucError) {
      console.error('[useWishlist] user_cards error:', JSON.stringify(ucError));
      setError(t('errorWishlist'));
      setLoading(false);
      return;
    }

    if (!ucData || ucData.length === 0) {
      setCards([]);
      setLoading(false);
      return;
    }

    const cardIds = ucData.map((uc: any) => uc.card_id);
    const { data: cardsData, error: cardsError } = await supabase
      .from('cards_full')
      .select('*')
      .in('id', cardIds);

    if (cardsError || !cardsData) {
      console.error('[useWishlist] cards_full error:', JSON.stringify(cardsError));
      setError(t('errorWishlist'));
      setLoading(false);
      return;
    }

    const statusMap: Record<number, CardStatus> = {};
    ucData.forEach((uc: any) => { statusMap[uc.card_id] = uc.status; });

    const combined: CardWithStatus[] = cardsData.map((card: any) => ({
      ...card,
      status: statusMap[card.id] || null,
      duplicate_count: 0,
    }));

    const order: Record<string, number> = { want: 0, otw: 1 };
    combined.sort((a, b) => (order[a.status!] ?? 3) - (order[b.status!] ?? 3));

    setCards(combined);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const setCardStatus = useCallback(async (cardId: number, status: CardStatus) => {
    if (!userId) return;

    if (status === 'have' || status === 'not_collecting') {
      setCards(prev => prev.filter(c => c.id !== cardId));
    } else {
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, status } : c));
    }

    const { error } = await supabase
      .from('user_cards')
      .upsert(
        { user_id: userId, card_id: cardId, status },
        { onConflict: 'user_id,card_id' }
      );

    if (error) {
      console.error('[useWishlist] upsert error:', JSON.stringify(error));
      fetchWishlist();
    }
  }, [userId, fetchWishlist]);

  return {
    cards,
    loading,
    error,
    setCardStatus,
    refetch: () => fetchWishlist(false),
    silentRefetch: () => fetchWishlist(true),
  };
}
