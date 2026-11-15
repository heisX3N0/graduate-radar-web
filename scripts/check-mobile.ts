// The 360 px check (spec 6.6): opens every built page in headless Chrome or Edge at
// 360 x 800 (mobile emulation) and fails if a page scrolls sideways or has a tap target
// under 44 px. Inline text links inside a sentence are exempt (WCAG 2.5.8), as are
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

export interface MobileFinding {
  page: string;
  reason: string;
}

const CANDIDATES = [
  process.env['CHROME_PATH'],
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export function findBrowser(): string | null {
  return CANDIDATES.find((p): p is string => !!p && existsSync(p)) ?? null;
}

// Runs inside the page. Returns one message per problem.
const CHECK = `(() => {
  const W = document.documentElement.clientWidth;
  const out = [];
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
    const timer = setTimeout(
      () => fail(new Error(`browser did not start: ${err.slice(-300)}`)),
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
    proc.on('error', (e) => {
      clearTimeout(timer);
      fail(e);
    });
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

export async function checkMobile(dist: string, browser: string): Promise<MobileFinding[]> {
  const { origin, server } = await serve(dist);
  const profile = mkdtempSync(join(tmpdir(), 'gr-mobile-'));
  const { ws, proc } = await launch(browser, profile);
  const cdp = connect(ws);
  const findings: MobileFinding[] = [];
  try {
    await cdp.ready;
    const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', {
      url: 'about:blank',
    });
    const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width: 360, height: 800, deviceScaleFactor: 2, mobile: true },
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
      for (const reason of res.result.value) findings.push({ page, reason });
    }
  } finally {
    cdp.close();
    proc.kill();
    server.close();
    // The browser can hold its profile for a moment after exit (Windows).
    await new Promise((r) => setTimeout(r, 300));
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  return findings;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = process.argv[2] ?? 'dist';
  const browser = findBrowser();
  if (!browser) {
    console.error('No Chrome or Edge found for the 360 px check. Set CHROME_PATH.');
    process.exitCode = 1;
  } else {
    const all = pages(dist);
    const findings = await checkMobile(dist, browser);
    for (const f of findings) console.error(`${f.page}: ${f.reason}`);
    if (findings.length > 0) {
      console.error(`360 px check failed: ${findings.length} finding(s) on ${all.length} pages.`);
      process.exitCode = 1;
    } else {
      console.log(
        `360 px check passed: ${all.length} pages, no sideways scroll, all tap targets at least 44 px.`,
      );
    }
  }
}
