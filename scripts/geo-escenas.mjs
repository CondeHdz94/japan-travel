// Valida dónde quedan las escenas de anime: ubica cada punto y mide a cuánto está de su lugar.
//
//   node scripts/geo-escenas.mjs
//
// Ubicación del punto: primero las coordenadas que traiga el enlace de la fuente (Google Maps las
// lleva en «ll=»); si no, se busca el nombre en OpenStreetMap (Nominatim), a una consulta por
// segundo como piden sus reglas. Todo queda guardado en .data/geo-escenas.json para no repetir.
//
// Deja el informe en .data/geo-escenas-informe.json y un resumen en pantalla:
//   en el lugar (≤ 1,2 km) · cerca (≤ 15 km: es «otro punto», hay que decir dónde queda) ·
//   lejos (revisar: puede estar mal asignado) · sin ubicar (revisar a mano).
// No cambia los datos del sitio: lo que se decida se anota a mano en src/data/escenas-revision.json.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { SEMILLAS } from '../src/data/lugares.ts';

const UA = 'japan-travel-site/0.1 (sitio personal de viaje; validacion de escenas)';
const CACHE = '.data/geo-escenas.json';
const INFORME = '.data/geo-escenas-informe.json';
const EN_EL_LUGAR = 1.2;
const CERCA = 15;

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const guardar = () => writeFileSync(CACHE, JSON.stringify(cache, null, 1));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let ultima = 0;

/** Busca un nombre en Nominatim (Japón), respetando una consulta por segundo. */
async function buscar(q) {
  if (q in cache) return cache[q];
  const espera = 1100 - (Date.now() - ultima);
  if (espera > 0) await pausa(espera);
  ultima = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: 'json', limit: '1', countrycodes: 'jp' })}`;
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'ja,en' } });
    const j = r.ok ? await r.json() : [];
    cache[q] = j[0] ? [Number(j[0].lat), Number(j[0].lon)] : null;
  } catch {
    return null; // sin red: no se guarda, se intenta en la próxima corrida
  }
  guardar();
  return cache[q];
}

/** Coordenadas que trae el enlace de la fuente, si las trae. */
function delEnlace(enlace) {
  const m = enlace.match(/[?&]ll=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Distancia en km entre dos puntos. */
function km([a, b], [c, d]) {
  const R = 6371, rad = Math.PI / 180;
  const x = Math.sin(((c - a) * rad) / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const { lugares } = JSON.parse(readFileSync('src/data/escenas.json', 'utf8'));
const informe = { lugares: {}, resumen: { 'en-el-lugar': 0, cerca: 0, lejos: 0, 'sin-ubicar': 0 } };
for (const [id, l] of Object.entries(lugares)) {
  const s = SEMILLAS.find((x) => x.id === id);
  const centro = (await buscar(s.jp)) ?? (await buscar(`${s.nombre}, Japan`));
  const filas = [];
  for (const o of l.obras)
    for (const e of o.escenas) {
      const donde = delEnlace(e.fuente.enlace) ?? (await buscar(e.punto));
      let clase = 'sin-ubicar';
      let d = null;
      if (donde && centro) {
        d = Math.round(km(centro, donde) * 10) / 10;
        clase = d <= EN_EL_LUGAR ? 'en-el-lugar' : d <= CERCA ? 'cerca' : 'lejos';
      }
      informe.resumen[clase]++;
      filas.push({ escena: e.id, obra: o.nombre, punto: e.punto, km: d, clase, coordenadas: donde });
    }
  informe.lugares[id] = { centro, escenas: filas };
  const c = (k) => filas.filter((f) => f.clase === k).length;
  console.log(`${id.padEnd(17)} en el lugar ${c('en-el-lugar')} · cerca ${c('cerca')} · lejos ${c('lejos')} · sin ubicar ${c('sin-ubicar')}${centro ? '' : '  (¡no se ubicó el lugar!)'}`);
}
writeFileSync(INFORME, JSON.stringify(informe, null, 1));
console.log('total:', informe.resumen);
