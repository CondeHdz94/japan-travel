// Cuentas de la página Decisiones: los votos de todos, cruzados entre secciones.
// Son funciones puras sobre personas y marcas (lo mismo que devuelve /api/estado), así que sirven
// igual en el servidor que en el navegador.

import { SEMILLAS, ZONAS, type Lugar } from '../data/lugares';
import { MESES, PAPELES, VENTANAS } from '../data/claves';
import { VENTANAS_VIAJE } from '../data/ventanas';

export interface Persona {
  id: number;
  nombre: string;
  forma?: string;
  tinta?: number;
}
export interface Marca {
  p: number;
  t: string;
  c: string;
  v: number;
}

/** Los meses que toca cada ventana de Cuándo ir (1 = enero). */
export const MESES_DE_VENTANA: Record<string, number[]> = Object.fromEntries(
  VENTANAS_VIAJE.map((v) => [v.id, v.meses]),
);

const de = (marcas: Marca[], t: string) => marcas.filter((m) => m.t === t);
const quienes = (personas: Persona[], ids: Iterable<number>) => {
  const set = new Set(ids);
  return personas.filter((p) => set.has(p.id));
};

/** Quiénes han marcado algo de un tipo, y quiénes no. */
export function quorum(personas: Persona[], marcas: Marca[], tipo: string) {
  const ya = new Set(de(marcas, tipo).map((m) => m.p));
  return { votaron: quienes(personas, ya), faltan: personas.filter((p) => !ya.has(p.id)) };
}

// ───── Cuándo ─────

export interface ConteoVentana {
  id: string;
  /** Quién puso cada valor: 2 me encanta · 1 me sirve · 0 no puedo. */
  votos: Record<0 | 1 | 2, Persona[]>;
  faltan: Persona[];
  puntos: number;
  /** Lo máximo que podría sumar con todo el grupo (2 por persona). */
  tope: number;
  /** Puntos sobre lo posible entre quienes ya votaron: así no castiga a la que tiene votos pendientes. */
  agrado: number;
  /** Alguien no puede: la ventana queda por fuera, sin importar los puntos. */
  tachada: boolean;
}

export function contarVentanas(personas: Persona[], marcas: Marca[]): ConteoVentana[] {
  const vs = de(marcas, 'ventana');
  const conteos = VENTANAS.map((id) => {
    const suyas = vs.filter((m) => m.c === id);
    const votos = { 0: [], 1: [], 2: [] } as Record<0 | 1 | 2, Persona[]>;
    for (const p of personas) {
      const m = suyas.find((x) => x.p === p.id);
      if (m && (m.v === 0 || m.v === 1 || m.v === 2)) votos[m.v].push(p);
    }
    const votaron = votos[0].length + votos[1].length + votos[2].length;
    const puntos = votos[1].length + 2 * votos[2].length;
    return {
      id,
      votos,
      faltan: personas.filter((p) => !suyas.some((x) => x.p === p.id)),
      puntos,
      tope: 2 * personas.length,
      agrado: votaron ? puntos / (2 * votaron) : 0,
      tachada: votos[0].length > 0,
    };
  });
  // primero las que todos pueden, por agrado; las tachadas, al final
  return conteos.sort(
    (a, b) => +a.tachada - +b.tachada || b.agrado - a.agrado || b.puntos - a.puntos,
  );
}

/**
 * La que va adelante y, si le faltan votos, cuál pasaría adelante si alguno no puede.
 * Si hay empate arriba, no hay una sola: «empatadas» trae todas las que comparten el primer puesto.
 * Si todas las que tienen votos están tachadas, no hay ninguna.
 */
export function lider(ranking: ConteoVentana[]) {
  const vivas = ranking.filter((v) => !v.tachada && v.puntos > 0);
  const primera = vivas[0] ?? null;
  const empatadas = primera ? vivas.filter((v) => v.agrado === primera.agrado && v.puntos === primera.puntos) : [];
  return {
    primera,
    empatadas: empatadas.length > 1 ? empatadas : [],
    siFalla: primera && empatadas.length < 2 && primera.faltan.length ? (vivas[1] ?? null) : null,
    /** Hay votos, pero todas las ventanas tienen un «No puedo». */
    todasTachadas: !primera && ranking.some((v) => v.tachada),
  };
}

