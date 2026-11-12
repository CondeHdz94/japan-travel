// @ts-check
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  // dirección pública: la usan los enlaces completos, como la imagen que sale al compartir el sitio
  site: 'https://nihon-trip.vercel.app',
  adapter: vercel()
});
