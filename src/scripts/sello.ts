// Lo que define cómo se ve el sello de cada quien, igual en el navegador (grupo.ts) y en el
// servidor (components/Sello.astro).

interface ConNombre {
  id: number;
  nombre: string;
}

/**
 * Iniciales del sello de cada persona: con un solo nombre, la inicial («Juan» → J); con
 * varias, la inicial de cada palabra («Juan Camilo» → JC, «Juan Pablo» → JP), como se dice en
 * Colombia. Si aun así dos chocan, se alarga la última palabra hasta distinguirlos
 * («Ana» y «Andrés» → Ana y And).
 */
export function iniciales(personas: ConNombre[]): Map<number, string> {
  const letras = (p: ConNombre, extra: number) => {
    const ps = p.nombre.toLowerCase().split(' ').filter(Boolean);
    const ultima = ps.pop() ?? '';
    const antes = ps.map((x) => x.charAt(0).toUpperCase()).join('');
    const fin = ultima.slice(0, 1 + extra);
    return antes + fin.charAt(0).toUpperCase() + fin.slice(1);
  };
  const m = new Map<number, string>();
  for (const p of personas) {
    let extra = 0;
    while (extra < 2 && personas.some((o) => o.id !== p.id && letras(o, extra) === letras(p, extra))) extra++;
    m.set(p.id, letras(p, extra));
  }
  return m;
}

/** Giro estable para un sello ya puesto: el mismo en cada visita. */
export function giroFijo(clave: string): number {
  // FNV-1a: mezcla bien claves casi iguales (personas con ids seguidos)
  let h = 0x811c9dc5;
  for (const ch of clave) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  h ^= h >>> 15;
  return ((h >>> 0) % 21) - 10;
}
