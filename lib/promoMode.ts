import { ImageSourcePropType } from 'react-native';
import {
  promoAlbumCover,
  promoIllustrated,
  promoMemberAvatar,
  promoProfilePhoto,
  promoSilhouettes,
} from './promoImages';

export { promoAlbumCover, promoMemberAvatar } from './promoImages';

// Client-only visual toggle for recording promo material (Reels, screenshots).
// When on, photocard IMAGES are swapped for local demo art; every other piece
// of data (member, album, version, category, rarity, status, counters,
// progress, filters) still comes from Supabase untouched. Album covers,
// avatars, and the app logo are never affected — see components that import
// this for the exact scope.
//
// EXPO_PUBLIC_ vars are inlined by Expo/Metro at build time, so setting
// EXPO_PUBLIC_PROMO_MODE=true in .env.local (or the shell before `expo start`)
// is all that's needed — no other wiring. Leave unset/false for normal builds.
export const PROMO_MODE = process.env.EXPO_PUBLIC_PROMO_MODE === 'true';

// Opt-in, separate from PROMO_MODE: only true once a real personal photo has
// been dropped into assets/promo/profile-photo.png (replacing its placeholder)
// AND this is explicitly set. Otherwise the Purple Collector logo is shown
// instead of the real Google/Apple account photo — there's no reliable way to
// detect "is this file still the placeholder" at runtime, so this flag is the
// explicit signal instead of guessing from file contents.
const PROMO_HAS_PROFILE_PHOTO = process.env.EXPO_PUBLIC_PROMO_PROFILE_PHOTO === 'true';

// Purple Collector logo, reused here as the profile-photo fallback (see
// getPromoProfilePhoto below) — never swapped by PROMO_MODE itself.
const purpleCollectorLogo = require('../assets/images/logo.png');

export function getPromoProfilePhoto(): ImageSourcePropType {
  return PROMO_HAS_PROFILE_PHOTO ? promoProfilePhoto : purpleCollectorLogo;
}

// category_short values (card_categories table) that read as illustration-style
// art rather than photo cutouts, so they get the "illustrated" pool instead of
// the "silhouette" default. Anything not listed here (including categories we
// can't easily classify, e.g. jp_edition_pc, lenticular_pc, tour, album_pola,
// inclusion, poster, others) falls back to silhouettes.
const ILLUSTRATED_CATEGORIES = new Set([
  'pob',
  'lucky_draw',
  'exclusive',
  'merch_pc',
  'event_pc',
]);

export function getPromoCardImage({
  seed,
  categoryShort,
  isWishlist = false,
}: {
  // Stable per-card number to pick a repeatable image out of the pool —
  // callers pass card.id so the same card always renders the same demo art.
  seed: number;
  categoryShort?: string | null;
  isWishlist?: boolean;
}): ImageSourcePropType | null {
  const useIllustrated = isWishlist || (!!categoryShort && ILLUSTRATED_CATEGORIES.has(categoryShort));
  const pool = useIllustrated ? promoIllustrated : promoSilhouettes;
  if (pool.length === 0) return null;
  const index = ((seed % pool.length) + pool.length) % pool.length;
  return pool[index];
}
