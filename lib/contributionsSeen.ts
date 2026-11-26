import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cuando miro esta persona por ultima vez "Mis aportes", en este dispositivo.
 *
 * Sirve para el contador del perfil ("2 nuevos"): un resultado es nuevo si se
 * reviso (reviewed_at) despues de esta marca. Vive en el dispositivo y no en la
 * base porque es una comodidad, no un dato: si se pierde, lo peor que pasa es
 * que el contador vuelve a contar resultados ya vistos una vez.
 */

const key = (userId: string) => `contributionsSeenAt:${userId}`;

/** ISO de la ultima visita, o null si nunca entro (o no se pudo leer). */
export async function getContributionsSeenAt(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

export async function markContributionsSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), new Date().toISOString());
  } catch {}
}
