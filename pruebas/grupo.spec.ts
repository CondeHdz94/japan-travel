// El grupo en el navegador: entrar, sellar, ver a los demás en vivo, perfil, y que nada salte.

import type { Page } from '@playwright/test';
import { CLAVE, abrir, entrarEn, estadoDe, expect, llenarRegistro, plano, test } from './ayudas';

const mes = (page: Page, m: string) => page.locator(`[data-marca="mes:${m}"]`);
const sellosDe = (caja: ReturnType<typeof mes>) => caja.locator('[data-sellos] .sello-p:not(.fantasma)');

test.describe('sin sesión', () => {
  test('se ve la información, la invitación a entrar y ningún sello', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    await ana.marcar('mes', 'oct', 1);
    await ana.marcar('ventana', 'otono', 2);
    await ana.marcar('papel', 'visa', 1);

    for (const ruta of ['/cuando-ir', '/requisitos']) {
      await abrir(page, ruta, 'no');
      await expect(page.locator('#quien button')).toHaveText('Entrar');
      await expect(page.locator('.invita')).toBeVisible();
      await expect(page.locator('.sello-p')).toHaveCount(0);
      await expect(page.locator('[data-poner][aria-pressed=true]')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('Ana');
    }
  });

  test('«Entrar» de la cabecera y el de la invitación abren el registro', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    for (const boton of ['#quien [data-entrar]', '.invita [data-entrar]']) {
      await page.locator(boton).click();
      await expect(page.locator('#registro')).toBeVisible();
      await expect(page.locator('#registro [name=nombre]')).toBeFocused();
      await page.locator('#registro [data-cerrar]').click();
      await expect(page.locator('#registro')).toBeHidden();
    }
  });
});

