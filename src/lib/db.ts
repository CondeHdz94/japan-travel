import { mkdirSync } from 'node:fs';
import { createClient, type Client } from '@libsql/client';
import { getSecret } from 'astro:env/server';
import { FORMAS, esForma } from '../data/formas';

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
         creado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
         forma TEXT
       )`,
      `CREATE TABLE IF NOT EXISTS marcas (
         persona INTEGER NOT NULL REFERENCES personas(id),
         tipo TEXT NOT NULL,
         clave TEXT NOT NULL,
         valor INTEGER NOT NULL,
         PRIMARY KEY (persona, tipo, clave)
       )`,
      // lugares propuestos por el grupo (los del catálogo inicial viven en src/data/lugares.ts)
      `CREATE TABLE IF NOT EXISTS lugares (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         nombre TEXT NOT NULL,
         tema TEXT NOT NULL,
         zona TEXT NOT NULL,
         nota TEXT NOT NULL DEFAULT '',
         meses TEXT NOT NULL DEFAULT '',
         enlace TEXT NOT NULL DEFAULT '',
         imagen TEXT NOT NULL DEFAULT '',
         persona INTEGER NOT NULL REFERENCES personas(id),
         creado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`,
    ],
    'write',
  );
  // Bases creadas antes de que existieran las formas de sello: se les agrega la columna.
  try {
    await c.execute('SELECT forma FROM personas LIMIT 0');
  } catch {
    try {
      await c.execute('ALTER TABLE personas ADD COLUMN forma TEXT');
    } catch (e) {
      // otro arranque al tiempo ya la agregó
      if (!/duplicate column/i.test(String(e))) throw e;
    }
  }
  return c;
}

export interface Persona {
  id: number;
  nombre: string;
  /** Forma de su sello: un id de `src/data/formas.ts`. */
  forma: string;
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
    [
      'SELECT id, nombre, forma FROM personas ORDER BY id',
      'SELECT persona, tipo, clave, valor FROM marcas',
    ],
    'read',
  );
  const personas = ps.rows.map((r) => ({
    id: Number(r.id),
    nombre: String(r.nombre),
    forma: formaGuardada(Number(r.id), r.forma),
  }));
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

/**
 * La forma del sello de alguien. Quien entró antes de que existieran las formas no tiene una
 * guardada: se le da una fija según su id, hasta que escoja otra.
 */
function formaGuardada(id: number, guardada: unknown): string {
  return esForma(guardada) ? guardada : FORMAS[(id - 1) % FORMAS.length].id;
}

/** Forma para un viajero nuevo: la primera que nadie tenga; si ya están todas, se repite. */
export async function formaLibre(c: Client): Promise<string> {
  const r = await c.execute('SELECT id, forma FROM personas');
  const usadas = new Set(r.rows.map((x) => formaGuardada(Number(x.id), x.forma)));
  return (FORMAS.find((f) => !usadas.has(f.id)) ?? FORMAS[r.rows.length % FORMAS.length]).id;
}

/**
 * Forma de comparar nombres: sin distinguir mayúsculas ni tildes, para que «Ángela» escrito
 * desde el celular y «angela» desde el computador sean la misma persona. La ñ sí cuenta.
 * (El COLLATE NOCASE de la tabla solo iguala letras sin tilde.)
 */
export function claveNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/ñ/g, 'ñ')
    .replace(/[̀-ͯ]/g, '');
}

/** Id de quien ya usa ese nombre (sin contar a `excepto`), o null. */
export async function personaLlamada(
  c: Client,
  nombre: string,
  excepto?: number,
): Promise<number | null> {
  const k = claveNombre(nombre);
  const r = await c.execute('SELECT id, nombre FROM personas ORDER BY id');
  const f = r.rows.find((x) => Number(x.id) !== excepto && claveNombre(String(x.nombre)) === k);
  return f ? Number(f.id) : null;
}

/** Nombre limpio (sin espacios de sobra) o null si no sirve. */
export function nombreValido(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const n = x.trim().replace(/\s+/g, ' ');
  return n.length >= 2 && n.length <= 20 ? n : null;
}
