// Lugares en el navegador: catálogo, filtros, sellos, proponer, quitar y avisos en vivo.

import type { Page } from '@playwright/test';
import { SEMILLAS, TEMAS, TEMPORADAS, ZONAS } from '../src/data/lugares';
import { abrir, desborde, entrarEn, estadoDe, expect, llenarRegistro, plano, test } from './ayudas';

const TOTAL = SEMILLAS.length;
const LUGAR = { nombre: 'Mirador de prueba', tema: 'raro', zona: 'tokio' };

const visibles = (page: Page) => page.locator('article.lugar:visible');
const tarjeta = (page: Page, id: string) => page.locator(`article.lugar[data-marca="lugar:${id}"]`);

/** Lo que dicen los contadores de la página, para compararlo con lo que de verdad se ve. */
async function conteos(page: Page) {
  return page.evaluate(() => {
    const ver = (e: Element) => !(e as HTMLElement).hidden;
    return {
      total: Number(document.getElementById('f-total')!.textContent),
      tarjetas: [...document.querySelectorAll('article.lugar')].filter(ver).length,
      temas: [...document.querySelectorAll<HTMLElement>('section.tema')].map((t) => ({
        id: t.id,
        oculto: t.hidden,
        dice: Number(t.querySelector('[data-visibles]')!.textContent),
        hay: [...t.querySelectorAll('article.lugar')].filter(ver).length,
        enBarra: Number(document.querySelector(`[data-ir-tema="${t.id}"] small`)!.textContent),
        apagado: document.querySelector(`[data-ir-tema="${t.id}"]`)!.classList.contains('apagado'),
      })),
    };
  });
}

/** Los contadores cuadran con las tarjetas a la vista. */
async function cuadra(page: Page) {
  const c = await conteos(page);
  expect(c.total, 'total a la vista').toBe(c.tarjetas);
  for (const t of c.temas) {
    expect(t.dice, `cuenta de ${t.id}`).toBe(t.hay);
    expect(t.enBarra, `barra de ${t.id}`).toBe(t.hay);
    expect(t.oculto, `${t.id} oculto`).toBe(t.hay === 0);
    expect(t.apagado, `${t.id} apagado`).toBe(t.hay === 0);
  }
  return c;
}

test.describe('catálogo', () => {
  test(`sin sesión: ${TOTAL} tarjetas en diez temas, con sus conteos`, async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    await expect(page.locator('article.lugar')).toHaveCount(TOTAL);
    await expect(page.locator('section.tema')).toHaveCount(TEMAS.length);
    await expect(page.locator('.page-head p')).toContainText(`${TOTAL} sitios y eventos`);
    const c = await cuadra(page);
    expect(c.total).toBe(TOTAL);
    for (const t of c.temas) expect(t.hay, t.id).toBe(SEMILLAS.filter((l) => l.tema === t.id).length);
    await expect(page.locator('#f-mios')).toBeHidden();
    await expect(page.locator('#vacio')).toBeHidden();
    await expect(page.locator('#novedad')).toBeHidden();
  });

  test('cada tarjeta trae nombre, zona, enlace al mapa y botón de sello', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    const malas = await page.locator('article.lugar').evaluateAll((as) =>
      as
        .filter((a) => {
          const mapa = a.querySelector<HTMLAnchorElement>('.meta a');
          return !(
            a.querySelector('h3')?.textContent?.trim() &&
            a.querySelector('.meta span')?.textContent?.trim() &&
            mapa?.href.startsWith('https://www.google.com/maps/search/?api=1&query=') &&
            mapa.target === '_blank' &&
            a.querySelectorAll('[data-poner="1"]').length === 1 &&
            a.querySelectorAll('[data-sellos]').length === 1 &&
            (a.querySelector('.foto img') || a.querySelector('.sin-foto'))
          );
        })
        .map((a) => a.id),
    );
    expect(malas).toEqual([]);
  });

  test('las fotos cargan de verdad (ninguna rota)', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    await page.locator('article.lugar img').evaluateAll((imgs) => imgs.forEach((i) => ((i as HTMLImageElement).loading = 'eager')));
    await expect
      .poll(
        () => page.locator('article.lugar img').evaluateAll((imgs) => imgs.filter((i) => !(i as HTMLImageElement).complete).length),
        { timeout: 20_000 },
      )
      .toBe(0);
    const rotas = await page.locator('article.lugar img').evaluateAll((imgs) =>
      imgs.filter((i) => (i as HTMLImageElement).naturalWidth === 0).map((i) => i.getAttribute('src')),
    );
    expect(rotas).toEqual([]);
  });

  test('la barra de temas salta a cada sección', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    for (const id of ['motor', 'eventos', 'otaku']) {
      await page.locator(`[data-ir-tema="${id}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`section#${id} h2`)).toBeInViewport();
      // el título no queda debajo de la barra fija
      const barra = (await page.locator('.barra').boundingBox())!;
      const titulo = (await page.locator(`section#${id} h2`).boundingBox())!;
      expect(titulo.y).toBeGreaterThanOrEqual(barra.y + barra.height - 1);
    }
  });

  test('los créditos listan una foto por lugar que la tiene', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    const n = await page.locator('article.lugar .foto img').count();
    await expect(page.locator('.creditos li')).toHaveCount(n);
    await page.locator('.creditos summary').click();
    await expect(page.locator('.creditos li').first()).toBeVisible();
  });

  test('no se desborda a lo ancho, ni con la barra de filtros', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    expect(await desborde(page)).toBeLessThanOrEqual(0);
    await entrarEn(page, 'Maximiliano Fernando');
    await abrir(page, '/lugares', 'si');
    expect(await desborde(page)).toBeLessThanOrEqual(0);
    // todos los controles de filtro se pueden alcanzar
    for (const sel of ['#f-zona', '#f-temp', '#f-mios', '.filtros [data-proponer]']) {
      await page.locator(sel).scrollIntoViewIfNeeded();
      await expect(page.locator(sel)).toBeInViewport();
    }
  });
});

