import { useCallback, useMemo } from 'react';

import { t } from '../lib/i18n';
import { setMyCardStatus } from '../lib/myCards';
import { combine, keys, refreshIfStale, refreshNow, useMyCards } from '../lib/queries';
import { CardStatus, CardWithStatus } from '../lib/types';

const ORDER: Record<string, number> = { want: 0, otw: 1 };

/** Cartas que quiero o vienen en camino. Sale de la cache compartida. */
export function useWishlist(userId: string | null) {
  const { userCards, details, loading, error } = useMyCards(userId);

  const cards: CardWithStatus[] = useMemo(() => {
    const list = combine(userCards, details, r => r.status === 'want' || r.status === 'otw');
    return list.sort((a, b) => (ORDER[a.status!] ?? 3) - (ORDER[b.status!] ?? 3));
  }, [userCards, details]);

  const setCardStatus = useCallback(async (cardId: number, status: CardStatus) => {
    if (!userId) return;
    await setMyCardStatus(userId, details?.[cardId], cardId, status);
  }, [userId, details]);

  const refetch = useCallback(() => {
    refreshNow(keys.userCards(userId));
    refreshNow(keys.myCardDetails(userId));
  }, [userId]);
  const silentRefetch = useCallback(() => {
    refreshIfStale(keys.userCards(userId));
    refreshIfStale(keys.myCardDetails(userId));
  }, [userId]);

  return {
    cards,
    loading,
    error: error ? t('errorWishlist') : null,
    setCardStatus,
    refetch,
    silentRefetch,
  };
}
