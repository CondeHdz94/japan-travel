// Arma src/data/escenas.json: las escenas de anime que pasan en lugares del catálogo.
//
//   node scripts/escenas.mjs               usa la copia local de lo que ya bajó (.data/anitabi/)
//   node scripts/escenas.mjs --refrescar   vuelve a pedirle todo a anitabi
//
// Los puntos salen de la API pública de anitabi (https://github.com/anitabi/anitabi.cn-document),
// que comparte sus datos con licencia CC BY-NC-SA 4.0: cada escena lleva su fuente y su enlace.
// La configuración (series, nombres, palabras clave de cada lugar) está en escenas.config.mjs.
// Lo que se revisa a mano (estado, fuente que la confirma, distancia a otro punto, exclusiones,
// escena principal) vive en src/data/escenas-revision.json, y este script nunca lo pisa.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SEMILLAS } from '../src/data/lugares.ts';
import { EXCLUIDOS, LUGARES, SERIES } from './escenas.config.mjs';

const UA = 'japan-travel-site/0.1 (sitio personal de viaje; escenas de anime)';
const SALIDA = 'src/data/escenas.json';
const REVISION = 'src/data/escenas-revision.json';
// copia local de lo que responde anitabi: no se le vuelve a pedir en cada corrida
const COPIA = '.data/anitabi';
const refrescar = process.argv.includes('--refrescar');
mkdirSync(COPIA, { recursive: true });

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
async function pedir(url, intento = 0) {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if ((r.status === 429 || r.status >= 500) && intento < 4) {
    await pausa(3000 * (intento + 1));
    return pedir(url, intento + 1);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  return r.json();
}

const revision = existsSync(REVISION)
  ? JSON.parse(readFileSync(REVISION, 'utf8'))
  : { lugares: {}, escenas: {}, principal: {}, excluir: {} };

const existe = new Set(SEMILLAS.map((l) => l.id));
for (const [id] of LUGARES) if (!existe.has(id)) throw new Error(`«${id}» no está en el catálogo`);

/** A qué lugar va un punto: el primero cuya palabra clave aparezca en su nombre. */
const lugarDe = (nombre) => LUGARES.find(([, claves]) => claves.some((k) => nombre.includes(k)));

// la escena que mejor representa el lugar va primero: la del punto más reconocible, de un episodio
// normal (no del opening o el ending) y con minuto
function puntaje(e, principal) {
  const ep = String(e.ep ?? '');
  return (principal && e.punto.includes(principal) ? 4 : 0) + (/^\d+$/.test(ep) ? 2 : 0) - (/^(ED|OP)/.test(ep) ? 2 : 0) + (e.s ? 1 : 0);
}

/** Para comparar nombres sin mayúsculas, corchetes ni signos. */
const mismoNombre = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

const NIVEL = { confirmada: 2, validada: 1, 'por-confirmar': 0 };

const porLugar = new Map(); // lugar → serie → escenas
let bajados = 0;
const sinLugar = [];
for (const [serie, info] of Object.entries(SERIES)) {
  for (const [bgm, parte] of Object.entries(info.partes)) {
    const copia = `${COPIA}/${bgm}.json`;
    let puntos;
    if (!refrescar && existsSync(copia)) puntos = JSON.parse(readFileSync(copia, 'utf8'));
    else {
      puntos = await pedir(`https://api.anitabi.cn/bangumi/${bgm}/points/detail?haveImage=true`);
      writeFileSync(copia, JSON.stringify(puntos));
      await pausa(400);
    }
    for (const p of puntos) {
      bajados++;
      const id = `${bgm}-${p.id}`;
      if (EXCLUIDOS[`${bgm}:${p.id}`] || revision.excluir?.[id]) continue;
      const l = lugarDe(p.name);
      if (!l) {
        sinLugar.push(p.name);
        continue;
      }
      const [lugar] = l;
      if (!porLugar.has(lugar)) porLugar.set(lugar, new Map());
      const series = porLugar.get(lugar);
      if (!series.has(serie)) series.set(serie, []);
      const r = revision.escenas?.[id] ?? {};
      series.get(serie).push({
        id,
        punto: p.name,
        ep: p.ep == null ? null : String(p.ep),
        s: p.s ?? null,
        parte: parte ?? null,
        fuente: {
          autor: p.origin || 'anitabi',
          enlace: p.originURL || p.originLink || `https://www.anitabi.cn/map?bangumiId=${bgm}&pid=${p.id}`,
        },
        // la miniatura en anitabi; scripts/imagenes-escenas.mjs la baja a privado/escenas/
        // sin tamaño: la ventana pide el que necesita. Algunas vienen con «&plan=» en vez de «?plan=»
        original: String(p.image).replace(/[?&]plan=.*/, ''),
        estado: r.estado ?? 'por-confirmar',
        ...(r.confirmacion ? { confirmacion: r.confirmacion } : {}),
        ...(r.queda ? { queda: r.queda } : {}),
      });
    }
  }
}

const lugares = {};
for (const [lugar, series] of porLugar) {
  const principal = LUGARES.find(([id]) => id === lugar)[2];
  const obras = [...series].map(([serie, escenas]) => {
    const fija = revision.principal?.[`${lugar}/${serie}`];
    // la escena grande es la más verificada que haya: la fijada a mano, luego confirmada, validada y
    // por confirmar; dentro de cada nivel, la más representativa del lugar
    escenas.sort(
      (a, b) =>
        (b.id === fija) - (a.id === fija) || NIVEL[b.estado] - NIVEL[a.estado] || puntaje(b, principal) - puntaje(a, principal),
    );
    const info = SERIES[serie];
    return {
      serie,
      nombre: info.nombre,
      // el rōmaji va debajo solo si es otro nombre: «K-ON!» o «[Oshi no Ko]» no lo son
      ...(info.romaji && mismoNombre(info.romaji) !== mismoNombre(info.nombre) ? { romaji: info.romaji } : {}),
      estudio: info.estudio,
      ...(info.dudoso ? { dudoso: true } : {}),
      escenas,
    };
  });
  // de la obra con más escenas en este lugar a la que menos; a igualdad, el orden de SERIES
  const orden = Object.keys(SERIES);
  obras.sort((a, b) => b.escenas.length - a.escenas.length || orden.indexOf(a.serie) - orden.indexOf(b.serie));
  lugares[lugar] = { ...(revision.lugares?.[lugar] ?? {}), obras };
}

// en el orden del catálogo, para que el archivo sea fácil de revisar
const ordenados = Object.fromEntries(SEMILLAS.filter((l) => lugares[l.id]).map((l) => [l.id, lugares[l.id]]));
writeFileSync(
  SALIDA,
  `${JSON.stringify({ fuente: 'anitabi', licencia: 'CC BY-NC-SA 4.0', lugares: ordenados }, null, 1)}\n`,
);
if (!existsSync(REVISION)) writeFileSync(REVISION, `${JSON.stringify(revision, null, 2)}\n`);

const n = Object.values(ordenados);
console.log(`puntos revisados: ${bajados} · sin lugar del catálogo: ${sinLugar.length}`);
console.log(`lugares con escenas: ${n.length} · pares lugar-obra: ${n.reduce((s, l) => s + l.obras.length, 0)} · escenas: ${n.reduce((s, l) => s + l.obras.reduce((t, o) => t + o.escenas.length, 0), 0)}`);
for (const [id, l] of Object.entries(ordenados))
  console.log(`  ${id}: ${l.obras.map((o) => `${o.nombre} (${o.escenas.length})`).join(', ')}`);
