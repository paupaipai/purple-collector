/**
 * Nombre sugerido para una card nueva.
 *
 * El catalogo sigue un formato bastante estable: `<Miembro> <set en singular>
 * [numero]`, p.ej. "Jin Mini PC 8", "RM Soundwave Lucky Draw PC",
 * "Suga DVD Photocard". En vez de inventar una regla, se copia el formato de
 * las cards HERMANAS (mismo set, o mismo album/version/categoria): se les quita
 * el miembro del principio y el numero del final, y queda la "base" comun.
 *
 * Si no hay hermanas, se arma desde el nombre del set o de la categoria
 * ("Mini PCs" -> "Mini PC").
 *
 * Es solo una sugerencia: la persona la puede editar, y el moderador la revisa.
 */

export interface SiblingCard {
  member: string;
  card_name: string;
}

const TRAILING_NUMBER = /\s+(\d+)$/;

/** Quita el miembro del principio. null si el nombre no empieza por el. */
function stripMember(name: string, member: string): string | null {
  const prefix = `${member} `;
  if (!name.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  const rest = name.slice(prefix.length).trim();
  return rest || null;
}

/** "Mini PCs" -> "Mini PC"; "DVD Photocards" -> "DVD Photocard"; "Samsung" -> "Samsung PC". */
export function baseFromLabel(label: string | null | undefined): string | null {
  const text = (label ?? '').trim();
  if (!text) return null;
  const singular = text
    .replace(/\bPCs$/i, 'PC')
    .replace(/\bPhotocards$/i, 'Photocard')
    .replace(/\bCards$/i, 'Card');
  return /(PC|Photocard|Card)$/i.test(singular) ? singular : `${singular} PC`;
}

export function suggestCardName(params: {
  member: string | null;
  siblings: SiblingCard[];
  setName?: string | null;
  categoryName?: string | null;
}): string | null {
  const { member, siblings, setName, categoryName } = params;
  if (!member) return null;

  // La base mas comun entre las hermanas, y si esa base va numerada.
  const bases = new Map<string, { count: number; numbered: boolean }>();
  for (const s of siblings) {
    const suffix = stripMember(s.card_name, s.member);
    if (!suffix) continue;
    const numbered = TRAILING_NUMBER.test(suffix);
    const base = suffix.replace(TRAILING_NUMBER, '').trim();
    if (!base) continue;
    const entry = bases.get(base) ?? { count: 0, numbered: false };
    entry.count += 1;
    entry.numbered = entry.numbered || numbered;
    bases.set(base, entry);
  }

  let base: string | null = null;
  let numbered = false;
  for (const [b, info] of bases) {
    if (!base || info.count > bases.get(base)!.count) {
      base = b;
      numbered = info.numbered;
    }
  }
  if (!base) base = baseFromLabel(setName) ?? baseFromLabel(categoryName);
  if (!base) return null;

  // Las que este miembro ya tiene con esa base: la nueva va despues. Una sin
  // numero cuenta como la 1 ("Jin Album PC" y luego "Jin Album PC 2").
  const mine: number[] = [];
  for (const s of siblings) {
    if (s.member !== member) continue;
    const suffix = stripMember(s.card_name, s.member);
    if (!suffix) continue;
    if (suffix === base) mine.push(1);
    else if (suffix.startsWith(`${base} `)) {
      const n = Number(suffix.slice(base.length + 1));
      if (Number.isInteger(n)) mine.push(n);
    }
  }

  if (mine.length > 0) return `${member} ${base} ${Math.max(...mine) + 1}`;
  if (numbered) return `${member} ${base} 1`;
  return `${member} ${base}`;
}
