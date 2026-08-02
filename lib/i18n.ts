const en = {
  // Login
  loginTagline: 'Your BTS Photocard Tracker',
  loginDescription: 'Track, organize and grow your BTS photocard collection in one place',
  loginButton: 'Sign in with Google',
  loginDivider: 'your collection, tracked',
  loginFeature1: 'Sync across devices',
  loginFeature2: 'Track owned & wishlist',
  loginFeature3: 'Collection stats',
  loginQuote: '"I Purple You" — Kim Taehyung',

  // Tabs
  tabHome: 'Home',
  tabCollection: 'Collection',
  tabWishlist: 'Wishlist',
  tabProfile: 'Profile',

  // Home
  welcome: 'Welcome back, {name}',
  loadingCollection: 'Loading collection...',
  noAlbums: 'No albums yet',
  noAlbumsDesc: 'Albums will appear here once added',
  complete: 'COMPLETE ✓',

  // Collection
  myCollection: 'My Collection',
  photocardsOwned: '{n} photocards owned',
  labelAlbums: 'Albums',
  labelMembers: 'Members',
  labelRarePlus: 'Rare+',
  labelTotal: 'total',
  noCards: 'No cards yet',
  noCardsDesc: 'Mark photocards as "Have" in\nany album to build your collection',
  browseAlbums: 'Browse Albums',
  noCardsFilter: 'No cards match filters',
  filterAllAlbums: 'All Albums',
  filterAll: 'All',
  filterGroup: 'Group',
  searchPlaceholder: 'Search by card, member or album...',

  // Album detail
  photocardsOf: '{owned} of {total} Photocards',
  wordOf: 'of',
  wordPhotocards: 'Photocards',
  loadingCards: 'Loading cards...',

  // Wishlist
  wishlist: 'Wishlist',
  photocardsTracked: '{n} photocards tracked',
  loadingWishlist: 'Loading wishlist...',
  wishlistEmpty: 'Wishlist empty',
  wishlistEmptyDesc: 'Mark photocards as "Want" or "OTW"\nin any album to track them here',

  // Photocard status labels
  clearStatus: 'Pending',
  statusHave: 'Have',
  statusWant: 'Want',
  statusOtw: 'OTW',
  statusNotCollecting: 'Not Collecting',
  statusNone: 'Pending',

  // Profile
  owned: 'Owned',
  fullSets: 'Full sets',
  labelComplete: 'Complete',
  overallProgress: 'Overall Progress',
  cardsLeft: '{n} cards left to complete your collection',
  collectionComplete: 'Collection complete!',
  rarityBreakdown: 'Rarity Breakdown',
  memberCollection: 'Member Collection',
  albumProgress: 'Album Progress',
  account: 'Account',
  labelEmail: 'Email',
  labelProvider: 'Provider',
  labelLanguage: 'Language',
  signOut: 'Sign Out',
  version: 'Purple Collector v1.0.0 · Made with',
  affiliationDisclaimer: 'Purple Collector is an unofficial fan app. Not affiliated with BTS, HYBE or Big Hit Music.',
  privacyPolicy: 'Privacy Policy',

  // Catalog / types
  loadingTypes: 'Loading catalog...',
  errorTypes: "Couldn't load catalog. Check your connection.",
  noTypes: 'No collection types available',
  wordAlbums: 'albums',
  wordEras: 'eras',

  // Errors
  errorRetry: 'Try again',
  errorAlbums: "Couldn't load albums. Check your connection.",
  errorCollection: "Couldn't load collection. Check your connection.",
  errorWishlist: "Couldn't load wishlist. Check your connection.",
  errorCards: "Couldn't load cards. Check your connection.",

  // Onboarding
  onboardingTitle: 'Welcome to Purple Collector',
  onboardingSubtitle: 'Who is your bias?',
  onboardingBiasSubtitle: 'You can choose one or more',
  onboardingSkip: 'Skip for now',
  onboardingStart: 'Start collecting',
  continue: 'Continue',
  myBiases: 'My biases',
  edit: 'Edit',
  noBiasesSelected: 'No biases selected yet',
  bias: 'Bias',
  biases: 'Biases',
  saveChanges: 'Save changes',
  biasUpdated: 'Biases updated',

  // Premium
  premiumTitle: 'Purple Collector Premium',
  premiumSubtitle: 'Unlock advanced tools to organize your collection',
  premiumFeatureStats: 'Advanced stats: rarity, members & completion',
  premiumFeatureFilters: 'Member filter across your full collection',
  premiumFeatureMemberStats: 'Collection breakdown by each member',
  premiumFeatureUnlimited: 'Exclusive collector features',
  premiumFeatureSync: 'Full multi-device cloud sync',
  premiumFeaturePersonal: 'Personalization: bias, themes & avatar',
  premiumFeatureUpload: 'Upload your own photocards',
  premiumPriceMonthly: 'Monthly',
  premiumPriceAnnual: 'Annual',
  premiumTrialAnnual: 'Free 7-day trial, then $19.990/year',
  premiumPriceLifetime: 'Lifetime',
  premiumLockTitle: 'Premium Feature',
  premiumUnlock: 'Unlock Premium',
  premiumLegal: 'Subscriptions renew automatically. You can cancel anytime.',
  premiumPurchaseErrorTitle: 'Purchase failed',
  premiumPurchaseErrorBody: 'Something went wrong processing your purchase. Please try again.',
  premiumBadge: 'Premium Active ✓',
  premiumCTA: 'Unlock Premium Stats →',

  // Celebration
  celebrationTitle: 'Album Complete!',
  celebrationDesc: 'You collected every photocard in this album!',
  celebrationClose: 'Awesome!',

  // Delete account
  deleteAccount: 'Delete Account',
  deleteAccountTitle: 'Delete Account',
  deleteAccountWarning: 'This action is permanent and cannot be undone.\n\nDeleting your account will erase:\n• Your entire collection\n• Your wishlist\n• Your preferences and bias\n\nAre you sure you want to continue?',
  deleteAccountConfirmHint: 'Type DELETE to confirm',
  deleteAccountConfirmWord: 'DELETE',
  deleteAccountConfirmBtn: 'Delete my account',
  deleteAccountCancel: 'Cancel',
  deleteAccountDeleting: 'Deleting…',
  deleteAccountErrorTitle: 'Could not delete account',
  deleteAccountErrorBody: 'Something went wrong and your account was not deleted. Please try again, or contact support if the problem continues.',

  // Status help modal
  statusHelpLabel: 'Photocard status',
  statusHelpTitle: 'What does each status mean?',
  statusHelpPending: "You haven't classified it yet.",
  statusHelpHave: "It's already in your collection.",
  statusHelpWant: 'You want to get it.',
  statusHelpOtw: "It's already on the way.",
  statusHelpNotCollecting: 'You decided not to collect it.',
  statusHelpGotIt: 'Got it',
} as const;