test.describe('filtros', () => {
  for (const z of ZONAS) {
    test(`zona «${z.nombre}»: solo se ven las de esa zona`, async ({ page }) => {
      await abrir(page, '/lugares', 'no');
      await page.locator('#f-zona').selectOption(z.id);
      const esperadas = SEMILLAS.filter((l) => l.zona === z.id).map((l) => l.id).sort();
      expect((await visibles(page).evaluateAll((as) => as.map((a) => a.id))).sort()).toEqual(esperadas);
      await cuadra(page);
      await expect(page).toHaveURL(new RegExp(`\\?zona=${z.id}$`));
    });
  }

  for (const t of TEMPORADAS) {
    test(`temporada «${t.nombre}»: lo de esos meses y lo de todo el año`, async ({ page }) => {
      await abrir(page, '/lugares', 'no');
      await page.locator('#f-temp').selectOption(t.id);
      const esperadas = SEMILLAS.filter((l) => !l.meses || l.meses.some((m) => t.meses.includes(m))).map((l) => l.id).sort();
      expect((await visibles(page).evaluateAll((as) => as.map((a) => a.id))).sort()).toEqual(esperadas);
      await cuadra(page);
      await expect(page).toHaveURL(new RegExp(`\\?t=${t.id}$`));
    });
  }

  test('zona y temporada juntas, y los filtros sobreviven a una recarga', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    await page.locator('#f-zona').selectOption('kansai');
    await page.locator('#f-temp').selectOption('invierno');
    const esperadas = SEMILLAS.filter(
      (l) => l.zona === 'kansai' && (!l.meses || l.meses.some((m) => [12, 1, 2].includes(m))),
    ).length;
    await expect(visibles(page)).toHaveCount(esperadas);
    await expect(page).toHaveURL(/\?zona=kansai&t=invierno$/);

    await page.reload();
    await expect(page.locator('#f-zona')).toHaveValue('kansai');
    await expect(page.locator('#f-temp')).toHaveValue('invierno');
    await expect(visibles(page)).toHaveCount(esperadas);
    await cuadra(page);
  });

  test('volver a «todas» lo muestra todo y limpia la dirección', async ({ page }) => {
    await abrir(page, '/lugares?zona=norte&t=verano', 'no');
    await expect(page.locator('#f-zona')).toHaveValue('norte');
    await page.locator('#f-zona').selectOption('');
    await page.locator('#f-temp').selectOption('');
    await expect(visibles(page)).toHaveCount(TOTAL);
    await expect(page).toHaveURL(/\/lugares$/);
    await cuadra(page);
  });

  test('valores inventados en la dirección se ignoran', async ({ page, errores }) => {
    await abrir(page, '/lugares?zona=marte&t=nunca&mios=1&otra=<script>', 'no');
    await expect(page.locator('#f-zona')).toHaveValue('');
    await expect(page.locator('#f-temp')).toHaveValue('');
    await expect(visibles(page)).toHaveCount(TOTAL);
    await expect(page.locator('#f-mios')).toHaveAttribute('aria-pressed', 'false');
    expect(errores).toEqual([]);
  });

  test('sin resultados: mensaje, y «Quitar filtros» devuelve todo', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    await page.locator('#f-mios').click(); // no he sellado nada
    await expect(visibles(page)).toHaveCount(0);
    await expect(page.locator('#vacio')).toBeVisible();
    await expect(page.locator('section.tema:visible')).toHaveCount(0);
    await cuadra(page);

    await page.locator('#limpiar').click();
    await expect(page.locator('#vacio')).toBeHidden();
    await expect(visibles(page)).toHaveCount(TOTAL);
    await expect(page.locator('#f-mios')).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/\/lugares$/);
    await cuadra(page);
  });

  test('el ancla se conserva al filtrar', async ({ page }) => {
    await abrir(page, '/lugares#jardines', 'no');
    await page.locator('#f-zona').selectOption('tokio');
    await expect(page).toHaveURL(/\/lugares\?zona=tokio#jardines$/);
  });
});

