// The page check (spec 6.6): opens every built page in headless Chrome or Edge at 360 x 800
// (mobile emulation), then at 768, 1024 and 1280 px wide (GR-017), and fails if a page
// scrolls sideways or has a tap target under 44 px, or a list page whose first listing
// starts below the first screen (GR-015). It also checks the broadsheet layout (GR-017):
// listings are never side by side (a card grid); at 1200 px and wider no ledger title
// column is under 480 px; below 960 px a list page shows no rail; from 960 to 1199 px the
// "Never pay to apply" notice is above the list; from 960 px the wordmark lines up with
// the page's left edge, and a detail page's rail stays in view while the article scrolls.
// Inline text links inside a sentence are exempt (WCAG 2.5.8), as are
// elements that are hidden or off screen (the skip link).
// Talks to the browser over the Chrome DevTools Protocol with Node's built-in WebSocket,
// so there is no extra dependency.
// Run: node scripts/check-mobile.ts [dist]   (npm run check:mobile; CI runs it after build)
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser } from './browsers.ts';

export { findBrowser };

export interface MobileFinding {
  page: string;
  /** Viewport width in CSS px. */
  width: number;
  reason: string;
}

/** The widths every page is checked at: a phone, a tablet, a small and a common laptop. */
export const WIDTHS = [360, 768, 1024, 1280] as const;

// Runs inside the page. Returns one message per problem. Closed <details> panels (the
// folded filters) are opened first so the controls inside them are measured too.
// On a list page the first listing must start on the first screen (GR-015); that is
// measured before the panels are opened, as a visitor first sees the page.
const CHECK = `(() => {
  const out = [];
  const W0 = window.innerWidth;
  const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const rows = [...document.querySelectorAll('[data-items] [data-key]')].filter((e) => e.getBoundingClientRect().height > 0);
  const first = rows[0];
  if (first) {
    const top = Math.round(first.getBoundingClientRect().top + window.scrollY);
    if (top >= window.innerHeight) out.push('first listing starts at ' + top + 'px, below the first screen (' + window.innerHeight + 'px)');
    const tops = rows.slice(0, 6).map((e) => Math.round(e.getBoundingClientRect().top));
    if (new Set(tops).size < tops.length) out.push('listings laid out side by side (a card grid)');
    if (W0 >= 1200) {
      const narrow = [...document.querySelectorAll('[data-items] .row__title')].filter(shown).map((e) => Math.round(e.getBoundingClientRect().width)).filter((w) => w < 480);
      if (narrow.length) out.push('ledger title column ' + Math.min(...narrow) + 'px wide, under 480px');
    }
  }
  const rail = document.querySelector('[data-rail]');
  if (first && W0 < 960 && shown(rail)) out.push('list page shows a rail below 960px');
  if (first && rail && W0 >= 960 && W0 < 1200) {
    const note = document.querySelector('[data-rail] .safety');
    if (!shown(note) || note.getBoundingClientRect().top > first.getBoundingClientRect().top) out.push('the Never pay to apply notice is not above the list');
  }
  if (W0 >= 960) {
    const mark = document.querySelector('.wordmark');
    const main = document.querySelector('#main');
    if (mark && main) {
      const edge = main.getBoundingClientRect().left + parseFloat(getComputedStyle(main).paddingLeft);
      const left = mark.getBoundingClientRect().left;
      if (Math.abs(left - edge) > 1) out.push('wordmark not left aligned (' + Math.round(left) + 'px, page edge ' + Math.round(edge) + 'px)');
    }
    const detail = document.querySelector('[data-detail]');
    if (detail && shown(rail)) {
      // Scroll as far as the rail could travel inside the article; it must still be in view.
      const start = rail.getBoundingClientRect().top + window.scrollY;
      const room = detail.getBoundingClientRect().height - rail.getBoundingClientRect().height;
      const y = Math.min(room, document.documentElement.scrollHeight - window.innerHeight);
      if (y > start + 50) {
        window.scrollTo(0, y);
        const top = rail.getBoundingClientRect().top;
        window.scrollTo(0, 0);
        if (top < 0) out.push('detail rail scrolls out of view (top at ' + Math.round(top) + 'px)');
      }
    }
  }
  document.querySelectorAll('details').forEach((d) => { d.open = true; });
  const W = document.documentElement.clientWidth;
  const sw = document.documentElement.scrollWidth;
  if (sw > W + 1) {
    // Name the innermost elements that stick out, so the cause is easy to find.
    const wide = [...document.querySelectorAll('body *')]
      .filter((e) => e.getBoundingClientRect().right > W + 1)
      .filter((e) => ![...e.children].some((c) => c.getBoundingClientRect().right > W + 1))
      .slice(0, 3)
      .map((e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).filter((c) => !c.startsWith('astro-')).join('.') : ''));
    out.push('scrolls sideways: content is ' + sw + 'px wide at ' + W + 'px (' + wide.join(', ') + ')');
  }
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, summary')) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.bottom < 0) continue;
    if (el.tagName === 'A' && cs.display === 'inline') continue;
    if (r.height < 43.5) {
      const label = (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
      out.push('tap target ' + Math.round(r.height) + 'px tall: ' + el.tagName.toLowerCase() + ' "' + label + '"');
    }
  }
  return out;
})()`;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.json': 'application/json',
};

