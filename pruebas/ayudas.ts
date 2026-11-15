// Lo común a todas las pruebas: la base de pruebas, viajeros de mentira y medidas de página.

import { mkdirSync } from 'node:fs';
import { createClient } from '@libsql/client';
import {
  test as base,
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';

export { expect };

/** La clave del servidor de pruebas (ver playwright.config.ts). No es la del viaje. */
export const CLAVE = 'clave-de-pruebas';
const BASE_DATOS = 'file:.data/pruebas.db';

export interface Estado {
  yo: { id: number; nombre: string; forma: string; tinta: number } | null;
  personas: { id: number; nombre: string; forma: string; tinta: number }[];
  marcas: { p: number; t: string; c: string; v: number }[];
  visto?: number;
}

/** Borra todo lo que haya en la base de pruebas. Nunca toca .data/local.db. */
export async function vaciarBase() {
  mkdirSync('.data', { recursive: true });
  const c = createClient({ url: BASE_DATOS });
  try {
    for (const tabla of ['marcas', 'lugares', 'personas']) {
      for (let intento = 0; ; intento++) {
        try {
          await c.execute(`DELETE FROM ${tabla}`);
          break;
        } catch (e) {
          if (/no such table/i.test(String(e))) break; // el servidor aún no la ha creado
          if (intento >= 5) throw e;
          await new Promise((r) => setTimeout(r, 150)); // base ocupada: se reintenta
        }
      }
    }
  } finally {
    c.close();
  }
}

/** Alguien del grupo hablando directo con la API, con su propia cookie. */
export interface Viajero {
  id: number;
  nombre: string;
  api: APIRequestContext;
  /** El valor de su cookie de sesión. */
  cookie(): Promise<string>;
  marcar(tipo: string, clave: string, valor: unknown): Promise<APIResponse>;
  proponer(datos: Record<string, unknown>): Promise<string>;
  estado(): Promise<Estado>;
}

export interface Grupo {
  /** Cliente de la API sin sesión (o con las cabeceras que se le den). */
  anonimo(cabeceras?: Record<string, string>): Promise<APIRequestContext>;
  /** Entra (o se registra) con ese nombre. Si ya existe, entra como esa persona («soy yo»). */
  entrar(nombre: string): Promise<Viajero>;
}

export const test = base.extend<{ limpieza: void; grupo: Grupo; errores: string[] }>({
  // después de cada prueba no queda ningún viajero ni marca
  limpieza: [
    async ({}, use) => {
      await use();
      await vaciarBase();
    },
    { auto: true },
  ],

  grupo: async ({ playwright, baseURL }, use) => {
    const abiertos: APIRequestContext[] = [];
    const anonimo = async (cabeceras?: Record<string, string>) => {
      const a = await playwright.request.newContext({ baseURL, extraHTTPHeaders: cabeceras });
      abiertos.push(a);
      return a;
    };
    await use({
      anonimo,
      async entrar(nombre) {
        const api = await anonimo();
        const r = await api.post('/api/entrar', { data: { nombre, clave: CLAVE, soyYo: true } });
        expect(r.status(), `entrar como ${nombre}`).toBe(200);
        const e: Estado = await r.json();
        return {
          id: e.yo!.id,
          nombre: e.yo!.nombre,
          api,
          async cookie() {
            const { cookies } = await api.storageState();
            return cookies.find((c) => c.name === 'viajero')?.value ?? '';
          },
          marcar: (tipo, clave, valor) => api.post('/api/marca', { data: { tipo, clave, valor } }),
          async proponer(datos) {
            const p = await api.post('/api/lugares', { data: datos });
            expect(p.status(), `proponer ${JSON.stringify(datos)}`).toBe(200);
            return (await p.json()).id;
          },
          estado: async () => (await api.get('/api/estado')).json(),
        };
      },
    });
    for (const a of abiertos) await a.dispose();
  },

  // la barra de desarrollo de Astro no es parte del sitio: tapa el borde de abajo y trae sus propios títulos y enlaces
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      new MutationObserver(() => document.querySelector('astro-dev-toolbar')?.remove()).observe(document, {
        childList: true,
        subtree: true,
      });
    });
    await use(page);
  },

  /** Errores de consola y de página que salgan durante la prueba. */
  errores: async ({ page }, use) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errores.push(`consola: ${m.text()}`);
    });
    page.on('response', (r) => {
      if (r.status() >= 400) errores.push(`${r.status()} ${r.url()}`);
    });
    await use(errores);
  },
});

/** Abre sesión en el navegador de la prueba (por la API, sin pasar por el formulario). */
export async function entrarEn(page: Page, nombre: string): Promise<number> {
  const r = await page.context().request.post('/api/entrar', { data: { nombre, clave: CLAVE, soyYo: true } });
  expect(r.status(), `entrar como ${nombre}`).toBe(200);
  return (await r.json()).yo.id;
}

/** Va a una página y espera a que el estado del grupo esté pintado. */
export async function abrir(page: Page, ruta: string, sesion: 'si' | 'no') {
  const estado = page.waitForResponse((r) => r.url().includes('/api/estado'));
  await page.goto(ruta);
  await estado;
  await expect(page.locator('html')).toHaveAttribute('data-sesion', sesion);
}

/** Llena y envía el registro que ya está abierto. */
export async function llenarRegistro(page: Page, nombre: string, clave = CLAVE) {
  const d = page.locator('#registro');
  await expect(d).toBeVisible();
  await d.locator('[name=nombre]').fill(nombre);
  await d.locator('[name=clave]').fill(clave);
  await d.locator('button[type=submit]').click();
}

/** En el registro abierto, responde «Sí, soy yo» a la pregunta de nombre repetido. */
export async function confirmarQueSoyYo(page: Page) {
  const d = page.locator('#registro');
  await expect(d.locator('[data-confirma]')).toBeVisible();
  await d.locator('[data-soy-yo]').click();
}

/** Espera a que termine el momento de una llegada (si lo hay) y que la capa desaparezca. */
export async function sinMomento(page: Page) {
  await expect(page.locator('.llegada')).toHaveCount(0, { timeout: 10_000 });
}

/** Estado del grupo visto desde el navegador de la prueba. */
export async function estadoDe(page: Page): Promise<Estado> {
  return (await page.context().request.get('/api/estado')).json();
}

/** ¿La página se sale por los lados? Devuelve cuántos px sobran (0 = bien). */
export const desborde = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/**
 * Foto de dónde está cada cosa: alto total y posición de los elementos que casan con el selector.
 * Sirve para comprobar que poner o quitar un sello no mueve nada.
 */
export const plano = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    // las franjas que se deslizan de lado (el año, los filtros) se devuelven al inicio
    for (const e of document.querySelectorAll('.scroll, .filtros, .temas')) e.scrollLeft = 0;
    const y = window.scrollY;
    const visibles = (s: string) => [...document.querySelectorAll<HTMLElement>(s)].filter((e) => e.offsetParent !== null);
    const redondo = (ns: number[]) => ns.map((n) => Math.round(n)).join(',');
    return {
      alto: document.documentElement.scrollHeight,
      cajas: visibles(sel).map((e) => {
        const r = e.getBoundingClientRect();
        return redondo([r.left, r.top + y, r.width, r.height]);
      }),
      // Las zonas de sellos y los botones sí cambian de ancho (llegan sellos, el botón gana
      // un ✓); lo que no puede cambiar es a qué altura están ni cuánto alto ocupan.
      renglones: visibles('[data-sellos], [data-poner]').map((e) => {
        const r = e.getBoundingClientRect();
        return redondo([r.top + y, r.height]);
      }),
    };
  }, selector);
