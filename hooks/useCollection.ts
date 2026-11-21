import { useCallback, useMemo } from 'react';

import { t } from '../lib/i18n';
import { combine, keys, refreshIfStale, refreshNow, useMyCards } from '../lib/queries';
import { CardWithStatus } from '../lib/types';

/**
 * Cartas que tengo. Sale de la cache compartida de "mis cartas"
 * (lib/queries.ts): no hace pedidos propios.
 */
export function useCollection(userId: string | null) {
  const { userCards, details, loading, error } = useMyCards(userId);

  const cards: CardWithStatus[] = useMemo(
    () => combine(userCards, details, r => r.status === 'have'),
    [userCards, details],
  );

  // Estables (useCallback): las pantallas las usan en useFocusEffect.
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
    error: error ? t('errorCollection') : null,
    refetch,
    silentRefetch,
  };
}
