// Cada página por fuera: que cargue limpia, que no se desborde, que los enlaces sirvan
// y que la entrada animada del Inicio nunca deje la portada tapada.

import { MESES, PAPELES, VENTANAS } from '../src/data/claves';
import { abrir, desborde, entrarEn, expect, test } from './ayudas';

const PAGINAS = [
  { ruta: '/', titulo: 'Inicio', h1: /Cali/ },
  { ruta: '/cuando-ir', titulo: 'Cuándo ir', h1: /Cuándo ir/ },
  { ruta: '/requisitos', titulo: 'Requisitos', h1: /Requisitos/ },
  { ruta: '/lugares', titulo: 'Lugares', h1: /Lugares/ },
];

// la entrada del Inicio tiene sus propias pruebas; en las demás estorba
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!location.search.includes('intro')) sessionStorage.setItem('intro', '1');
  });
});

for (const p of PAGINAS) {
  test.describe(`${p.titulo} (${p.ruta})`, () => {
    for (const sesion of ['no', 'si'] as const) {
      test(`carga limpia ${sesion === 'si' ? 'con' : 'sin'} sesión: sin errores ni desborde`, async ({ page, errores }) => {
        if (sesion === 'si') await entrarEn(page, 'Camilo');
        await abrir(page, p.ruta, sesion);
        await expect(page).toHaveTitle(`${p.titulo} · Cali → Japón`);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('h1')).toContainText(p.h1);
        // se recorre hasta el final para que carguen las fotos perezosas
        await page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += 1200) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 30));
          }
        });
        await page.waitForLoadState('networkidle');
        expect(await desborde(page), 'px que sobran a lo ancho').toBeLessThanOrEqual(0);
        expect(errores).toEqual([]);
      });
    }

    test('cabecera: marca, tres secciones y la actual resaltada', async ({ page }) => {
      await abrir(page, p.ruta, 'no');
      await expect(page.locator('header.top a.mark')).toHaveAttribute('href', '/');
      const nav = page.locator('header.top nav a');
      await expect(nav).toHaveText(['Cuándo ir', 'Requisitos', 'Lugares']);
      const actual = page.locator('header.top nav a[aria-current=page]');
      if (p.ruta === '/') await expect(actual).toHaveCount(0);
      else await expect(actual).toHaveAttribute('href', p.ruta);
      await expect(page.locator('#quien button')).toHaveText('Entrar');
    });

    test('la cabecera cabe en pantalla, con y sin sesión', async ({ page }) => {
      for (const nombre of [null, 'Maximiliano Fernando']) {
        if (nombre) await entrarEn(page, nombre);
        await abrir(page, p.ruta, nombre ? 'si' : 'no');
        const ancho = page.viewportSize()!.width;
        for (const sel of ['header.top a.mark', 'header.top nav', '#quien button']) {
          const caja = await page.locator(sel).boundingBox();
          expect(caja, sel).not.toBeNull();
          expect(caja!.x, `${sel} se sale por la izquierda`).toBeGreaterThanOrEqual(0);
          expect(caja!.x + caja!.width, `${sel} se sale por la derecha`).toBeLessThanOrEqual(ancho + 1);
        }
        // el botón de sesión no queda encima de la marca
        const marca = (await page.locator('header.top a.mark').boundingBox())!;
        const quien = (await page.locator('#quien button').boundingBox())!;
        const seCruzan =
          marca.x < quien.x + quien.width && quien.x < marca.x + marca.width &&
          marca.y < quien.y + quien.height && quien.y < marca.y + marca.height;
        expect(seCruzan, 'marca y sesión se pisan').toBe(false);
      }
    });

    test('los enlaces internos llevan a páginas que existen', async ({ page }) => {
      await abrir(page, p.ruta, 'no');
      const hrefs = await page.locator('a[href^="/"]').evaluateAll((as) => [
        ...new Set(as.map((a) => a.getAttribute('href')!.split('#')[0])),
      ]);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const h of hrefs) expect((await page.request.get(h)).status(), h).toBe(200);
    });

    test('los enlaces externos son https y los que abren pestaña no filtran el origen', async ({ page }) => {
      await abrir(page, p.ruta, 'no');
      const externos = await page.locator('a[href^="http"]').evaluateAll((as) =>
        as.map((a) => ({ href: a.getAttribute('href')!, target: a.getAttribute('target'), rel: a.getAttribute('rel') ?? '' })),
      );
      for (const e of externos) {
        expect(e.href, e.href).toMatch(/^https:\/\//);
        if (e.target === '_blank') expect(e.rel, e.href).toContain('noopener');
      }
    });

    test('ningún id repetido en la página', async ({ page }) => {
      await abrir(page, p.ruta, 'no');
      const repetidos = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
        return ids.filter((id, i) => ids.indexOf(id) !== i);
      });
      expect(repetidos).toEqual([]);
    });
  });
}

