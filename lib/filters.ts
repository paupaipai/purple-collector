/**
 * Filtros de varias opciones (miembro, categoria, album, estado).
 *
 * Una lista vacia = sin filtro. Dentro de una misma seccion las opciones se
 * suman (Jimin O Jungkook); entre secciones se restan (Jimin Y Album PC).
 */

/** 'Group' es una opcion mas: las cards grupales, que no tienen un solo miembro. */
export function matchesMembers(card: { member: string; is_group: boolean }, members: string[]): boolean {
  if (members.length === 0) return true;
  if (card.is_group && members.includes('Group')) return true;
  return members.includes(card.member);
}

/** Saca una opcion de la lista (el chip con la X). */
export function without(list: string[], value: string): string[] {
  return list.filter(v => v !== value);
}
