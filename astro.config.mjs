// @ts-check
import { defineConfig } from 'astro/config';

// The site's address: graduateradar.versionphi.com (GR-012, owner decision 15 Nov 2026).
// Keep in step with DEFAULT_SITE in src/lib/site.ts (a test checks they match).
export default defineConfig({
  // `||`, not `??`: a SITE_URL set but left blank must still fall back.
  site: process.env.SITE_URL || 'https://graduateradar.versionphi.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
});
