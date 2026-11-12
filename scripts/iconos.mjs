// Saca los íconos del sitio a partir de public/favicon.svg (el sello 旅 de la cabecera):
//
//   node scripts/iconos.mjs
//
//   favicon.ico            16, 32 y 48 px, para lo que no lee SVG
//   apple-touch-icon.png   180 px, para la pantalla de inicio del iPhone
//   icono-192.png / -512   para el manifiesto (Android, «Añadir a pantalla de inicio»)
//   tarjeta.png            la comprime, si ya existe (ver scripts/tarjeta.html)
//
// Los de pantalla de inicio llevan fondo de papel hasta el borde: cada sistema recorta el ícono
// a su manera (círculo, esquinas redondas) y el sello tiene que quedar entero adentro.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const PUBLICO = new URL('../public/', import.meta.url);
const PAPEL = '#f1ece1';
const sello = readFileSync(new URL('favicon.svg', PUBLICO));

/** El sello solo, con fondo transparente, a `lado` px. */
const suelto = (lado) => sharp(sello, { density: (72 * lado) / 64 }).resize(lado, lado).png().toBuffer();

/** El sello centrado sobre papel, ocupando `parte` del lado. */
async function sobrePapel(lado, parte = 0.62) {
  const adentro = Math.round(lado * parte);
  return sharp({ create: { width: lado, height: lado, channels: 4, background: PAPEL } })
    .composite([{ input: await suelto(adentro), gravity: 'centre' }])
    .png()
    .toBuffer();
}

/** Un .ico con varias imágenes PNG adentro. */
function ico(imagenes) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(1, 2); // tipo: ícono
  cabecera.writeUInt16LE(imagenes.length, 4);
  let desde = 6 + 16 * imagenes.length;
  const entradas = imagenes.map(({ lado, png }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(lado, 0); // ancho
    e.writeUInt8(lado, 1); // alto
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por píxel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(desde, 12);
    desde += png.length;
    return e;
  });
  return Buffer.concat([cabecera, ...entradas, ...imagenes.map((i) => i.png)]);
}

const lados = [16, 32, 48];
const pngs = await Promise.all(lados.map(suelto));
const archivos = {
  'favicon.ico': ico(lados.map((lado, i) => ({ lado, png: pngs[i] }))),
  'apple-touch-icon.png': await sobrePapel(180),
  'icono-192.png': await sobrePapel(192, 0.54), // más chico: Android lo recorta en círculo
  'icono-512.png': await sobrePapel(512, 0.54),
};
// La tarjeta para compartir es una foto de scripts/tarjeta.html (ahí dice cómo sacarla). Aquí se
// comprime: WhatsApp no muestra la vista previa si la imagen pesa mucho.
if (existsSync(new URL('tarjeta.png', PUBLICO)))
  archivos['tarjeta.png'] = await sharp(readFileSync(new URL('tarjeta.png', PUBLICO)))
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toBuffer();

for (const [nombre, datos] of Object.entries(archivos)) {
  writeFileSync(new URL(nombre, PUBLICO), datos);
  console.log(`${nombre}  ${(datos.length / 1024).toFixed(1)} kB`);
}
