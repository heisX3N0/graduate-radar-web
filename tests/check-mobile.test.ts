// The 360 px check: every built page, in a real headless browser at 360 x 800, must not
// scroll sideways and must have tap targets of at least 44 px (inline text links in a
// sentence are exempt, as in WCAG 2.5.8). Skipped where no Chrome or Edge is installed;
// GitHub's Ubuntu runners have Chrome, so it always runs in CI.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkMobile, findBrowser } from '../scripts/check-mobile.ts';

const browser = findBrowser();
let dist: string;
beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'mobile-'));
});
afterEach(() => rmSync(dist, { recursive: true, force: true }));

const page = (path: string, body: string) => {
  const full = join(dist, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(
    full,
    `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font:16px sans-serif}</style></head><body>${body}</body></html>`,
  );
};

describe.skipIf(!browser)('checkMobile: what must be refused', () => {
  it('fails a page that scrolls sideways at 360 px', async () => {
    page('index.html', '<div style="width:500px">too wide</div>');
    const f = await checkMobile(dist, browser!);
    expect(f).toEqual([
      expect.objectContaining({ page: '/', reason: expect.stringMatching(/sideways/) }),
    ]);
  }, 60_000);

  it('fails a button or link block smaller than 44 px', async () => {
    page(
      'index.html',
      '<button style="height:20px;padding:0">Tiny</button><a href="/x" style="display:block;height:20px">Block link</a>',
    );
    const reasons = (await checkMobile(dist, browser!)).map((f) => f.reason).join(' | ');
    expect(reasons).toMatch(/Tiny/);
    expect(reasons).toMatch(/Block link/);
  }, 60_000);
});

describe.skipIf(!browser)('checkMobile: happy path', () => {
  it('passes a narrow page with big targets and inline text links', async () => {
    page(
      'index.html',
      '<p>Read <a href="/a">this link</a> in a sentence.</p><button style="min-height:48px">Big</button>',
    );
    page('about.html', '<p>About</p>');
    expect(await checkMobile(dist, browser!)).toEqual([]);
  }, 60_000);
});
