// Llegadas al viaje: la bienvenida de quien se registra y, en el Inicio, los que entraron desde
// mi última visita. Varias personas a la vez: cada navegador (contexto) es un viajero distinto.

import type { BrowserContext, Page } from '@playwright/test';
import { confirmarQueSoyYo, estadoDe, expect, llenarRegistro, sinMomento, test, type Grupo, type Viajero } from './ayudas';

const capa = (page: Page) => page.locator('.llegada');
const pasajeros = (page: Page) => page.locator('[data-pasajeros] .sello-p');
const cuenta = (page: Page) => page.locator('[data-cuenta-pasajeros]');

/** Un navegador con la sesión de ese viajero. Sin intro, salvo que se pida. */
async function navegadorDe(ctx: BrowserContext, v: Viajero, { intro = false } = {}) {
  const valor = await v.cookie();
  await ctx.addCookies([{ name: 'viajero', value: valor, url: 'http://localhost:4399' }]);
  const page = await ctx.newPage();
  if (!intro) await page.addInitScript(() => sessionStorage.setItem('intro', '1'));
  return page;
}

async function abrirInicio(page: Page) {
  const estado = page.waitForResponse((r) => r.url().includes('/api/estado'));
  await page.goto('/');
  await estado;
}

test.describe('Inicio: los que entraron desde mi última visita', () => {
  test('Camilo ve a Laura y a Santiago con un solo anuncio, y después ya no', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    const laura = await grupo.entrar('Laura');
    const santiago = await grupo.entrar('Santiago');
    const yo = await navegadorDe(page.context(), camilo);
    await abrirInicio(yo);

    await expect(capa(yo)).toBeVisible();
    await expect(capa(yo).locator('.dice strong')).toHaveText('Laura y Santiago se montaron al viaje');
    await expect(capa(yo).locator('.dice span')).toHaveText('Desde tu última visita · van 3');
    await sinMomento(yo);
    await expect(pasajeros(yo)).toHaveCount(3);
    await expect(yo.locator('[data-pasajeros] .sello-p.esperando')).toHaveCount(0);
    await expect(cuenta(yo)).toHaveText('Van 3 de 4–5');
    await expect.poll(async () => (await camilo.estado()).visto).toBe(santiago.id);

    // otra visita: ya no se anuncia
    await abrirInicio(yo);
    await yo.waitForTimeout(2500);
    await expect(capa(yo)).toHaveCount(0);
    expect(laura.id).toBeLessThan(santiago.id);
  });

  test('al que llega no se le anuncian los que ya estaban', async ({ page, grupo }) => {
    await grupo.entrar('Camilo');
    const laura = await grupo.entrar('Laura');
    const suyo = await navegadorDe(page.context(), laura);
    await abrirInicio(suyo);
    await suyo.waitForTimeout(2500);
    await expect(capa(suyo)).toHaveCount(0);
    await expect(pasajeros(suyo)).toHaveCount(2);
  });

  test('en dos aparatos se ve una sola vez', async ({ browser, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    await grupo.entrar('Laura');
    const celular = await navegadorDe(await browser.newContext(), camilo);
    await abrirInicio(celular);
    await expect(capa(celular)).toBeVisible();
    await sinMomento(celular);
    await expect.poll(async () => (await camilo.estado()).visto).toBeGreaterThan(camilo.id);

    const portatil = await navegadorDe(await browser.newContext(), camilo);
    await abrirInicio(portatil);
    await portatil.waitForTimeout(2500);
    await expect(capa(portatil)).toHaveCount(0);
    await celular.context().close();
    await portatil.context().close();
  });

  test('si alguien entra mientras tengo el Inicio abierto, lo veo la próxima vez', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    const yo = await navegadorDe(page.context(), camilo);
    await abrirInicio(yo);
    await yo.waitForTimeout(1500);
    await grupo.entrar('Diana');
    await yo.waitForTimeout(2500);
    await expect(capa(yo)).toHaveCount(0); // el Inicio no consulta en vivo
    await abrirInicio(yo);
    await expect(capa(yo).locator('.dice strong')).toHaveText('Diana se montó al viaje');
  });

  test('de cuatro en adelante: «y 2 más», en un solo golpe', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    for (const n of ['Laura', 'Santiago', 'Valentina', 'Mafe']) await grupo.entrar(n);
    const yo = await navegadorDe(page.context(), camilo);
    await abrirInicio(yo);
    await expect(capa(yo).locator('.dice strong')).toHaveText('Laura, Santiago y 2 más se montaron al viaje');
    await expect(capa(yo).locator('.cae')).toHaveCount(4);
    await sinMomento(yo);
    await expect(cuenta(yo)).toHaveText('Van 5 de 4–5');
  });

  test('«Saltar» deja todo en su puesto al instante y lo da por visto', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    const laura = await grupo.entrar('Laura');
    const yo = await navegadorDe(page.context(), camilo);
    await abrirInicio(yo);
    await capa(yo).locator('.saltar').click();
    await expect(capa(yo)).toHaveCount(0);
    await expect(pasajeros(yo)).toHaveCount(2);
    await expect(yo.locator('[data-pasajeros] .sello-p.esperando')).toHaveCount(0);
    await expect.poll(async () => (await camilo.estado()).visto).toBe(laura.id);
  });

  test('Escape también lo salta', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    await grupo.entrar('Laura');
    const yo = await navegadorDe(page.context(), camilo);
    await abrirInicio(yo);
    await expect(capa(yo)).toBeVisible();
    await yo.keyboard.press('Escape');
    await expect(capa(yo)).toHaveCount(0);
  });

  test('el scroll no lo salta: la página se queda quieta hasta que termina', async ({ page, grupo, isMobile }) => {
    test.skip(isMobile, 'la rueda del mouse es de escritorio');
    const camilo = await grupo.entrar('Camilo');
    await grupo.entrar('Laura');
    const yo = await navegadorDe(page.context(), camilo);
    await abrirInicio(yo);
    await expect(capa(yo).locator('.dice')).toBeVisible();
    await yo.mouse.move(400, 400);
    await yo.mouse.wheel(0, 800);
    await yo.keyboard.press('PageDown');
    await yo.waitForTimeout(300);
    await expect(capa(yo)).toBeVisible();
    expect(await yo.evaluate(() => scrollY)).toBe(0);
    // la barra de scroll no se esconde: nada salta
    expect(await yo.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe('hidden');
    await sinMomento(yo);
  });

  test('si ya está haciendo otra cosa, no hay golpe: caen en el boleto cuando lo ve', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    const laura = await grupo.entrar('Laura');
    const yo = await navegadorDe(page.context(), camilo);
    await abrirInicio(yo);
    await yo.locator('.lead').click(); // un clic en la página antes de que arranque
    await yo.waitForTimeout(2500);
    await expect(capa(yo)).toHaveCount(0);
    await yo.locator('.pasajeros').scrollIntoViewIfNeeded();
    await expect(cuenta(yo)).toHaveText('Nuevos: Laura');
    await expect(pasajeros(yo)).toHaveCount(2);
    await expect(yo.locator('[data-pasajeros] .sello-p.esperando')).toHaveCount(0);
    await expect.poll(async () => (await camilo.estado()).visto).toBe(laura.id);
  });

  test('con movimiento reducido no hay golpe, y el anuncio queda en texto', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    await grupo.entrar('Laura');
    const yo = await navegadorDe(page.context(), camilo);
    await yo.emulateMedia({ reducedMotion: 'reduce' });
    await abrirInicio(yo);
    await yo.waitForTimeout(1500);
    await expect(capa(yo)).toHaveCount(0);
    await expect(yo.locator('#aviso-llegadas')).toHaveText('Laura se montó al viaje');
    await yo.locator('.pasajeros').scrollIntoViewIfNeeded();
    await expect(cuenta(yo)).toHaveText('Nuevos: Laura');
  });

  test('sin red no se anuncia nada ni se marca como visto', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    await grupo.entrar('Laura');
    const yo = await navegadorDe(page.context(), camilo);
    // una visita con red deja la copia local; la siguiente, sin red
    await yo.route('**/api/estado', (r) => r.abort());
    await yo.goto('/');
    await yo.waitForTimeout(2500);
    await expect(capa(yo)).toHaveCount(0);
    expect((await camilo.estado()).visto).toBe(camilo.id);
  });

  test('con intro: espera a que caiga 計画中, nunca encima', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    await grupo.entrar('Laura');
    const yo = await navegadorDe(page.context(), camilo, { intro: true });
    await yo.addInitScript(() => {
      const w = window as unknown as { tiempos: Record<string, number> };
      w.tiempos = {};
      new MutationObserver(() => {
        const t = performance.now();
        if (document.documentElement.dataset.intro === 'sale') w.tiempos.sale ??= t;
        if (document.querySelector('.llegada')) w.tiempos.llegada ??= t;
      }).observe(document, { attributes: true, childList: true, subtree: true });
    });
    await abrirInicio(yo);
    await expect(capa(yo)).toBeVisible({ timeout: 12_000 });
    const t = await yo.evaluate(() => (window as unknown as { tiempos: Record<string, number> }).tiempos);
    // 計画中 empieza a caer 0,95 s después de que sale la intro y tarda 0,5 s; luego, un respiro
    expect(t.llegada - t.sale).toBeGreaterThan(1450 + 500);
    await sinMomento(yo);
  });

  test('un poco de scroll antes de que arranque no lo cancela', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    await grupo.entrar('Laura');
    const yo = await navegadorDe(page.context(), camilo);
    await abrirInicio(yo);
    await yo.evaluate(() => scrollBy({ top: 150, behavior: 'instant' }));
    await expect(capa(yo)).toBeVisible();
    await sinMomento(yo);
  });

  test('si ya bajó del titular, no hay golpe: caen en el boleto cuando lo ve', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    await grupo.entrar('Laura');
    const yo = await navegadorDe(page.context(), camilo);
    await abrirInicio(yo);
    await yo.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await yo.waitForTimeout(2500);
    await expect(capa(yo)).toHaveCount(0);
    await yo.locator('.pasajeros').scrollIntoViewIfNeeded();
    await expect(cuenta(yo)).toHaveText('Nuevos: Laura');
  });

  test('si el servidor tarda más de 2 s, no hay golpe y no se pierde: caen en el boleto', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    const laura = await grupo.entrar('Laura');
    const yo = await navegadorDe(page.context(), camilo);
    await yo.route('**/api/estado', async (r) => {
      await new Promise((listo) => setTimeout(listo, 4500));
      await r.continue();
    });
    await abrirInicio(yo);
    await yo.waitForTimeout(800);
    await expect(capa(yo)).toHaveCount(0);
    await expect(yo.locator('#aviso-llegadas')).toHaveText('Laura se montó al viaje');
    await yo.locator('.pasajeros').scrollIntoViewIfNeeded();
    await expect(cuenta(yo)).toHaveText('Nuevos: Laura');
    await expect.poll(async () => (await camilo.estado()).visto).toBe(laura.id);
  });

  test('con la pestaña oculta espera a que la mire', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    await grupo.entrar('Laura');
    const yo = await navegadorDe(page.context(), camilo);
    await yo.addInitScript(() => {
      let oculta = true;
      Object.defineProperty(document, 'hidden', { get: () => oculta, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => (oculta ? 'hidden' : 'visible'), configurable: true });
      (window as unknown as { mirar: () => void }).mirar = () => {
        oculta = false;
        document.dispatchEvent(new Event('visibilitychange'));
      };
    });
    await abrirInicio(yo);
    await yo.waitForTimeout(3000);
    await expect(capa(yo)).toHaveCount(0);
    expect((await camilo.estado()).visto).toBe(camilo.id); // nada se dio por visto
    await yo.evaluate(() => (window as unknown as { mirar: () => void }).mirar());
    await expect(capa(yo)).toBeVisible();
    await sinMomento(yo);
  });

  test('deslizar el dedo durante el golpe no lo salta', async ({ page, grupo, isMobile }) => {
    test.skip(!isMobile, 'el gesto de deslizar es de celular');
    const camilo = await grupo.entrar('Camilo');
    await grupo.entrar('Laura');
    const yo = await navegadorDe(page.context(), camilo);
    await abrirInicio(yo);
    await expect(capa(yo).locator('.dice')).toBeVisible();
    const cdp = await yo.context().newCDPSession(yo);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 650 }] });
    for (let i = 1; i <= 6; i++)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 650 - i * 80 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await yo.waitForTimeout(200);
    await expect(capa(yo)).toBeVisible();
    expect(await yo.evaluate(() => scrollY)).toBe(0);
    await sinMomento(yo);
  });

  test('sin sesión no se anuncia nada ni se pregunta por «visto»', async ({ page, grupo }) => {
    await grupo.entrar('Camilo');
    await grupo.entrar('Laura');
    let vistos = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/visto')) vistos++;
    });
    await page.addInitScript(() => sessionStorage.setItem('intro', '1'));
    await page.goto('/');
    await page.waitForTimeout(2500);
    await expect(capa(page)).toHaveCount(0);
    await expect(page.locator('#aviso-llegadas')).toHaveCount(0);
    expect(vistos).toBe(0);
  });
});

