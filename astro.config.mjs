// @ts-check
import { defineConfig } from 'astro/config';

// The final *.pages.dev address is set when Cloudflare Pages is connected (GR-008).
export default defineConfig({
  // `||`, not `??`: a SITE_URL set but left blank must still fall back.
  site: process.env.SITE_URL || 'https://graduate-radar.pages.dev',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
});
