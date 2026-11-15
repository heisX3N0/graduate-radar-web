// Filters, search, sort and URL state for the list pages (spec 6.3). Pure functions,
// used at build time and in the browser. Keep imports to dates.ts and Fuse.js only, so
// the browser bundle stays small (no Zod, no Node APIs). Nothing here touches the
// network: search text only ever goes into the page's own URL (?q=).
import Fuse from 'fuse.js/basic';
import { effectiveStatus } from './dates.ts';

export const MAX_QUERY_LENGTH = 100;

export interface JobItem {
  key: string;
  title: string;
  organisation: string;
  type: string;
  field: string;
  location: string;
  remote: boolean;
  minClass: string;
  eligibility: string;
  status: string;
  deadline: string;
  firstSeen: string;
}

export interface TrainingItem {
  key: string;
  title: string;
  provider: string;
  track: string;
  cost: string;
  format: string;
  jobPlacement: string;
  eligibility: string;
  status: string;
  deadline: string;
  firstSeen: string;
}

type Dated = { key: string; status: string; deadline: string; firstSeen: string };

// ---------- groups ----------

export const LOCATIONS = ['Lagos', 'Abuja', 'Port Harcourt', 'Other Nigeria', 'Remote'] as const;
export type LocationBucket = (typeof LOCATIONS)[number];

/** Location groups for a listing. "(listed as Lagos)" notes are ignored. */
export function locationBuckets(location: string, remote: boolean): LocationBucket[] {
  const text = location
    .replace(/\(?\s*listed as [^)]*\)?/gi, '')
    .replace(/\(\s*[^)]*-based company\s*\)/gi, '');
  const out: LocationBucket[] = [];
  if (/\blagos\b/i.test(text)) out.push('Lagos');
  if (/\babuja\b/i.test(text)) out.push('Abuja');
  if (/\bport\s+harcourt\b/i.test(text)) out.push('Port Harcourt');
  const remoteOnly = remote && /^\s*remote\b/i.test(text);
  if (out.length === 0 && !remoteOnly) out.push('Other Nigeria');
  if (remote) out.push('Remote');
  return out;
}

export const COSTS = ['Free', 'Free + stipend', 'Scholarship', 'Low-cost'] as const;
export type CostBucket = (typeof COSTS)[number];

export function costBucket(cost: string): CostBucket {
  if (/stipend/i.test(cost)) return 'Free + stipend';
  if (/scholarship|funded/i.test(cost)) return 'Scholarship';
  if (/^\s*free\b/i.test(cost)) return 'Free';
  return 'Low-cost';
}

export const FORMATS = ['Online', 'In person', 'Hybrid', 'Not stated'] as const;
export type FormatBucket = (typeof FORMATS)[number];

export function formatBucket(format: string): FormatBucket {
  if (/hybrid|blended/i.test(format)) return 'Hybrid';
  if (/online|virtual|remote/i.test(format)) return 'Online';
  if (/in[\s-]?person|physical|on[\s-]?site|classroom/i.test(format)) return 'In person';
  return 'Not stated';
}

// ---------- degree class ----------

/** What the visitor has: '' means no class filter; 'any' means below a 2:2 (owner decision). */
export type ClassChoice = '' | '2:1' | '2:2' | 'any';

const RANK: Record<string, number> = { '2:1': 2, '2:2': 1 };

/** Does someone with `mine` meet a listing's minimum class? "Not stated" counts as met. */
export function meetsClass(required: string, mine: ClassChoice): boolean {
  if (mine === '') return true;
  const need = RANK[required] ?? 0;
  const have = mine === 'any' ? 0 : RANK[mine]!;
  return have >= need;
}

// ---------- filter state and the URL ----------

export type Sort = 'soon' | 'new';

export interface JobFilters {
  q: string;
  type: string;
  field: string;
  loc: '' | LocationBucket;
  remote: boolean;
  soon: boolean;
  cls: ClassChoice;
  sort: Sort;
}

export interface TrainingFilters {
  q: string;
  track: string;
  cost: '' | CostBucket;
  format: '' | FormatBucket;
  placement: boolean;
  soon: boolean;
  sort: Sort;
}

const CLASS_IN_URL: Record<string, ClassChoice> = { '21': '2:1', '22': '2:2', any: 'any' };
const CLASS_TO_URL: Record<string, string> = { '2:1': '21', '2:2': '22', any: 'any' };

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): '' | T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : '';
}

function query(params: URLSearchParams): string {
  return (params.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH);
}

const flag = (params: URLSearchParams, key: string) => params.get(key) === '1';
const sortOf = (params: URLSearchParams): Sort => (params.get('sort') === 'new' ? 'new' : 'soon');

/** Reads job filters from the URL. Anything unknown or malformed is ignored. */
export function parseJobFilters(
  params: URLSearchParams,
  options: { types: readonly string[]; fields: readonly string[] },
): JobFilters {
  return {
    q: query(params),
    type: oneOf(params.get('type'), options.types),
    field: oneOf(params.get('field'), options.fields),
    loc: oneOf(params.get('loc'), LOCATIONS),
    remote: flag(params, 'remote'),
    soon: flag(params, 'soon'),
    cls: CLASS_IN_URL[params.get('class') ?? ''] ?? '',
    sort: sortOf(params),
  };
}

