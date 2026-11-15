// sitemap.xml (spec 6.5): the main pages and every open listing, with absolute URLs.
// Closed listings keep their pages for shared links but are left out of the sitemap;
// /design and 404 are never listed.
import type { APIRoute } from 'astro';
import { getListings } from '../data/feed.ts';
import { lagosToday } from '../lib/dates.ts';
import { openOnly } from '../lib/filters.ts';
import { absolute } from '../lib/site.ts';

const STATIC_PAGES = ['/', '/trainings', '/about', '/stay-safe'];

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ site }) => {
  const { jobs, trainings } = await getListings();
  const today = lagosToday();
  const paths = [
    ...STATIC_PAGES,
    ...openOnly(jobs, today).map((j) => `/jobs/${j.slug}`),
    ...openOnly(trainings, today).map((t) => `/trainings/${t.slug}`),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((p) => `  <url><loc>${escape(absolute(site, p))}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
