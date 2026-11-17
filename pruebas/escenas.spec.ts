// Escenas de anime en Lugares: el sello y la línea de la tarjeta, el filtro «聖 Anime» y la ventana.

import type { Page } from '@playwright/test';
import { ESCENAS } from '../src/data/escenas';
import { abrir, desborde, entrarEn, expect, plano, test } from './ayudas';

const CON_ANIME = Object.keys(ESCENAS);
const tarjeta = (page: Page, id: string) => page.locator(`article.lugar[data-marca="lugar:${id}"]`);
const ventana = (page: Page) => page.locator('dialog.escenas');
const visibles = (page: Page) => page.locator('article.lugar:visible');

/** Abre la ventana de un lugar desde su tarjeta y espera a que esté pintada. */
async function abrirVentana(page: Page, id: string) {
  await tarjeta(page, id).locator('[data-abrir-escenas]').click();
  await expect(ventana(page).locator('.es-obra').first()).toBeVisible();
}

test.describe('la tarjeta', () => {
  test('sello «聖地 N obras» y línea «Sale en:» solo en los lugares con escenas', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    await expect(page.locator('.sello-anime')).toHaveCount(CON_ANIME.length);
    await expect(page.locator('.linea-anime')).toHaveCount(CON_ANIME.length);

    const n = ESCENAS.shibuya.obras.length;
    const shibuya = tarjeta(page, 'shibuya');
    await expect(shibuya.locator('.sello-anime')).toHaveText(`聖地${n} obras`);
    const [a, b] = ESCENAS.shibuya.obras.map((o) => o.nombre);
    await expect(shibuya.locator('.linea-anime')).toContainText(`Sale en: ${a}, ${b} y ${n - 2} más.`);

    // una sola obra: «1 obra» y un solo nombre
    const una = CON_ANIME.find((id) => ESCENAS[id].obras.length === 1)!;
    await expect(tarjeta(page, una).locator('.sello-anime')).toHaveText('聖地1 obra');
    await expect(tarjeta(page, una).locator('.linea-anime em')).toHaveCount(1);

    // sin escenas: la tarjeta queda como siempre
    await expect(tarjeta(page, 'himeji').locator('.sello-anime, .linea-anime')).toHaveCount(0);
  });

  test('el sello solo avisa y la línea queda al fondo del texto, justo encima de «Quiero ir»', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    const medidas = await page.evaluate((ids) => {
      return ids.map((id) => {
        const c = document.querySelector(`article.lugar[data-marca="lugar:${id}"]`)!;
        const sello = c.querySelector('.sello-anime')!;
        const linea = c.querySelector('.linea-anime')!.getBoundingClientRect();
        const cuerpo = c.querySelector('.cuerpo')!.getBoundingClientRect();
        return {
          id,
          boton: sello.closest('button, a') !== null,
          tocable: getComputedStyle(sello).pointerEvents !== 'none',
          // la línea termina donde termina el texto (el relleno de abajo del cuerpo)
          alFondo: Math.abs(cuerpo.bottom - linea.bottom) < 8,
        };
      });
    }, CON_ANIME.slice(0, 6));
    for (const m of medidas) {
      expect(m.boton || m.tocable, `${m.id}: el sello no se toca`).toBe(false);
      expect(m.alFondo, `${m.id}: línea al fondo`).toBe(true);
    }
  });

  test('«Ver escenas» mide al menos 44 px para el dedo', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    const alto = await tarjeta(page, 'shibuya').locator('.ver-escenas').evaluate((b) => b.getBoundingClientRect().height);
    expect(alto).toBeGreaterThanOrEqual(44);
  });

  test('sellar una tarjeta con escenas no mueve nada', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    const PUNTOS = 'article.lugar, section.tema';
    const antes = await plano(page, PUNTOS);
    await tarjeta(page, 'shibuya').locator('[data-poner]').click();
    await expect(tarjeta(page, 'shibuya').locator('.sello-p')).toHaveCount(1);
    await page.waitForTimeout(700);
    expect(await plano(page, PUNTOS)).toEqual(antes);
  });
});