test.describe('Inicio: entre varias personas', () => {
  /** Camilo ya vio a Laura. */
  async function grupoVisto(grupo: Grupo) {
    const camilo = await grupo.entrar('Camilo');
    const laura = await grupo.entrar('Laura');
    await camilo.api.post('/api/visto', { data: { hasta: laura.id } });
    return { camilo, laura };
  }

  test('cambiar de nombre o de forma no es una llegada', async ({ page, grupo }) => {
    const { camilo, laura } = await grupoVisto(grupo);
    expect((await laura.api.post('/api/renombrar', { data: { nombre: 'Lau', forma: 'ema' } })).status()).toBe(200);
    const yo = await navegadorDe(page.context(), camilo);
    await abrirInicio(yo);
    await yo.waitForTimeout(2500);
    await expect(capa(yo)).toHaveCount(0);
    await expect(yo.locator('[data-pasajeros] .sello-p.f-ema')).toHaveAttribute('title', /Lau/);
  });

  test('salirse del grupo y volver a entrar se anuncia otra vez, con el color que quedó libre', async ({ page, grupo }) => {
    const { camilo, laura } = await grupoVisto(grupo);
    await laura.api.post('/api/borrarme');
    const otraVez = await grupo.entrar('Laura');
    expect(otraVez.id).toBeGreaterThan(laura.id);
    const yo = await navegadorDe(page.context(), camilo);
    await abrirInicio(yo);
    await expect(capa(yo).locator('.dice strong')).toHaveText('Laura se montó al viaje');
    await sinMomento(yo);
    // Camilo conserva su color de siempre
    await expect(yo.locator(`[data-pasajeros] .sello-p[data-de="${camilo.id}"]`)).toHaveAttribute('data-tinta', '0');
  });

  test('perder la sesión (o que cambien la clave) y volver con el nombre: sin bienvenida ni avalancha', async ({ browser, grupo }) => {
    await grupoVisto(grupo);
    const ctx = await browser.newContext();
    const nuevo = await ctx.newPage();
    await nuevo.addInitScript(() => sessionStorage.setItem('intro', '1'));
    await nuevo.goto('/');
    await nuevo.locator('.pasajeros .subete').click();
    await llenarRegistro(nuevo, 'Camilo');
    await confirmarQueSoyYo(nuevo);
    await expect(nuevo.locator('html')).toHaveAttribute('data-sesion', 'si');
    await nuevo.waitForTimeout(800);
    await expect(capa(nuevo)).toHaveCount(0);
    // al volver al Inicio, Laura ya estaba vista: su «visto» sigue en la base
    await abrirInicio(nuevo);
    await nuevo.waitForTimeout(2500);
    await expect(capa(nuevo)).toHaveCount(0);
    await expect(pasajeros(nuevo)).toHaveCount(2);
    await ctx.close();
  });

  test('dos se registran al mismo tiempo con el mismo nombre: uno entra, al otro se le pregunta', async ({ browser }) => {
    const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
    const pages = await Promise.all([a.newPage(), b.newPage()]);
    for (const p of pages) {
      await p.goto('/cuando-ir');
      await p.locator('#quien [data-entrar]').click();
      await p.locator('#registro [name=nombre]').fill('Gemelo');
      await p.locator('#registro [name=clave]').fill('clave-de-pruebas');
    }
    await Promise.all(pages.map((p) => p.locator('#registro button[type=submit]').click()));
    await expect
      .poll(async () => {
        const r = await Promise.all(pages.map((p) => p.locator('#registro [data-confirma]').isVisible()));
        return r.sort().join();
      })
      .toBe('false,true');
    const entro = (await pages[0].locator('#registro [data-confirma]').isVisible()) ? pages[1] : pages[0];
    await expect(entro.locator('html')).toHaveAttribute('data-sesion', 'si');
    await expect(capa(entro).locator('.dice strong')).toHaveText('Ya vas a bordo, Gemelo');
    await a.close();
    await b.close();
  });
});

