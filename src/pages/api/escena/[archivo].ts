// La imagen de una escena de anime, solo con sesión: los fotogramas tienen derechos de su estudio,
// así que no están en public/ ni se ven sin entrar al viaje.
//
//   /api/escena/<id>.webp     la escena (640 px de ancho)
//   /api/escena/<id>-p.webp   su miniatura (240 px)
//
// Las imágenes viven en privado/escenas/ (las baja scripts/imagenes-escenas.mjs). Se incluyen en el
// código del servidor con import.meta.glob, así Vercel las empaqueta sin configuración aparte, y
// cada una se carga solo cuando alguien la pide.

import type { APIRoute } from 'astro';
import { json, sesion } from '../../../lib/sesion';

export const prerender = false;

const IMAGENES = import.meta.glob<string>('../../../../privado/escenas/*.webp', { query: '?inline', import: 'default' });
const porNombre = new Map(Object.entries(IMAGENES).map(([ruta, cargar]) => [ruta.split('/').pop()!, cargar]));

export const GET: APIRoute = async ({ params, cookies }) => {
  if (!sesion(cookies)) return json({ error: 'Entra primero con tu nombre.' }, 401);
  const archivo = params.archivo ?? '';
  if (!/^\d{1,9}-\w{1,32}(-p)?\.webp$/.test(archivo)) return json({ error: 'Imagen inválida.' }, 400);
  const cargar = porNombre.get(archivo);
  if (!cargar) return json({ error: 'Esa imagen todavía no está.' }, 404);
  // «data:image/webp;base64,…» → los bytes
  const datos = await cargar();
  const bytes = Buffer.from(datos.slice(datos.indexOf(',') + 1), 'base64');
  return new Response(bytes, {
    headers: {
      'content-type': 'image/webp',
      // privada: no la guarda ningún intermediario; el navegador sí, un día
      'cache-control': 'private, max-age=86400',
    },
  });
};
