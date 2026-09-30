import { MemberInfo } from './types';

// Single switch to launch v1 fully unlocked without ripping out the paywall/RevenueCat code.
// false = todo desbloqueado (isPremium siempre true, paywall inaccesible).
// true  = comportamiento premium normal (v1.1+).
export const PREMIUM_ENABLED = false;

// Misma idea que PREMIUM_ENABLED: apaga la eleccion de bias sin sacar el codigo.
// false = no se pide bias en el onboarding, no aparece en el perfil ni en el home.
// true  = comportamiento normal (onboarding de bias + tarjeta "Mis bias" editable).
// Los bias ya guardados en Supabase/AsyncStorage se conservan intactos.
export const BIAS_ENABLED = false;

// Misma idea que PREMIUM_ENABLED: el tratamiento visual de las imagenes legacy
// existe pero viene apagado (decision D1 de Purple V2, "V2 podra aplicar
// blur/overlay/watermark").
//
// false = una legacy se ve igual que cualquier otra imagen.
// true  = blur + velo + etiqueta "Imagen Legacy" sobre la imagen, y etiqueta de
//         procedencia en el detalle.
//
// ENCENDIDO el 2026-09-30. El objetivo de esta etapa NO es ocultar la legacy:
// es marcarla como contenido de terceros dejando que se siga reconociendo QUE
// photocard es, para que el usuario pueda identificarla y decidir aportar una
// propia. De ahi que el blur sea moderado y el velo suave: si no se distinguiera
// la card, el catalogo dejaria de servir para lo que sirve.
export const LEGACY_TREATMENT_ENABLED = true;

// Solo aplican con LEGACY_TREATMENT_ENABLED = true.
//
// Calibrado mirando la grilla real en el simulador. Con radio 6 la photocard
// se volvia irreconocible, que es justo lo que NO se busca: el usuario tiene que
// poder identificar la card para decidir si aporta una propia.
//
// El velo es bajo a proposito porque se APILA con el de las cards no adquiridas
// (NOT_OWNED_IMAGE_OPACITY 0.65 + NOT_OWNED_OVERLAY_OPACITY 0.32). Con 0.30 las
// legacy no adquiridas quedaban casi negras.
export const LEGACY_BLUR_RADIUS = 3;
export const LEGACY_VEIL_COLOR = 'rgba(11,0,36,0.16)';

// Flujo de aporte de imagenes (FASE D).
//
// false = no aparece ninguna entrada para aportar imagenes.
// true  = el usuario puede aportar desde el detalle de una card.
//
// ENCENDIDO el 2026-09-29, una vez que FASE G dejo el circuito cerrado: la edge
// function moderate-card-image mueve el objeto del bucket privado de revision al
// publico al aprobar, y la bandeja de /admin/moderation permite aprobar y
// rechazar. Antes de eso habilitar el boton solo habria acumulado envios que
// nadie podia aprobar.
//
// OJO: expo-image-picker es un modulo NATIVO. En un dev client o un build
// anterior a su instalacion no existe, y pickContributionImage() devuelve
// 'unavailable' en vez de reventar. Para probarlo en dispositivo hace falta un
// build nuevo; en web funciona sin rebuild.
export const CONTRIBUTIONS_ENABLED = true;

// Aportar una CARD que no esta en el catalogo, no solo una imagen para una que
// ya existe (CONTRIBUTIONS_ENABLED).
//
// false = no aparece ninguna entrada para proponer cards nuevas.
// true  = el usuario puede proponerlas desde el perfil y desde el album.
//
// Viene apagada: encenderla antes de que la bandeja de moderacion este probada
// solo acumularia propuestas que nadie puede aprobar, que es exactamente el
// error que ya se cometio con CONTRIBUTIONS_ENABLED. Aprobar una propuesta CREA
// una card en el catalogo, asi que el coste de equivocarse es mayor que con una
// imagen: conviene mirar la bandeja con datos reales antes.
export const CARD_SUBMISSIONS_ENABLED = false;

export const COMMUNITY_BUCKET = 'photocard-community';
export const COMMUNITY_REVIEW_BUCKET = 'photocard-community-review';

// Debe coincidir con allowed_mime_types y file_size_limit de los buckets
// community (migration 20260928150106). Se valida en cliente ANTES de subir
// para dar un error legible en vez de un 400 del storage.
export const CONTRIBUTION_MAX_BYTES = 5 * 1024 * 1024;
export const CONTRIBUTION_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Version de los terminos que el usuario acepta al enviar. Se guarda en
// card_images.terms_version, asi queda registrado QUE texto acepto. Subir esta
// constante cada vez que cambien los terminos de contribucion.
export const CONTRIBUTION_TERMS_VERSION = '2026-09-29';