test.describe('registro', () => {
  test('entrar por el formulario: cabecera con nombre y kana, y se guarda para la próxima visita', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    await page.locator('#quien [data-entrar]').click();
    await page.locator('#registro [name=nombre]').fill('Camilo');
    await expect(page.locator('#registro [data-kana]')).toHaveText('カミロ');
    await llenarRegistro(page, 'Camilo');

    await expect(page.locator('#registro')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'si');
    await expect(page.locator('#quien .yo')).toContainText('Camilo');
    await expect(page.locator('#quien .yo small')).toHaveText('カミロ');
    await expect(page.locator('#quien .sello-p b')).toHaveText('カ');
    await expect(page.locator('#quien .sello-p i')).toHaveText('C');
    await expect(page.locator('.invita')).toBeHidden();

    // al recargar, la sesión está desde antes de pintar (sin parpadeo de «Entrar»)
    await page.reload();
    expect(await page.locator('html').getAttribute('data-sesion')).toBe('si');
    await expect(page.locator('#quien .yo')).toContainText('Camilo');
  });

  test('clave mala: avisa, no cierra, y se puede corregir', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    await page.locator('#quien [data-entrar]').click();
    await llenarRegistro(page, 'Camilo', 'no-es-la-clave');
    await expect(page.locator('#registro [role=alert]')).toHaveText('Esa no es la clave del viaje.');
    await expect(page.locator('#registro')).toBeVisible();
    await expect(page.locator('#registro button[type=submit]')).toBeEnabled();
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'no');

    await page.locator('#registro [name=clave]').fill(CLAVE);
    await page.locator('#registro button[type=submit]').click();
    await expect(page.locator('#registro')).toBeHidden();
    await expect(page.locator('#quien .yo')).toContainText('Camilo');
  });

  test('el aviso de error no se queda pegado al volver a abrir', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    await page.locator('#quien [data-entrar]').click();
    await llenarRegistro(page, 'Camilo', 'mala');
    await expect(page.locator('#registro [role=alert]')).not.toBeEmpty();
    await page.locator('#registro [data-cerrar]').click();
    await page.locator('#quien [data-entrar]').click();
    await expect(page.locator('#registro [role=alert]')).toBeEmpty();
  });

  test('campos obligatorios: sin nombre o con una sola letra no se envía', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    let envios = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/entrar')) envios++;
    });
    await page.locator('#quien [data-entrar]').click();
    const d = page.locator('#registro');
    await d.locator('[name=clave]').fill(CLAVE);
    await d.locator('button[type=submit]').click();
    await d.locator('[name=nombre]').fill('A');
    await d.locator('button[type=submit]').click();
    await expect(d).toBeVisible();
    expect(envios).toBe(0);
    expect(await d.locator('[name=nombre]').getAttribute('maxlength')).toBe('20');
  });

  test('el ojo muestra y oculta la clave, y siempre arranca oculta', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    await page.locator('#quien [data-entrar]').click();
    const campo = page.locator('#registro [name=clave]');
    const ojo = page.locator('#registro [data-ver-clave]');
    await campo.fill('secreto');
    await expect(campo).toHaveAttribute('type', 'password');
    await ojo.click();
    await expect(campo).toHaveAttribute('type', 'text');
    await expect(ojo).toHaveAttribute('aria-pressed', 'true');
    await expect(ojo).toHaveAttribute('aria-label', 'Ocultar la clave');
    await expect(campo).toBeFocused();
    await expect(campo).toHaveValue('secreto');
    await ojo.click();
    await expect(campo).toHaveAttribute('type', 'password');

    await ojo.click();
    await page.locator('#registro [data-cerrar]').click();
    await page.locator('#quien [data-entrar]').click();
    await expect(campo).toHaveAttribute('type', 'password');
    await expect(ojo).toHaveAttribute('aria-pressed', 'false');
  });

  test('el katakana se va pintando mientras se escribe', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    await page.locator('#quien [data-entrar]').click();
    const campo = page.locator('#registro [name=nombre]');
    const kana = page.locator('#registro [data-kana]');
    await campo.fill('Juan Camilo');
    await expect(kana).toHaveText('フアン・カミロ');
    await campo.fill('');
    await expect(kana).toHaveText('');
  });

  test('tocar un voto sin sesión abre el registro y, al entrar, el voto queda puesto', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    await mes(page, 'oct').locator('[data-poner]').click();
    await llenarRegistro(page, 'Camilo');
    await expect(page.locator('#registro')).toBeHidden();
    await expect(mes(page, 'oct').locator('[data-poner]')).toHaveAttribute('aria-pressed', 'true');
    await expect(sellosDe(mes(page, 'oct'))).toHaveCount(1);
    await expect.poll(async () => (await estadoDe(page)).marcas.map((m) => `${m.t}:${m.c}:${m.v}`)).toEqual(['mes:oct:1']);
  });

  test('si ya había votado eso, entrar tocando el mismo voto no lo quita', async ({ page, grupo }) => {
    const camilo = await grupo.entrar('Camilo');
    await camilo.marcar('mes', 'oct', 1);
    await abrir(page, '/cuando-ir', 'no');
    await mes(page, 'oct').locator('[data-poner]').click();
    await llenarRegistro(page, 'Camilo');
    await expect(mes(page, 'oct').locator('[data-poner]')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(500);
    expect((await camilo.estado()).marcas).toHaveLength(1);
  });

  for (const [como, cerrar] of [
    ['con «Cerrar»', (page: Page) => page.locator('#registro [data-cerrar]').click()],
    ['con Escape', (page: Page) => page.keyboard.press('Escape')],
  ] as const) {
    test(`cerrar el registro ${como} olvida el voto que lo abrió`, async ({ page }) => {
      await abrir(page, '/cuando-ir', 'no');
      await mes(page, 'oct').locator('[data-poner]').click();
      await expect(page.locator('#registro')).toBeVisible();
      await cerrar(page);
      await expect(page.locator('#registro')).toBeHidden();

      // más tarde entra por la cabecera: no debe aparecer votando octubre
      await page.locator('#quien [data-entrar]').click();
      await llenarRegistro(page, 'Camilo');
      await expect(page.locator('html')).toHaveAttribute('data-sesion', 'si');
      await page.waitForTimeout(600);
      await expect(mes(page, 'oct').locator('[data-poner]')).toHaveAttribute('aria-pressed', 'false');
      expect((await estadoDe(page)).marcas).toEqual([]);
    });
  }

  test('un nombre con código se muestra como texto', async ({ page }) => {
    await abrir(page, '/cuando-ir', 'no');
    let dialogos = 0;
    page.on('dialog', (d) => {
      dialogos++;
      d.dismiss();
    });
    await page.locator('#quien [data-entrar]').click();
    await llenarRegistro(page, '<u id=x>hola</u>');
    await expect(page.locator('#quien .yo')).toContainText('<u id=x>hola</u>');
    await mes(page, 'oct').locator('[data-poner]').click();
    await expect(sellosDe(mes(page, 'oct'))).toHaveCount(1);
    await expect(page.locator('#quien u, [data-sellos] u, #x')).toHaveCount(0);
    expect(dialogos).toBe(0);
  });

  test('una sesión guardada que ya no sirve se limpia sola', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('sembrado')) {
        sessionStorage.setItem('sembrado', '1');
        localStorage.setItem(
          'grupo',
          JSON.stringify({ yo: { id: 99, nombre: 'Fantasma' }, personas: [{ id: 99, nombre: 'Fantasma' }], marcas: [{ p: 99, t: 'mes', c: 'oct', v: 1 }] }),
        );
      }
    });
    await abrir(page, '/cuando-ir', 'no');
    await expect(page.locator('#quien button')).toHaveText('Entrar');
    await expect(page.locator('.sello-p')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('grupo'))).toBeNull();
  });

  test('con el almacenamiento dañado la página igual funciona', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('grupo', '{esto no es json'));
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await expect(page.locator('#quien .yo')).toContainText('Camilo');
    expect(errores).toEqual([]);
  });
});

