// Page weight budgets (spec 6.6): JavaScript at most 50 KB gzipped and the first load
// (HTML + its CSS + its JS) at most 150 KB gzipped, on every built page.
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BUDGET, checkBudgets, pageWeight } from '../scripts/check-budgets.ts';

let dist: string;
beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'budget-'));
});
afterEach(() => rmSync(dist, { recursive: true, force: true }));

const file = (path: string, body: string) => {
  const full = join(dist, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, body);
};
// Base64 of random bytes gzips to about 75% of its length (6 bits per character).
const noise = (bytes: number) => randomBytes(bytes).toString('base64').slice(0, bytes);
const html = (assets: string) =>
  `<!doctype html><html><head>${assets}</head><body>hi</body></html>`;

describe('checkBudgets: what must be refused', () => {
  it('fails a page whose JavaScript is over 50 KB gzipped', () => {
    file('_astro/big.js', noise(80 * 1024));
    file('index.html', html('<script type="module" src="/_astro/big.js"></script>'));
    const f = checkBudgets(dist);
    expect(f).toEqual([
      expect.objectContaining({ file: 'index.html', reason: expect.stringMatching(/JavaScript/) }),
    ]);
  });

  it('fails a page whose first load is over 150 KB gzipped', () => {
    file('_astro/big.css', noise(140 * 1024));
    file(
      'index.html',
      html(`<link rel="stylesheet" href="/_astro/big.css">`) + `<p>${noise(80 * 1024)}</p>`,
    );
    expect(
      checkBudgets(dist)
        .map((f) => f.reason)
        .join(' '),
    ).toMatch(/first load/);
  });

  it('counts inline styles as part of the HTML', () => {
    file('index.html', html(`<style>${noise(220 * 1024)}</style>`));
    expect(
      checkBudgets(dist)
        .map((f) => f.reason)
        .join(' '),
    ).toMatch(/first load/);
  });

  it('counts inline scripts in the HTML itself', () => {
    file('index.html', html(`<script>${noise(80 * 1024)}</script>`));
    expect(checkBudgets(dist).length).toBeGreaterThan(0);
  });

  it('counts a stylesheet whose href comes before rel', () => {
    file('_astro/big.css', noise(220 * 1024));
    file('index.html', html('<link href="/_astro/big.css" rel="stylesheet">'));
    expect(
      checkBudgets(dist)
        .map((f) => f.reason)
        .join(' '),
    ).toMatch(/first load/);
  });

  it('fails when a linked asset is missing (a broken build)', () => {
    file('index.html', html('<script type="module" src="/_astro/missing.js"></script>'));
    expect(
      checkBudgets(dist)
        .map((f) => f.reason)
        .join(' '),
    ).toMatch(/missing/);
  });
});

describe('checkBudgets: happy path', () => {
  it('passes small pages and reports their weight', () => {
    file('_astro/a.js', 'console.log(1)');
    file('_astro/a.css', 'body{margin:0}');
    file(
      'index.html',
      html(
        '<link rel="stylesheet" href="/_astro/a.css"><script type="module" src="/_astro/a.js"></script>',
      ),
    );
    expect(checkBudgets(dist)).toEqual([]);
    const w = pageWeight(dist, 'index.html');
    expect(w.js).toBeGreaterThan(0);
    expect(w.css).toBeGreaterThan(0);
    expect(w.total).toBe(w.html + w.css + w.js);
    expect(BUDGET).toEqual({ jsBytes: 50 * 1024, totalBytes: 150 * 1024 });
  });
});