test.describe('Inicio: el boleto', () => {
  test('sin sesión: la cifra y la invitación, sin nombres', async ({ page, grupo }) => {
    await grupo.entrar('Camilo');
    await page.goto('/');
    await expect(page.locator('.pasajeros strong')).toHaveText('4–5');
    await expect(page.locator('.pasajeros .subete')).toBeVisible();
    await expect(page.locator('[data-pasajeros]')).toBeHidden();
    await expect(page.locator('.pasajeros')).not.toContainText('Camilo');
  });

  test('entrar o salir no mueve el boleto, y su texto queda alineado con las otras casillas', async ({ page, grupo }) => {
    const medir = () =>
      page.evaluate(() => {
        const celdas = [...document.querySelectorAll<HTMLElement>('.boleto > div')];
        // el texto de abajo de cada casilla: el de Pasajeros debe quedar a la misma altura
        const pies = celdas.map((c) => {
          const e = [...c.querySelectorAll<HTMLElement>('dd > span, .pie > *')].find((x) => x.offsetParent !== null)!;
          return Math.round(e.getBoundingClientRect().bottom);
        });
        return { alto: document.querySelector('.boleto')!.getBoundingClientRect().height, pies };
      });
    await page.addInitScript(() => sessionStorage.setItem('intro', '1'));
    await page.goto('/');
    const sin = await medir();
    const camilo = await grupo.entrar('Camilo');
    await page.context().addCookies([{ name: 'viajero', value: await camilo.cookie(), url: 'http://localhost:4399' }]);
    await abrirInicio(page);
    await expect(pasajeros(page)).toHaveCount(1);
    const con = await medir();
    expect(con.alto).toBe(sin.alto);
    // en la misma fila del boleto, los textos de abajo terminan a la misma altura (±1 px)
    const filas = new Map<number, number[]>();
    const tops = await page.locator('.boleto > div').evaluateAll((cs) => cs.map((c) => Math.round(c.getBoundingClientRect().top)));
    tops.forEach((t, i) => filas.set(t, [...(filas.get(t) ?? []), con.pies[i]]));
    for (const ps of filas.values()) expect(Math.max(...ps) - Math.min(...ps)).toBeLessThanOrEqual(1);
  });
});

