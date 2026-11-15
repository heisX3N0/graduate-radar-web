// The built site must never contain private data, and every detail page must carry
// "Never pay to apply" (acceptance criteria 1 and 7). scripts/check-dist.ts scans dist/.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkDist } from '../scripts/check-dist.ts';
import { CHANNEL_URL } from '../src/lib/site.ts';

let dist: string;
beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'dist-check-'));
});
afterEach(() => rmSync(dist, { recursive: true, force: true }));

const LINK = `<a href="${CHANNEL_URL}">Follow Graduate Radar on WhatsApp</a>`;
// The real site footer (Footer.astro renders <footer class="footer" data-astro-cid-...>).
const SITE_FOOTER = `<footer class="footer" data-astro-cid-x>${LINK}</footer>`;
/** Writes a file exactly as given. */
const bare = (path: string, text: string) => {
  const full = join(dist, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, text);
};
/** Writes a file; HTML pages get the site footer, as every built page has. */
const page = (path: string, text: string) =>
  bare(path, path.endsWith('.html') ? `${text}${SITE_FOOTER}` : text);
const SAFE = '<p>Never pay to apply.</p>';
const ABOUT = `<main><h2>Follow on WhatsApp</h2>${LINK}</main>`;
// Cloudflare's documented rule: noindex on the pages.dev address and its previews (GR-012).
const HEADERS = [
  'https://:project.pages.dev/*',
  '  X-Robots-Tag: noindex',
  '',
  'https://:version.:project.pages.dev/*',
  '  X-Robots-Tag: noindex',
  '',
].join('\n');

describe('checkDist: the WhatsApp channel link (GR-013)', () => {
  const base = () => {
    page('_headers', HEADERS);
    page('about.html', ABOUT);
    page('jobs/a.html', `<h1>A</h1>${SAFE}`);
    page('about.html', ABOUT);
  };
  const reasons = () => checkDist(dist).map((f) => `${f.file}: ${f.reason}`);
  const FOOTER_NO_LINK = '<footer class="footer"><a href="/about">About</a></footer>';

  it('refuses a page whose site footer has no channel link', () => {
    base();
    bare('index.html', `<main>Jobs</main>${FOOTER_NO_LINK}`);
    expect(reasons()).toContain('index.html: footer without the WhatsApp channel link');
  });

  it('refuses a footer link to a different WhatsApp address', () => {
    base();
    bare(
      'index.html',
      '<footer class="footer"><a href="https://whatsapp.com/channel/x">WhatsApp</a></footer>',
    );
    expect(reasons()).toContain('index.html: footer without the WhatsApp channel link');
  });

  it('checks the site footer, not an earlier <footer> inside a card', () => {
    base();
    bare('index.html', `<article><footer>Closes 27 Nov</footer></article>${SITE_FOOTER}`);
    expect(checkDist(dist)).toEqual([]);
    bare('index.html', `<article><footer>${LINK}</footer></article>${FOOTER_NO_LINK}`);
    expect(reasons()).toContain('index.html: footer without the WhatsApp channel link');
  });

  it('refuses a page with no site footer at all', () => {
    base();
    bare('stay-safe.html', '<main>Stay safe</main>');
    expect(reasons()).toContain('stay-safe.html: no site footer');
  });

  it('refuses an About page with the link only in its footer', () => {
    base();
    page('about.html', '<main><h1>About</h1></main>');
    expect(reasons()).toContain('about.html: no WhatsApp channel section');
  });

  it('refuses a build without an About page', () => {
    page('_headers', HEADERS);
    page('jobs/a.html', `<h1>A</h1>${SAFE}`);
    expect(reasons()).toContain('about.html: missing');
  });

  it('passes pages with the link in the footer, and About with its own section', () => {
    base();
    page('index.html', '<main>Jobs</main>');
    expect(checkDist(dist)).toEqual([]);
  });
});

