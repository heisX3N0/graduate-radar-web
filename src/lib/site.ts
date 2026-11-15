// The site's public address, for absolute URLs in canonical links, sharing tags,
// JSON-LD, the sitemap and robots.txt. Astro.site comes from astro.config.mjs
// (SITE_URL, or https://graduateradar.versionphi.com); this falls back to the same default
// when Astro.site is not set (for example when components render in tests).
export const DEFAULT_SITE = 'https://graduateradar.versionphi.com';

export function siteOrigin(site: URL | undefined): string {
  const fromEnv = typeof process !== 'undefined' ? process.env['SITE_URL'] : undefined;
  return (site?.toString() || fromEnv || DEFAULT_SITE).replace(/\/+$/, '');
}

/**
 * The page's own path for canonical and og:url: no ".html", and the home page is "/".
 * With build.format 'file' the home page's URL is "/index.html"; "/index" would 308 to
 * "/", and a canonical that redirects is a weak signal to search engines.
 */
export function canonicalPath(path: string): string {
  const clean = path.replace(/\.html$/, '');
  return clean === '/index' || clean === '' ? '/' : clean;
}

export function absolute(site: URL | undefined, path: string): string {
  return `${siteOrigin(site)}${path.startsWith('/') ? path : `/${path}`}`;
}