/** Todavía es temprano para anunciar nada: menos de la mitad del grupo ha votado. */
export const temprano = (votaron: number, grupo: number) => votaron < Math.ceil(grupo / 2);

/** Por persona, los meses en que puede viajar; y por mes, cuántos pueden. */
export function contarMeses(personas: Persona[], marcas: Marca[]) {
  const ms = de(marcas, 'mes').filter((m) => m.v === 1);
  const puede = new Map<number, Set<number>>();
  for (const m of ms) {
    const n = MESES.indexOf(m.c) + 1;
    if (!n) continue;
    if (!puede.has(m.p)) puede.set(m.p, new Set());
    puede.get(m.p)!.add(n);
  }
  const marcaron = personas.filter((p) => puede.has(p.id));
  const porMes = MESES.map((_, i) => marcaron.filter((p) => puede.get(p.id)!.has(i + 1)).length);
  return {
    puede,
    marcaron,
    faltan: personas.filter((p) => !puede.has(p.id)),
    porMes,
    /** Meses en que pueden todos los que ya marcaron. */
    todos: porMes.map((n) => marcaron.length > 0 && n === marcaron.length),
  };
}

/** Votos que no cuadran con los meses: le gusta una ventana pero no marcó ninguno de sus meses. */
export function noCuadran(personas: Persona[], marcas: Marca[]) {
  const { puede } = contarMeses(personas, marcas);
  const fuera: { persona: Persona; ventana: string; valor: number; meses: number[] }[] = [];
  for (const m of de(marcas, 'ventana')) {
    if (m.v < 1) continue;
    const suyos = puede.get(m.p);
    const meses = MESES_DE_VENTANA[m.c];
    const persona = personas.find((p) => p.id === m.p);
    // quien no ha marcado meses todavía no se cuenta: no es contradicción, es que falta
    if (!persona || !suyos || !meses || meses.some((n) => suyos.has(n))) continue;
    fuera.push({ persona, ventana: m.c, valor: m.v, meses });
  }
  return fuera;
}

// ───── Lugares ─────

export interface ConteoLugar {
  lugar: Lugar;
  quieren: Persona[];
  /** Frente a la ventana que va adelante: solo se da en esas fechas, o no se da. */
  temporada: 'si' | 'no' | null;
}

export function contarLugares(
  personas: Persona[],
  marcas: Marca[],
  catalogo: Lugar[] = SEMILLAS,
  ventana: string | null = null,
) {
  const meses = ventana ? MESES_DE_VENTANA[ventana] : null;
  const ls = de(marcas, 'lugar').filter((m) => m.v === 1);
  const conteos: ConteoLugar[] = catalogo
    .map((lugar) => {
      const quieren = quienes(personas, ls.filter((m) => m.c === lugar.id).map((m) => m.p));
      let temporada: ConteoLugar['temporada'] = null;
      if (meses && lugar.meses) {
        if (!lugar.meses.some((n) => meses.includes(n))) temporada = 'no';
        else if (lugar.meses.length <= 4) temporada = 'si';
      }
      return { lugar, quieren, temporada };
    })
    .filter((c) => c.quieren.length > 0)
    .sort((a, b) => b.quieren.length - a.quieren.length || orden(a) - orden(b));

  const n = personas.length;
  const fijo = Math.max(2, n - 1);
  return {
    /** Todos o casi todos. */
    fijos: conteos.filter((c) => c.quieren.length >= fijo),
    /** Dos o más, sin llegar a casi todos. */
    fuerza: conteos.filter((c) => c.quieren.length >= 2 && c.quieren.length < fijo),
    /** Lo que quiere una sola persona, agrupado por quién. */
    personales: personas
      .map((p) => ({ persona: p, lugares: conteos.filter((c) => c.quieren.length === 1 && c.quieren[0].id === p.id) }))
      .filter((x) => x.lugares.length > 0),
    /** Lo que tiene votos pero no se da en las fechas que van ganando. */
    fueraDeFecha: conteos.filter((c) => c.temporada === 'no'),
    umbralFijo: fijo,
  };
}
const orden = (c: ConteoLugar) => ZONAS.findIndex((z) => z.id === c.lugar.zona);

