import type { APIRoute } from 'astro';
import { db, estado, nombreValido, personaLlamada } from '../../lib/db';
import { json, sesion } from '../../lib/sesion';
import { esForma } from '../../data/formas';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const yo = sesion(cookies);
  if (!yo) return json({ error: 'Entra primero con tu nombre.' }, 401);

  const body = await request.json().catch(() => null);
  const nombre = nombreValido(body?.nombre);
  if (!nombre) return json({ error: 'El nombre debe tener entre 2 y 20 letras.' }, 400);

  // la forma del sello es opcional: si no viene, se queda la que tenía
  const forma = body?.forma ?? null;
  if (forma !== null && !esForma(forma)) return json({ error: 'Esa forma de sello no existe.' }, 400);

  const c = await db();
  if ((await personaLlamada(c, nombre, yo)) !== null)
    return json({ error: 'Ya hay alguien con ese nombre en el grupo.' }, 409);

  const r = await c.execute({
    sql: 'UPDATE personas SET nombre = ?, forma = COALESCE(?, forma) WHERE id = ?',
    args: [nombre, forma, yo],
  });
  // pudo haberse borrado desde otro dispositivo
  if (!r.rowsAffected) return json({ error: 'Entra primero con tu nombre.' }, 401);
  return json(await estado(yo));
};