test.describe('sellar', () => {
  test('mes: un toque pone mi sello, otro lo quita, y queda guardado', async ({ page }) => {
    const id = await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    const oct = mes(page, 'oct');

    await oct.locator('[data-poner]').click();
    await expect(oct.locator('[data-poner]')).toHaveAttribute('aria-pressed', 'true');
    await expect(sellosDe(oct)).toHaveCount(1);
    await expect(sellosDe(oct)).toHaveAttribute('title', 'Camilo · カミロ');
    await expect.poll(async () => (await estadoDe(page)).marcas).toEqual([{ p: id, t: 'mes', c: 'oct', v: 1 }]);

    await page.reload();
    await expect(mes(page, 'oct').locator('[data-poner]')).toHaveAttribute('aria-pressed', 'true');
    await expect(sellosDe(mes(page, 'oct'))).toHaveCount(1);

    await mes(page, 'oct').locator('[data-poner]').click();
    await expect(mes(page, 'oct').locator('[data-poner]')).toHaveAttribute('aria-pressed', 'false');
    await expect(sellosDe(mes(page, 'oct'))).toHaveCount(0);
    await expect.poll(async () => (await estadoDe(page)).marcas).toEqual([]);
  });

  test('los doce meses se pueden marcar, cada uno por separado', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    const botones = page.locator('.meses [data-poner]');
    for (let i = 0; i < 12; i++) await botones.nth(i).click();
    await expect(page.locator('.meses [data-poner][aria-pressed=true]')).toHaveCount(12);
    await expect(page.locator('.meses .sello-p')).toHaveCount(12);
    await expect.poll(async () => (await estadoDe(page)).marcas.length).toBe(12);
  });

  test('toques rapidísimos sobre el mismo botón terminan en el estado que se ve', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    const b = mes(page, 'oct').locator('[data-poner]');
    for (let i = 0; i < 5; i++) await b.click({ delay: 0 });
    await expect(b).toHaveAttribute('aria-pressed', 'true');
    await page.waitForLoadState('networkidle');
    await expect.poll(async () => (await estadoDe(page)).marcas.length).toBe(1);
    // y la consulta de fondo no lo devuelve
    await page.waitForTimeout(7000);
    await expect(b).toHaveAttribute('aria-pressed', 'true');
  });

  test('ventana: una sola opción a la vez, el sello se pasa de renglón', async ({ page }) => {
    const id = await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    const v = page.locator('[data-marca="ventana:otono"]');
    const fila = (valor: number) => v.locator(`li:has([data-poner="${valor}"])`);

    await fila(2).locator('[data-poner]').click();
    await expect(fila(2).locator('.sello-p')).toHaveCount(1);
    await expect(v.locator('[data-poner][aria-pressed=true]')).toHaveCount(1);

    await fila(0).locator('[data-poner]').click();
    await expect(fila(0).locator('.sello-p')).toHaveCount(1);
    await expect(fila(2).locator('.sello-p')).toHaveCount(0);
    await expect(v.locator('[data-poner][aria-pressed=true]')).toHaveCount(1);
    await expect(fila(0).locator('[data-poner]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await estadoDe(page)).marcas).toEqual([{ p: id, t: 'ventana', c: 'otono', v: 0 }]);

    // tocar la misma la quita
    await fila(0).locator('[data-poner]').click();
    await expect(v.locator('.sello-p')).toHaveCount(0);
    await expect(v.locator('[data-poner][aria-pressed=true]')).toHaveCount(0);
    await expect.poll(async () => (await estadoDe(page)).marcas).toEqual([]);

    // las otras ventanas no se tocaron
    await expect(page.locator('.ventanas [data-poner][aria-pressed=true]')).toHaveCount(0);
  });

  test('papeles: sello lleno si lo tengo, punteado si falta, uno por viajero', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    await ana.marcar('papel', 'pasaporte', 1);
    await entrarEn(page, 'Camilo');
    await abrir(page, '/requisitos', 'si');

    const pasaporte = page.locator('[data-marca="papel:pasaporte"]');
    const visa = page.locator('[data-marca="papel:visa"]');
    await expect(pasaporte.locator('.sello-p')).toHaveCount(2);
    await expect(pasaporte.locator('.sello-p.fantasma')).toHaveCount(1);
    await expect(pasaporte.locator('.sello-p.fantasma')).toHaveAttribute('title', /Camilo.*pendiente/);
    await expect(visa.locator('.sello-p.fantasma')).toHaveCount(2);

    await pasaporte.locator('[data-poner]').click();
    await expect(pasaporte.locator('.sello-p.fantasma')).toHaveCount(0);
    await expect(pasaporte.locator('.sello-p')).toHaveCount(2);
    await expect(pasaporte.locator('[data-poner]')).toHaveAttribute('aria-pressed', 'true');

    await pasaporte.locator('[data-poner]').click();
    await expect(pasaporte.locator('.sello-p.fantasma')).toHaveCount(1);
    await expect(pasaporte.locator('.sello-p')).toHaveCount(2);
  });

  test('si el servidor rechaza la marca, el sello se devuelve', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await page.route('**/api/marca', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' }));
    const oct = mes(page, 'oct');
    await oct.locator('[data-poner]').click();
    await expect(oct.locator('[data-poner]')).toHaveAttribute('aria-pressed', 'false');
    await expect(sellosDe(oct)).toHaveCount(0);
  });

  test('sin red al marcar: no se rompe la página y el sello no queda mintiendo', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.route('**/api/marca', (r) => r.abort());
    const oct = mes(page, 'oct');
    await oct.locator('[data-poner]').click();
    await expect(oct.locator('[data-poner]')).toHaveAttribute('aria-pressed', 'false');
    expect(errores).toEqual([]);
    // sigo con sesión: un tropiezo de red no me saca
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'si');
  });
});