export function parseTrainingFilters(
  params: URLSearchParams,
  options: { tracks: readonly string[] },
): TrainingFilters {
  return {
    q: query(params),
    track: oneOf(params.get('track'), options.tracks),
    cost: oneOf(params.get('cost'), COSTS),
    format: oneOf(params.get('format'), FORMATS),
    placement: flag(params, 'place'),
    soon: flag(params, 'soon'),
    sort: sortOf(params),
  };
}

function toQuery(pairs: [string, string | false][]): string {
  const p = new URLSearchParams();
  for (const [k, v] of pairs) if (v) p.set(k, v);
  const s = p.toString().replace(/\+/g, '%20');
  return s ? `?${s}` : '';
}

/** Only known keys with non-default values, so shared links stay short. */
export function jobFiltersToQuery(f: JobFilters): string {
  return toQuery([
    ['q', f.q],
    ['type', f.type],
    ['field', f.field],
    ['loc', f.loc],
    ['remote', f.remote && '1'],
    ['soon', f.soon && '1'],
    ['class', f.cls && CLASS_TO_URL[f.cls]!],
    ['sort', f.sort === 'new' && 'new'],
  ]);
}

export function trainingFiltersToQuery(f: TrainingFilters): string {
  return toQuery([
    ['q', f.q],
    ['track', f.track],
    ['cost', f.cost],
    ['format', f.format],
    ['place', f.placement && '1'],
    ['soon', f.soon && '1'],
    ['sort', f.sort === 'new' && 'new'],
  ]);
}

// ---------- open listings, sort ----------

/** Listings a list may show: never closed, never past their deadline (spec 6.4). */
export function openOnly<T extends Dated>(items: readonly T[], today: string): T[] {
  return items.filter((i) => effectiveStatus(i, today) !== 'Closed');
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Closing soonest: dated deadlines first, earliest first; then the rest, newest first. */
export function sortListings<T extends Dated>(items: readonly T[], sort: Sort): T[] {
  const byNew = (a: T, b: T) =>
    b.firstSeen.localeCompare(a.firstSeen) || a.key.localeCompare(b.key);
  if (sort === 'new') return [...items].sort(byNew);
  return [...items].sort((a, b) => {
    const da = isDay(a.deadline);
    const db = isDay(b.deadline);
    if (da && db) return a.deadline.localeCompare(b.deadline) || byNew(a, b);
    if (da !== db) return da ? -1 : 1;
    return byNew(a, b);
  });
}

// ---------- search ----------

export type Search = (q: string) => Set<string>;

const FUSE_OPTIONS = { threshold: 0.35, ignoreLocation: true, minMatchCharLength: 2 };

function makeSearch<T extends { key: string }>(items: readonly T[], keys: string[]): Search {
  const fuse = new Fuse(items as T[], { ...FUSE_OPTIONS, keys });
  return (q) => new Set(fuse.search(q).map((r) => r.item.key));
}

/** Fuzzy search over title, organisation, field, location, class and eligibility. */
export const makeJobSearch = (items: readonly JobItem[]) =>
  makeSearch(items, ['title', 'organisation', 'field', 'location', 'minClass', 'eligibility']);

export const makeTrainingSearch = (items: readonly TrainingItem[]) =>
  makeSearch(items, ['title', 'provider', 'track', 'format', 'eligibility']);

// ---------- apply ----------

export function filterJobs(
  items: readonly JobItem[],
  f: JobFilters,
  today: string,
  search?: Search,
): JobItem[] {
  const hits = f.q ? (search ?? makeJobSearch(items))(f.q) : null;
  const kept = openOnly(items, today).filter(
    (j) =>
      (!hits || hits.has(j.key)) &&
      (!f.type || j.type === f.type) &&
      (!f.field || j.field === f.field) &&
      (!f.loc || locationBuckets(j.location, j.remote).includes(f.loc)) &&
      (!f.remote || j.remote) &&
      (!f.soon || effectiveStatus(j, today) === 'Closing soon') &&
      meetsClass(j.minClass, f.cls),
  );
  return sortListings(kept, f.sort);
}

export function filterTrainings(
  items: readonly TrainingItem[],
  f: TrainingFilters,
  today: string,
  search?: Search,
): TrainingItem[] {
  const hits = f.q ? (search ?? makeTrainingSearch(items))(f.q) : null;
  const kept = openOnly(items, today).filter(
    (t) =>
      (!hits || hits.has(t.key)) &&
      (!f.track || t.track === f.track) &&
      (!f.cost || costBucket(t.cost) === f.cost) &&
      (!f.format || formatBucket(t.format) === f.format) &&
      (!f.placement || t.jobPlacement === 'Yes') &&
      (!f.soon || effectiveStatus(t, today) === 'Closing soon'),
  );
  return sortListings(kept, f.sort);
}
