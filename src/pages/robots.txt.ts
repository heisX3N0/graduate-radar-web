// robots.txt (spec 6.5): everything may be crawled; /design and 404 carry their own
// noindex. Points to the sitemap at the site's own address.
import type { APIRoute } from 'astro';
import { absolute } from '../lib/site.ts';

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${absolute(site, '/sitemap.xml')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
