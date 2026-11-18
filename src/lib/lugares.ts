import { db } from './db';
import type { Lugar } from '../data/lugares';

/** Un lugar propuesto por alguien del grupo. Su id público es «u» + el id de la base. */
export interface LugarPropuesto extends Lugar {
  persona: number;
  enlace?: string;
  imagen?: string;
}

/** Lugares propuestos por el grupo, del más antiguo al más nuevo. */
export async function propuestos(): Promise<LugarPropuesto[]> {
  const c = await db();
  const r = await c.execute(
    'SELECT id, nombre, tema, zona, nota, meses, enlace, imagen, persona FROM lugares ORDER BY id',
  );
  return r.rows.map((f) => {
    const meses = String(f.meses)
      .split(',')
      .map(Number)
      .filter((m) => m >= 1 && m <= 12);
    return {
      id: `u${f.id}`,
      nombre: String(f.nombre),
      tema: String(f.tema),
      zona: String(f.zona),
      desc: String(f.nota),
      meses: meses.length ? meses : undefined,
      enlace: String(f.enlace) || undefined,
      imagen: String(f.imagen) || undefined,
      persona: Number(f.persona),
    };
  });
}
