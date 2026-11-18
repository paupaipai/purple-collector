import type { Router } from 'expo-router';

/**
 * Volver atras sin quedarse pegado.
 *
 * `router.back()` sin historial NO hace nada, y en la web eso pasa seguido:
 * al recargar la pagina, al entrar por un enlace directo a un album, o al
 * reabrir la pestaña, la pantalla es la primera del stack. El boton parecia
 * roto. Sin a donde volver, se va a `fallback` (por defecto, el inicio).
 */
export function goBack(router: Router, fallback: string = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as any);
}

/** Area tactil extra para los botones de volver (36px es poco para el dedo). */
export const BACK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
