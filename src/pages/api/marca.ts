import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { json, sesion } from '../../lib/sesion';

export const prerender = false;

/** Qué se puede marcar y con qué valores. */
const TIPOS: Record<string, number[]> = {
  mes: [1], // puedo viajar ese mes
  ventana: [0, 1, 2], // no puedo · me sirve · me encanta
  papel: [1], // ya lo tengo
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const yo = sesion(cookies);
  if (!yo) return json({ error: 'Entra primero con tu nombre.' }, 401);

  const body = await request.json().catch(() => null);
  const { tipo, clave, valor } = body ?? {};
  const permitidos = typeof tipo === 'string' ? TIPOS[tipo] : undefined;
  if (!permitidos || typeof clave !== 'string' || !/^[a-z0-9-]{1,32}$/.test(clave))
    return json({ error: 'Marca inválida.' }, 400);

  const c = await db();
  if (valor === null) {
    await c.execute({
      sql: 'DELETE FROM marcas WHERE persona = ? AND tipo = ? AND clave = ?',
      args: [yo, tipo, clave],
    });
  } else if (permitidos.includes(valor)) {
    await c.execute({
      // solo si la persona sigue en el grupo (pudo haberse borrado desde otro dispositivo)
      sql: `INSERT INTO marcas (persona, tipo, clave, valor)
            SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM personas WHERE id = ?)
            ON CONFLICT (persona, tipo, clave) DO UPDATE SET valor = excluded.valor`,
      args: [yo, tipo, clave, valor, yo],
    });
  } else {
    return json({ error: 'Valor inválido.' }, 400);
  }
  return json({ ok: true });
};
