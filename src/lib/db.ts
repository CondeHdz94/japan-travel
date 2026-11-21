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
  const [conVistos] = await c.batch(["SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vistos'"], 'read');
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
      // a quién ya le presenté a quién: cada persona ve la entrada de cada otra una sola vez
      // (a los de antes en su bienvenida, a los de después en el Inicio)
      `CREATE TABLE IF NOT EXISTS vistos (
         persona INTEGER NOT NULL REFERENCES personas(id),
         otro INTEGER NOT NULL REFERENCES personas(id),
         PRIMARY KEY (persona, otro)
       )`,
    ],
    'write',
  );
  // Bases creadas antes de que existieran estas columnas: se agregan.
  //   forma  la forma del sello
  //   tinta  el color del sello, fijo: no cambia si alguien de antes se sale del grupo
  //   visto  ya no se usa: era el id más alto que ya se le anunció (ahora está en `vistos`)
  for (const col of ['forma TEXT', 'tinta INTEGER', 'visto INTEGER']) await columna(c, col);
  // Quien ya estaba conserva el color que tenía (el de su puesto en la lista).
  await c.execute(
    `UPDATE personas SET tinta = (SELECT COUNT(*) FROM personas p WHERE p.id < personas.id) % ${TINTAS}
     WHERE tinta IS NULL`,
  );
  // La primera vez que existe `vistos`, se llena con lo que ya pasó: antes solo se guardaba
  // «ya vi hasta el id N», y la bienvenida no mostraba a los de antes. Entonces solo cuenta
  // como visto quien llegó después de mí y hasta mi N; a los de antes nunca me los presentaron
  // y me quedan pendientes (los veo una vez en el Inicio). Sin N, no vi a nadie.
  if (!conVistos.rows.length)
    await c.execute(
      `INSERT OR IGNORE INTO vistos (persona, otro)
       SELECT q.id, o.id FROM personas q JOIN personas o ON o.id > q.id AND o.id <= q.visto`,
    );
  return c;
}

async function columna(c: Client, definicion: string) {
  const nombre = definicion.split(' ')[0];
  try {
    await c.execute(`SELECT ${nombre} FROM personas LIMIT 0`);
  } catch {
    try {
      await c.execute(`ALTER TABLE personas ADD COLUMN ${definicion}`);
    } catch (e) {
      // otro arranque al tiempo ya la agregó
      if (!/duplicate column/i.test(String(e))) throw e;
    }
  }
}

/** Cuántos colores de sello hay (los de `.sello-p[data-tinta]` en global.css). */
export const TINTAS = 6;

export interface Persona {
  id: number;
  nombre: string;
  /** Forma de su sello: un id de `src/data/formas.ts`. */
  forma: string;
  /** Color de su sello, de 0 a TINTAS − 1. */
  tinta: number;
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
  /** Los del viaje que todavía no me han presentado (sus ids). Sin sesión no viene. */
  pendientes?: number[];
}

const VACIO: Estado = { yo: null, personas: [], marcas: [] };

/** Estado del grupo. Sin sesión válida no se devuelve nada: los nombres son privados. */
export async function estado(yoId: number | null): Promise<Estado> {
  if (!yoId) return VACIO;
  const c = await db();
  const [ps, ms, vs] = await c.batch(
    [
      'SELECT id, nombre, forma, tinta FROM personas ORDER BY id',
      'SELECT persona, tipo, clave, valor FROM marcas',
      { sql: 'SELECT otro FROM vistos WHERE persona = ?', args: [yoId] },
    ],
    'read',
  );
  const personas = ps.rows.map((r, i) => ({
    id: Number(r.id),
    nombre: String(r.nombre),
    forma: formaGuardada(Number(r.id), r.forma),
    tinta: r.tinta === null ? i % TINTAS : Number(r.tinta),
  }));
  const yo = personas.find((p) => p.id === yoId) ?? null;
  if (!yo) return VACIO;
  const vistos = new Set(vs.rows.map((r) => Number(r.otro)));
  return {
    yo,
    personas,
    pendientes: personas.filter((p) => p.id !== yoId && !vistos.has(p.id)).map((p) => p.id),
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

/** Color para un viajero nuevo: el primero que nadie tenga; si ya están todos, se repiten. */
export async function tintaLibre(c: Client): Promise<number> {
  const r = await c.execute('SELECT tinta FROM personas');
  const usadas = new Set(r.rows.map((x) => Number(x.tinta)));
  for (let t = 0; t < TINTAS; t++) if (!usadas.has(t)) return t;
  return r.rows.length % TINTAS;
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
