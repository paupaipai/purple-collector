// Local demo photocard art shown only when PROMO_MODE is on (see promoMode.ts).
// Metro resolves require() paths statically at bundle time, so these can't be
// built dynamically from a template string — each one has to be listed here.
//
// These 14 files start out as 1x1 placeholder PNGs so the app keeps bundling
// before the real art is dropped in. Replace them in place (same file names)
// at assets/promo/silhouettes/01–07.png and assets/promo/illustrated/01–07.png.

export const promoSilhouettes = [
  require('../assets/promo/silhouettes/01.png'),
  require('../assets/promo/silhouettes/02.png'),
  require('../assets/promo/silhouettes/03.png'),
  require('../assets/promo/silhouettes/04.png'),
  require('../assets/promo/silhouettes/05.png'),
  require('../assets/promo/silhouettes/06.png'),
  require('../assets/promo/silhouettes/07.png'),
];

export const promoIllustrated = [
  require('../assets/promo/illustrated/01.png'),
  require('../assets/promo/illustrated/02.png'),
  require('../assets/promo/illustrated/03.png'),
  require('../assets/promo/illustrated/04.png'),
  require('../assets/promo/illustrated/05.png'),
  require('../assets/promo/illustrated/06.png'),
  require('../assets/promo/illustrated/07.png'),
];

// Single-image swaps (not pools) — one demo asset reused everywhere that kind
// of thing renders. Same placeholder-until-replaced convention as above.
export const promoAlbumCover = require('../assets/promo/album-cover.png');
export const promoMemberAvatar = require('../assets/promo/member-avatar.png');
export const promoProfilePhoto = require('../assets/promo/profile-photo.png');