test.describe('el filtro «聖 Anime»', () => {
  test('un toque deja solo los lugares con escenas, queda en la dirección, y otro toque lo apaga', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    const pildora = page.locator('#f-anime');
    await expect(pildora.locator('small')).toHaveText(String(CON_ANIME.length));
    const todos = await visibles(page).count();

    await pildora.click();
    await expect(pildora).toHaveAttribute('aria-pressed', 'true');
    await expect(visibles(page)).toHaveCount(CON_ANIME.length);
    expect(new URL(page.url()).searchParams.get('anime')).toBe('1');
    // los temas sin ninguno se apagan; el total a la vista cuadra
    await expect(page.locator('[data-ir-tema="motor"]')).toHaveClass(/apagado/);
    if (await page.locator('#f-total').isVisible()) await expect(page.locator('#f-total')).toHaveText(String(CON_ANIME.length));

    await pildora.click();
    await expect(pildora).toHaveAttribute('aria-pressed', 'false');
    await expect(visibles(page)).toHaveCount(todos);
    expect(new URL(page.url()).searchParams.get('anime')).toBeNull();
  });

  test('el número de la píldora sigue a los demás filtros, y en 0 se apaga', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    const pildora = page.locator('#f-anime');
    await page.locator('#f-zona').selectOption('kansai');
    const enKansai = await page.locator('article.lugar[data-zona="kansai"][data-escenas]').count();
    await expect(pildora.locator('small')).toHaveText(String(enKansai));
    await expect(pildora).not.toHaveClass(/apagado/);
    // en el norte no hay ninguno: la píldora se apaga
    await page.locator('#f-zona').selectOption('norte');
    await expect(pildora.locator('small')).toHaveText('0');
    await expect(pildora).toHaveClass(/apagado/);
  });

  test('sobrevive a una recarga, se combina con la zona y sin resultados dice qué filtros los dejan vacíos', async ({ page }) => {
    await page.goto('/lugares?anime=1&zona=kansai');
    await expect(page.locator('#f-anime')).toHaveAttribute('aria-pressed', 'true');
    const zonas = await visibles(page).evaluateAll((cs) => cs.map((c) => [(c as HTMLElement).dataset.zona, !!(c as HTMLElement).dataset.escenas]));
    expect(zonas.length).toBeGreaterThan(0);
    for (const [zona, anime] of zonas) {
      expect(zona).toBe('kansai');
      expect(anime).toBe(true);
    }
    await page.locator('#f-zona').selectOption('norte');
    await expect(page.locator('#vacio')).toBeVisible();
    await expect(page.locator('#vacio')).toContainText('Ningún lugar que salga en anime en Norte.');
    // prendida y sin resultados, la píldora sigue tocable para quitarla
    await page.locator('#f-anime').click();
    await expect(page.locator('#f-anime')).toHaveAttribute('aria-pressed', 'false');
    // «Quitar filtros» también apaga la de anime
    await page.locator('#f-anime').click({ force: true }).catch(() => {});
    await page.goto('/lugares?anime=1&zona=norte');
    await page.locator('#limpiar').click();
    await expect(page.locator('#f-anime')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#f-zona')).toHaveValue('');
  });

  test('prenderlo desde abajo sube al comienzo de la lista', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight * 0.7));
    await page.locator('#f-anime').click();
    await expect(page.locator('#f-anime')).toHaveAttribute('aria-pressed', 'true');
    const m = await page.evaluate(() => {
      const barra = document.querySelector('.barra')!.getBoundingClientRect();
      const primera = [...document.querySelectorAll('section.tema')].find((t) => !(t as HTMLElement).hidden)!.getBoundingClientRect();
      return { debajoDeLaBarra: Math.round(primera.top - barra.bottom) };
    });
    // la primera sección con resultados queda justo bajo la barra fija
    expect(Math.abs(m.debajoDeLaBarra)).toBeLessThanOrEqual(2);
  });

  test('arriba de la lista, filtrar no mueve la página', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator('#f-anime').click();
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });

  test('la píldora se ve sin deslizar la fila de temas, mide lo que los otros filtros y se toca en 44 px', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    const m = await page.locator('#f-anime').evaluate((b) => {
      const r = b.getBoundingClientRect();
      const fila = b.parentElement!.getBoundingClientRect();
      const toque = getComputedStyle(b, '::after');
      return {
        alto: Math.round(r.height),
        toque: Math.round(r.height - parseFloat(toque.top) - parseFloat(toque.bottom)),
        filtro: Math.round(document.getElementById('f-zona')!.getBoundingClientRect().height),
        dentro: r.left >= fila.left && r.right <= fila.right,
      };
    });
    expect(m.alto).toBe(m.filtro);
    expect(m.toque).toBeGreaterThanOrEqual(44);
    expect(m.dentro).toBe(true);
  });
});

