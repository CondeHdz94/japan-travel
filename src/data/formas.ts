// Formas de sello. Todas se dibujan en la misma caja de 32 × 48 (los 1.6 × 2.4 rem del sello),
// así que cambiar de forma no mueve nada en la página. El contorno es el `trazo` dentro de un
// <svg viewBox="0 0 32 48">; los ajustes de texto por forma están en global.css (`.f-<id>`).
//
// El orden es el de asignación: a quien llega se le da la primera que nadie tenga, y las
// primeras son las que mejor se distinguen entre sí.

export interface Forma {
  id: string;
  /** Nombre que se muestra al escogerla. */
  nombre: string;
  /** Qué es, en pocas palabras. */
  pista: string;
  trazo: string;
}

export const FORMAS: Forma[] = [
  {
    id: 'koban',
    nombre: 'Koban',
    pista: 'óvalo',
    trazo: '<rect x="1.25" y="1.25" width="29.5" height="45.5" rx="14.75"/>',
  },
  {
    id: 'maru',
    nombre: 'Maru',
    pista: 'círculo',
    trazo: '<circle cx="16" cy="15.5" r="14.25"/>',
  },
  {
    id: 'sumikiri',
    nombre: 'Sumikiri',
    pista: 'esquinas cortadas',
    trazo:
      '<polygon points="8.25,1.25 23.75,1.25 30.75,8.25 30.75,39.75 23.75,46.75 8.25,46.75 1.25,39.75 1.25,8.25"/>',
  },
  {
    id: 'kikko',
    nombre: 'Kikkō',
    pista: 'hexágono',
    trazo: '<polygon points="16,1.25 30.75,10 30.75,38 16,46.75 1.25,38 1.25,10"/>',
  },
  {
    id: 'ema',
    nombre: 'Ema',
    pista: 'tablilla de santuario',
    trazo: '<path d="M16,1.25 L30.75,11 V46.75 H1.25 V11 Z"/>',
  },
  {
    id: 'tanzaku',
    nombre: 'Tanzaku',
    pista: 'tira de papel',
    trazo: '<rect x="1.25" y="1.25" width="29.5" height="45.5" rx="5"/>',
  },
  {
    id: 'hyotan',
    nombre: 'Hyōtan',
    pista: 'calabaza',
    trazo: '<path d="M12,18.31 A9,9 0 1 1 20,18.31 A14.5,14.5 0 1 1 12,18.31 Z"/>',
  },
  {
    id: 'arco',
    nombre: 'Arco',
    pista: 'ventana',
    trazo: '<path d="M1.25,46.75 V16 A14.75,14.75 0 0 1 30.75,16 V46.75 Z"/>',
  },
  {
    id: 'masu',
    nombre: 'Masu',
    pista: 'cuadrado',
    trazo: '<rect x="1.25" y="1.25" width="29.5" height="29.5" rx="3"/>',
  },
  {
    id: 'sumiire',
    nombre: 'Sumi-ire',
    pista: 'esquinas hundidas',
    trazo:
      '<path d="M7.25,1.25 H24.75 A6,6 0 0 0 30.75,7.25 V40.75 A6,6 0 0 0 24.75,46.75 H7.25 A6,6 0 0 0 1.25,40.75 V7.25 A6,6 0 0 0 7.25,1.25 Z"/>',
  },
  {
    id: 'taru',
    nombre: 'Taru',
    pista: 'barril',
    trazo: '<path d="M7,1.25 H25 C32.5,14 32.5,34 25,46.75 H7 C-0.5,34 -0.5,14 7,1.25 Z"/>',
  },
  {
    id: 'kaku',
    nombre: 'Kaku',
    pista: 'doble marco',
    trazo:
      '<rect x="1" y="1" width="30" height="46" rx="1" stroke-width="1.6"/><rect x="4.4" y="4.4" width="23.2" height="39.2" stroke-width="1"/>',
  },
];

export const esForma = (x: unknown): x is string =>
  typeof x === 'string' && FORMAS.some((f) => f.id === x);

/** La forma con ese id; si no existe (dato viejo o dañado), la primera. */
export const formaDe = (id: unknown): Forma => FORMAS.find((f) => f.id === id) ?? FORMAS[0];
