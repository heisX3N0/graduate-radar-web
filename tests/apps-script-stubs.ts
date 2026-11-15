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
  triggerRebuild: () => void;
  installRebuildTrigger: () => void;
}

export interface Trigger {
  handler: string;
  everyDays?: number;
  atHour?: number;
  nearMinute?: number;
}

export interface Options {
  /** Script Properties. */
  props?: Record<string, string>;
  /** HTTP status UrlFetchApp returns (default 200). */
  fetchStatus?: number;
  /** Triggers that already exist in the project. */
  triggers?: Trigger[];
}

export interface Harness {
  feed: FeedApi;
  /** Every UrlFetchApp call. */
  fetches: { url: string; method: string }[];
  /** The project's triggers after the script ran. */
  triggers: Trigger[];
  /** Web app entry points (doGet, doPost, ...) the script defines. */
  routes: string[];
  opened: string[];
  /** Every cell read: which tab, raw or display values, and how many cells. */
  reads: { tab: string; kind: 'raw' | 'display'; cells: number }[];
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

export function loadFeed(tabs: Record<string, Grid>, options: Options = {}): Harness {
  const fetches: Harness['fetches'] = [];
  const triggers: Trigger[] = [...(options.triggers ?? [])];
  const opened: string[] = [];
  const errors: string[] = [];
  const cache = new Map<string, string>();

  const reads: Harness['reads'] = [];

  const sheetFor = (name: string) => {
    opened.push(name);
    const grid = tabs[name];
    if (!grid) return null;
    // A range over grid rows [r0, r0 + nr) and columns [c0, c0 + nc), 0-based.
    const rangeOf = (r0: number, c0: number, nr: number, nc: number) => {
      const block = () => grid.slice(r0, r0 + nr).map((row) => row.slice(c0, c0 + nc));
      return {
        getValues: () => {
          reads.push({ tab: name, kind: 'raw', cells: nr * nc });
          return block().map((row) => [...row]);
        },
        getDisplayValues: () => {
          reads.push({ tab: name, kind: 'display', cells: nr * nc });
          return block().map((row) => row.map(display));
        },
      };
    };
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    return {
      getDataRange: () => rangeOf(0, 0, rows, cols),
      getLastRow: () => rows,
      // Apps Script getRange(row, column, numRows, numColumns) is 1-based.
      getRange: (row: number, column: number, numRows: number, numColumns: number) =>
        rangeOf(row - 1, column - 1, numRows, numColumns),
    };
  };

  const context = createContext({
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => options.props?.[k] ?? null,
      }),
    },
    UrlFetchApp: {
      fetch: (url: string, params: { method?: string } = {}) => {
        fetches.push({ url, method: params.method ?? 'get' });
        const status = options.fetchStatus ?? 200;
        return { getResponseCode: () => status, getContentText: () => `status ${status}` };
      },
    },
    ScriptApp: {
      getProjectTriggers: () =>
        triggers.map((t) => ({ getHandlerFunction: () => t.handler, _t: t })),
      deleteTrigger: (wrapped: { _t: Trigger }) => {
        const i = triggers.indexOf(wrapped._t);
        if (i !== -1) triggers.splice(i, 1);
      },
      newTrigger: (handler: string) => {
        const t: Trigger = { handler };
        const builder = {
          timeBased: () => builder,
          everyDays: (n: number) => ((t.everyDays = n), builder),
          atHour: (h: number) => ((t.atHour = h), builder),
          nearMinute: (m: number) => ((t.nearMinute = m), builder),
          create: () => {
            triggers.push(t);
            return t;
          },
        };
        return builder;
      },
    },
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
  const feed = runInContext(
    `${code}\n;({ doGet, readTab_, day_, FEED_TABS, triggerRebuild, installRebuildTrigger })`,
    context,
  ) as FeedApi;
  const routes = Object.keys(context).filter((k) => /^do[A-Z]/.test(k));
  return { feed, fetches, triggers, routes, opened, reads, errors, cache };
}