test.describe('sin conexión', () => {
  test('si se cae la red al marcar, el sello se devuelve pero la sesión sigue', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await mes(page, 'nov').locator('[data-poner]').click();
    await expect.poll(async () => (await estadoDe(page)).marcas.length).toBe(1);

    await page.route('**/api/**', (r) => r.abort());
    const oct = mes(page, 'oct');
    await oct.locator('[data-poner]').click();
    await expect(oct.locator('[data-poner]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'si');
    await expect(page.locator('#quien .yo')).toContainText('Camilo');
    // lo que ya estaba guardado se sigue viendo
    await expect(sellosDe(mes(page, 'nov'))).toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem('grupo'))).not.toBeNull();

    // vuelve la red: se puede marcar normal
    await page.unroute('**/api/**');
    await oct.locator('[data-poner]').click();
    await expect(oct.locator('[data-poner]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await estadoDe(page)).marcas.length).toBe(2);
  });

  test('abrir la página sin red muestra lo último que se sabía, no un «Entrar»', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await mes(page, 'nov').locator('[data-poner]').click();
    await expect.poll(async () => (await estadoDe(page)).marcas.length).toBe(1);

    await page.route('**/api/estado', (r) => r.abort());
    await page.reload();
    await expect(page.locator('#quien .yo')).toContainText('Camilo');
    await page.waitForTimeout(500);
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'si');
    await expect(sellosDe(mes(page, 'nov'))).toHaveCount(1);
  });

  test('si el servidor responde con error, tampoco se cierra la sesión', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await page.route('**/api/estado', (r) => r.fulfill({ status: 500, body: 'se cayó' }));
    await page.reload();
    await page.waitForTimeout(500);
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'si');
    await expect(page.locator('#quien .yo')).toContainText('Camilo');
  });
});

