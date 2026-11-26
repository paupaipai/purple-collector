import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from './supabase';

/**
 * Community Challenge: lectura desde Supabase.
 *
 * Todo lo que es puntaje, posicion y ranking lo calcula la base (RPC
 * challenge_*). La app solo muestra: nunca suma puntos por su cuenta.
 */

export type ChallengeStatus = 'draft' | 'active' | 'reviewing' | 'finished';

export interface ChallengePrize { place: number; months: number }

export interface Challenge {
  id: number;
  slug: string;
  kind: 'catalog_images' | 'new_cards';
  title: string;
  status: ChallengeStatus;
  starts_at: string | null;
  ends_at: string | null;
  closed_at: string | null;
  finalized_at: string | null;
  rules_version: string;
  prizes: ChallengePrize[];
  eligible_count: number;
  completed_count: number;
}

export interface MyChallengeStats {
  /** Medios puntos posibles (0,5 por lado). Puede llegar como texto: usar formatPoints. */
  points: number;
  rank: number | null;
  pending_cards: number;
  incomplete_cards: number;
}

export interface LeaderboardRow {
  rank: number;
  username: string | null;
  points: number;
  is_me: boolean;
  total: number;
}

/** Dias que la tarjeta del inicio sigue visible tras publicar resultados. */
const SHOW_FINISHED_DAYS = 14;

/** ¿Va la tarjeta del concurso en el inicio? */
export function isChallengeHighlighted(c: Challenge | null): boolean {
  if (!c) return false;
  if (c.status === 'active' || c.status === 'reviewing') return true;
  if (c.status === 'finished' && c.finalized_at) {
    return Date.now() - new Date(c.finalized_at).getTime() < SHOW_FINISHED_DAYS * 86400_000;
  }
  return false;
}

/** ¿Se puede seguir aportando para sumar? */
export const isChallengeOpen = (c: Challenge | null) => c?.status === 'active';

export async function fetchCurrentChallenge(): Promise<Challenge | null> {
  const { data, error } = await supabase.rpc('challenge_current');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as Challenge) ?? null;
}

/**
 * Concurso vigente. Se relee al volver a la pantalla (el estado y el contador
 * de la comunidad cambian con cada aprobacion). Un fallo de red no rompe la
 * pantalla que lo usa: simplemente no se muestra nada del concurso.
 */
export function useCurrentChallenge(enabled = true) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!enabled) { setLoading(false); return; }
    let cancelled = false;
    fetchCurrentChallenge()
      .then(c => { if (!cancelled) { setChallenge(c); setError(null); } })
      .catch(e => { if (!cancelled) setError(e?.message ?? 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);

  useFocusEffect(load);

  return { challenge, loading, error, refetch: load };
}

export function useMyChallengeStats(challengeId: number | null) {
  const [stats, setStats] = useState<MyChallengeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (challengeId == null) { setLoading(false); return; }
    let cancelled = false;
    supabase.rpc('challenge_my_stats', { p_challenge_id: challengeId }).then(({ data, error }) => {
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      setStats(error ? null : (row as MyChallengeStats) ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [challengeId]));

  return { stats, loading };
}

const PAGE = 25;

/** Ranking paginado ("cargar mas"). */
export function useLeaderboard(challengeId: number | null) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (offset: number) => {
    const { data, error } = await supabase.rpc('challenge_leaderboard', {
      p_challenge_id: challengeId, p_limit: PAGE, p_offset: offset,
    });
    if (error) throw error;
    return (data ?? []) as LeaderboardRow[];
  }, [challengeId]);

  const reload = useCallback(() => {
    if (challengeId == null) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchPage(0)
      .then(page => {
        if (cancelled) return;
        setRows(page);
        setTotal(page[0]?.total ?? 0);
        setError(null);
      })
      .catch(e => { if (!cancelled) setError(e?.message ?? 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [challengeId, fetchPage]);

  useFocusEffect(reload);

  const loadMore = useCallback(async () => {
    if (loadingMore || rows.length >= total) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(rows.length);
      setRows(prev => [...prev, ...page]);
    } catch (e: any) {
      setError(e?.message ?? 'error');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, rows.length, total, fetchPage]);

  return { rows, total, loading, loadingMore, error, loadMore, hasMore: rows.length < total, reload };
}

export function formatChallengeDate(iso: string | null, lang: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export const PRIZE_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * Puntos para mostrar. Desde las reglas v2 cada lado vale 0,5, asi que hay
 * medios puntos: "3", "1,5" (es) / "1.5" (en). La base devuelve numeric, que
 * puede llegar como numero o como texto: se normaliza aca.
 */
export function formatPoints(value: number | string | null | undefined, lang: string): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  const text = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return lang === 'en' ? text : text.replace('.', ',');
}
