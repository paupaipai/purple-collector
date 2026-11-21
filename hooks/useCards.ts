import { useCallback, useMemo } from 'react';

import { t } from '../lib/i18n';
import { clearMyCardStatus, setMyCardStatus, setMyDuplicateCount } from '../lib/myCards';
import { keys, refreshIfStale, refreshNow, useAlbumCatalogCards, useMyCards } from '../lib/queries';
import { CardStatus, CardWithStatus } from '../lib/types';

/**
 * Cartas de un album con mi estado. El catalogo del album se guarda por album
 * (5 min) y el estado sale de la cache compartida de "mis cartas": marcar aca
 * se ve al instante en Coleccion, Wishlist y Perfil.
 */
export function useAlbumCards(albumId: number | null, userId: string | null) {
  const catalog = useAlbumCatalogCards(albumId);
  const { userCards, error: myError } = useMyCards(userId);

  const cards: CardWithStatus[] = useMemo(() => {
    if (!catalog.data) return [];
    return catalog.data.cards.map(card => {
      const row = userCards?.[card.id];
      return { ...card, status: row?.status ?? null, duplicate_count: row?.duplicate_count ?? 0 };
    });
  }, [catalog.data, userCards]);

  const cardById = useCallback(
    (id: number) => catalog.data?.cards.find(c => c.id === id),
    [catalog.data],
  );

  const setCardStatus = useCallback(async (cardId: number, status: CardStatus) => {
    if (!userId) return;
    await setMyCardStatus(userId, cardById(cardId), cardId, status);
  }, [userId, cardById]);

  const clearCardStatus = useCallback(async (cardId: number) => {
    if (!userId) return;
    await clearMyCardStatus(userId, cardId);
  }, [userId]);

  const setDuplicateCount = useCallback(async (cardId: number, count: number) => {
    if (!userId) return;
    await setMyDuplicateCount(userId, cardById(cardId), cardId, count);
  }, [userId, cardById]);

  const refetch = useCallback(() => {
    refreshNow(keys.albumCards(albumId));
    refreshNow(keys.userCards(userId));
  }, [albumId, userId]);
  const silentRefetch = useCallback(() => {
    refreshIfStale(keys.albumCards(albumId));
    refreshIfStale(keys.userCards(userId));
  }, [albumId, userId]);

  return {
    cards,
    album: catalog.data?.album ?? null,
    // Sin mi estado todavia, la grilla mostraria todo como "no tengo".
    loading: catalog.isLoading || (!!userId && !userCards && !myError),
    error: catalog.error ? t('errorCards') : null,
    setCardStatus, clearCardStatus, setDuplicateCount,
    refetch,
    silentRefetch,
  };
}
