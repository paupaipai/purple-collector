import { queryClient } from './queries';
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
  // `suggestions` solo viene con 'taken' o 'reserved': nombres libres para
  // ofrecer en vez de dejar a la persona adivinando.
  | { ok: false; reason: UsernameFailure; suggestions?: string[] };

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

  // `.select('id')` para saber si de verdad se toco una fila. Sin perfil
  // (el trigger de alta puede no haberlo creado), el UPDATE afecta 0 filas SIN
  // error: la app daba el nombre por guardado y lo volvia a pedir en cada
  // arranque. En ese caso se crea el perfil (policy "user_profiles insert own").
  let { data: updated, error } = await supabase
    .from('user_profiles')
    .update({ username })
    .eq('id', userId)
    .select('id');

  if (!error && (!updated || updated.length === 0)) {
    ({ error } = await supabase
      .from('user_profiles')
      .insert({ id: userId, username }));
  }

  if (error) {
    const code = (error as any).code;
    // El formato ya se comprobo arriba, asi que un check_violation aqui solo
    // puede venir de la lista de nombres reservados.
    if (code === UNIQUE_VIOLATION) {
      return { ok: false, reason: 'taken', suggestions: await suggestUsernames(username) };
    }
    if (code === CHECK_VIOLATION) {
      return { ok: false, reason: 'reserved', suggestions: await suggestUsernames(username) };
    }
    return { ok: false, reason: 'failed' };
  }

  // La base ya reescribio el @ de todos sus aportes (trigger
  // user_profiles_sync_handle_trg), pero las cartas guardadas en cache
  // seguirian mostrando el viejo hasta 2 min: se marcan viejas para que la
  // persona vea su nombre nuevo enseguida.
  queryClient.invalidateQueries({
    predicate: q => q.queryKey[0] === 'myCardDetails' || q.queryKey[0] === 'albumCards',
  });

  return { ok: true, username };
}

/**
 * El nombre de usuario actual, o null si todavia no eligio uno (o no tiene
 * perfil).
 *
 * LANZA si la consulta falla. Antes un error de red devolvia null, igual que
 * "no tiene nombre", y la app volvia a pedirlo a quien ya lo tenia. Quien
 * llama decide que hacer ante la duda (el arranque, no preguntar).
 */
export async function fetchUsername(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('user_profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.username ?? null;
}

/**
 * Nombres libres parecidos a `base`, para ofrecer cuando el elegido esta ocupado.
 *
 * Lo resuelve la base (`suggest_usernames`, SECURITY DEFINER) porque la RLS no
 * deja al cliente leer los perfiles de otros, asi que desde aqui no se puede
 * saber que nombres estan libres. Devuelve solo nombres, nunca filas.
 * Si falla, devuelve [] y la pantalla se queda con el mensaje de "ocupado".
 */
export async function suggestUsernames(base: string, howMany = 3): Promise<string[]> {
  const { data, error } = await supabase.rpc('suggest_usernames', { base, how_many: howMany });
  if (error || !Array.isArray(data)) return [];
  return (data as string[]).filter(u => USERNAME_RE.test(u));
}
