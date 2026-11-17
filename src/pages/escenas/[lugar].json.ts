// Las escenas de un lugar, para la ventana de Lugares (src/scripts/escenas.ts). Se arma al compilar:
// es información pública (sin imágenes; esas pasan por /api/escena/ y piden sesión).

import type { APIRoute, GetStaticPaths } from 'astro';
import { ESCENAS } from '../../data/escenas';
import { SEMILLAS } from '../../data/lugares';
import creditos from '../../data/fotos.json';

export const prerender = true;

export const getStaticPaths = (() => Object.keys(ESCENAS).map((lugar) => ({ params: { lugar } }))) satisfies GetStaticPaths;

const fotos = creditos as Record<string, { archivo: string }>;

export const GET: APIRoute = ({ params }) => {
  const id = params.lugar!;
  const l = SEMILLAS.find((x) => x.id === id)!;
  const { aparte, obras } = ESCENAS[id];
  const cuerpo = {
    lugar: { id, nombre: l.nombre, foto: fotos[id] ? `/lugares/${fotos[id].archivo}` : null },
    aparte: aparte ?? null,
    // la miniatura original de anitabi no sale de aquí: las imágenes se sirven desde el sitio
    obras: obras.map((o) => ({ ...o, escenas: o.escenas.map(({ original: _, ...e }) => e) })),
  };
  return new Response(JSON.stringify(cuerpo), { headers: { 'content-type': 'application/json' } });
};
