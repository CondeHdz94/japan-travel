import type { APIRoute } from 'astro';
import { db, estado, nombreValido } from '../../lib/db';
import { abrirSesion, claveCorrecta, json } from '../../lib/sesion';

export const prerender = false;

const MAX_PERSONAS = 12;

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  if (!claveCorrecta(body?.clave)) return json({ error: 'Esa no es la clave del viaje.' }, 401);
  const nombre = nombreValido(body?.nombre);
  if (!nombre) return json({ error: 'El nombre debe tener entre 2 y 20 letras.' }, 400);

  const c = await db();
  const ya = await c.execute({ sql: 'SELECT id FROM personas WHERE nombre = ?', args: [nombre] });
  let id: number;
  if (ya.rows.length) {
    id = Number(ya.rows[0].id);
  } else {
    const total = await c.execute('SELECT COUNT(*) AS n FROM personas');
    if (Number(total.rows[0].n) >= MAX_PERSONAS)
      return json({ error: 'El grupo ya está completo.' }, 403);
    const nuevo = await c.execute({
      sql: 'INSERT INTO personas (nombre) VALUES (?) RETURNING id',
      args: [nombre],
    });
    id = Number(nuevo.rows[0].id);
  }

  abrirSesion(cookies, id);
  return json(await estado(id));
};
