import { defineConfig } from '@playwright/test';

// Las pruebas corren contra un servidor de desarrollo propio, en otro puerto, con su propia
// clave y su propia base (.data/pruebas.db). Así no tocan ni el .env ni .data/local.db.
const PUERTO = 4399;
const URL = `http://localhost:${PUERTO}`;

const navegador = /(paginas|grupo|lugares|llegadas|decisiones|escenas)\.spec\.ts/;

export default defineConfig({
  testDir: 'pruebas',
  globalSetup: './pruebas/preparar.ts',
  // una sola base compartida: las pruebas van de a una
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list']],
  use: {
    baseURL: URL,
    locale: 'es-CO',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `pnpm astro dev --port ${PUERTO} --ignore-lock`,
    url: URL,
    reuseExistingServer: true,
    timeout: 90_000,
    env: {
      TRIP_KEY: 'clave-de-pruebas',
      TURSO_DATABASE_URL: 'file:.data/pruebas.db',
      TURSO_AUTH_TOKEN: '',
    },
  },
  projects: [
    // sin navegador: funciones puras y la API
    { name: 'logica', testMatch: /(unidad|api)\.spec\.ts/ },
    // Edge ya viene con Windows: no hay que bajar navegadores
    {
      name: 'escritorio',
      testMatch: navegador,
      use: { channel: 'msedge', viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'celular',
      testMatch: navegador,
      use: {
        channel: 'msedge',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
