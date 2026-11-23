// Los filtros de Lugares, sin DOM: qué lugar pasa, cómo se leen y escriben en la dirección y qué
// decir cuando no queda ninguno. Los usa el script de src/pages/lugares.astro.
//
// Regla: dentro de un filtro las opciones se suman (Tokio o Norte; verano o invierno) y entre
// filtros se cruzan (zona y temporada y mis sellos y anime y lo buscado).

import { TEMPORADAS, ZONAS } from '../data/lugares';

export interface Filtros {
  zona: string[];
  temp: string[];
  mios: boolean;
  anime: boolean;
  /** lo escrito en el buscador, tal cual (se compara sin tildes ni mayúsculas) */
  q: string;
}

/** Lo que el filtro necesita saber de una tarjeta (sale de sus atributos data-* y su texto). */
export interface LugarFiltrable {
  zona: string;
  /** meses en que se puede ir; sin meses, se puede todo el año */
  meses: number[] | null;
  mio: boolean;
  escenas: boolean;
  /** nombre, japonés, descripción y zona, ya pasados por `normalizar` */
  texto: string;
}

/** Para buscar: minúsculas y sin tildes ni macrones («Tōno» se encuentra escribiendo «tono»). */
export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const sinFiltros = (): Filtros => ({ zona: [], temp: [], mios: false, anime: false, q: '' });
export const copiar = (f: Filtros): Filtros => ({ ...f, zona: [...f.zona], temp: [...f.temp] });
export const cuantosPuestos = (f: Filtros) =>
  f.zona.length + f.temp.length + Number(f.mios) + Number(f.anime) + Number(normalizar(f.q) !== '');

const MESES = new Map(TEMPORADAS.map((t) => [t.id, t.meses]));

export function pasa(l: LugarFiltrable, f: Filtros): boolean {
  if (f.zona.length && !f.zona.includes(l.zona)) return false;
  // un lugar de todo el año no se esconde por la temporada
  if (f.temp.length && l.meses && !l.meses.some((m) => f.temp.some((t) => MESES.get(t)?.includes(m)))) return false;
  if (f.mios && !l.mio) return false;
  if (f.anime && !l.escenas) return false;
  // cada palabra buscada tiene que estar, en cualquier orden
  if (normalizar(f.q).split(' ').some((p) => p && !l.texto.includes(p))) return false;
  return true;
}

/** Valores de una lista de la dirección («tokio,norte»), sin repetidos ni desconocidos, en el orden del catálogo. */
function lista(valor: string | null, validos: string[]): string[] {
  const pedidos = new Set((valor ?? '').split(','));
  return validos.filter((v) => pedidos.has(v));
}

/** Lee los filtros de la dirección. Sirve también con un solo valor (`?t=otono`, de «Cuándo ir»). */
export function leerDireccion(search: string): Filtros {
  const q = new URLSearchParams(search);
  return {
    zona: lista(q.get('zona'), ZONAS.map((z) => z.id)),
    temp: lista(q.get('t'), TEMPORADAS.map((t) => t.id)),
    mios: q.get('mios') === '1',
    anime: q.get('anime') === '1',
    q: (q.get('q') ?? '').trim().slice(0, 60),
  };
}

/** «?zona=tokio,norte&t=verano&anime=1&q=kappa», o «» sin filtros. Las comas quedan legibles. */
export function escribirDireccion(f: Filtros): string {
  const q = f.q.trim();
  const partes = [
    f.zona.length && `zona=${f.zona.join(',')}`,
    f.temp.length && `t=${f.temp.join(',')}`,
    f.mios && 'mios=1',
    f.anime && 'anime=1',
    q && `q=${encodeURIComponent(q)}`,
  ].filter(Boolean);
  return partes.length ? `?${partes.join('&')}` : '';
}

const nombreZona = (id: string) => ZONAS.find((z) => z.id === id)?.nombre ?? id;
const nombreTemp = (id: string) => (TEMPORADAS.find((t) => t.id === id)?.nombre ?? id).toLowerCase();
/** «A», «A o B», «A, B o C». */
const enLista = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} o ${xs.at(-1)}`);

/** Lo que dice la página cuando no queda ningún lugar: qué filtros la dejan vacía. */
export function queDejaVacio(f: Filtros): string {
  const q = f.q.trim();
  const que = [
    q && `con «${q}»`,
    f.anime && 'que salga en anime',
    f.mios && 'con tu sello',
    f.zona.length && `en ${enLista(f.zona.map(nombreZona))}`,
    f.temp.length && `en ${enLista(f.temp.map(nombreTemp))}`,
  ].filter(Boolean);
  return que.length ? `Ningún lugar ${que.join(' ')}.` : 'No hay nada con ese filtro.';
}

/** Texto del botón de un menú: «Todas las zonas», «Tokio» o «Zona · 2». */
export function textoMenu(grupo: 'zona' | 'temp', escogidos: string[]): string {
  if (!escogidos.length) return grupo === 'zona' ? 'Todas las zonas' : 'Todo el año';
  if (escogidos.length === 1) return grupo === 'zona' ? nombreZona(escogidos[0]) : `En ${nombreTemp(escogidos[0])}`;
  return `${grupo === 'zona' ? 'Zona' : 'Temporada'} · ${escogidos.length}`;
}