test.describe('sellar lugares', () => {
  test('«Quiero ir» pone mi sello y la foto a color; otro toque lo quita', async ({ page }) => {
    const id = await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    const t = tarjeta(page, 'akihabara');
    await t.scrollIntoViewIfNeeded();
    const filtro = () => t.locator('.foto img').evaluate((i) => getComputedStyle(i).filter);

    await page.mouse.move(0, 0);
    expect(await filtro()).toContain('grayscale');
    await t.locator('[data-poner]').click();
    await expect(t.locator('[data-poner]')).toHaveAttribute('aria-pressed', 'true');
    await expect(t.locator('[data-sellos] .sello-p')).toHaveCount(1);
    await expect.poll(filtro).toBe('none');
    await expect.poll(async () => (await estadoDe(page)).marcas).toEqual([{ p: id, t: 'lugar', c: 'akihabara', v: 1 }]);

    await t.locator('[data-poner]').click();
    await expect(t.locator('[data-sellos] .sello-p')).toHaveCount(0);
    await expect.poll(async () => (await estadoDe(page)).marcas).toEqual([]);
  });

  test('sellar no mueve ninguna tarjeta, ni con cinco sellos en la misma', async ({ page, grupo }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    const PUNTOS = 'article.lugar, section.tema, footer';
    const antes = await plano(page, PUNTOS);

    for (const id of ['akihabara', 'fushimi-inari', 'gion']) {
      await tarjeta(page, id).locator('[data-poner]').click();
      await expect(tarjeta(page, id).locator('.sello-p')).toHaveCount(1);
    }
    await page.waitForTimeout(700);
    expect(await plano(page, PUNTOS)).toEqual(antes);

    for (const n of ['Maximiliano', 'Wendy', 'Ñato', 'Guillermo']) await (await grupo.entrar(n)).marcar('lugar', 'akihabara', 1);
    await expect(tarjeta(page, 'akihabara').locator('.sello-p')).toHaveCount(5, { timeout: 10_000 });
    await page.waitForTimeout(700);
    expect(await plano(page, PUNTOS)).toEqual(antes);
    // los cinco sellos caben dentro de la tarjeta
    const cabe = await tarjeta(page, 'akihabara').evaluate((a) => {
      const c = a.getBoundingClientRect();
      return [...a.querySelectorAll('.sello-p')].every((s) => {
        const r = s.getBoundingClientRect();
        return r.left >= c.left - 1 && r.right <= c.right + 1 && r.bottom <= c.bottom + 1;
      });
    });
    expect(cabe, 'sellos dentro de la tarjeta').toBe(true);
  });

  test('poner mi sello no corre los sellos de los demás', async ({ page, grupo }) => {
    for (const n of ['Ana', 'Beto']) await (await grupo.entrar(n)).marcar('lugar', 'akihabara', 1);
    await entrarEn(page, 'Zoe');
    await abrir(page, '/lugares', 'si');
    const t = tarjeta(page, 'akihabara');
    await expect(t.locator('.sello-p')).toHaveCount(2);
    const donde = () => t.locator('.sello-p').evaluateAll((ss) => ss.slice(0, 2).map((s) => Math.round(s.getBoundingClientRect().left)));
    const antes = await donde();
    await t.locator('[data-poner]').click();
    await expect(t.locator('.sello-p')).toHaveCount(3);
    await page.waitForTimeout(700);
    expect(await donde()).toEqual(antes);
  });

  test('sin sesión, «Quiero ir» abre el registro y al entrar el sello queda puesto', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    await tarjeta(page, 'gion').locator('[data-poner]').click();
    await llenarRegistro(page, 'Camilo');
    // la página se recarga para traer lo del grupo
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'si');
    await expect(tarjeta(page, 'gion').locator('[data-poner]')).toHaveAttribute('aria-pressed', 'true');
    await expect(tarjeta(page, 'gion').locator('.sello-p')).toHaveCount(1);
    expect((await estadoDe(page)).marcas.map((m) => m.c)).toEqual(['gion']);
    await expect(page.locator('#f-mios')).toBeVisible();
  });

  test('«Mis sellos» deja solo los míos, queda en la dirección y sobrevive a recargar', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    await ana.marcar('lugar', 'himeji', 1);
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    for (const id of ['akihabara', 'gion']) await tarjeta(page, id).locator('[data-poner]').click();

    await page.locator('#f-mios').click();
    await expect(page.locator('#f-mios')).toHaveAttribute('aria-pressed', 'true');
    expect((await visibles(page).evaluateAll((as) => as.map((a) => a.id))).sort()).toEqual(['akihabara', 'gion']);
    await cuadra(page);
    await expect(page).toHaveURL(/\?mios=1$/);

    await page.reload();
    await expect(page.locator('#f-mios')).toHaveAttribute('aria-pressed', 'true');
    await expect(visibles(page)).toHaveCount(2);
    await cuadra(page);

    // combinado con zona
    await page.locator('#f-zona').selectOption('tokio');
    expect(await visibles(page).evaluateAll((as) => as.map((a) => a.id))).toEqual(['akihabara']);

    await page.locator('#f-mios').click();
    await expect(page.locator('#f-mios')).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/\?zona=tokio$/);
  });

  test('un enlace con «mis sellos» abierto en un dispositivo recién ingresado también filtra', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    await camilo.marcar('lugar', 'gion', 1);
    await entrarEn(page, 'Camilo'); // hay cookie, pero este navegador aún no guarda el estado
    await abrir(page, '/lugares?mios=1', 'si');
    await expect(page.locator('#f-mios')).toHaveAttribute('aria-pressed', 'true');
    await expect(visibles(page)).toHaveCount(1);
  });
});

