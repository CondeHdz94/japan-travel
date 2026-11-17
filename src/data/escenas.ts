// Escenas de anime que pasan en lugares del catálogo (聖地巡礼). Los datos los arma
// scripts/escenas.mjs a partir de anitabi (CC BY-NC-SA 4.0); lo revisado a mano está en
// escenas-revision.json. Las imágenes no se copian: la ventana las muestra desde anitabi.

import datos from './escenas.json' with { type: 'json' };

/** confirmada: con una fuente aparte · validada: el punto cuadra con el lugar · por-confirmar: como vino */
export type EstadoEscena = 'confirmada' | 'validada' | 'por-confirmar';

export interface Escena {
  /** «<id de la entrega en bgm.tv>-<id del punto en anitabi>»; también es el nombre de la imagen */
  id: string;
  /** el punto exacto, como lo nombra anitabi (en japonés: así se busca allá) */
  punto: string;
  /** episodio («7», «ED2», …) o null */
  ep: string | null;
  /** segundo de la escena dentro del episodio, o null */
  s: number | null;
  /** la entrega, si no es la primera («Temporada 2», «Película: …») */
  parte: string | null;
  fuente: { autor: string; enlace: string };
  /** la captura en anitabi; la ventana la muestra desde allá con ?plan=h360 o h160 */
  original: string;
  estado: EstadoEscena;
  /** enlace de la fuente aparte que la confirma */
  confirmacion?: string;
  /** si el punto no queda en el lugar: dónde queda y a cuánto («A unos 10 min en el tren Enoden») */
  queda?: string;
}

export interface Obra {
  /** id de la serie en scripts/escenas.config.mjs */
  serie: string;
  /** nombre a mostrar: el de Latinoamérica, el inglés oficial o el rōmaji */
  nombre: string;
  /** el rōmaji, solo cuando es distinto del nombre */
  romaji?: string;
  /** quien hizo la animación (no es el dueño de los derechos) */
  estudio: string | null;
  /** no se sabe con certeza qué obra es */
  dudoso?: boolean;
  /** de la escena principal a la última */
  escenas: Escena[];
}

export interface EscenasLugar {
  /** si las escenas no son en el lugar mismo sino cerca: «en puntos cercanos, a 10–20 min en tren» */
  aparte?: string;
  /** de la obra con más escenas en este lugar a la que menos */
  obras: Obra[];
}

export const ESCENAS = datos.lugares as Record<string, EscenasLugar>;

/** Lo que va en la tarjeta: cuántas obras, las dos primeras y si las escenas son en otro punto. */
export function resumenTarjeta(lugar: string) {
  const e = ESCENAS[lugar];
  if (!e) return null;
  return { obras: e.obras.length, nombres: e.obras.slice(0, 2).map((o) => o.nombre), aparte: e.aparte };
}

/** Cuántas escenas tiene un lugar. */
export const totalEscenas = (lugar: string) => ESCENAS[lugar]?.obras.reduce((n, o) => n + o.escenas.length, 0) ?? 0;

export { momento } from '../lib/momento';
