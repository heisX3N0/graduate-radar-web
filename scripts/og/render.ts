// npm run og: renders scripts/og/og.html to public/og-default.png (1200 x 630) with a
// locally installed Edge or Chrome in headless mode. Run it by hand after editing og.html;
// the build only copies the PNG.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BROWSERS = [
  process.env['CHROME_PATH'],
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter((p): p is string => !!p);

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error('No Edge or Chrome found. Set CHROME_PATH to a Chromium-based browser.');
  process.exitCode = 1;
} else {
  const out = resolve('public/og-default.png');
  const profile = mkdtempSync(join(tmpdir(), 'og-'));
  try {
    execFileSync(browser, [
      '--headless=new',
      '--no-first-run',
      `--user-data-dir=${profile}`,
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1200,630',
      `--screenshot=${out}`,
      pathToFileURL(resolve('scripts/og/og.html')).href,
    ]);
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
  console.log(`Wrote ${out} (${statSync(out).size} bytes).`);
}
