// GR-010: the launch drafts in docs/launch.md (the sheet's Start here tab and the
// WhatsApp post). The owner pastes them by hand, so these checks guard the text itself:
// the website is the main link, and the old "Publish to web" view is never promoted.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const SITE = 'https://graduate-radar.pages.dev';
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

const urls = (text: string) => text.match(/https?:\/\/[^\s)*_]+/g) ?? [];

function readLaunch(): string {
  const file = join(ROOT, 'docs', 'launch.md');
  if (!existsSync(file)) throw new Error('docs/launch.md is missing');
  return readFileSync(file, 'utf8');
}

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

describe('launch drafts (docs/launch.md)', () => {
  for (const heading of DRAFTS) {
    describe(heading, () => {
      it('does not link to the Google Sheet or its "Publish to web" view', () => {
        const text = draft(readLaunch(), heading);
        expect(text).not.toMatch(/docs\.google\.com|pubhtml|spreadsheets/i);
        expect(text).not.toMatch(/publish(ed)? to (the )?web/i);
      });

      it('never mentions the private "Found via" field', () => {
        expect(draft(readLaunch(), heading)).not.toMatch(/found via/i);
      });

      it('has the website home page as its first link', () => {
        const first = urls(draft(readLaunch(), heading))[0];
        expect(first?.replace(/\/$/, '')).toBe(SITE);
      });

      it('links only to pages the site builds', () => {
        const pages = new Set(['/', '/trainings', '/about', '/stay-safe']);
        for (const url of urls(draft(readLaunch(), heading))) {
          expect(url.startsWith(SITE), url).toBe(true);
          const path = new URL(url).pathname.replace(/(.)\/$/, '$1');
          expect(pages.has(path), url).toBe(true);
        }
      });

      it('keeps "Never pay to apply"', () => {
        expect(draft(readLaunch(), heading)).toMatch(/never pay to apply/i);
      });
    });
  }
});