// Hosted from the paupaipai/purple-collector-legal repo (GitHub Pages), not this repo.
export const PRIVACY_URL = 'https://paupaipai.github.io/purple-collector-legal/';

export const COLORS = {
  bg: '#0B0024',
  surface1: '#160A30',
  surface2: '#261450',
  surfaceGlass: 'rgba(30, 12, 60, 0.65)',
  purple1: '#7B2FBE',
  purple2: '#A855F7',
  purple3: '#C084FC',
  purple4: '#E9D5FF',
  pink: '#E040A0',
  pinkGlow: '#FF60C0',
  gold: '#F0C040',
  green: '#4ADE80',
  textPrimary: '#FFFFFF',
  textSecondary: '#C8B0E8',
  textMuted: '#8B70AA',
  border: 'rgba(168, 85, 247, 0.15)',
  borderActive: 'rgba(168, 85, 247, 0.5)',
  categoryBadge: '#E040A0',
};

export const MEMBERS: MemberInfo[] = [
  { key: 'rm',       name: 'RM',       fullName: 'Kim Namjoon',   emoji: '🐨', colors: ['#1B4332', '#40916C', '#74C69D'] },
  { key: 'jin',      name: 'Jin',      fullName: 'Kim Seokjin',   emoji: '🐹', colors: ['#0D2B45', '#1976D2', '#64B5F6'] },
  { key: 'suga',     name: 'Suga',     fullName: 'Min Yoongi',    emoji: '🐱', colors: ['#1A1A2E', '#4A4A6A', '#9090B0'] },
  { key: 'jhope',    name: 'J-Hope',   fullName: 'Jung Hoseok',   emoji: '🐿',  colors: ['#7B2D00', '#E67700', '#FFB74D'] },
  { key: 'jimin',    name: 'Jimin',    fullName: 'Park Jimin',    emoji: '🐥', colors: ['#3A0065', '#9C27B0', '#E1BEE7'] },
  { key: 'v',        name: 'V',        fullName: 'Kim Taehyung',  emoji: '🐻', colors: ['#1B3A1B', '#388E3C', '#A5D6A7'] },
  { key: 'jungkook', name: 'Jungkook', fullName: 'Jeon Jungkook', emoji: '🐰', colors: ['#3E0060', '#8E24AA', '#CE93D8'] },
];

export const MEMBER_MAP = Object.fromEntries(
  MEMBERS.map(m => [m.name, m])
) as Record<string, MemberInfo>;

export const MEMBER_KEY_MAP = Object.fromEntries(
  MEMBERS.map(m => [m.key, m])
) as Record<string, MemberInfo>;

export function getMemberByKey(key: string): MemberInfo | undefined {
  return MEMBER_KEY_MAP[key];
}

export const RARITIES = {
  Common:       { symbol: '◆', color: '#8B8BAE', glow: 'rgba(139,139,174,0.4)' },
  Rare:         { symbol: '★', color: '#A855F7', glow: 'rgba(168,85,247,0.5)' },
  'Ultra Rare': { symbol: '◇', color: '#38BDF8', glow: 'rgba(56,189,248,0.5)' },
  Limited:      { symbol: '☆', color: '#F0C040', glow: 'rgba(240,192,64,0.5)' },
} as const;

export const RARITY_LABEL_KEY = {
  Common:       'rarityCommon',
  Rare:         'rarityRare',
  'Ultra Rare': 'rarityUltraRare',
  Limited:      'rarityLimited',
} as const;

export const STATUS_LABEL_KEY = {
  have:           'statusHave',
  want:           'statusWant',
  otw:            'statusOtw',
  not_collecting: 'statusNotCollecting',
} as const;

// Sort priority for the country column on cards. Countries not listed here
// (or null) sort last, alphabetically by card_name.
export const COUNTRY_ORDER: Record<string, number> = {
  KOREA: 0,
  JAPAN: 1,
  USA: 2,
};

// Sort priority for the draw_type column on cards (R1 before R2, etc).
// Cards without a draw_type (null) are treated as the base/R1 version.
export const DRAW_TYPE_ORDER: Record<string, number> = {
  R1: 0,
  R2: 1,
  R3: 2,
};

export const STATUS_CONFIG = {
  have:            { label: 'Have',            color: '#4ADE80', icon: '✓' },
  want:            { label: 'Want',            color: '#E040A0', icon: '♡' },
  otw:             { label: 'OTW',             color: '#FFAA00', icon: '►' },
  not_collecting:  { label: 'Not Collecting',  color: '#4A3A6A', icon: '✕' },
} as const;
