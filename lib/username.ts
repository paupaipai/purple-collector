import { supabase } from './supabase';

/**
 * El nombre de usuario publico.
 *
 * Es lo que firma lo que aportas: la pastilla `@` de la grilla sale de aqui.
 * Se elige al crear la cuenta y, si se salta ese paso, se pone desde el perfil.
 *
 * La validacion vive en un solo sitio porque hay DOS pantallas que lo guardan
 * --el alta y el perfil-- y si cada una llevara su propia copia de la regla,
 * acabarian discrepando. Las comprobaciones de verdad las hace la base de
 * todos modos (formato, lista de reservados e indice unico): esto solo sirve
 * para decirlo antes y mejor.
 */

/** Minusculas, numeros y guion bajo. Igual que la constraint de la base. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export type UsernameFailure =
  | 'no_session'
  | 'invalid'    // no cumple el formato
  | 'taken'      // ya lo tiene otra cuenta
  | 'reserved'   // esta en la lista de reservados
  | 'failed';

export type UsernameResult =
  | { ok: true; username: string }
  | { ok: false; reason: UsernameFailure };

/** Codigos de Postgres que llegan via PostgREST. */
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

/**
 * Guarda el nombre de usuario.
 *
 * Se normaliza a minusculas antes de validar en vez de rechazar "Paupau": la
 * persona escribio algo valido, solo que con mayusculas, y corregirlo por ella
 * es mas util que darle un error.
 */
export async function saveUsername(
  userId: string | null,
  raw: string,
): Promise<UsernameResult> {
  if (!userId) return { ok: false, reason: 'no_session' };

  const username = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) return { ok: false, reason: 'invalid' };

  const { error } = await supabase
    .from('user_profiles')
    .update({ username })
    .eq('id', userId);

  if (error) {
    const code = (error as any).code;
    // El formato ya se comprobo arriba, asi que un check_violation aqui solo
    // puede venir de la lista de nombres reservados.
    if (code === UNIQUE_VIOLATION) return { ok: false, reason: 'taken' };
    if (code === CHECK_VIOLATION) return { ok: false, reason: 'reserved' };
    return { ok: false, reason: 'failed' };
  }

  return { ok: true, username };
}

/** El nombre de usuario actual, o null si todavia no eligio uno. */
export async function fetchUsername(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from('user_profiles')
    .select('username')
    .eq('id', userId)
    .single();
  return data?.username ?? null;
}