/** El orden en que se recorren las zonas: de Tokio hacia el occidente, y lo lejano al final. */
const RUTA = ['tokio', 'kanto', 'chubu', 'kansai', 'oeste', 'norte', 'sur'];

/**
 * Reparte los días entre zonas según los votos de lo que quieren dos o más (cada voto pesa uno),
 * con el método del mayor residuo. Una zona que no alcanza un día completo no entra.
 */
export function repartirDias(conteos: ConteoLugar[], dias: number) {
  const peso = new Map<string, { votos: number; lugares: ConteoLugar[] }>();
  for (const c of conteos) {
    if (c.quieren.length < 2 || c.temporada === 'no') continue;
    const z = peso.get(c.lugar.zona) ?? { votos: 0, lugares: [] };
    z.votos += c.quieren.length;
    z.lugares.push(c);
    peso.set(c.lugar.zona, z);
  }
  const total = [...peso.values()].reduce((s, z) => s + z.votos, 0);
  if (!total) return [];
  const cuotas = [...peso.entries()].map(([zona, z]) => {
    const exacto = (z.votos / total) * dias;
    return { zona, ...z, dias: Math.floor(exacto), resto: exacto % 1 };
  });
  let sobran = dias - cuotas.reduce((s, c) => s + c.dias, 0);
  for (const c of [...cuotas].sort((a, b) => b.resto - a.resto)) {
    if (sobran-- <= 0) break;
    c.dias++;
  }
  return cuotas.filter((c) => c.dias > 0).sort((a, b) => RUTA.indexOf(a.zona) - RUTA.indexOf(b.zona));
}

// ───── Papeles ─────

export function contarPapeles(personas: Persona[], marcas: Marca[]) {
  const ps = de(marcas, 'papel').filter((m) => m.v === 1);
  return PAPELES.map((id) => {
    const tienen = quienes(personas, ps.filter((m) => m.c === id).map((m) => m.p));
    return { id, tienen, faltan: personas.filter((p) => !tienen.includes(p)) };
  });
}

// ───── lo que me falta a mí ─────

export interface MiParte {
  /** Ventanas que no he votado. */
  ventanas: string[];
  /** No he marcado ningún mes. */
  meses: boolean;
  /** No he votado ningún lugar. */
  lugares: boolean;
  /** Me falta el papel más urgente del grupo (el primero de la lista que alguien ya tiene). */
  papel: string | null;
  /** Mi voto puede tachar a la que va adelante: si pongo «No puedo», gana esta otra. */
  decido: { ventana: string; siNo: string | null } | null;
}

export function miParte(yo: Persona, personas: Persona[], marcas: Marca[]): MiParte {
  const mias = marcas.filter((m) => m.p === yo.id);
  const ranking = contarVentanas(personas, marcas);
  const { primera, siFalla, empatadas } = lider(ranking);
  const papeles = contarPapeles(personas, marcas);
  const urgente = papeles.find((x) => x.tienen.length > 0 && x.faltan.length > 0) ?? papeles[0];
  return {
    ventanas: VENTANAS.filter((v) => !mias.some((m) => m.t === 'ventana' && m.c === v)),
    meses: !mias.some((m) => m.t === 'mes'),
    lugares: !mias.some((m) => m.t === 'lugar'),
    papel: urgente && urgente.faltan.some((p) => p.id === yo.id) ? urgente.id : null,
    decido:
      primera && !empatadas.length && primera.faltan.some((p) => p.id === yo.id)
        ? { ventana: primera.id, siNo: siFalla?.id ?? null }
        : null,
  };
}
