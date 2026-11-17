// Las escenas de un lugar, para la ventana de Lugares (src/scripts/escenas.ts). Se arma al compilar:
// es información pública. Las imágenes se muestran desde anitabi (la ventana solo las pide con sesión).

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
    obras: obras.map((o) => ({ ...o, escenas: o.escenas.map(({ original, ...e }) => ({ ...e, imagen: original })) })),
  };
  return new Response(JSON.stringify(cuerpo), { headers: { 'content-type': 'application/json' } });
};
