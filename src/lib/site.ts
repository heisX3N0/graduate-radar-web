// The site's public address, for absolute URLs in canonical links, sharing tags,
// JSON-LD, the sitemap and robots.txt. Astro.site comes from astro.config.mjs
// (SITE_URL, or https://graduateradar.versionphi.com); this falls back to the same default
// when Astro.site is not set (for example when components render in tests).
export const DEFAULT_SITE = 'https://graduateradar.versionphi.com';

/**
 * The Graduate Radar Nigeria channel on WhatsApp (GR-013, owner decision 15 Nov 2026).
 * The www form: the bare whatsapp.com link redirects here, one round trip less on slow data.
 */
export const CHANNEL_URL = 'https://www.whatsapp.com/channel/0029VbDs41p11ulNTNQBxp1T';

/** An https www.whatsapp.com channel address with an ID and nothing after it. */
export function isWhatsAppChannel(url: string): boolean {
  return /^https:\/\/www\.whatsapp\.com\/channel\/[A-Za-z0-9]+$/.test(url);
}

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
