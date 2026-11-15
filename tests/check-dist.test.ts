// The built site must never contain private data, and every detail page must carry
// "Never pay to apply" (acceptance criteria 1 and 7). scripts/check-dist.ts scans dist/.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkDist } from '../scripts/check-dist.ts';

let dist: string;
beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'dist-check-'));
});
afterEach(() => rmSync(dist, { recursive: true, force: true }));

const page = (path: string, html: string) => {
  const full = join(dist, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, html);
};
const SAFE = '<p>Never pay to apply.</p>';

describe('checkDist: what must be refused', () => {
  it.each([
    ['the Found via header', 'Found via'],
    ['the foundVia field', '"foundVia":"x"'],
    ['the private Postgrad Scholarships tab', 'Postgrad Scholarships'],
  ])('refuses %s anywhere in the site', (_name, text) => {
    page('index.html', `<p>${text}</p>`);
    expect(checkDist(dist).map((f) => f.file)).toContain('index.html');
  });

  it('looks inside JS, JSON and XML files too', () => {
    page('_astro/app.js', 'const a = "foundVia";');
    page('sitemap.xml', '<url>Found via</url>');
    const files = checkDist(dist)
      .filter((f) => f.file !== '(dist)')
      .map((f) => f.file)
      .sort();
    expect(files).toEqual(['_astro/app.js', 'sitemap.xml']);
  });

  it('refuses a job or training detail page without "Never pay to apply"', () => {
    page('jobs/a.html', '<h1>A job</h1>');
    page('trainings/b.html', '<h1>A training</h1>');
    page('jobs/c.html', `<h1>C</h1>${SAFE}`);
    const files = checkDist(dist)
      .map((f) => f.file)
      .sort();
    expect(files).toEqual(['jobs/a.html', 'trainings/b.html']);
  });

  it('refuses a dist folder with no detail pages at all (a broken build)', () => {
    page('index.html', '<p>ok</p>');
    expect(checkDist(dist).some((f) => /no detail pages/i.test(f.reason))).toBe(true);
  });
});

describe('checkDist: happy path', () => {
  it('passes a clean site', () => {
    page('index.html', '<p>Graduate Radar</p>');
    page('jobs/a.html', `<h1>A</h1>${SAFE}`);
    expect(checkDist(dist)).toEqual([]);
  });
});
