// The 360 px check: every built page, in a real headless browser at 360 x 800, must not
// scroll sideways and must have tap targets of at least 44 px (inline text links in a
// sentence are exempt, as in WCAG 2.5.8). Skipped where no Chrome or Edge is installed;
// GitHub's Ubuntu runners have Chrome, so it always runs in CI.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkMobile, findBrowser, removeProfile, stopBrowser } from '../scripts/check-mobile.ts';

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

describe('checkMobile: a browser that will not start', () => {
  it('fails fast instead of hanging, and leaves nothing running', async () => {
    page('index.html', '<p>hi</p>');
    // Node is not a browser: it rejects the Chrome flags and exits at once.
    const started = Date.now();
    await expect(checkMobile(dist, process.execPath)).rejects.toThrow(/browser/);
    expect(Date.now() - started).toBeLessThan(10_000);
  }, 30_000);
});

describe.skipIf(!browser)('checkMobile: hidden parts are checked too', () => {
  it('opens closed <details> panels before measuring (the folded filters)', async () => {
    // A closed panel hides its width from the page, so a too-wide control inside it
    // only shows up once the panel is open. Its tap size is measured either way.
    page(
      'index.html',
      '<details><summary style="min-height:48px">Filters</summary><div style="width:500px">Wide inside</div><button style="height:20px;padding:0">Hidden tiny</button></details>',
    );
    const reasons = (await checkMobile(dist, browser!)).map((f) => f.reason).join(' | ');
    expect(reasons).toMatch(/sideways/);
    expect(reasons).toMatch(/Hidden tiny/);
  }, 60_000);
});

describe.skipIf(!browser)('the site CSS breaks long unbroken listing text', () => {
  it('a long URL in a paragraph does not scroll sideways with global.css', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8').replace(
      /@import[^;]+;/,
      '',
    );
    const url =
      'https://careers.example.com/graduate-programme-2026/apply-now-for-the-programme?ref=graduate-radar-whatsapp-share';
    page(
      'index.html',
      `<style>${css}</style><main><p>Apply via ${url}</p><h1>${'Supercalifragilistic'.repeat(4)}</h1></main>`,
    );
    expect(await checkMobile(dist, browser!)).toEqual([]);
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

describe('checkMobile: cleanup after the browser', () => {
  it('a profile folder that cannot be deleted warns instead of failing the check', () => {
    const locked = () => {
      throw Object.assign(new Error('EPERM, Permission denied'), { code: 'EPERM' });
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => removeProfile('C:\\Temp\\gr-mobile-x', locked)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not delete'));
    warn.mockRestore();
  });

  it('waits for the browser process to exit before cleanup', async () => {
    const proc = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
    await stopBrowser(proc);
    expect(proc.exitCode !== null || proc.signalCode !== null).toBe(true);
  });
});
