import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const isWeb = Platform.OS === 'web';

// ⚠️ Reemplazar con tus valores: Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://qlswdqqjtqepxfqagooi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Hu97XQLavdKWoY2YgRDhfg_t3rRv2bf';

const storage = Platform.OS === 'web'
  ? typeof window !== 'undefined' ? window.localStorage : undefined
  : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
  },
});

// Bump manually (e.g. 'v2') only after a bulk re-upload of images to the
// 'photocards' bucket, then commit — this is the only thing that busts the
// on-device expo-image cache, since bucket objects don't carry an updated_at.
const IMAGE_CACHE_VERSION = 'v1';

export function getPhotocardUrl(imagePath: string): string {
  const { data } = supabase.storage.from('photocards').getPublicUrl(imagePath);
  return `${data.publicUrl}?v=${IMAGE_CACHE_VERSION}`;
}

// PostgREST caps unbounded selects at 1000 rows by default, so any query that
// can grow past that needs explicit pagination or the select silently
// truncates instead of erroring. This bites both the catalog ('cards', 4500+
// rows) and a single user's own 'user_cards' — a collection of 1127 owned
// cards was being reported as exactly 1000 everywhere.
const PAGE_SIZE = 1000;

// PostgREST puts filters in the query string, so a long `in.(...)` list blows
// past the URL length limit (a 3376-card wishlist is ~17KB of ids). Batch it.
const IN_CHUNK_SIZE = 500;

export type PagedResult<T> = { data: T[]; error: any };

/**
 * Drains a select page by page instead of letting PostgREST cap it at 1000.
 *
 * `build` must return a *fresh* query builder on every call — builders are
 * single-use. `orderColumn` is not optional in spirit: without an ORDER BY,
 * Postgres doesn't guarantee consistent row order across separate .range()
 * calls, so pages can silently overlap or skip rows (this is what made album
 * and type card counts flicker between fetches).
 */
export async function fetchAllPages<T = any>(
  build: () => any,
  orderColumn = 'id',
): Promise<PagedResult<T>> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await build().order(orderColumn).range(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { data: rows, error: null };
}

/**
 * Same idea for `.in(col, ids)` lookups: splits `ids` into URL-safe batches and
 * paginates each one. `build` receives one batch and returns the query for it.
 */
export async function fetchAllByIds<T = any>(
  ids: (number | string)[],
  build: (chunk: (number | string)[]) => any,
  orderColumn = 'id',
): Promise<PagedResult<T>> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + IN_CHUNK_SIZE);
    const { data, error } = await fetchAllPages<T>(() => build(chunk), orderColumn);
    rows.push(...data);
    if (error) return { data: rows, error };
  }
  return { data: rows, error: null };
}

export async function fetchAllRows<T = any>(table: string, columns: string): Promise<T[]> {
  const { data, error } = await fetchAllPages<T>(() => supabase.from(table).select(columns));
  if (error) throw error;
  return data;
}