test.describe('sellos del grupo', () => {
  test('se ven los de todos, cada uno con su color y su inicial', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    const andres = await grupo.entrar('Andrés');
    const beto = await grupo.entrar('Beto');
    for (const v of [ana, andres, beto]) await v.marcar('mes', 'oct', 1);
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');

    const sellos = sellosDe(mes(page, 'oct'));
    await expect(sellos).toHaveCount(3);
    expect(await sellos.evaluateAll((ss) => ss.map((s) => s.getAttribute('title')))).toEqual([
      'Ana · アナ',
      'Andrés · アンドレス',
      'Beto · ベト',
    ]);
    // Ana y Andrés comparten inicial: se alarga hasta distinguirlos
    expect(await sellos.evaluateAll((ss) => ss.map((s) => s.querySelector('i')!.textContent))).toEqual(['Ana', 'And', 'B']);
    expect(await sellos.evaluateAll((ss) => ss.map((s) => (s as HTMLElement).dataset.tinta))).toEqual(['0', '1', '2']);
    const colores = await sellos.evaluateAll((ss) => ss.map((s) => getComputedStyle(s).color));
    expect(new Set(colores).size).toBe(3);
    await expect(mes(page, 'oct').locator('[data-poner]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('un nombre sin letras latinas igual tiene sello', async ({ page }) => {
    await entrarEn(page, '李小龍');
    await abrir(page, '/cuando-ir', 'si');
    await mes(page, 'oct').locator('[data-poner]').click();
    const s = sellosDe(mes(page, 'oct'));
    await expect(s).toHaveCount(1);
    await expect(s.locator('i')).toHaveText('李');
    const caja = (await s.boundingBox())!;
    expect(caja.width).toBeGreaterThan(10);
    expect(caja.height).toBeGreaterThan(10);
  });

  test('en vivo: lo que marca otro aparece solo, sin recargar', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await expect(sellosDe(mes(page, 'nov'))).toHaveCount(0);

    await ana.marcar('mes', 'nov', 1);
    await expect(sellosDe(mes(page, 'nov'))).toHaveCount(1, { timeout: 10_000 });
    await expect(sellosDe(mes(page, 'nov'))).toHaveAttribute('title', /Ana/);

    await ana.marcar('mes', 'nov', null);
    await expect(sellosDe(mes(page, 'nov'))).toHaveCount(0, { timeout: 10_000 });
  });

  test('en vivo: llega alguien nuevo al grupo y cambia de nombre', async ({ page, grupo }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/requisitos', 'si');
    const visa = page.locator('[data-marca="papel:visa"]');
    await expect(visa.locator('.sello-p')).toHaveCount(1);

    const ana = await grupo.entrar('Ana');
    await expect(visa.locator('.sello-p')).toHaveCount(2, { timeout: 10_000 });
    await ana.api.post('/api/renombrar', { data: { nombre: 'Beatriz' } });
    await expect(visa.locator('.sello-p[title^="Beatriz"]')).toHaveCount(1, { timeout: 10_000 });
    await expect(visa.locator('.sello-p')).toHaveCount(2);
  });

  test('si me borran desde otro dispositivo, esta página queda sin sesión', async ({ page, grupo }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await mes(page, 'oct').locator('[data-poner]').click();
    const otro = await grupo.entrar('Camilo');
    await otro.api.post('/api/borrarme');
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'no', { timeout: 10_000 });
    await expect(page.locator('#quien button')).toHaveText('Entrar');
    await expect(page.locator('.sello-p')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('grupo'))).toBeNull();
  });

  test('la consulta de fondo descansa a los 5 minutos sin tocar la página y vuelve al primer toque', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await page.clock.install();
    let consultas = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/estado')) consultas++;
    });
    await abrir(page, '/cuando-ir', 'si');
    await page.mouse.move(50, 50);

    const antes = consultas;
    await page.clock.runFor(31_000);
    await expect.poll(() => consultas - antes).toBeGreaterThanOrEqual(4);

    await page.clock.runFor(5 * 60_000);
    await page.waitForTimeout(300);
    const dormida = consultas;
    await page.clock.runFor(60_000);
    await page.waitForTimeout(300);
    expect(consultas, 'siguió consultando dormida').toBe(dormida);

    await page.mouse.move(120, 120);
    await expect.poll(() => consultas).toBeGreaterThan(dormida);
  });
});

