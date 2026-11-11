import type { APIRoute } from 'astro';
import { db, estado, nombreValido } from '../../lib/db';
import { json, sesion } from '../../lib/sesion';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const yo = sesion(cookies);
  if (!yo) return json({ error: 'Entra primero con tu nombre.' }, 401);

  const body = await request.json().catch(() => null);
  const nombre = nombreValido(body?.nombre);
  if (!nombre) return json({ error: 'El nombre debe tener entre 2 y 20 letras.' }, 400);

  const c = await db();
  const otro = await c.execute({
    sql: 'SELECT 1 FROM personas WHERE nombre = ? AND id <> ?',
    args: [nombre, yo],
  });
  if (otro.rows.length) return json({ error: 'Ya hay alguien con ese nombre en el grupo.' }, 409);

  await c.execute({ sql: 'UPDATE personas SET nombre = ? WHERE id = ?', args: [nombre, yo] });
  return json(await estado(yo));
};
