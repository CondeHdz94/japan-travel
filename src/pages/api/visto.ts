import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { json, sesion } from '../../lib/sesion';

export const prerender = false;

/**
 * Guarda a quiénes ya me presentaron (`ids`). Solo suma: si el celular y el portátil lo mandan
 * al tiempo, quedan los dos, y nadie se vuelve a anunciar en ningún aparato.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const yo = sesion(cookies);
  if (!yo) return json({ error: 'Entra primero con tu nombre.' }, 401);

  const body = await request.json().catch(() => null);
  const ids = body?.ids;
  const valido = (id: unknown) => Number.isInteger(id) && (id as number) >= 1;
  if (!Array.isArray(ids) || !ids.length || ids.length > 50 || !ids.every(valido))
    return json({ error: 'Valor inválido.' }, 400);

  const c = await db();
  const r = await c.execute({ sql: 'SELECT 1 FROM personas WHERE id = ?', args: [yo] });
  if (!r.rows.length) return json({ error: 'Entra primero con tu nombre.' }, 401);
  await c.execute({
    // solo gente que existe y que no soy yo: no se puede dar por visto a alguien que no ha llegado
    sql: `INSERT OR IGNORE INTO vistos (persona, otro)
          SELECT ?, id FROM personas WHERE id <> ? AND id IN (${ids.map(() => '?').join(', ')})`,
    args: [yo, yo, ...ids],
  });
  return json({ ok: true });
};
