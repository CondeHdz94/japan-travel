// Resuelve a qué artículo lleva el nombre de cada lugar del catálogo: Wikipedia en español
// si el artículo de `wiki` tiene versión en español, y si no, el mismo en inglés.
//
//   node scripts/articulos-lugares.mjs
//
// Deja el enlace de cada lugar en src/data/articulos.json. Se corre otra vez al agregar
// lugares al catálogo; la página no le pregunta nada a Wikipedia en vivo.

import { writeFileSync } from 'node:fs';
import { SEMILLAS } from '../src/data/lugares.ts';

const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'japan-travel-site/0.1 (sitio personal de viaje; script de artículos)';
const JSON_OUT = 'src/data/articulos.json';

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const enLotes = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));

const articulos = {};
const faltan = [];
let enEspanol = 0;

for (const lote of enLotes(SEMILLAS.filter((l) => l.wiki && !l.sinArticulo), 50)) {
  const url = `${API}?${new URLSearchParams({
    format: 'json', formatversion: '2', action: 'query', redirects: '1',
    titles: lote.map((l) => l.wiki).join('|'),
    prop: 'info|langlinks', inprop: 'url', lllang: 'es', llprop: 'url', lllimit: 'max',
  })}`;
  const r = await (await fetch(url, { headers: { 'user-agent': UA } })).json();
  // el título pedido puede llegar normalizado o redirigido a otro
  const salto = new Map();
  for (const x of [...(r.query?.normalized ?? []), ...(r.query?.redirects ?? [])]) salto.set(x.from, x.to);
  const final = (t) => { let n = 0; while (salto.has(t) && n++ < 5) t = salto.get(t); return t; };
  const porTitulo = new Map((r.query?.pages ?? []).map((p) => [p.title, p]));
  for (const l of lote) {
    const p = porTitulo.get(final(l.wiki));
    if (!p || p.missing) {
      faltan.push(`${l.id}: no existe «${l.wiki}»`);
      continue;
    }
    const es = p.langlinks?.[0]?.url;
    if (es) enEspanol++;
    articulos[l.id] = es ?? p.fullurl;
  }
  await pausa(500);
}

writeFileSync(JSON_OUT, JSON.stringify(articulos, null, 2) + '\n');
console.log(`${Object.keys(articulos).length} de ${SEMILLAS.length} lugares con artículo (${enEspanol} en español).`);
if (faltan.length) console.log('Sin artículo:\n  ' + faltan.join('\n  '));
