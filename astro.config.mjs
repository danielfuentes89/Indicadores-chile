// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// En GitHub Pages el sitio vive bajo /<repo>/. El workflow define SITE_URL y BASE_PATH
// a partir de actions/configure-pages; en local se usa la raíz.
const site = process.env.SITE_URL || 'http://localhost:4321';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [preact()],
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es',
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
});
