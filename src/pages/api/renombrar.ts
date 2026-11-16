import type { APIRoute } from 'astro';
import { db, estado, nombreValido, personaLlamada, TINTAS } from '../../lib/db';
import { json, sesion } from '../../lib/sesion';
import { esForma } from '../../data/formas';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const yo = sesion(cookies);
  if (!yo) return json({ error: 'Entra primero con tu nombre.' }, 401);

  const body = await request.json().catch(() => null);
  const nombre = nombreValido(body?.nombre);
  if (!nombre) return json({ error: 'El nombre debe tener entre 2 y 20 letras.' }, 400);

  // la forma y el color del sello son opcionales: si no vienen, se quedan los que tenía
  const forma = body?.forma ?? null;
  if (forma !== null && !esForma(forma)) return json({ error: 'Esa forma de sello no existe.' }, 400);
  const tinta = body?.tinta ?? null;
  if (tinta !== null && !(Number.isInteger(tinta) && tinta >= 0 && tinta < TINTAS))
    return json({ error: 'Ese color de sello no existe.' }, 400);

  const c = await db();
  if ((await personaLlamada(c, nombre, yo)) !== null)
    return json({ error: 'Ya hay alguien con ese nombre en el grupo.' }, 409);

  // El color es lo que distingue a cada uno de lejos: no se puede tomar el de otro. La forma sí
  // se puede repetir. La condición va en el mismo UPDATE, así dos que escogen el mismo color al
  // tiempo no quedan iguales. Quedarse con el color que ya se tiene siempre vale: en un grupo de
  // más de 6 los colores se repiten, y guardar el nombre no puede fallar por eso.
  const r = await c.execute({
    sql: `UPDATE personas SET nombre = ?, forma = COALESCE(?, forma), tinta = COALESCE(?, tinta)
          WHERE id = ? AND (? IS NULL OR tinta = ?
            OR NOT EXISTS (SELECT 1 FROM personas o WHERE o.tinta = ? AND o.id <> ?))`,
    args: [nombre, forma, tinta, yo, tinta, tinta, tinta, yo],
  });
  if (!r.rowsAffected) {
    const due = tinta === null ? null : await c.execute({ sql: 'SELECT nombre FROM personas WHERE tinta = ? AND id <> ?', args: [tinta, yo] });
    const de = due?.rows[0]?.nombre;
    if (de) return json({ error: `Ese color ya es de ${de}.` }, 409);
    // pudo haberse borrado desde otro dispositivo
    return json({ error: 'Entra primero con tu nombre.' }, 401);
  }
  return json(await estado(yo));
};