test.describe('Inicio', () => {
  test('boleto con cinco datos e índice con seis secciones (tres abiertas, tres «Pronto»)', async ({ page }) => {
    await abrir(page, '/', 'no');
    await expect(page.locator('.boleto > div')).toHaveCount(5);
    await expect(page.locator('.boleto strong')).toHaveText(['CLO', 'TYO', '2027', '4–5', '14.400']);
    await expect(page.locator('.indice li')).toHaveCount(6);
    const abiertas = page.locator('.indice a.fila');
    await expect(abiertas).toHaveCount(3);
    expect(await abiertas.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual([
      '/cuando-ir',
      '/requisitos',
      '/lugares',
    ]);
    const pronto = page.locator('.indice div.fila.off');
    await expect(pronto).toHaveCount(3);
    await expect(pronto.locator('.go')).toHaveText(['Pronto', 'Pronto', 'Pronto']);
    expect(await pronto.evaluateAll((ds) => ds.some((d) => d.hasAttribute('href')))).toBe(false);
  });

  test('desde el índice se llega a cada sección', async ({ page }) => {
    for (const [i, ruta] of ['/cuando-ir', '/requisitos', '/lugares'].entries()) {
      await abrir(page, '/', 'no');
      await page.locator('.indice a.fila').nth(i).click();
      await expect(page).toHaveURL(new RegExp(`${ruta}$`));
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('con sesión la cabecera muestra el nombre, y el Inicio no se queda consultando', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    let consultas = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/estado')) consultas++;
    });
    await abrir(page, '/', 'si');
    await expect(page.locator('#quien .yo')).toContainText('Camilo');
    await page.waitForTimeout(7000);
    expect(consultas).toBe(1);
  });
});

test.describe('entrada animada del Inicio', () => {
  const portadaLibre = async (page: import('@playwright/test').Page) => {
    await expect(page.locator('#intro')).toHaveCount(0, { timeout: 12_000 });
    await expect(page.locator('html')).not.toHaveAttribute('data-intro', 'si');
    await expect(page.locator('header.top .hanko')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');
    // se puede tocar lo de abajo: nada quedó tapando
    await page.locator('.indice a.fila').first().click();
    await expect(page).toHaveURL(/\/cuando-ir$/);
  };

  test('la primera vez se reproduce y termina sola, dejando la portada libre', async ({ page, errores }) => {
    await page.goto('/?intro');
    await expect(page.locator('html')).toHaveAttribute('data-intro', /si|sale/);
    await portadaLibre(page);
    expect(errores).toEqual([]);
  });

  test('«Saltar» la corta de una', async ({ page }) => {
    await page.goto('/?intro');
    const saltar = page.locator('#intro .saltar');
    // si el navegador no tiene WebGL la entrada se retira sola antes de poder saltarla
    if (await saltar.isVisible().catch(() => false)) await saltar.click().catch(() => {});
    await expect(page.locator('#intro')).toHaveCount(0, { timeout: 3000 });
    await portadaLibre(page);
  });

  test('Escape también la corta', async ({ page }) => {
    await page.goto('/?intro');
    await page.keyboard.press('Escape');
    await expect(page.locator('#intro')).toHaveCount(0, { timeout: 6000 });
    await portadaLibre(page);
  });

  test('va una sola vez por sesión del navegador', async ({ page }) => {
    await page.goto('/?intro');
    await expect(page.locator('#intro')).toHaveCount(0, { timeout: 12_000 });
    expect(await page.evaluate(() => sessionStorage.getItem('intro'))).toBe('1');
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-intro', 'si');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('con movimiento reducido no se reproduce, ni pidiéndola', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?intro');
    expect(await page.locator('html').getAttribute('data-intro')).toBeNull();
    await expect(page.locator('#intro')).toBeHidden();
    await expect(page.locator('header.top .hanko')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
  });

  test('solo existe en el Inicio', async ({ page }) => {
    for (const ruta of ['/cuando-ir', '/requisitos', '/lugares']) {
      await page.goto(`${ruta}?intro`);
      await expect(page.locator('#intro')).toHaveCount(0);
      expect(await page.locator('html').getAttribute('data-intro')).toBeNull();
    }
  });
});

test.describe('contenido de Cuándo ir', () => {
  test('doce meses, seis ventanas, cinco fechas a evitar', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    await expect(page.locator('.meses > li')).toHaveCount(12);
    await expect(page.locator('.meses strong')).toHaveText(
      ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    );
    expect(await page.locator('.meses [data-marca]').evaluateAll((es) => es.map((e) => e.getAttribute('data-marca')))).toEqual(
      // las mismas claves que acepta la API (src/data/claves.ts)
      MESES.map((m) => `mes:${m}`),
    );
    await expect(page.locator('.ventanas article')).toHaveCount(6);
    expect(await page.locator('.ventanas [data-marca]').evaluateAll((es) => es.map((e) => e.getAttribute('data-marca')))).toEqual(
      VENTANAS.map((v) => `ventana:${v}`),
    );
    for (const v of await page.locator('.ventanas .voto').all())
      expect(await v.locator('[data-poner]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-poner')))).toEqual(['2', '1', '0']);
    await expect(page.locator('table tbody tr')).toHaveCount(5);
  });

  test('las barras de temperatura quedan dentro de su casilla', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    const fuera = await page.locator('.meses .termo').evaluateAll((ts) =>
      ts.filter((t) => {
        const c = t.getBoundingClientRect();
        const r = t.querySelector('.rango')!.getBoundingClientRect();
        return r.height <= 0 || r.top < c.top - 1 || r.bottom > c.bottom + 1;
      }).length,
    );
    expect(fuera).toBe(0);
  });

  test('«Ver lugares» lleva a Lugares con la temporada ya filtrada', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    const enlaces = page.locator('.temporada a');
    const hrefs = await enlaces.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) expect(h).toMatch(/^\/lugares\?t=(primavera|verano|otono|invierno)$/);

    const otono = page.locator('.temporada a[href="/lugares?t=otono"]');
    await otono.click();
    await expect(page).toHaveURL(/\/lugares\?t=otono$/);
    await expect(page.locator('#f-temp')).toHaveValue('otono');
    const total = Number(await page.locator('#f-total').textContent());
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(116);
  });

  test('en celular el año se desliza de lado sin arrastrar la página', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    const m = await page.locator('.anio .scroll').evaluate((s) => ({ ancho: s.clientWidth, contenido: s.scrollWidth }));
    if (page.viewportSize()!.width < 720) expect(m.contenido).toBeGreaterThan(m.ancho);
    expect(await desborde(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('contenido de Requisitos', () => {
  test('seis puntos de visa, cinco rutas, siete papeles y sus fuentes', async ({ page }) => {
    await abrir(page, '/requisitos', 'no');
    await expect(page.locator('.lista > li')).toHaveCount(6);
    await expect(page.locator('.rutas > li')).toHaveCount(5);
    await expect(page.locator('.papeles > li')).toHaveCount(7);
    expect(await page.locator('.papeles [data-marca]').evaluateAll((es) => es.map((e) => e.getAttribute('data-marca')))).toEqual(
      PAPELES.map((p) => `papel:${p}`),
    );
    await expect(page.locator('.fuentes a')).toHaveCount(10);
  });

  test('cada dato lleva su sello de «Confirmado» o «Por confirmar»', async ({ page }) => {
    await abrir(page, '/requisitos', 'no');
    for (const li of await page.locator('.lista > li, .rutas > li').all())
      await expect(li.locator('.chip').filter({ hasText: /^(Confirmado|Por confirmar)$/ })).toHaveCount(1);
    await expect(page.locator('.chip.warn').filter({ hasText: 'Por confirmar' }).first()).toBeVisible();
  });
});

test.describe('nada de fábrica', () => {
  test('los íconos son el sello del sitio y todos existen', async ({ page }) => {
    await abrir(page, '/', 'no');
    const pedir = (ruta: string) => page.context().request.get(ruta);
    const href = (sel: string) => page.locator(sel).getAttribute('href');

    const svg = await pedir((await href('link[rel=icon][type="image/svg+xml"]'))!);
    expect(svg.status()).toBe(200);
    const dibujo = await svg.text();
    expect(dibujo, 'bermellón del sello').toContain('#d2391f');
    expect(dibujo, 'sigue siendo el ícono de la plantilla').not.toContain('prefers-color-scheme');

    for (const sel of ['link[rel=icon][sizes]', 'link[rel=apple-touch-icon]']) {
      const r = await pedir((await href(sel))!);
      expect(r.status(), sel).toBe(200);
      expect((await r.body()).length, sel).toBeGreaterThan(1000);
    }

    const manifiesto = await (await pedir((await href('link[rel=manifest]'))!)).json();
    expect(manifiesto.name).toContain('Cali → Japón');
    expect(manifiesto.icons.length).toBeGreaterThanOrEqual(2);
    for (const i of manifiesto.icons) expect((await pedir(i.src)).status(), i.src).toBe(200);

    await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content', '#f1ece1');
  });

  for (const p of PAGINAS) {
    test(`${p.ruta}: al compartirla sale con título, descripción y la tarjeta del sitio`, async ({ page }) => {
      await abrir(page, p.ruta, 'no');
      const og = (n: string) => page.locator(`meta[property="og:${n}"]`).getAttribute('content');
      expect(await og('title')).toBe(`${p.titulo} · Cali → Japón`);
      expect((await og('description'))!.length).toBeGreaterThan(20);
      // dirección completa: WhatsApp no sigue rutas relativas
      const imagen = (await og('image'))!;
      expect(imagen).toMatch(/^https:\/\/.+\/tarjeta\.png$/);
      const r = await page.context().request.get(new URL(imagen).pathname);
      expect(r.status()).toBe(200);
      expect(r.headers()['content-type']).toContain('image/png');
      expect((await r.body()).length, 'muy pesada para la vista previa de WhatsApp').toBeLessThan(300_000);
    });
  }

  test('una dirección que no existe muestra la página perdida del cuaderno, con salida al inicio', async ({ page }) => {
    const r = await page.goto('/esta-pagina-no-existe');
    expect(r?.status()).toBe(404);
    await expect(page).toHaveTitle('Página perdida · Cali → Japón');
    await expect(page.locator('h1')).toHaveText('Por aquí no es');
    await expect(page.locator('header.top a.mark')).toBeVisible();
    await expect(page.locator('main a[href="/"]')).toBeVisible();
    expect(await desborde(page), 'px que sobran a lo ancho').toBeLessThanOrEqual(0);
    await page.locator('main a[href="/"]').click();
    await expect(page).toHaveURL(/\/$/);
  });
});