test.describe('la ventana', () => {
  test('abre desde la tarjeta, cambia la dirección, y Esc la cierra devolviendo el foco', async ({ page, errores }) => {
    await abrir(page, '/lugares', 'no');
    await abrirVentana(page, 'shibuya');
    expect(new URL(page.url()).hash).toBe('#escenas-shibuya');
    await expect(ventana(page).locator('.es-obra')).toHaveCount(ESCENAS.shibuya.obras.length);
    await expect(ventana(page).locator('.es-obra h3').first()).toContainText(ESCENAS.shibuya.obras[0].nombre);
    await page.keyboard.press('Escape');
    await expect(ventana(page)).not.toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    await expect(tarjeta(page, 'shibuya').locator('[data-abrir-escenas]')).toBeFocused();
    expect(errores.filter((e) => !/\/api\/escena\//.test(e))).toEqual([]);
  });

  test('«atrás» la cierra sin salir de la página, y un enlace con la dirección la abre de una', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    await abrirVentana(page, 'kamakura');
    await page.goBack();
    await expect(ventana(page)).not.toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/lugares');

    await page.goto('/lugares#escenas-shinjuku');
    await expect(ventana(page).locator('.es-obra').first()).toBeVisible();
    await expect(ventana(page)).toContainText(ESCENAS.shinjuku.obras[0].nombre);
  });

  test('con una sola obra no hay índice ni barra', async ({ page }) => {
    const una = CON_ANIME.find((id) => ESCENAS[id].obras.length === 1)!;
    await abrir(page, '/lugares', 'no');
    await abrirVentana(page, una);
    await expect(ventana(page).locator('.es-indice, .es-salto')).toHaveCount(0);
  });

  test('saltar a una obra con el índice la deja arriba y la marca', async ({ page, isMobile }) => {
    await abrir(page, '/lugares', 'no');
    await abrirVentana(page, 'shibuya');
    const v = ventana(page);
    const destino = 7;
    const nombre = ESCENAS.shibuya.obras[destino].nombre;
    if (isMobile) {
      await v.locator('.es-salto-b').click();
      await expect(v.locator('.es-emergente')).toBeVisible();
      await v.locator(`.es-emergente [data-oi="${destino}"]`).click();
      await expect(v.locator('[data-viendo]')).toHaveText(nombre);
    } else {
      await v.locator(`.es-recorrido > .es-indice [data-oi="${destino}"]`).click();
      await expect(v.locator(`.es-recorrido > .es-indice [data-oi="${destino}"]`)).toHaveAttribute('aria-current', 'true');
    }
    await page.waitForTimeout(900);
    const distancia = await v.evaluate((d, i) => {
      const ficha = d.querySelector('.es-ficha')!.getBoundingClientRect();
      const salto = d.querySelector('.es-salto')?.getBoundingClientRect();
      const sec = d.querySelectorAll('.es-obra')[i].getBoundingClientRect();
      return sec.top - (salto ? salto.bottom : ficha.top);
    }, destino);
    expect(distancia).toBeGreaterThanOrEqual(0);
    expect(distancia).toBeLessThan(60);
  });

  test('«Ver las N escenas» muestra todas las miniaturas de la obra', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    await abrirVentana(page, 'shibuya');
    const obra = ventana(page).locator('.es-obra').first();
    const n = ESCENAS.shibuya.obras[0].escenas.length;
    await expect(obra.locator('.es-fila button:visible')).toHaveCount(6);
    await obra.locator('.es-ver-todas').click();
    await expect(obra.locator('.es-fila button:visible')).toHaveCount(n);
  });

  test('sin sesión no se piden imágenes: un marco invita a entrar', async ({ page }) => {
    const pedidas: string[] = [];
    page.on('request', (r) => r.url().includes('/api/escena/') && pedidas.push(r.url()));
    await abrir(page, '/lugares', 'no');
    await abrirVentana(page, 'kamakura');
    await expect(ventana(page).locator('.es-grande .es-falta').first()).toContainText('Entra para verla');
    expect(pedidas).toEqual([]);
  });

  test('con sesión, una imagen que todavía no está deja un marco del mismo tamaño', async ({ page }) => {
    await entrarEn(page, 'Camilo');
    await abrir(page, '/lugares', 'si');
    await abrirVentana(page, 'kamakura');
    const marco = ventana(page).locator('.es-grande .es-falta').first();
    await expect(marco).toContainText('Imagen no disponible');
    const proporcion = await marco.evaluate((m) => m.getBoundingClientRect().width / m.getBoundingClientRect().height);
    expect(proporcion).toBeCloseTo(16 / 9, 1);
  });

  test('nada se desborda a lo ancho, con la ventana abierta', async ({ page }) => {
    await abrir(page, '/lugares', 'no');
    await abrirVentana(page, 'shibuya');
    expect(await desborde(page)).toBe(0);
    const v = await ventana(page).evaluate((d) => d.getBoundingClientRect().right <= innerWidth + 1);
    expect(v).toBe(true);
  });
});

test.describe('las imágenes', () => {
  test('sin sesión la ruta responde 401; con sesión, 404 si la imagen no está', async ({ page, grupo }) => {
    const anonimo = await grupo.anonimo();
    expect((await anonimo.get('/api/escena/1608-np5n8b8ys.webp')).status()).toBe(401);
    const v = await grupo.entrar('Camilo');
    expect((await v.api.get('/api/escena/1608-noexiste.webp')).status()).toBe(404);
    expect((await v.api.get('/api/escena/..%2F..%2Fsecreto.webp')).status()).toBe(400);
    void page;
  });
});
