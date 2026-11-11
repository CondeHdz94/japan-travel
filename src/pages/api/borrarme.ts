import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { cerrarSesion, json, sesion } from '../../lib/sesion';

export const prerender = false;

/** Saca a la persona del grupo junto con todas sus marcas. */
export const POST: APIRoute = async ({ cookies }) => {
  const yo = sesion(cookies);
  if (!yo) return json({ error: 'Entra primero con tu nombre.' }, 401);

  const c = await db();
  await c.batch(
    [
      { sql: 'DELETE FROM marcas WHERE persona = ?', args: [yo] },
      { sql: 'DELETE FROM personas WHERE id = ?', args: [yo] },
    ],
    'write',
  );
  cerrarSesion(cookies);
  return json({ ok: true });
};
