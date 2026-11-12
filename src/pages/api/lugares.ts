import type { APIRoute } from 'astro';
import { TEMAS, TEMPORADAS, ZONAS } from '../../data/lugares';
import { db } from '../../lib/db';
import { json, sesion } from '../../lib/sesion';

export const prerender = false;

const MAX_LUGARES = 300;

const texto = (x: unknown, max: number) =>
  typeof x === 'string' ? x.trim().replace(/\s+/g, ' ').slice(0, max) : '';

/** Solo enlaces https bien formados; cualquier otra cosa se descarta. */
function enlaceSeguro(x: unknown): string {
  const t = texto(x, 500);
  if (!t) return '';
  try {
    const u = new URL(t);
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

/** Alguien del grupo propone un lugar. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const yo = sesion(cookies);
  if (!yo) return json({ error: 'Entra primero con tu nombre.' }, 401);

  const b = await request.json().catch(() => null);
  const nombre = texto(b?.nombre, 60);
  if (nombre.length < 2) return json({ error: 'Ponle un nombre al lugar.' }, 400);
  if (!TEMAS.some((t) => t.id === b?.tema)) return json({ error: 'Escoge un tema.' }, 400);
  if (!ZONAS.some((z) => z.id === b?.zona)) return json({ error: 'Escoge una zona.' }, 400);
  if (b?.enlace && !enlaceSeguro(b.enlace))
    return json({ error: 'El enlace debe empezar por https://' }, 400);
  if (b?.imagen && !enlaceSeguro(b.imagen))
    return json({ error: 'El enlace de la foto debe empezar por https://' }, 400);

  const meses = TEMPORADAS.find((t) => t.id === b?.temporada)?.meses ?? [];

  const c = await db();
  const sigue = await c.execute({ sql: 'SELECT 1 FROM personas WHERE id = ?', args: [yo] });
  if (!sigue.rows.length) return json({ error: 'Entra primero con tu nombre.' }, 401);
  const total = await c.execute('SELECT COUNT(*) AS n FROM lugares');
  if (Number(total.rows[0].n) >= MAX_LUGARES)
    return json({ error: 'Ya hay demasiados lugares propuestos.' }, 403);

  const r = await c.execute({
    sql: `INSERT INTO lugares (nombre, tema, zona, nota, meses, enlace, imagen, persona)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      nombre,
      b.tema,
      b.zona,
      texto(b?.nota, 240),
      meses.join(','),
      enlaceSeguro(b?.enlace),
      enlaceSeguro(b?.imagen),
      yo,
    ],
  });
  const id = `u${r.rows[0].id}`;

  // quien lo propone, de entrada quiere ir
  await c.execute({
    sql: "INSERT OR IGNORE INTO marcas (persona, tipo, clave, valor) VALUES (?, 'lugar', ?, 1)",
    args: [yo, id],
  });
  return json({ id });
};
