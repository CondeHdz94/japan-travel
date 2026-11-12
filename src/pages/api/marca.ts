import type { APIRoute } from 'astro';
import { MESES, PAPELES, VENTANAS } from '../../data/claves';
import { SEMILLAS } from '../../data/lugares';
import { db } from '../../lib/db';
import { json, sesion } from '../../lib/sesion';

export const prerender = false;

const CATALOGO = new Set(SEMILLAS.map((l) => l.id));
/** Lugar propuesto por el grupo: «u» + su id en la base. */
const PROPUESTO = /^u(\d{1,9})$/;

/** Qué se puede marcar: con qué valores y sobre qué claves. */
const TIPOS: Record<string, { valores: number[]; existe: (clave: string) => boolean }> = {
  mes: { valores: [1], existe: (c) => MESES.includes(c) }, // puedo viajar ese mes
  ventana: { valores: [0, 1, 2], existe: (c) => VENTANAS.includes(c) }, // no puedo · me sirve · me encanta
  papel: { valores: [1], existe: (c) => PAPELES.includes(c) }, // ya lo tengo
  lugar: { valores: [1], existe: (c) => CATALOGO.has(c) || PROPUESTO.test(c) }, // quiero ir
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const yo = sesion(cookies);
  if (!yo) return json({ error: 'Entra primero con tu nombre.' }, 401);

  const body = await request.json().catch(() => null);
  const { tipo, clave, valor } = body ?? {};
  // hasOwn: «constructor» o «toString» no son tipos, aunque existan en cualquier objeto
  const regla = typeof tipo === 'string' && Object.hasOwn(TIPOS, tipo) ? TIPOS[tipo] : undefined;
  if (!regla || typeof clave !== 'string' || !/^[a-z0-9-]{1,32}$/.test(clave))
    return json({ error: 'Marca inválida.' }, 400);

  const c = await db();
  if (valor === null) {
    // quitar siempre se puede: así también se limpian marcas de algo que ya no existe
    await c.execute({
      sql: 'DELETE FROM marcas WHERE persona = ? AND tipo = ? AND clave = ?',
      args: [yo, tipo, clave],
    });
    return json({ ok: true });
  }
  if (!regla.valores.includes(valor)) return json({ error: 'Valor inválido.' }, 400);
  if (!regla.existe(clave)) return json({ error: 'Marca inválida.' }, 400);

  // Un lugar propuesto pudo haberlo quitado su dueño mientras yo tenía la tarjeta en pantalla:
  // sin esta condición quedaría un sello sobre un lugar que ya no existe.
  const propuesto = tipo === 'lugar' ? PROPUESTO.exec(clave) : null;
  const r = await c.execute({
    // solo si la persona sigue en el grupo (pudo haberse borrado desde otro dispositivo)
    sql: `INSERT INTO marcas (persona, tipo, clave, valor)
          SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM personas WHERE id = ?)
            AND (? IS NULL OR EXISTS (SELECT 1 FROM lugares WHERE id = ?))
          ON CONFLICT (persona, tipo, clave) DO UPDATE SET valor = excluded.valor`,
    args: [yo, tipo, clave, valor, yo, propuesto ? 1 : null, propuesto ? Number(propuesto[1]) : null],
  });
  if (!r.rowsAffected) {
    const sigo = await c.execute({ sql: 'SELECT 1 FROM personas WHERE id = ?', args: [yo] });
    return sigo.rows.length
      ? json({ error: 'Ese lugar ya no está en la lista.' }, 404)
      : json({ error: 'Entra primero con tu nombre.' }, 401);
  }
  return json({ ok: true });
};
