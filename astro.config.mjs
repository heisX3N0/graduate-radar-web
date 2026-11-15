// @ts-check
import { defineConfig } from 'astro/config';
// The site's address lives in one place (GR-012): graduateradar.versionphi.com.
import { DEFAULT_SITE } from './src/lib/site.ts';

export default defineConfig({
  // `||`, not `??`: a SITE_URL set but left blank must still fall back.
  site: process.env.SITE_URL || DEFAULT_SITE,
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
});
