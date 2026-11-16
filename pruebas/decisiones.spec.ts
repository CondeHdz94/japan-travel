// Decisiones en el navegador: privacidad, lo que va ganando, mi parte y los estados raros
// (temprano, empate, todas tachadas). Las cuentas en sí se prueban en decisiones.unidad.spec.ts.

import { abrir, desborde, entrarEn, expect, llenarRegistro, test, type Viajero } from './ayudas';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('intro', '1'));
});

/** Cada viajero vota igual en una ventana. */
const votar = (vs: Viajero[], ventana: string, valor: number) =>
  Promise.all(vs.map((v) => v.marcar('ventana', ventana, valor)));

test('sin sesión no se ve nada del grupo; al entrar, la página se arma con los votos', async ({ page, grupo }) => {
  const ana = await grupo.entrar('Ana');
  await ana.marcar('ventana', 'otono', 2);
  await ana.marcar('lugar', 'fushimi-inari', 1);

  await abrir(page, '/decisiones', 'no');
  await expect(page.locator('.sin-sesion')).toBeVisible();
  await expect(page.locator('.acta, .tu-parte, .tabla')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Ana');
  await expect(page.locator('main')).not.toContainText('Fushimi');
  // cómo se cuenta sí es público
  await expect(page.getByRole('heading', { name: 'Cómo se cuenta' })).toBeVisible();

  await page.locator('.sin-sesion [data-entrar]').click();
  await llenarRegistro(page, 'Beto');
  await expect(page.locator('.acta')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('main')).toContainText('Fushimi Inari');
});

test.describe('con el grupo votando', () => {
  test('la que va adelante, el aviso cuando falta mi voto y mi voto decide', async ({ page, grupo }) => {
    const [a, b, c] = await Promise.all(['Ana', 'Beto', 'Caro'].map((n) => grupo.entrar(n)));
    const dani = await entrarEn(page, 'Dani');
    await votar([a, b, c], 'otono', 2);
    await votar([a, b, c], 'primavera', 1);
    await a.marcar('ventana', 'cerezos', 2);
    await b.marcar('ventana', 'cerezos', 0);

    await abrir(page, '/decisiones', 'si');
    await expect(page.locator('[data-veredicto=primera] h3')).toHaveText('Otoño');
    await expect(page.locator('.veredicto .ojo')).toContainText('Falta tu voto. Si pones «No puedo», Otoño queda tachada y pasa adelante Primavera tardía.');

    // la tabla: primero las que todos pueden, la tachada al final y con quién no puede
    const filas = page.locator('.tabla .fila:not(.cabeza)');
    await expect(filas.first()).toHaveClass(/primera/);
    await expect(filas.first().locator('strong')).toHaveText('Otoño');
    await expect(filas.last()).toHaveClass(/tachada/);
    await expect(filas.last().locator('.veto')).toHaveText('No puede: Beto');

    // mi parte: lo primero es que mi voto decide, y lleva a votar
    const primero = page.locator('.tu-parte li').first();
    await expect(primero).toHaveAttribute('data-pendiente', 'decido');
    await expect(primero).toContainText('Tu voto decide');
    await expect(primero.locator('a')).toHaveAttribute('href', '/cuando-ir');
    // la ventana que decide no se repite en «te falta votar»
    await expect(page.locator('[data-pendiente=ventanas]')).not.toContainText('Otoño');
    expect(dani).toBeGreaterThan(0);
  });

  test('cuando ya voté en todo, mi parte lo dice', async ({ page, grupo }) => {
    const ana = await grupo.entrar('Ana');
    await entrarEn(page, 'Ana');
    for (const v of ['cerezos', 'abril', 'primavera', 'verano', 'otono', 'invierno']) await ana.marcar('ventana', v, 1);
    await ana.marcar('mes', 'oct', 1);
    await ana.marcar('lugar', 'shibuya', 1);
    // sin pasaporte igual me lo recuerda: es lo más urgente de los papeles
    await abrir(page, '/decisiones', 'si');
    await expect(page.locator('.tu-parte [data-pendiente=papel]')).toContainText('Te falta el pasaporte');
    await ana.marcar('papel', 'pasaporte', 1);
    await abrir(page, '/decisiones', 'si');
    await expect(page.locator('.tu-parte [data-pendiente=nada]')).toHaveText('Ya votaste en todo. Lo que falta es de los demás.');
  });

  test('es temprano: con menos de la mitad votando no se anuncia ganadora', async ({ page, grupo }) => {
    const [a] = await Promise.all(['Ana', 'Beto', 'Caro', 'Dani'].map((n) => grupo.entrar(n)));
    await a.marcar('ventana', 'otono', 2);
    await entrarEn(page, 'Ana');
    await abrir(page, '/decisiones', 'si');
    await expect(page.locator('[data-veredicto=temprano]')).toContainText('Votaron 1 de 4');
    await expect(page.locator('.tabla .fila.primera')).toHaveCount(0);
    await expect(page.locator('.acta strong').first()).toHaveText('—');
  });

  test('empate: se dicen las dos, sin escoger una', async ({ page, grupo }) => {
    const vs = await Promise.all(['Ana', 'Beto'].map((n) => grupo.entrar(n)));
    await votar(vs, 'otono', 1);
    await votar(vs, 'primavera', 1);
    await entrarEn(page, 'Ana');
    await abrir(page, '/decisiones', 'si');
    await expect(page.locator('[data-veredicto=empate] h3')).toHaveText('Primavera tardía y Otoño');
    await expect(page.locator('.acta strong').first()).toHaveText('Empate');
    await expect(page.locator('.tabla .fila.primera')).toHaveCount(2);
  });

  test('todas tachadas: no hay ninguna adelante', async ({ page, grupo }) => {
    const [a, b] = await Promise.all(['Ana', 'Beto'].map((n) => grupo.entrar(n)));
    await a.marcar('ventana', 'otono', 2);
    await b.marcar('ventana', 'otono', 0);
    await entrarEn(page, 'Ana');
    await abrir(page, '/decisiones', 'si');
    await expect(page.locator('[data-veredicto=ninguna]')).toContainText('Todas las ventanas con votos tienen un «No puedo»');
  });

  test('lugares: fijos, lo que se cae por la fecha y el enlace a la tarjeta en Lugares', async ({ page, grupo }) => {
    const vs = await Promise.all(['Ana', 'Beto', 'Caro'].map((n) => grupo.entrar(n)));
    await votar(vs, 'otono', 2);
    await Promise.all(vs.map((v) => v.marcar('lugar', 'fushimi-inari', 1)));
    await Promise.all(vs.slice(0, 2).map((v) => v.marcar('lugar', 'hanami', 1)));
    const id = await vs[2].proponer({ nombre: 'Café de prueba', tema: 'raro', zona: 'tokio' });
    await entrarEn(page, 'Ana');
    await abrir(page, '/decisiones', 'si');

    await expect(page.locator('.fijos li')).toHaveCount(2);
    await expect(page.locator('.fijos [data-lugar=hanami] .chip')).toHaveText('No da en otoño');
    await expect(page.locator('.ojo', { hasText: 'Si es otoño' })).toContainText('Hanami: cerezos en flor (2)');
    // lo propuesto por el grupo también cuenta: es el plan personal de Caro
    await expect(page.locator('.personales')).toContainText('Café de prueba');
    // el reparto de días es una posible opción, no un plan
    await expect(page.locator('.idea')).toContainText('Posible opción · no es fija');

    await page.locator('.fijos [data-lugar=fushimi-inari] .txt a').click();
    await expect(page).toHaveURL(/\/lugares#fushimi-inari$/);
    await expect(page.locator('#fushimi-inari')).toBeInViewport();
    expect(id).toMatch(/^u\d+$/);
  });

  test('con un grupo lleno no se desborda ni tiene errores', async ({ page, grupo, errores }) => {
    const nombres = ['Valentina', 'Santiago', 'Andrés', 'Laura', 'Maximiliano Fernando'];
    const vs = await Promise.all(nombres.map((n) => grupo.entrar(n)));
    for (const [i, v] of vs.entries()) {
      await v.marcar('ventana', 'invierno', 0);
      await v.marcar('ventana', 'otono', i % 2 ? 1 : 2);
      await v.marcar('mes', 'oct', 1);
      await v.marcar('lugar', 'shibuya', 1);
      if (i < 3) await v.marcar('papel', 'pasaporte', 1);
    }
    await entrarEn(page, 'Valentina');
    await abrir(page, '/decisiones', 'si');
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 1200) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 30));
      }
    });
    await page.waitForLoadState('networkidle');
    expect(await desborde(page), 'px que sobran a lo ancho').toBeLessThanOrEqual(0);
    await expect(page.locator('.papeles .fila.urgente .papel')).toHaveText('Pasaporte');
    expect(errores).toEqual([]);
  });
});
