import { MemberInfo } from './types';

// Single switch to launch v1 fully unlocked without ripping out the paywall/RevenueCat code.
// false = todo desbloqueado (isPremium siempre true, paywall inaccesible).
// true  = comportamiento premium normal (v1.1+).
export const PREMIUM_ENABLED = false;

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

export const STATUS_LABEL_KEY = {
  have:           'statusHave',
  want:           'statusWant',
  otw:            'statusOtw',
  not_collecting: 'statusNotCollecting',
} as const;

export const STATUS_CONFIG = {
  have:            { label: 'Have',            color: '#4ADE80', icon: '✓' },
  want:            { label: 'Want',            color: '#E040A0', icon: '♡' },
  otw:             { label: 'OTW',             color: '#FFAA00', icon: '►' },
  not_collecting:  { label: 'Not Collecting',  color: '#4A3A6A', icon: '✕' },
} as const;