/** Serves dist/ like Cloudflare Pages: /about finds about.html; unknown paths get 404.html. */
function serve(dist: string): Promise<{ origin: string; server: Server }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    const safe = normalize(path).replace(/^([/\\])+/, '');
    const tries = path.endsWith('/')
      ? [join(safe, 'index.html')]
      : [safe, `${safe}.html`, join(safe, 'index.html')];
    const found = tries
      .map((t) => join(dist, t))
      .find((f) => f.startsWith(dist) && existsSync(f) && statSync(f).isFile());
    const file = found ?? join(dist, '404.html');
    res.writeHead(found ? 200 : 404, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    res.end(existsSync(file) ? readFileSync(file) : 'not found');
  });
  return new Promise((ok) =>
    server.listen(0, '127.0.0.1', () =>
      ok({ origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server }),
    ),
  );
}

/** Stops the browser and waits for it to exit (at most 5 s), so it lets go of its profile. */
export function stopBrowser(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null) return Promise.resolve();
  return new Promise((done) => {
    const timer = setTimeout(done, 5_000);
    proc.once('exit', () => {
      clearTimeout(timer);
      done();
    });
    proc.kill();
  });
}

/**
 * Deletes the throwaway browser profile. On Windows the browser's helper processes can
 * hold files for a moment after it exits; a leftover folder in the temp directory is
 * not a phone problem, so it is reported as a warning and never fails the check.
 */