test.describe('perfil', () => {
  test('cambiar el nombre conserva las marcas y actualiza cabecera y sellos', async ({ page }) => {
    const id = await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await mes(page, 'oct').locator('[data-poner]').click();
    await expect(sellosDe(mes(page, 'oct'))).toHaveCount(1);

    await page.locator('#quien [data-perfil]').click();
    const d = page.locator('#perfil');
    await expect(d).toBeVisible();
    await expect(d.locator('[name=nombre]')).toHaveValue('Camilo');
    await expect(d.locator('[data-kana]')).toHaveText('カミロ');
    await d.locator('[name=nombre]').fill('Juancho');
    await expect(d.locator('[data-kana]')).toHaveText('フアンチョ');
    await d.locator('button[type=submit]').click();

    await expect(d).toBeHidden();
    await expect(page.locator('#quien .yo')).toContainText('Juancho');
    await expect(sellosDe(mes(page, 'oct'))).toHaveCount(1);
    await expect(sellosDe(mes(page, 'oct'))).toHaveAttribute('title', /Juancho/);
    const e = await estadoDe(page);
    expect(e.yo).toEqual({ id, nombre: 'Juancho', forma: 'koban' });
    expect(e.marcas).toHaveLength(1);
  });

  test('escoger otra forma de sello la cambia en la cabecera y en los sellos, sin mover nada', async ({ page }) => {
    const id = await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await mes(page, 'oct').locator('[data-poner]').click();
    await expect(page.locator('#quien .sello-p')).toHaveClass(/f-koban/);
    const antes = await plano(page, 'main h1, main h2, .meses li, footer');

    await page.locator('#quien [data-perfil]').click();
    const d = page.locator('#perfil');
    const opciones = d.locator('[data-formas] input[name=forma]');
    await expect(opciones).toHaveCount(12);
    await expect(d.locator('[data-formas] input:checked')).toHaveValue('koban');
    // cada opción muestra mi propio sello con esa forma
    await expect(d.locator('[data-formas] .sello-p.f-ema b')).toHaveText('カ');
    await d.locator('[data-formas] input[value=ema]').check({ force: true });
    await d.locator('button[type=submit]').click();
    await expect(d).toBeHidden();

    await expect(page.locator('#quien .sello-p')).toHaveClass(/f-ema/);
    await expect(sellosDe(mes(page, 'oct'))).toHaveClass(/f-ema/);
    await expect(page.locator('#perfil .sello-p')).toHaveCount(0); // las muestras del perfil no se quedan
    expect((await estadoDe(page)).yo).toEqual({ id, nombre: 'Camilo', forma: 'ema' });
    expect(await plano(page, 'main h1, main h2, .meses li, footer')).toEqual(antes);

    // al volver a abrir, la escogida es la nueva
    await page.locator('#quien [data-perfil]').click();
    await expect(d.locator('[data-formas] input:checked')).toHaveValue('ema');
  });

  test('cerrar el perfil sin guardar no cambia la forma', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await page.locator('#quien [data-perfil]').click();
    const d = page.locator('#perfil');
    await d.locator('[data-formas] input[value=kikko]').check({ force: true });
    await d.locator('[data-cerrar]').click();
    await expect(page.locator('#quien .sello-p')).toHaveClass(/f-koban/);
    expect((await estadoDe(page)).yo?.forma).toBe('koban');
  });

  test('no deja tomar el nombre de otro: avisa y no cambia', async ({ page, grupo }) => {
    await grupo.entrar('Ana');
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await page.locator('#quien [data-perfil]').click();
    const d = page.locator('#perfil');
    await d.locator('[name=nombre]').fill('ana');
    await d.locator('button[type=submit]').click();
    await expect(d.locator('[role=alert]')).toHaveText('Ya hay alguien con ese nombre en el grupo.');
    await expect(d).toBeVisible();
    await d.locator('[data-cerrar]').click();
    await expect(page.locator('#quien .yo')).toContainText('Camilo');
    // el aviso no queda pegado
    await page.locator('#quien [data-perfil]').click();
    await expect(d.locator('[role=alert]')).toBeEmpty();
    await expect(d.locator('[name=nombre]')).toHaveValue('Camilo');
  });

  test('salir: vuelve «Entrar», se van los sellos, y el viajero sigue existiendo', async ({ page, grupo }) => {
    const id = await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await mes(page, 'oct').locator('[data-poner]').click();
    await expect(sellosDe(mes(page, 'oct'))).toHaveCount(1);

    await page.locator('#quien [data-perfil]').click();
    await page.locator('#perfil [data-salir]').click();
    await expect(page.locator('#perfil')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'no');
    await expect(page.locator('#quien button')).toHaveText('Entrar');
    await expect(page.locator('.sello-p')).toHaveCount(0);
    await expect(page.locator('.invita')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('grupo'))).toBeNull();
    expect((await estadoDe(page)).yo).toBeNull();

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'no');

    const otraVez = await grupo.entrar('Camilo');
    expect(otraVez.id).toBe(id);
    expect((await otraVez.estado()).marcas).toHaveLength(1);
  });

  test('borrarme pide dos toques; el primero solo avisa y se desarma al cerrar', async ({ page, grupo }) => {
    const testigo = await grupo.entrar('Testigo');
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await mes(page, 'oct').locator('[data-poner]').click();

    await page.locator('#quien [data-perfil]').click();
    const borrar = page.locator('#perfil [data-borrarme]');
    await expect(borrar).toHaveText('Borrarme del grupo');
    await borrar.click();
    await expect(borrar).toHaveText('¿Seguro? Se borran tus marcas');
    expect((await testigo.estado()).personas).toHaveLength(2);

    // me arrepiento: cierro y vuelvo a abrir
    await page.locator('#perfil [data-cerrar]').click();
    await page.locator('#quien [data-perfil]').click();
    await expect(borrar).toHaveText('Borrarme del grupo');
    expect((await testigo.estado()).personas).toHaveLength(2);

    await borrar.click();
    await borrar.click();
    await expect(page.locator('html')).toHaveAttribute('data-sesion', 'no');
    await expect(page.locator('#perfil')).toBeHidden();
    await expect(page.locator('#quien button')).toHaveText('Entrar');
    const e = await testigo.estado();
    expect(e.personas.map((p) => p.nombre)).toEqual(['Testigo']);
    expect(e.marcas).toEqual([]);
  });

  test('después de salir se puede entrar como otra persona en la misma página', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    await mes(page, 'oct').locator('[data-poner]').click();
    await page.locator('#quien [data-perfil]').click();
    await page.locator('#perfil [data-salir]').click();
    await expect(page.locator('#quien button')).toHaveText('Entrar');

    await page.locator('#quien [data-entrar]').click();
    await expect(page.locator('#registro [name=nombre]')).toHaveValue('');
    await expect(page.locator('#registro [name=clave]')).toHaveValue('');
    await llenarRegistro(page, 'Diana');
    await expect(page.locator('#quien .yo')).toContainText('Diana');
    // ve el sello de Camilo, pero su botón no está marcado
    await expect(sellosDe(mes(page, 'oct'))).toHaveCount(1);
    await expect(mes(page, 'oct').locator('[data-poner]')).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('nada salta', () => {
  const PUNTOS = 'main section, main article, main li, footer';

  test('Cuándo ir: sellar meses y ventanas no mueve nada', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    const antes = await plano(page, PUNTOS);
    for (const m of ['ene', 'jun', 'dic']) await mes(page, m).locator('[data-poner]').click();
    for (const v of ['cerezos', 'otono']) await page.locator(`[data-marca="ventana:${v}"] [data-poner="2"]`).click();
    await page.locator('[data-marca="ventana:invierno"] [data-poner="0"]').click();
    await expect(page.locator('main .sello-p')).toHaveCount(6);
    await page.waitForTimeout(700); // que termine la animación del sello
    expect(await plano(page, PUNTOS)).toEqual(antes);
  });

  test('Requisitos: marcar papeles no mueve nada', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/requisitos', 'si');
    const antes = await plano(page, PUNTOS);
    for (const p of ['pasaporte', 'seguro', 'plata']) await page.locator(`[data-marca="papel:${p}"] [data-poner]`).click();
    await expect(page.locator('main .sello-p:not(.fantasma)')).toHaveCount(3);
    await page.waitForTimeout(700);
    expect(await plano(page, PUNTOS)).toEqual(antes);
  });

  test('con cinco viajeros sellando todo, las páginas miden lo mismo que vacías', async ({ page, grupo }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/cuando-ir', 'si');
    const cuando = await plano(page, PUNTOS);
    await abrir(page, '/requisitos', 'si');
    const requisitos = await plano(page, PUNTOS);

    const nombres = ['Camilo', 'Maximiliano', 'Wendy', 'Ñato', 'Guillermo'];
    for (const n of nombres) {
      const v = await grupo.entrar(n);
      for (const m of ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']) await v.marcar('mes', m, 1);
      for (const w of ['cerezos', 'abril', 'primavera', 'verano', 'otono', 'invierno']) await v.marcar('ventana', w, 2);
      for (const p of ['pasaporte', 'visa', 'tiquetes', 'hospedajes', 'seguro', 'vjw', 'plata']) await v.marcar('papel', p, 1);
    }

    await abrir(page, '/cuando-ir', 'si');
    await expect(sellosDe(mes(page, 'oct'))).toHaveCount(5);
    expect(await plano(page, PUNTOS)).toEqual(cuando);
    // los cinco sellos caben en su columna sin salirse
    const fuera = await page.locator('.meses li').evaluateAll((lis) =>
      lis.filter((li) => {
        const c = li.getBoundingClientRect();
        return [...li.querySelectorAll('.sello-p')].some((s) => {
          const r = s.getBoundingClientRect();
          return r.left < c.left - 1 || r.right > c.right + 1;
        });
      }).length,
    );
    expect(fuera, 'meses con sellos por fuera de su columna').toBe(0);

    await abrir(page, '/requisitos', 'si');
    await expect(page.locator('[data-marca="papel:visa"] .sello-p')).toHaveCount(5);
    expect(await plano(page, PUNTOS)).toEqual(requisitos);
  });
});
