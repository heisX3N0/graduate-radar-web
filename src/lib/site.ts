// The site's public address, for absolute URLs in canonical links, sharing tags,
// JSON-LD, the sitemap and robots.txt. Astro.site comes from astro.config.mjs
// (SITE_URL, or https://graduate-radar.pages.dev); this falls back to the same default
// when Astro.site is not set (for example when components render in tests).
const DEFAULT_SITE = 'https://graduate-radar.pages.dev';

export function siteOrigin(site: URL | undefined): string {
  const fromEnv = typeof process !== 'undefined' ? process.env['SITE_URL'] : undefined;
  return (site?.toString() || fromEnv || DEFAULT_SITE).replace(/\/+$/, '');
}

export function absolute(site: URL | undefined, path: string): string {
  return `${siteOrigin(site)}${path.startsWith('/') ? path : `/${path}`}`;
}
