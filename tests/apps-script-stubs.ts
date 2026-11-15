// Minimal stand-ins for the Apps Script services Feed.gs uses, so the real
// Feed.gs file can run in Node under Vitest. Only the calls Feed.gs makes exist.
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

export type Cell = string | Date;
export type Grid = Cell[][];

export interface FeedApi {
  doGet: () => { body: string; mime: string };
  readTab_: (cfg: unknown) => Record<string, unknown>[];
  day_: (raw: unknown, display: string) => string;
  FEED_TABS: Record<string, { sheet: string; fields: Record<string, string> }>;
}

export interface Harness {
  feed: FeedApi;
  /** Web app entry points (doGet, doPost, ...) the script defines. */
  routes: string[];
  opened: string[];
  errors: string[];
  cache: Map<string, string>;
}

// Real date cells display in the sheet's locale (dd/MM/yyyy here), not ISO.
function display(cell: Cell): string {
  if (cell instanceof Date) {
    const [y, m, d] = lagosDay(cell).split('-');
    return `${d}/${m}/${y}`;
  }
  return cell;
}

export function lagosDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function loadFeed(tabs: Record<string, Grid>): Harness {
  const opened: string[] = [];
  const errors: string[] = [];
  const cache = new Map<string, string>();

  const sheetFor = (name: string) => {
    opened.push(name);
    const grid = tabs[name];
    if (!grid) return null;
    return {
      getDataRange: () => ({
        getValues: () => grid.map((row) => [...row]),
        getDisplayValues: () => grid.map((row) => row.map(display)),
      }),
    };
  };

  const context = createContext({
    Date, // host Date, so vi.setSystemTime controls "today"
    console: { ...console, error: (msg: string) => errors.push(String(msg)) },
    // Any spreadsheet call other than getSheetByName is recorded, so a test can prove
    // the feed never reaches tabs by another path (getSheets, getSheetById, ...).
    SpreadsheetApp: {
      getActive: () =>
        new Proxy(
          {},
          {
            get: (_t, prop) => {
              if (prop === 'getSheetByName') return sheetFor;
              return () => {
                opened.push(`spreadsheet.${String(prop)}`);
                throw new Error(`stub: ${String(prop)} not allowed`);
              };
            },
          },
        ),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cache.get(k) ?? null,
        // Real CacheService rejects values over 100 KB (bytes, not characters).
        put: (k: string, v: string) => {
          if (Buffer.byteLength(v, 'utf8') > 100 * 1024) throw new Error('Argument too large');
          cache.set(k, v);
        },
        remove: (k: string) => void cache.delete(k),
      }),
    },
    Utilities: {
      newBlob: (text: string) => ({ getBytes: () => Buffer.from(text, 'utf8') }),
      formatDate: (d: Date, tz: string, fmt: string) => {
        if (tz !== 'Africa/Lagos' || fmt !== 'yyyy-MM-dd') throw new Error(`stub: ${tz} ${fmt}`);
        return lagosDay(d);
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (body: string) => ({
        body,
        mime: '',
        setMimeType(m: string) {
          this.mime = m;
          return this;
        },
      }),
    },
  });

  const code = readFileSync(new URL('../apps-script/Feed.gs', import.meta.url), 'utf8');
  const feed = runInContext(`${code}\n;({ doGet, readTab_, day_, FEED_TABS })`, context) as FeedApi;
  const routes = Object.keys(context).filter((k) => /^do[A-Z]/.test(k));
  return { feed, routes, opened, errors, cache };
}
