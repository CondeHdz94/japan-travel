import type { APIRoute } from 'astro';
import { db, estado, formaLibre, nombreValido, personaLlamada, tintaLibre } from '../../lib/db';
import { abrirSesion, claveCorrecta, json } from '../../lib/sesion';

export const prerender = false;

const MAX_PERSONAS = 12;

/**
 * Entrar al viaje con nombre y clave.
 *
 * Si el nombre ya está en el grupo (sin contar mayúsculas, tildes ni espacios), no se entra de
 * una: se responde 409 con `existe` para que el registro pregunte «¿eres tú?». Solo con
 * `soyYo: true` se entra como esa persona. Así un segundo «Juan» no queda convertido en el primero.
 *
 * Quien se registra recibe `nuevo: true` (para su bienvenida) y su «visto» queda en su propio
 * id: a los que estaban antes no se los anuncia como llegadas.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  if (!claveCorrecta(body?.clave)) return json({ error: 'Esa no es la clave del viaje.' }, 401);
  const nombre = nombreValido(body?.nombre);
  if (!nombre) return json({ error: 'El nombre debe tener entre 2 y 20 letras.' }, 400);
  const soyYo = body?.soyYo === true;

  const c = await db();
  const yaEsta = async (id: number) => {
    if (soyYo) return id;
    const r = await c.execute({ sql: 'SELECT nombre FROM personas WHERE id = ?', args: [id] });
    const suyo = String(r.rows[0]?.nombre ?? nombre);
    return json({ error: `Ya hay alguien llamado ${suyo} en el viaje.`, existe: suyo }, 409);
  };

  const ya = await personaLlamada(c, nombre);
  let id: number;
  let nuevo = false;
  if (ya !== null) {
    const r = await yaEsta(ya);
    if (r instanceof Response) return r;
    id = r;
  } else {
    const total = await c.execute('SELECT COUNT(*) AS n FROM personas');
    if (Number(total.rows[0].n) >= MAX_PERSONAS)
      return json({ error: 'El grupo ya está completo.' }, 403);
    try {
      const r = await c.execute({
        sql: 'INSERT INTO personas (nombre, forma, tinta) VALUES (?, ?, ?) RETURNING id',
        args: [nombre, await formaLibre(c), await tintaLibre(c)],
      });
      id = Number(r.rows[0].id);
      // su «visto» es su propio id: todos los de antes ya estaban cuando llegó
      await c.execute({ sql: 'UPDATE personas SET visto = id WHERE id = ?', args: [id] });
      nuevo = true;
    } catch (e) {
      // dos registros al tiempo con el mismo nombre: el segundo recibe la misma pregunta
      const ganador = await personaLlamada(c, nombre);
      if (ganador === null) throw e;
      const r = await yaEsta(ganador);
      if (r instanceof Response) return r;
      id = r;
    }
  }

  abrirSesion(cookies, id);
  return json({ ...(await estado(id)), nuevo });
};
