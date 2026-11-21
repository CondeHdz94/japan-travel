import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { cerrarSesion, json, sesion } from '../../lib/sesion';

export const prerender = false;

/** Saca a la persona del grupo junto con sus marcas y los lugares que propuso. */
export const POST: APIRoute = async ({ cookies }) => {
  const yo = sesion(cookies);
  if (!yo) return json({ error: 'Entra primero con tu nombre.' }, 401);

  const c = await db();
  await c.batch(
    [
      // sus lugares propuestos se van con la persona (y los sellos que tuvieran),
      // porque nadie más los podría quitar después
      {
        sql: "DELETE FROM marcas WHERE tipo = 'lugar' AND clave IN (SELECT 'u' || id FROM lugares WHERE persona = ?)",
        args: [yo],
      },
      { sql: 'DELETE FROM lugares WHERE persona = ?', args: [yo] },
      { sql: 'DELETE FROM marcas WHERE persona = ?', args: [yo] },
      { sql: 'DELETE FROM vistos WHERE persona = ? OR otro = ?', args: [yo, yo] },
      { sql: 'DELETE FROM personas WHERE id = ?', args: [yo] },
    ],
    'write',
  );
  cerrarSesion(cookies);
  return json({ ok: true });
};
