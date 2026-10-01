import { useState, useEffect, useCallback } from 'react';
import { fetchAllByIds, fetchAllPages, supabase } from '../lib/supabase';
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

    // Paginado: un usuario con mas de 1000 cards en 'have' veia su coleccion
    // cortada en exactamente 1000 (el cap por defecto de PostgREST).
    const { data: ucData, error: ucError } = await fetchAllPages<{ card_id: number; status: 'have' }>(
      () => supabase
        .from('user_cards')
        .select('card_id, status')
        .eq('user_id', userId)
        .eq('status', 'have'),
    );

    if (ucError) {
      setError(t('errorCollection'));
      setLoading(false);
      return;
    }

    if (ucData.length === 0) {
      setCards([]);
      setLoading(false);
      return;
    }

    const cardIds = ucData.map((uc: any) => uc.card_id);
    // Por lotes: `in.(...)` viaja en la query string y con miles de ids la URL
    // supera el limite del servidor.
    const { data: cardsData, error: cardsError } = await fetchAllByIds<any>(
      cardIds,
      chunk => supabase.from('cards_full').select('*').in('id', chunk),
    );

    if (cardsError) {
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

  // Memoizadas, y esto NO es cosmetico: las pantallas hacen
  //   useFocusEffect(useCallback(() => silentRefetch(), [silentRefetch]))
  // y useFocusEffect depende de la identidad del callback. Si estas funciones
  // se recrearan en cada render, el efecto se volveria a disparar despues de
  // cada setState que el propio fetch provoca: refrescar -> render -> nueva
  // identidad -> refrescar. Medido antes de arreglarlo: 87 consultas en 25
  // segundos con la app QUIETA.
  const refetchNow = useCallback(() => fetchCollection(false), [fetchCollection]);
  const refetchSilently = useCallback(() => fetchCollection(true), [fetchCollection]);

  return {
    cards,
    loading,
    error,
    refetch: refetchNow,
    silentRefetch: refetchSilently,
  };
}
