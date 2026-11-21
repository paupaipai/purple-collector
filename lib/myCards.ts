import { CardDetailsMap, keys, queryClient, UserCardsMap } from './queries';
import { supabase } from './supabase';
import { CardFull, CardStatus } from './types';

/**
 * Escrituras sobre "mis cartas". Actualizan la cache compartida AL INSTANTE
 * (todas las pantallas lo ven sin pedir nada) y despues escriben en Supabase.
 * Si la escritura falla, se vuelve a pedir el estado real para no mostrar algo
 * que no se guardo.
 */

function patchUserCard(uid: string, cardId: number, patch: Partial<{ status: CardStatus | null; duplicate_count: number }> | null) {
  queryClient.setQueryData<UserCardsMap>(keys.userCards(uid), prev => {
    if (!prev) return prev;
    const next = { ...prev };
    if (patch === null) delete next[cardId];
    else {
      const base = prev[cardId] ?? { status: null, duplicate_count: 0 };
      next[cardId] = { ...base, ...patch };
    }
    return next;
  });
}

/** La carta pasa a ser "mia": se guarda su detalle para no tener que pedirlo. */
function rememberCard(uid: string, card: CardFull | undefined) {
  if (!card) return;
  queryClient.setQueryData<CardDetailsMap>(keys.myCardDetails(uid), prev =>
    prev && !prev[card.id] ? { ...prev, [card.id]: card } : prev);
}

async function resyncOnError(uid: string, error: unknown, label: string) {
  console.error(`[myCards] ${label}:`, error);
  await queryClient.invalidateQueries({ queryKey: keys.userCards(uid) });
}

export async function setMyCardStatus(uid: string, card: CardFull | undefined, cardId: number, status: CardStatus) {
  patchUserCard(uid, cardId, { status });
  rememberCard(uid, card);
  const { error } = await supabase
    .from('user_cards')
    .upsert({ user_id: uid, card_id: cardId, status }, { onConflict: 'user_id,card_id' });
  if (error) await resyncOnError(uid, error, 'setStatus');
  return !error;
}

export async function clearMyCardStatus(uid: string, cardId: number) {
  patchUserCard(uid, cardId, null);
  const { error } = await supabase.from('user_cards').delete().eq('user_id', uid).eq('card_id', cardId);
  if (error) await resyncOnError(uid, error, 'clearStatus');
  return !error;
}

export async function setMyDuplicateCount(uid: string, card: CardFull | undefined, cardId: number, count: number) {
  const clamped = Math.max(0, count);
  patchUserCard(uid, cardId, { duplicate_count: clamped });
  rememberCard(uid, card);
  const { error } = await supabase
    .from('user_cards')
    .upsert({ user_id: uid, card_id: cardId, duplicate_count: clamped }, { onConflict: 'user_id,card_id' });
  if (error) await resyncOnError(uid, error, 'setDuplicate');
  return !error;
}