test.describe('proponer', () => {
  test('sin sesión, «Proponer» abre el registro', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    await page.locator('.filtros [data-proponer]').click();
    await expect(page.locator('#registro')).toBeVisible();
    await expect(page.locator('#proponer')).toBeHidden();
  });

  test('proponer un lugar completo: aparece en su tema, resaltado, con mi sello y «Quitar»', async ({ page }) => {
    const id = await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    await page.locator('.filtros [data-proponer]').click();
    const d = page.locator('#proponer');
    await expect(d).toBeVisible();
    await d.locator('[name=nombre]').fill('Parque de los Gatos');
    await d.locator('[name=tema]').selectOption('raro');
    await d.locator('[name=zona]').selectOption('sur');
    await d.locator('[name=nota]').fill('Queda al lado del mar y casi no va nadie.');
    await d.locator('[name=temporada]').selectOption('verano');
    await d.locator('[name=enlace]').fill('https://example.com/gatos');
    await d.locator('button[type=submit]').click();

    await page.waitForURL(/\/lugares#u\d+$/);
    const idLugar = new URL(page.url()).hash.slice(1);
    const t = tarjeta(page, idLugar);
    await expect(t).toBeVisible();
    await expect(t).toBeInViewport();
    expect(await t.evaluate((a) => a.closest('section')!.id)).toBe('raro');
    await expect(t.locator('h3')).toHaveText('Parque de los Gatos');
    await expect(t.locator('.desc')).toHaveText('Queda al lado del mar y casi no va nadie.');
    await expect(t.locator('.meta span')).toHaveText('Sur');
    await expect(t.locator('.cuando')).toHaveText('Jun–Sep');
    await expect(t.locator('.meta a')).toHaveAttribute('href', 'https://example.com/gatos');
    await expect(t.locator('.meta a')).toContainText('Enlace');
    await expect(t.locator('.sin-foto')).toBeVisible();
    await expect(t.locator('[data-sello-de] .sello-p')).toHaveCount(1);
    await expect(t.locator('[data-sello-de] .sello-p')).toHaveAttribute('title', /Camilo/);
    await expect(t.locator('[data-quitar]')).toHaveText('Quitar');
    await expect(t.locator('[data-poner]')).toHaveAttribute('aria-pressed', 'true');
    await expect(t.locator('[data-sellos] .sello-p')).toHaveCount(1);

    await expect(page.locator('article.lugar')).toHaveCount(TOTAL + 1);
    await expect(page.locator('.page-head p')).toContainText(`${TOTAL + 1} sitios y eventos`);
    await cuadra(page);
    expect((await estadoDe(page)).marcas).toEqual([{ p: id, t: 'lugar', c: idLugar, v: 1 }]);
    await expect(page.locator('#novedad')).toBeHidden();
  });

  test('el botón de cada tema deja el tema escogido, y la zona filtrada también', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares?zona=tokio', 'si');
    await page.locator('section#motor .nueva').click();
    const d = page.locator('#proponer');
    await expect(d.locator('[name=tema]')).toHaveValue('motor');
    await expect(d.locator('[name=zona]')).toHaveValue('tokio');
    await d.locator('[data-cerrar]').click();
    await expect(d).toBeHidden();
    await page.locator('section#otaku .nueva').click();
    await expect(d.locator('[name=tema]')).toHaveValue('otaku');
  });

  test('sin nombre no se envía; con enlace que no es https el servidor avisa y no se pierde lo escrito', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    let envios = 0;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/lugares')) envios++;
    });
    await page.locator('.filtros [data-proponer]').click();
    const d = page.locator('#proponer');
    await d.locator('button[type=submit]').click();
    await expect(d).toBeVisible();
    expect(envios).toBe(0);

    await d.locator('[name=nombre]').fill('Con enlace viejo');
    await d.locator('[name=enlace]').fill('http://example.com');
    await d.locator('button[type=submit]').click();
    await expect(d.locator('[role=alert]')).toHaveText('El enlace debe empezar por https://');
    await expect(d).toBeVisible();
    await expect(d.locator('[name=nombre]')).toHaveValue('Con enlace viejo');
    await expect(d.locator('button[type=submit]')).toBeEnabled();
    await expect(page.locator('article.lugar')).toHaveCount(TOTAL);

    // cerrar y abrir: el aviso no queda pegado
    await d.locator('[data-cerrar]').click();
    await page.locator('.filtros [data-proponer]').click();
    await expect(d.locator('[role=alert]')).toBeEmpty();
  });

  test('doble toque en «Proponer» no crea el lugar dos veces', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    await page.locator('.filtros [data-proponer]').click();
    const d = page.locator('#proponer');
    await d.locator('[name=nombre]').fill('Solo una vez');
    await d.locator('button[type=submit]').dblclick();
    await page.waitForURL(/#u\d+$/);
    await expect(page.locator('article.lugar h3', { hasText: 'Solo una vez' })).toHaveCount(1);
  });

  test('un lugar propuesto con foto que no carga no deja la tarjeta rota', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    const id = await ana.proponer({ ...LUGAR, imagen: 'https://localhost:9/no-existe.jpg' });
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    const t = tarjeta(page, id);
    await t.scrollIntoViewIfNeeded();
    // en vez de una foto rota se ve el kanji del tema, como en las tarjetas sin foto
    await expect(t.locator('.sin-foto')).toBeVisible();
    await expect(t.locator('.foto img')).toBeHidden();
  });

  test('otro viajero lo ve con el sello de quien propuso, sin «Quitar», y lo puede sellar', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    const id = await ana.proponer(LUGAR);
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    const t = tarjeta(page, id);
    await expect(t.locator('h3')).toHaveText('Mirador de prueba');
    await expect(t.locator('[data-sello-de] .sello-p')).toHaveAttribute('title', /Ana/);
    await expect(t.locator('[data-quitar]')).toHaveCount(0);
    await expect(t.locator('[data-sellos] .sello-p')).toHaveCount(1);
    await t.locator('[data-poner]').click();
    await expect(t.locator('[data-sellos] .sello-p')).toHaveCount(2);
    await expect.poll(async () => (await ana.estado()).marcas.length).toBe(2);
  });

  test('quitar pide dos toques y se lleva la tarjeta y sus sellos', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    await entrarEn(page, 'Camilo');
    const camilo = await grupo.entrar('Camilo');
    const id = await camilo.proponer(LUGAR);
    await ana.marcar('lugar', id, 1);
    await abrir(page, '/lugares?zona=tokio', 'si');

    const quitar = tarjeta(page, id).locator('[data-quitar]');
    await quitar.click();
    await expect(quitar).toHaveText('¿Seguro?');
    await expect(tarjeta(page, id)).toBeVisible();
    expect((await ana.estado()).marcas).toHaveLength(2);

    await quitar.click();
    await expect(tarjeta(page, id)).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'si');
    // se conserva el filtro que había
    await expect(page.locator('#f-zona')).toHaveValue('tokio');
    expect((await ana.estado()).marcas).toEqual([]);
    await expect(page.locator('article.lugar')).toHaveCount(TOTAL);
  });

  test('al salir, los lugares del grupo desaparecen de la página', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    const id = await ana.proponer(LUGAR);
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    await expect(tarjeta(page, id)).toHaveCount(1);

    await page.locator('#quien [data-perfil]').click();
    await page.locator('#perfil [data-salir]').click();
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'no');
    await expect(tarjeta(page, id)).toHaveCount(0);
    await expect(page.locator('article.lugar')).toHaveCount(TOTAL);
    await expect(page.locator('body')).not.toContainText('Mirador de prueba');
  });
});

