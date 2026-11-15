// Where to find a Chromium-based browser (Chrome or Edge) for the scripts that need one:
// the 360 px check (check-mobile.ts) and the sharing image (og/render.ts).
import { existsSync } from 'node:fs';

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

/** The first installed browser, or null. CHROME_PATH wins when set. */
export function findBrowser(): string | null {
  return CANDIDATES.find((p): p is string => !!p && existsSync(p)) ?? null;
}
