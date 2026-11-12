// Baja una foto libre de Wikimedia Commons para cada lugar del catálogo.
//
//   node scripts/fotos-lugares.mjs          solo los que faltan
//   node scripts/fotos-lugares.mjs --todo   vuelve a bajar todo
//
// Deja las imágenes en public/lugares/ y los créditos en src/data/fotos.json.
// Solo toma la imagen principal del artículo si su licencia es libre.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import { SEMILLAS } from '../src/data/lugares.ts';

const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'japan-travel-site/0.1 (sitio personal de viaje; script de fotos)';
const ANCHO = 500;
const DIR = 'public/lugares';
const JSON_OUT = 'src/data/fotos.json';

const todo = process.argv.includes('--todo');
const fotos = !todo && existsSync(JSON_OUT) ? JSON.parse(readFileSync(JSON_OUT, 'utf8')) : {};
mkdirSync(DIR, { recursive: true });

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const sinHtml = (s = '') => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** fetch con reintentos: Wikimedia responde 429 si se le pide muy seguido. */
async function pedir(url, intento = 0) {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (r.status === 429 && intento < 5) {
    const espera = Number(r.headers.get('retry-after')) || 5 * (intento + 1);
    await pausa(espera * 1000);
    return pedir(url, intento + 1);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r;
}

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  return (await pedir(url)).json();
}

const enLotes = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));

const faltan = [];
const pendientes = SEMILLAS.filter((l) => l.wiki && !fotos[l.id]);

// 1. imagen principal de cada artículo, de a 50 títulos por consulta
//    (por defecto la API solo devuelve imágenes de licencia libre)
const archivoDe = new Map(); // id del lugar → nombre del archivo en Commons
const sinPrincipal = pendientes.filter((l) => l.foto); // estos van directo a la búsqueda en Commons
for (const lote of enLotes(pendientes.filter((l) => !l.foto), 50)) {
  const r = await api({ action: 'query', titles: lote.map((l) => l.wiki).join('|'), redirects: '1', prop: 'pageimages', piprop: 'name', pilimit: '50' });
  const salto = new Map();
  for (const x of [...(r.query?.normalized ?? []), ...(r.query?.redirects ?? [])]) salto.set(x.from, x.to);
  const final = (t) => { let n = 0; while (salto.has(t) && n++ < 5) t = salto.get(t); return t; };
  const porTitulo = new Map((r.query?.pages ?? []).map((p) => [p.title, p.pageimage]));
  for (const l of lote) {
    const a = porTitulo.get(final(l.wiki));
    if (a) archivoDe.set(l.id, a);
    else sinPrincipal.push(l);
  }
  await pausa(500);
}

// 1b. si el artículo no tiene imagen principal libre, se busca una foto en Commons por nombre
for (const l of sinPrincipal) {
  const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
    format: 'json', formatversion: '2', action: 'query', list: 'search',
    srnamespace: '6', srlimit: '1', srsearch: `${l.foto ?? l.wiki} filetype:bitmap filemime:image/jpeg`,
  })}`;
  try {
    const r = await (await pedir(url)).json();
    const t = r.query?.search?.[0]?.title;
    if (t) archivoDe.set(l.id, t.replace(/^File:/, ''));
    else faltan.push(`${l.id}: sin imagen libre en «${l.wiki}»`);
  } catch (e) {
    faltan.push(`${l.id}: ${e.message}`);
  }
  await pausa(700);
}

// 2. miniatura, autor y licencia de cada archivo, también de a 50
const infoDe = new Map(); // nombre del archivo → imageinfo
for (const lote of enLotes([...new Set(archivoDe.values())], 50)) {
  const r = await api({ action: 'query', titles: lote.map((a) => `File:${a}`).join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(ANCHO) });
  const salto = new Map((r.query?.normalized ?? []).map((x) => [x.to, x.from]));
  for (const p of r.query?.pages ?? []) {
    const original = (salto.get(p.title) ?? p.title).replace(/^File:/, '');
    if (p.imageinfo?.[0]) infoDe.set(original, p.imageinfo[0]);
  }
  await pausa(500);
}

// 3. bajar las miniaturas, despacio
for (const l of pendientes) {
  const info = infoDe.get(archivoDe.get(l.id));
  if (!archivoDe.has(l.id)) continue;
  if (!info?.thumburl) {
    faltan.push(`${l.id}: sin miniatura para ${archivoDe.get(l.id)}`);
    continue;
  }
  try {
    const img = await pedir(info.thumburl);
    // todo queda en JPG liviano: son fotos de tarjeta, no de galería
    const nombre = `${l.id}.jpg`;
    await sharp(Buffer.from(await img.arrayBuffer()))
      .resize({ width: ANCHO, withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 72, mozjpeg: true })
      .toFile(`${DIR}/${nombre}`);
    const m = info.extmetadata ?? {};
    fotos[l.id] = {
      archivo: nombre,
      autor: sinHtml(m.Artist?.value) || 'Autor desconocido',
      licencia: sinHtml(m.LicenseShortName?.value) || 'ver fuente',
      fuente: info.descriptionurl,
    };
    writeFileSync(JSON_OUT, JSON.stringify(fotos, null, 2) + '\n');
    console.log('ok ', l.id);
  } catch (e) {
    faltan.push(`${l.id}: ${e.message}`);
  }
  await pausa(1200);
}

writeFileSync(JSON_OUT, JSON.stringify(fotos, null, 2) + '\n');
console.log(`\n${Object.keys(fotos).length} de ${SEMILLAS.length} lugares con foto.`);
if (faltan.length) console.log('Sin foto:\n  ' + faltan.join('\n  '));
