import { mkdirSync } from 'node:fs';
import { createClient, type Client } from '@libsql/client';
import { getSecret } from 'astro:env/server';

let listo: Promise<Client> | undefined;

/** Cliente de base de datos. En local usa un archivo; en producción, Turso. */
export function db(): Promise<Client> {
  listo ??= abrir().catch((e) => {
    listo = undefined;
    throw e;
  });
  return listo;
}

async function abrir(): Promise<Client> {
  const url = getSecret('TURSO_DATABASE_URL') || 'file:.data/local.db';
  if (url.startsWith('file:')) mkdirSync('.data', { recursive: true });
  const c = createClient({ url, authToken: getSecret('TURSO_AUTH_TOKEN') || undefined });
  await c.batch(
    [
      `CREATE TABLE IF NOT EXISTS personas (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
         creado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`,
      `CREATE TABLE IF NOT EXISTS marcas (
         persona INTEGER NOT NULL REFERENCES personas(id),
         tipo TEXT NOT NULL,
         clave TEXT NOT NULL,
         valor INTEGER NOT NULL,
         PRIMARY KEY (persona, tipo, clave)
       )`,
    ],
    'write',
  );
  return c;
}

export interface Persona {
  id: number;
  nombre: string;
}
export interface Marca {
  p: number;
  t: string;
  c: string;
  v: number;
}
export interface Estado {
  yo: Persona | null;
  personas: Persona[];
  marcas: Marca[];
}

const VACIO: Estado = { yo: null, personas: [], marcas: [] };

/** Estado del grupo. Sin sesión válida no se devuelve nada: los nombres son privados. */
export async function estado(yoId: number | null): Promise<Estado> {
  if (!yoId) return VACIO;
  const c = await db();
  const [ps, ms] = await c.batch(
    ['SELECT id, nombre FROM personas ORDER BY id', 'SELECT persona, tipo, clave, valor FROM marcas'],
    'read',
  );
  const personas = ps.rows.map((r) => ({ id: Number(r.id), nombre: String(r.nombre) }));
  const yo = personas.find((p) => p.id === yoId) ?? null;
  if (!yo) return VACIO;
  return {
    yo,
    personas,
    marcas: ms.rows.map((r) => ({
      p: Number(r.persona),
      t: String(r.tipo),
      c: String(r.clave),
      v: Number(r.valor),
    })),
  };
}

/** Nombre limpio (sin espacios de sobra) o null si no sirve. */
export function nombreValido(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const n = x.trim().replace(/\s+/g, ' ');
  return n.length >= 2 && n.length <= 20 ? n : null;
}