describe('checkDist: the site address and the pages.dev noindex rule (GR-012)', () => {
  const clean = () => {
    page('index.html', '<p>ok</p>');
    page('jobs/a.html', `<h1>A</h1>${SAFE}`);
  };
  const reasons = () => checkDist(dist).map((f) => `${f.file}: ${f.reason}`);

  it.each([
    [
      'a canonical link',
      'jobs/b.html',
      `<link rel="canonical" href="https://graduate-radar.pages.dev/jobs/b">${SAFE}`,
    ],
    [
      'og:url and og:image',
      'index.html',
      '<meta property="og:image" content="https://graduate-radar.pages.dev/og-default.png">',
    ],
    [
      'JobPosting data',
      'jobs/c.html',
      `<script type="application/ld+json">{"url":"https://graduate-radar.pages.dev/jobs/c"}</script>${SAFE}`,
    ],
    ['a sitemap entry', 'sitemap.xml', '<loc>https://graduate-radar.pages.dev/</loc>'],
    [
      'the robots.txt sitemap line',
      'robots.txt',
      'Sitemap: https://graduate-radar.pages.dev/sitemap.xml',
    ],
  ])('refuses the old pages.dev address in %s', (_name, file, text) => {
    clean();
    page('_headers', HEADERS);
    page('about.html', ABOUT);
    page(file, text);
    expect(reasons()).toContain(`${file}: points to the old address graduate-radar.pages.dev`);
  });

  it('refuses a build without _headers', () => {
    clean();
    expect(reasons()).toContain('_headers: missing (the pages.dev noindex rule)');
  });

  it('refuses _headers without the noindex rule for previews', () => {
    clean();
    page('_headers', 'https://:project.pages.dev/*\n  X-Robots-Tag: noindex\n');
    expect(reasons()).toContain(
      '_headers: no noindex rule for https://:version.:project.pages.dev/*',
    );
  });

  it('refuses a noindex rule that would also hide the real site', () => {
    clean();
    page('_headers', `${HEADERS}\n/*\n  X-Robots-Tag: noindex\n`);
    expect(reasons()).toContain('_headers: noindex rule for /* would hide the real site');
    page(
      '_headers',
      `${HEADERS}\nhttps://graduateradar.versionphi.com/*\n  X-Robots-Tag: noindex\n`,
    );
    expect(reasons()).toContain(
      '_headers: noindex rule for https://graduateradar.versionphi.com/* would hide the real site',
    );
  });

  it('treats "none" (noindex plus nofollow) the same as noindex', () => {
    clean();
    page('_headers', `${HEADERS}\n/*\n  X-Robots-Tag: none\n`);
    expect(reasons()).toContain('_headers: noindex rule for /* would hide the real site');
  });

  it('does not mind an employer link that happens to be on pages.dev', () => {
    clean();
    page('_headers', HEADERS);
    page('about.html', ABOUT);
    page('jobs/d.html', `<a href="https://acme-careers.pages.dev/apply">Apply</a>${SAFE}`);
    expect(checkDist(dist)).toEqual([]);
  });
});

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
    page('_headers', HEADERS);
    page('about.html', ABOUT);
    page('_astro/app.js', 'const a = "foundVia";');
    page('sitemap.xml', '<url>Found via</url>');
    const files = checkDist(dist)
      .filter((f) => f.file !== '(dist)')
      .map((f) => f.file)
      .sort();
    expect(files).toEqual(['_astro/app.js', 'sitemap.xml']);
  });

  it('refuses a job or training detail page without "Never pay to apply"', () => {
    page('_headers', HEADERS);
    page('about.html', ABOUT);
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

describe('checkDist: no false alarms on ordinary listing text', () => {
  it.each([['Opening found via the company LinkedIn page'], ['We found it via a friend']])(
    'passes a note saying %j',
    (note) => {
      page('jobs/a.html', `<p>${note}</p>${SAFE}`);
      page('_headers', HEADERS);
      page('about.html', ABOUT);
      expect(checkDist(dist)).toEqual([]);
    },
  );

  it.each([['<th>Found via</th>'], ['Found via: https://agg.example.com'], ['"found_via":"x"']])(
    'still refuses the field form %j',
    (text) => {
      page('jobs/a.html', `${text}${SAFE}`);
      expect(checkDist(dist).map((f) => f.file)).toContain('jobs/a.html');
    },
  );
});

describe('the scan runs on every build, including Cloudflare daily builds', () => {
  it('npm run build runs check-dist after astro build', async () => {
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pkg.scripts.build).toMatch(/astro build && node scripts\/check-dist\.ts/);
  });
});

describe('checkDist: happy path', () => {
  it('passes a clean site', () => {
    page('index.html', '<p>Graduate Radar</p>');
    page('jobs/a.html', `<h1>A</h1>${SAFE}`);
    page('_headers', HEADERS);
    page('about.html', ABOUT);
    expect(checkDist(dist)).toEqual([]);
  });
});