test.describe('bienvenida: «Ya vas a bordo»', () => {
  test('desde un voto: el sello aterriza en ese voto y no sale de la página', async ({ page, grupo }) => {
    await grupo.entrar('Camilo');
    await page.goto('/cuando-ir');
    await page.locator('[data-marca="mes:oct"] [data-poner]').click();
    await llenarRegistro(page, 'Valentina');
    await expect(capa(page).locator('.dice strong')).toHaveText('Ya vas a bordo, Valentina');
    await expect(capa(page).locator('.dice span')).toHaveText('Asiento 2 · バレンティナ');
    await sinMomento(page);
    expect(new URL(page.url()).pathname).toBe('/cuando-ir');
    const voto = page.locator('[data-marca="mes:oct"] [data-sellos] .sello-p:not(.fantasma)');
    await expect(voto).toHaveCount(1);
    await expect(voto).not.toHaveClass(/esperando/);
    await expect(page.locator('#quien .sello-p')).not.toHaveClass(/esperando/);
    await expect(page.locator('[data-marca="mes:oct"] [data-poner]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('desde el boleto del Inicio: aterriza en Pasajeros', async ({ page, grupo }) => {
    await grupo.entrar('Camilo');
    await page.addInitScript(() => sessionStorage.setItem('intro', '1'));
    await page.goto('/');
    await page.locator('.pasajeros .subete').click();
    await llenarRegistro(page, 'Valentina');
    await expect(capa(page)).toBeVisible();
    await sinMomento(page);
    await expect(pasajeros(page)).toHaveCount(2);
    await expect(page.locator('[data-pasajeros] .sello-p.esperando')).toHaveCount(0);
    await expect(cuenta(page)).toHaveText('Van 2 de 4–5');
  });

  test('en Lugares la bienvenida termina antes de que la página se recargue', async ({ page }) => {
    await page.goto('/lugares');
    await page.locator('#quien [data-entrar]').click();
    await llenarRegistro(page, 'Valentina');
    await expect(capa(page)).toBeVisible();
    await sinMomento(page);
    await page.waitForLoadState();
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'si');
    await expect(page.locator('#quien .yo')).toContainText('Valentina');
  });

  test('si el voto no se pudo guardar, el sello aterriza en la cabecera', async ({ page }) => {
    await page.route('**/api/marca', (r) => r.abort());
    await page.goto('/cuando-ir');
    await page.locator('[data-marca="mes:oct"] [data-poner]').click();
    await llenarRegistro(page, 'Valentina');
    await expect(capa(page)).toBeVisible();
    await sinMomento(page);
    await expect(page.locator('#quien .sello-p')).toBeVisible();
    await expect(page.locator('#quien .sello-p')).not.toHaveClass(/esperando/);
    await expect(page.locator('[data-marca="mes:oct"] [data-sellos] .sello-p:not(.fantasma)')).toHaveCount(0);
  });

  test('con movimiento reducido: sin golpe, el sello aparece y el anuncio va en texto', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/cuando-ir');
    await page.locator('#quien [data-entrar]').click();
    await llenarRegistro(page, 'Valentina');
    await expect(page.locator('#quien .sello-p')).toBeVisible();
    await expect(capa(page)).toHaveCount(0);
    await expect(page.locator('#aviso-llegadas')).toHaveText(/Ya vas a bordo, Valentina/);
  });
});

