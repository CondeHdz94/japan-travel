import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { json, sesion } from '../../lib/sesion';

export const prerender = false;

/**
 * Guarda hasta qué viajero ya se me anunció la llegada. Solo sube: si el celular y el portátil
 * lo mandan al tiempo, queda el mayor, y nadie se vuelve a anunciar.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const yo = sesion(cookies);
  if (!yo) return json({ error: 'Entra primero con tu nombre.' }, 401);

  const body = await request.json().catch(() => null);
  const hasta = body?.hasta;
  if (!Number.isInteger(hasta) || hasta < 1) return json({ error: 'Valor inválido.' }, 400);

  const c = await db();
  const r = await c.execute({
    // nunca más allá del último que existe: no se puede dar por visto a alguien que no ha llegado
    sql: `UPDATE personas SET visto = MAX(COALESCE(visto, 0), MIN(?, (SELECT MAX(id) FROM personas)))
          WHERE id = ?`,
    args: [hasta, yo],
  });
  if (!r.rowsAffected) return json({ error: 'Entra primero con tu nombre.' }, 401);
  return json({ ok: true });
};
