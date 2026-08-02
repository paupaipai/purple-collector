import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CardWithStatus } from '../lib/types';
import { t } from '../lib/i18n';

export function useCollection(userId: string | null) {
  const [cards, setCards] = useState<CardWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollection = useCallback(async (silent = false) => {
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
      .eq('status', 'have');

    if (ucError) {
      setError(t('errorCollection'));
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
      setError(t('errorCollection'));
      setLoading(false);
      return;
    }

    const statusMap: Record<number, 'have'> = {};
    ucData.forEach((uc: any) => { statusMap[uc.card_id] = 'have'; });

    const combined: CardWithStatus[] = cardsData.map((card: any) => ({
      ...card,
      status: statusMap[card.id] || null,
      duplicate_count: 0,
    }));

    setCards(combined);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  return {
    cards,
    loading,
    error,
    refetch: () => fetchCollection(false),
    silentRefetch: () => fetchCollection(true),
  };
}
