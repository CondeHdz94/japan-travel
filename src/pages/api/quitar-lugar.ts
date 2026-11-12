import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { json, sesion } from '../../lib/sesion';

export const prerender = false;

/** Quien propuso un lugar lo puede quitar, junto con los sellos que tenga. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const yo = sesion(cookies);
  if (!yo) return json({ error: 'Entra primero con tu nombre.' }, 401);

  const b = await request.json().catch(() => null);
  const m = typeof b?.id === 'string' ? /^u(\d{1,9})$/.exec(b.id) : null;
  if (!m) return json({ error: 'Lugar inválido.' }, 400);

  const c = await db();
  const r = await c.execute({
    sql: 'DELETE FROM lugares WHERE id = ? AND persona = ?',
    args: [Number(m[1]), yo],
  });
  if (!r.rowsAffected) return json({ error: 'Solo quien lo propuso puede quitarlo.' }, 403);

  await c.execute({ sql: "DELETE FROM marcas WHERE tipo = 'lugar' AND clave = ?", args: [b.id] });
  return json({ ok: true });
};