test.describe('lugares en vivo', () => {
  test('si otro propone un lugar, sale el aviso y al tocarlo aparece', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    await expect(page.locator('#novedad')).toBeHidden();

    const id = await ana.proponer(LUGAR);
    await expect(page.locator('#novedad')).toBeVisible({ timeout: 10_000 });
    // no se recarga sola: la tarjeta aún no está
    await expect(tarjeta(page, id)).toHaveCount(0);

    await page.locator('#novedad').click();
    await expect(tarjeta(page, id)).toHaveCount(1);
    await expect(page.locator('#novedad')).toBeHidden();
  });

  test('si quitan un lugar que tengo en pantalla y lo toco, no queda un aviso eterno de «lugares nuevos»', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    const id = await ana.proponer(LUGAR);
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    await expect(tarjeta(page, id)).toHaveCount(1);

    await ana.api.post('/api/quitar-lugar', { data: { id } });
    await tarjeta(page, id).locator('[data-poner]').click();
    // el sello no se sostiene: ese lugar ya no existe
    await expect(tarjeta(page, id).locator('[data-poner]')).toHaveAttribute('aria-pressed', 'false');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'si');
    await expect(tarjeta(page, id)).toHaveCount(0);
    await page.waitForTimeout(7000); // una vuelta completa de la consulta de fondo
    await expect(page.locator('#novedad')).toBeHidden();
    expect((await estadoDe(page)).marcas).toEqual([]);
  });

  test('los sellos de otros en lugares llegan sin recargar', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    await ana.marcar('lugar', 'gion', 1);
    await expect(tarjeta(page, 'gion').locator('.sello-p')).toHaveCount(1, { timeout: 10_000 });
    await expect(page.locator('#novedad')).toBeHidden();
  });
});
