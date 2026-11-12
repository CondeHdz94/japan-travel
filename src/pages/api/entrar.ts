import type { APIRoute } from 'astro';
import { db, estado, formaLibre, nombreValido, personaLlamada } from '../../lib/db';
import { abrirSesion, claveCorrecta, json } from '../../lib/sesion';

export const prerender = false;

const MAX_PERSONAS = 12;

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  if (!claveCorrecta(body?.clave)) return json({ error: 'Esa no es la clave del viaje.' }, 401);
  const nombre = nombreValido(body?.nombre);
  if (!nombre) return json({ error: 'El nombre debe tener entre 2 y 20 letras.' }, 400);

  const c = await db();
  const ya = await personaLlamada(c, nombre);
  let id: number;
  if (ya !== null) {
    id = ya;
  } else {
    const total = await c.execute('SELECT COUNT(*) AS n FROM personas');
    if (Number(total.rows[0].n) >= MAX_PERSONAS)
      return json({ error: 'El grupo ya está completo.' }, 403);
    try {
      const nuevo = await c.execute({
        sql: 'INSERT INTO personas (nombre, forma) VALUES (?, ?) RETURNING id',
        args: [nombre, await formaLibre(c)],
      });
      id = Number(nuevo.rows[0].id);
    } catch (e) {
      // dos registros al tiempo con el mismo nombre: el segundo entra como el primero
      const ganador = await personaLlamada(c, nombre);
      if (ganador === null) throw e;
      id = ganador;
    }
  }

  abrirSesion(cookies, id);
  return json(await estado(id));
};
