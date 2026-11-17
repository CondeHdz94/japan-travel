// Baja las imágenes de las escenas de anime desde anitabi a privado/escenas/.
//
//   node scripts/imagenes-escenas.mjs          solo las que faltan
//
// Va despacio a propósito (una imagen cada pocos segundos) y con un navegador de verdad (el Edge
// que trae Windows, vía Playwright): anitabi bloquea las peticiones en ráfaga. Si varias seguidas
// fallan, se detiene: hay que volver a intentar otro día, no insistir.
//
// Deja dos tamaños por escena, en WebP: <id>.webp (640 px de ancho) y <id>-p.webp (240 px).
// No van en public/: las sirve /api/escena/, que pide sesión.

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const DIR = 'privado/escenas';
const PAUSA = 3000;
const FALLOS_SEGUIDOS = 5;

const { lugares } = JSON.parse(readFileSync('src/data/escenas.json', 'utf8'));
const escenas = new Map();
for (const l of Object.values(lugares)) for (const o of l.obras) for (const e of o.escenas) escenas.set(e.id, e.original);
const faltan = [...escenas].filter(([id]) => !existsSync(`${DIR}/${id}.webp`) || !existsSync(`${DIR}/${id}-p.webp`));
mkdirSync(DIR, { recursive: true });
console.log(`escenas: ${escenas.size} · faltan: ${faltan.length}`);

const navegador = await chromium.launch({ channel: 'msedge' });
const pagina = await navegador.newPage();
let bajadas = 0;
let seguidos = 0;
for (const [id, original] of faltan) {
  try {
    // la imagen de 360 px de alto: la que anitabi recomienda para mostrar (no la completa)
    const r = await pagina.goto(`${original}?plan=h360`, { waitUntil: 'load', timeout: 20000 });
    const tipo = r?.headers()['content-type'] ?? '';
    if (!r || !r.ok() || !tipo.startsWith('image/')) throw new Error(`HTTP ${r?.status()} ${tipo}`);
    const datos = await r.body();
    await sharp(datos).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 70 }).toFile(`${DIR}/${id}.webp`);
    await sharp(datos).resize({ width: 240 }).webp({ quality: 65 }).toFile(`${DIR}/${id}-p.webp`);
    bajadas++;
    seguidos = 0;
  } catch (e) {
    console.log(`  ✗ ${id}: ${e.message}`);
    if (++seguidos >= FALLOS_SEGUIDOS) {
      console.log(`${FALLOS_SEGUIDOS} fallos seguidos: anitabi no está respondiendo. Se intenta otro día.`);
      break;
    }
  }
  await pagina.waitForTimeout(PAUSA);
}
await navegador.close();
console.log(`bajadas: ${bajadas} · siguen faltando: ${faltan.length - bajadas}`);
