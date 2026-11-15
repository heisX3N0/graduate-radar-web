// GR-010: the launch drafts in docs/launch.md (the sheet's Start here tab and the
// WhatsApp post). The owner pastes them by hand, so these checks guard the text itself:
// the website is the main link, and the old "Publish to web" view is never promoted.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteOrigin } from '../src/lib/site.ts';

const ROOT = join(import.meta.dirname, '..');
const SITE = siteOrigin(undefined);
const DRAFTS = ['Start here tab', 'WhatsApp post'] as const;

/** The first ```text block under the "## <heading>" section, or throws. */
function draft(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) throw new Error(`No "## ${heading}" section`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  const section = end === -1 ? rest : rest.slice(0, end);
  const open = section.findIndex((l) => l.trim() === '```text');
  if (open === -1) throw new Error(`No text block under "## ${heading}"`);
  const close = section.findIndex((l, i) => i > open && l.trim() === '```');
  if (close === -1) throw new Error(`Unclosed text block under "## ${heading}"`);
  const text = section
    .slice(open + 1, close)
    .join('\n')
    .trim();
  if (!text) throw new Error(`Empty text block under "## ${heading}"`);
  return text;
}

/**
 * Every link WhatsApp or Sheets would make from the text, in order, as absolute URLs.
 * Bare domains count too ("bit.ly/x" becomes a link in WhatsApp). Trailing WhatsApp
 * formatting and sentence punctuation (* _ . , ) :) are not part of the link.
 */
function links(text: string): URL[] {
  const found = text.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi) ?? [];
  return found.map((raw) => {
    const trimmed = raw.replace(/[*_.,):]+$/, '');
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  });
}

/** True when src/pages builds this path ("/" is index.astro). */
function builtPage(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/index';
  return existsSync(join(ROOT, 'src', 'pages', `${path}.astro`));
}

const launchFile = join(ROOT, 'docs', 'launch.md');
const launch = existsSync(launchFile) ? readFileSync(launchFile, 'utf8') : '';

describe('draft()', () => {
  it('refuses a missing section, so the checks below cannot pass on nothing', () => {
    expect(() => draft('# Launch\n', 'WhatsApp post')).toThrow(/No "## WhatsApp post"/);
  });

  it('refuses a section without a text block, or with an empty one', () => {
    expect(() => draft('## WhatsApp post\nJust prose.\n', 'WhatsApp post')).toThrow(/No text/);
    expect(() => draft('## WhatsApp post\n```text\n\n```\n', 'WhatsApp post')).toThrow(/Empty/);
  });

  it('reads only its own section', () => {
    const md = '## A\n```text\nfirst\n```\n## B\n```text\nsecond\n```\n';
    expect(draft(md, 'A')).toBe('first');
    expect(draft(md, 'B')).toBe('second');
  });
});

describe('links()', () => {
  it('finds bare domains, which WhatsApp also turns into links', () => {
    expect(links('Old list: bit.ly/gr-sheet then more').map(String)).toEqual([
      'https://bit.ly/gr-sheet',
    ]);
  });

  it('keeps a lookalike host as its own host', () => {
    const [url] = links('https://graduate-radar.pages.dev.example.com/');
    expect(url?.origin).toBe('https://graduate-radar.pages.dev.example.com');
  });

  it('drops WhatsApp bold and sentence punctuation, but keeps underscores inside', () => {
    expect(links('*https://a.example/x_y*. Next').map(String)).toEqual(['https://a.example/x_y']);
  });

  it('does not treat ordinary words as links', () => {
    expect(links("Never pay to apply. If anyone asks, e.g. a recruiter, don't pay.")).toEqual([]);
  });
});

describe('builtPage()', () => {
  it('refuses a page the site does not build', () => {
    expect(builtPage('/no-such-page')).toBe(false);
  });

  it('accepts the home page and real pages', () => {
    expect(builtPage('/')).toBe(true);
    expect(builtPage('/stay-safe')).toBe(true);
  });
});

describe('launch drafts (docs/launch.md)', () => {
  it('exists', () => {
    expect(launch, 'docs/launch.md is missing').not.toBe('');
  });

  for (const heading of DRAFTS) {
    describe(heading, () => {
      it('does not link to the Google Sheet or its "Publish to web" view', () => {
        const text = draft(launch, heading);
        expect(text).not.toMatch(/docs\.google\.com|pubhtml|spreadsheets/i);
        expect(text).not.toMatch(/publish(ed)? to (the )?web/i);
      });

      it('never mentions the private "Found via" field', () => {
        expect(draft(launch, heading)).not.toMatch(/found via/i);
      });

      it('has the website home page as its first link', () => {
        const [first] = links(draft(launch, heading));
        expect(first?.origin).toBe(SITE);
        expect(first?.pathname).toBe('/');
      });

      it('links only to pages the site builds', () => {
        for (const url of links(draft(launch, heading))) {
          expect(url.origin, String(url)).toBe(SITE);
          expect(builtPage(url.pathname), String(url)).toBe(true);
        }
      });

      it('keeps "Never pay to apply"', () => {
        expect(draft(launch, heading)).toMatch(/never pay to apply/i);
      });
    });
  }
});