test.describe('nombre repetido: «¿eres tú?»', () => {
  test('«sí, soy yo» entra como esa persona, sin bienvenida', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    await camilo.marcar('mes', 'oct', 1);
    await page.goto('/cuando-ir');
    await page.locator('#quien [data-entrar]').click();
    await llenarRegistro(page, 'camilo');
    await expect(page.locator('#registro [data-confirma]')).toContainText('Ya hay alguien llamado Camilo en el viaje. ¿Eres tú?');
    await expect(page.locator('#registro button[type=submit]')).toBeHidden();
    await confirmarQueSoyYo(page);
    await expect(page.locator('#registro')).toBeHidden();
    await expect(page.locator('#quien .yo')).toContainText('Camilo');
    await page.waitForTimeout(600);
    await expect(capa(page)).toHaveCount(0);
    expect((await estadoDe(page)).yo?.id).toBe(camilo.id);
  });

  test('«no, soy otra persona» pide otro nombre y no entra', async ({ page, grupo }) => {
    await grupo.entrar('Camilo');
    await page.goto('/cuando-ir');
    await page.locator('#quien [data-entrar]').click();
    await llenarRegistro(page, 'Camilo');
    await page.locator('#registro [data-soy-otro]').click();
    await expect(page.locator('#registro [data-confirma]')).toBeHidden();
    await expect(page.locator('#registro [role=alert]')).toHaveText(/Escoge otro nombre/);
    await expect(page.locator('#registro [name=nombre]')).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'no');

    // con otro nombre entra como alguien nuevo, con bienvenida
    await page.locator('#registro [name=nombre]').fill('Camilo R');
    await page.locator('#registro button[type=submit]').click();
    await expect(capa(page).locator('.dice strong')).toHaveText('Ya vas a bordo, Camilo R');
    await sinMomento(page);
  });

  test('cambiar el nombre después de la pregunta la quita', async ({ page, grupo }) => {
    await grupo.entrar('Camilo');
    await page.goto('/cuando-ir');
    await page.locator('#quien [data-entrar]').click();
    await llenarRegistro(page, 'Camilo');
    await expect(page.locator('#registro [data-confirma]')).toBeVisible();
    await page.locator('#registro [name=nombre]').fill('Camila');
    await expect(page.locator('#registro [data-confirma]')).toBeHidden();
    await expect(page.locator('#registro button[type=submit]')).toBeVisible();
  });

  test('Juan, Juan Camilo y Juan Pablo: tres sellos con J, JC y JP', async ({ page, grupo }) => {
    const juan = await grupo.entrar('Juan');
    for (const n of ['Juan Camilo', 'Juan Pablo']) await grupo.entrar(n);
    for (const n of ['Juan', 'Juan Camilo', 'Juan Pablo']) await (await grupo.entrar(n)).marcar('mes', 'oct', 1);
    const yo = await navegadorDe(page.context(), juan);
    await yo.goto('/cuando-ir');
    const sellos = yo.locator('[data-marca="mes:oct"] [data-sellos] .sello-p:not(.fantasma)');
    await expect(sellos).toHaveCount(3);
    expect(await sellos.evaluateAll((ss) => ss.map((s) => s.querySelector('i')!.textContent))).toEqual(['J', 'JC', 'JP']);
  });
});