const es: Translations = {
  // Login
  loginTagline: 'Tu Tracker de Photocards de BTS',
  loginDescription: 'Registra, organiza y haz crecer tu colección de photocards de BTS en un solo lugar',
  loginButton: 'Iniciar sesión con Google',
  loginDivider: 'tu colección, registrada',
  loginFeature1: 'Sincroniza entre dispositivos',
  loginFeature2: 'Registra lo que tienes y tu wishlist',
  loginFeature3: 'Estadísticas de tu colección',
  loginQuote: '"I Purple You" — Kim Taehyung',

  // Tabs
  tabHome: 'Inicio',
  tabCollection: 'Colección',
  tabWishlist: 'Wishlist',
  tabProfile: 'Perfil',

  // Home
  welcome: 'Bienvenida, {name}',
  loadingCollection: 'Cargando colección...',
  noAlbums: 'Sin álbumes aún',
  noAlbumsDesc: 'Los álbumes aparecerán aquí cuando estén disponibles',
  complete: 'COMPLETO ✓',

  // Collection
  myCollection: 'Mi Colección',
  photocardsOwned: '{n} photocards en mi colección',
  labelAlbums: 'Álbumes',
  labelMembers: 'Miembros',
  labelRarePlus: 'Rare+',
  labelTotal: 'total',
  noCards: 'Sin cards aún',
  noCardsDesc: 'Marca photocards como "Have" en\ncualquier álbum para armar tu colección',
  browseAlbums: 'Ver Álbumes',
  noCardsFilter: 'Sin resultados para estos filtros',
  filterAllAlbums: 'Todos los Álbumes',
  filterAll: 'Todos',
  filterGroup: 'Grupo',
  searchPlaceholder: 'Buscar por card, miembro o álbum...',

  // Album detail
  photocardsOf: '{owned} de {total} Photocards',
  wordOf: 'de',
  wordPhotocards: 'Photocards',
  loadingCards: 'Cargando cards...',

  // Wishlist
  wishlist: 'Wishlist',
  photocardsTracked: '{n} photocards en seguimiento',
  loadingWishlist: 'Cargando wishlist...',
  wishlistEmpty: 'Wishlist vacía',
  wishlistEmptyDesc: 'Marca photocards como "Want" o "OTW"\nen cualquier álbum para rastrearlas aquí',

  // Photocard status labels
  clearStatus: 'Pending',
  statusHave: 'Have',
  statusWant: 'Want',
  statusOtw: 'OTW',
  statusNotCollecting: 'Not Collecting',
  statusNone: 'Pending',

  // Profile
  owned: 'Tengo',
  fullSets: 'Sets completos',
  labelComplete: 'Completo',
  overallProgress: 'Progreso General',
  cardsLeft: '{n} cards para completar tu colección',
  collectionComplete: '¡Colección completa!',
  rarityBreakdown: 'Desglose por Rareza',
  memberCollection: 'Colección por Miembro',
  albumProgress: 'Progreso por Álbum',
  account: 'Cuenta',
  labelEmail: 'Email',
  labelProvider: 'Proveedor',
  labelLanguage: 'Idioma',
  signOut: 'Cerrar Sesión',
  version: 'Purple Collector v1.0.0 · Hecho con',
  affiliationDisclaimer: 'Purple Collector es una app de fans no oficial. Sin afiliación con BTS, HYBE ni Big Hit Music.',
  privacyPolicy: 'Política de Privacidad',

  // Catalog / types
  loadingTypes: 'Cargando catálogo...',
  errorTypes: 'No se pudo cargar el catálogo. Verifica tu conexión.',
  noTypes: 'Sin tipos de colección disponibles',
  wordAlbums: 'álbumes',
  wordEras: 'eras',

  // Errors
  errorRetry: 'Intentar de nuevo',
  errorAlbums: 'No se pudieron cargar los álbumes. Verifica tu conexión.',
  errorCollection: 'No se pudo cargar la colección. Verifica tu conexión.',
  errorWishlist: 'No se pudo cargar la wishlist. Verifica tu conexión.',
  errorCards: 'No se pudieron cargar las cards. Verifica tu conexión.',

  // Onboarding
  onboardingTitle: 'Bienvenida a Purple Collector',
  onboardingSubtitle: '¿Quién es tu bias?',
  onboardingBiasSubtitle: 'Puedes elegir uno o más bias',
  onboardingSkip: 'Saltar por ahora',
  onboardingStart: 'Empezar a coleccionar',
  continue: 'Continuar',
  myBiases: 'Mis bias',
  edit: 'Editar',
  noBiasesSelected: 'Aún no has elegido tus bias',
  bias: 'Bias',
  biases: 'Biases',
  saveChanges: 'Guardar cambios',
  biasUpdated: 'Bias actualizados',

  // Premium
  premiumTitle: 'Purple Collector Premium',
  premiumSubtitle: 'Desbloquea herramientas avanzadas para organizar tu colección',
  premiumFeatureStats: 'Estadísticas avanzadas: rareza, miembros y progreso',
  premiumFeatureFilters: 'Filtro por miembro en tu colección completa',
  premiumFeatureMemberStats: 'Desglose de colección por miembro',
  premiumFeatureUnlimited: 'Funciones collector exclusivas',
  premiumFeatureSync: 'Sincronización multi-dispositivo completa',
  premiumFeaturePersonal: 'Personalización: bias, temas y avatar',
  premiumFeatureUpload: 'Sube tus propias photocards',
  premiumPriceMonthly: 'Mensual',
  premiumPriceAnnual: 'Anual',
  premiumTrialAnnual: 'Prueba gratis 7 días, luego $19.990/año',
  premiumPriceLifetime: 'Lifetime',
  premiumLockTitle: 'Función Premium',
  premiumUnlock: 'Desbloquear Premium',
  premiumLegal: 'Las suscripciones se renuevan automáticamente. Puedes cancelar cuando quieras.',
  premiumPurchaseErrorTitle: 'Compra fallida',
  premiumPurchaseErrorBody: 'Algo salió mal al procesar tu compra. Intenta de nuevo.',
  premiumBadge: 'Premium Activo ✓',
  premiumCTA: 'Desbloquear Premium →',

  // Celebration
  celebrationTitle: '¡Álbum Completo!',
  celebrationDesc: '¡Tienes todas las photocards de este álbum!',
  celebrationClose: '¡Genial!',

  // Delete account
  deleteAccount: 'Eliminar Cuenta',
  deleteAccountTitle: 'Eliminar Cuenta',
  deleteAccountWarning: 'Esta acción es permanente y no se puede deshacer.\n\nAl eliminar tu cuenta se borrará:\n• Tu colección completa\n• Tu wishlist\n• Tus preferencias y bias\n\n¿Estás segura de que quieres continuar?',
  deleteAccountConfirmHint: 'Escribe ELIMINAR para confirmar',
  deleteAccountConfirmWord: 'ELIMINAR',
  deleteAccountConfirmBtn: 'Eliminar mi cuenta',
  deleteAccountCancel: 'Cancelar',
  deleteAccountDeleting: 'Eliminando…',
  deleteAccountErrorTitle: 'No se pudo eliminar la cuenta',
  deleteAccountErrorBody: 'Algo salió mal y tu cuenta no fue eliminada. Intenta de nuevo o contáctanos si el problema continúa.',

  // Status help modal
  statusHelpLabel: 'Estado de tus photocards',
  statusHelpTitle: '¿Qué significa cada estado?',
  statusHelpPending: 'Aún no la has clasificado.',
  statusHelpHave: 'Ya está en tu colección.',
  statusHelpWant: 'Quieres conseguirla.',
  statusHelpOtw: 'Ya viene en camino.',
  statusHelpNotCollecting: 'Decidiste no coleccionarla.',
  statusHelpGotIt: 'Entendido',
};

export type Lang = 'es' | 'en';
export type TranslationKey = keyof typeof en;
type Translations = Record<TranslationKey, string>;

export function detectLanguage(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.toLowerCase().startsWith('es') ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

let currentTranslations: Translations = en;

export function setLanguage(lang: Lang) {
  currentTranslations = lang === 'es' ? es : en;
}

export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  let str = currentTranslations[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}
