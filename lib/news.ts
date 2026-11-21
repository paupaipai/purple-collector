import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Novedades de la app.
 *
 * Viven aqui, en el codigo, y no en Supabase: son pocas, tienen un diseño
 * propio cada una y se publican con un `eas update` / deploy web. Para agregar
 * una nueva basta con ponerla PRIMERA en NEWS con un id que no se haya usado:
 * el banner del inicio siempre muestra la primera, y vuelve a aparecer para
 * todos porque su id todavia no esta marcado como cerrado.
 */

type Localized = { es: string; en: string };

export interface NewsPrize {
  place: 1 | 2 | 3;
  label: Localized;
}

export interface NewsItem {
  id: string;
  /** Fecha de publicacion, YYYY-MM-DD. */
  date: string;
  tag: Localized;
  title: Localized;
  summary: Localized;
  cta: Localized;
  prizes?: NewsPrize[];
  footnote?: Localized;
  /** Parrafos del detalle. */
  body: Localized[];
  /** Pantalla a la que lleva el boton del detalle (p. ej. '/challenge'). */
  route?: string;
}

export const NEWS: NewsItem[] = [
  {
    id: 'community-challenge-2026-11',
    date: '2026-11-21',
    route: '/challenge',
    tag: { es: 'Evento especial', en: 'Special event' },
    title: { es: '¡Comienza el Community Challenge!', en: 'The Community Challenge begins!' },
    summary: {
      es: 'Estamos completando el catálogo con fotografías aportadas por la comunidad. ¡Ayúdanos y participa por hasta 12 meses de Premium!',
      en: "We're completing the catalog with photos from the community. Help us and compete for up to 12 months of Premium!",
    },
    cta: { es: 'Participar en el desafío', en: 'Join the challenge' },
    prizes: [
      { place: 1, label: { es: '12 meses', en: '12 months' } },
      { place: 2, label: { es: '6 meses', en: '6 months' } },
      { place: 3, label: { es: '3 meses', en: '3 months' } },
    ],
    footnote: { es: 'Ranking público por usuarios', en: 'Public ranking by user' },
    body: [
      {
        es: 'Muchas photocards del catálogo todavía usan imágenes de referencia. Queremos reemplazarlas por fotos reales de la comunidad.',
        en: 'Many photocards in the catalog still use reference images. We want to replace them with real photos from the community.',
      },
      {
        es: 'Cada photocard con frente y reverso aprobados suma 1 punto. Las tres personas con más puntos ganan Premium cuando se lance: 12, 6 y 3 meses.',
        en: 'Every photocard with an approved front and back scores 1 point. The three people with the most points win Premium when it launches: 12, 6 and 3 months.',
      },
      {
        es: 'En la pantalla del concurso puedes ver tus puntos, el ranking y las reglas completas.',
        en: 'On the challenge screen you can see your points, the ranking and the full rules.',
      },
    ],
  },
];

export const latestNews = (): NewsItem | null => NEWS[0] ?? null;

export const findNews = (id: string | undefined): NewsItem | null =>
  NEWS.find(n => n.id === id) ?? null;

export const pick = (l: Localized, lang: string) => (lang === 'en' ? l.en : l.es);

// Dos marcas por usuario y por dispositivo:
// - cerrada: el banner del inicio no vuelve a salir (sigue en la campanita).
// - vista:   la campanita deja de mostrar el punto.
// Abrir la noticia cuenta como vista Y cerrada: ya la leyo, no hace falta
// seguir ocupando el inicio con ella.
const dismissedKey = (uid: string) => `@purplecollector/news-dismissed:${uid}`;
const seenKey = (uid: string) => `@purplecollector/news-seen:${uid}`;

async function readSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

async function addTo(key: string, id: string) {
  const set = await readSet(key);
  if (set.has(id)) return;
  set.add(id);
  try { await AsyncStorage.setItem(key, JSON.stringify([...set])); } catch {}
}

export async function markNewsDismissed(uid: string | null, id: string) {
  if (uid) await addTo(dismissedKey(uid), id);
}

export async function markNewsSeen(uid: string | null, id: string) {
  if (!uid) return;
  await addTo(seenKey(uid), id);
  await addTo(dismissedKey(uid), id);
}

/**
 * Estado de las novedades para el inicio. Se relee al volver a la pantalla,
 * porque la noticia se marca como vista desde la pantalla de detalle.
 */
export function useNewsState(uid: string | null) {
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => {
    if (!uid) return;
    let cancelled = false;
    Promise.all([readSet(dismissedKey(uid)), readSet(seenKey(uid))]).then(([d, s]) => {
      if (!cancelled) { setDismissed(d); setSeen(s); }
    });
    return () => { cancelled = true; };
  }, [uid]));

  const latest = latestNews();
  // Mientras no se haya leido el almacenamiento (dismissed === null) no se
  // muestra el banner, para que no aparezca y desaparezca de golpe.
  const showBanner = !!latest && dismissed !== null && !dismissed.has(latest.id);
  const hasUnread = NEWS.some(n => !seen.has(n.id));

  const dismiss = useCallback(async () => {
    if (!latest) return;
    setDismissed(prev => new Set([...(prev ?? []), latest.id]));
    await markNewsDismissed(uid, latest.id);
  }, [uid, latest]);

  return { latest, showBanner, hasUnread, dismiss };
}