export function removeProfile(profile: string, remove: typeof rmSync = rmSync): void {
  try {
    remove(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (err) {
    console.warn(`[check-mobile] could not delete ${profile}: ${(err as Error).message}`);
  }
}

function launch(browser: string, profile: string): Promise<{ ws: string; proc: ChildProcess }> {
  const proc = spawn(browser, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    // GitHub's Ubuntu 24.04 runners block Chrome's sandbox (AppArmor). Only in CI, and
    // only ever loading our own built pages from 127.0.0.1.
    ...(process.env['CI'] ? ['--no-sandbox'] : []),
    'about:blank',
  ]);
  return new Promise((ok, fail) => {
    let err = '';
    // On any failure, stop the browser so it does not outlive the check.
    const giveUp = (e: Error) => {
      clearTimeout(timer);
      proc.kill();
      fail(e);
    };
    const timer = setTimeout(
      () => giveUp(new Error(`browser did not start: ${err.slice(-300)}`)),
      20_000,
    );
    proc.stderr?.on('data', (d: Buffer) => {
      err += d.toString();
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(err);
      if (m) {
        clearTimeout(timer);
        ok({ ws: m[1]!, proc });
      }
    });
    proc.on('error', giveUp);
    proc.on('exit', (code) =>
      giveUp(new Error(`browser exited (code ${code}) before starting: ${err.slice(-300)}`)),
    );
  });
}

/** Minimal CDP client: send commands, wait for one event. */
function connect(wsUrl: string) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map<
    number,
    (msg: { result?: unknown; error?: { message: string } }) => void
  >();
  const waiters: { method: string; resolve: () => void }[] = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(String(ev.data)) as { id?: number; method?: string };
    if (msg.id !== undefined) pending.get(msg.id)?.(msg as never);
    else if (msg.method) {
      const i = waiters.findIndex((w) => w.method === msg.method);
      if (i !== -1) waiters.splice(i, 1)[0]!.resolve();
    }
  });
  const ready = new Promise<void>((ok, fail) => {
    ws.addEventListener('open', () => ok());
    ws.addEventListener('error', () => fail(new Error('could not connect to the browser')));
  });
  const send = <T>(method: string, params: object = {}, sessionId?: string): Promise<T> =>
    new Promise((ok, fail) => {
      const n = ++id;
      pending.set(n, (m) =>
        m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok(m.result as T),
      );
      ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const once = (method: string, ms: number) =>
    new Promise<void>((ok, fail) => {
      const t = setTimeout(() => fail(new Error(`timed out waiting for ${method}`)), ms);
      waiters.push({ method, resolve: () => (clearTimeout(t), ok()) });
    });
  return { ready, send, once, close: () => ws.close() };
}

function pages(dist: string, dir = dist, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) pages(dist, full, out);
    else if (name.endsWith('.html')) {
      const rel = relative(dist, full)
        .split(sep)
        .join('/')
        .replace(/\.html$/, '');
      out.push(rel === 'index' ? '/' : `/${rel}`);
    }
  }
  return out.sort();
}

export async function checkMobile(
  dist: string,
  browser: string,
  widths: readonly number[] = WIDTHS,
): Promise<MobileFinding[]> {
  const { origin, server } = await serve(dist);
  const profile = mkdtempSync(join(tmpdir(), 'gr-mobile-'));
  const findings: MobileFinding[] = [];
  let proc: ChildProcess | undefined;
  let cdp: ReturnType<typeof connect> | undefined;
  try {
    const started = await launch(browser, profile);
    proc = started.proc;
    cdp = connect(started.ws);
    await cdp.ready;
    const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', {
      url: 'about:blank',
    });
    const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    await cdp.send('Page.enable', {}, sessionId);
    for (const width of widths) {
      // Phone widths emulate a phone; wider ones are a desktop browser window.
      await cdp.send(
        'Emulation.setDeviceMetricsOverride',
        { width, height: 800, deviceScaleFactor: width < 768 ? 2 : 1, mobile: width < 768 },
        sessionId,
      );
      for (const page of pages(dist)) {
        const loaded = cdp.once('Page.loadEventFired', 20_000);
        await cdp.send('Page.navigate', { url: `${origin}${page}` }, sessionId);
        await loaded;
        const res = await cdp.send<{ result: { value: string[] } }>(
          'Runtime.evaluate',
          { expression: CHECK, returnByValue: true },
          sessionId,
        );
        for (const reason of res.result.value) findings.push({ page, width, reason });
      }
    }
  } finally {
    cdp?.close();
    server.close();
    if (proc) await stopBrowser(proc);
    removeProfile(profile);
  }
  return findings;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = process.argv[2] ?? 'dist';
  const browser = findBrowser();
  if (!browser) {
    console.error('No Chrome or Edge found for the page check. Set CHROME_PATH.');
    process.exitCode = 1;
  } else {
    const all = pages(dist);
    const at = `${WIDTHS.join(', ')} px`;
    const findings = await checkMobile(dist, browser);
    for (const f of findings) console.error(`${f.page} at ${f.width} px: ${f.reason}`);
    if (findings.length > 0) {
      console.error(
        `Page check failed: ${findings.length} finding(s) on ${all.length} pages at ${at}.`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        `Page check passed: ${all.length} pages at ${at}: no sideways scroll, tap targets at least 44 px, broadsheet layout rules met.`,
      );
    }
  }
}
