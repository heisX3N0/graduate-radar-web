// Loads listings for the build (spec section 8, "Build resilience").
//
// Fetches FEED_URL once, checks it against the contract, and falls back to the
// committed snapshot (src/data/snapshot.json) when the feed is unreachable, has the
// wrong shape, or looks broken (see `thinReason`). One bad row never rejects the feed:
// it is dropped with a warning. Never returns an empty site: if the feed fails and the
// snapshot is empty too, the build stops.
import type { z } from 'astro/zod';
import { effectiveStatus, lagosToday } from '../lib/dates.ts';
import { assignSlugs } from '../lib/slug.ts';
import {
  FeedShapeSchema,
  JobSchema,
  TrainingSchema,
  isAllowedLink,
  type Feed,
  type Job,
  type Training,
} from './schema.ts';

export type FeedFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type JobListing = Job & { slug: string };
export type TrainingListing = Training & { slug: string };

export interface Listings {
  /** When the data was produced: the feed's time, or the snapshot's on fallback. */
  generatedAt: string;
  /** Where the data came from this build. */
  source: 'feed' | 'snapshot';
  jobs: JobListing[];
  trainings: TrainingListing[];
}

export interface LoadOptions {
  feedUrl: string | undefined;
  snapshot: Feed;
  fetchImpl?: FeedFetch;
  warn?: (message: string) => void;
  timeoutMs?: number;
  now?: Date;
}

/** Each list must have at least this share of the snapshot's still-open count. */
const MIN_SHARE_OF_SNAPSHOT = 0.5;
/** A snapshot older than this is too stale to judge the feed by count. */
const SNAPSHOT_MAX_AGE_DAYS = 14;

const LISTS = ['jobs', 'trainings'] as const;
type ListName = (typeof LISTS)[number];

class FeedProblem extends Error {}

/** Valid rows only: rows that fail the contract, have an unsafe Apply link or repeat a key are dropped. */
function cleanRows<T extends { key: string; applyLink: string }>(
  rows: readonly unknown[],
  schema: z.ZodType<T>,
  list: ListName,
  warn: (m: string) => void,
): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  rows.forEach((row, i) => {
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      warn(
        `Dropped ${list}[${i}]: failed the schema at ${issue?.path.join('.')}: ${issue?.message}.`,
      );
      return;
    }
    const item = parsed.data;
    if (!isAllowedLink(item.applyLink)) {
      warn(`Dropped ${list} "${item.key}": Apply link is not https, http or mailto.`);
      return;
    }
    if (seen.has(item.key)) {
      warn(`Dropped ${list} "${item.key}": duplicate key.`);
      return;
    }
    seen.add(item.key);
    kept.push(item);
  });
  return kept;
}

/** Turns any parsed JSON into a clean Feed, or throws if the top-level shape is wrong. */
export function cleanFeed(body: unknown, warn: (m: string) => void): Feed {
  const shape = FeedShapeSchema.safeParse(body);
  if (!shape.success) {
    const issue = shape.error.issues[0];
    throw new FeedProblem(
      `feed failed the schema at ${issue?.path.join('.') || '(top)'}: ${issue?.message}`,
    );
  }
  return {
    generatedAt: shape.data.generatedAt,
    jobs: cleanRows(shape.data.jobs, JobSchema, 'jobs', warn),
    trainings: cleanRows(shape.data.trainings, TrainingSchema, 'trainings', warn),
  };
}

/** Fetches and cleans the feed. Throws FeedProblem for anything the build should fall back on. */
export async function fetchFeed(
  url: string,
  fetchImpl: FeedFetch,
  timeoutMs: number,
  warn: (m: string) => void,
): Promise<Feed> {
  let res: Response;
  let text: string;
  try {
    res = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    text = await res.text();
  } catch (e) {
    throw new FeedProblem(`fetch failed (${(e as Error).message})`);
  }
  if (!res.ok) throw new FeedProblem(`feed answered HTTP ${res.status}`);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new FeedProblem(
      `feed did not return JSON (content-type ${res.headers.get('content-type')})`,
    );
  }
  return cleanFeed(body, warn);
}

function ageInDays(iso: string, now: Date): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / 864e5);
}

/**
 * Why the feed looks broken, or null if it is fine. A list with no rows is always broken.
 * Otherwise each list must have at least half as many rows as the snapshot has listings
 * still open today, unless the snapshot is older than SNAPSHOT_MAX_AGE_DAYS, when the
 * count is no longer a fair guide (a warning says so).
 */
export function thinReason(
  feed: Feed,
  snapshot: Feed,
  now: Date,
  warn: (m: string) => void,
): string | null {
  const today = lagosToday(now);
  const age = ageInDays(snapshot.generatedAt, now);
  const stale = age === null || age > SNAPSHOT_MAX_AGE_DAYS;
  for (const list of LISTS) {
    const got = feed[list].length;
    if (got === 0) return `feed has no ${list}`;
    if (stale) continue;
    const open = (snapshot[list] as { status: string; deadline: string }[]).filter(
      (i) => effectiveStatus(i, today) !== 'Closed',
    ).length;
    if (got < open * MIN_SHARE_OF_SNAPSHOT) {
      return `feed has ${got} ${list}, fewer than half the ${open} still open in the snapshot`;
    }
  }
  if (stale) {
    warn(
      `snapshot is ${age ?? 'an unknown number of'} days old, so the feed was not compared with it by count. Run npm run snapshot.`,
    );
  }
  return null;
}

function withSlugs<T extends { key: string }>(items: readonly T[]): (T & { slug: string })[] {
  const slugs = assignSlugs(items.map((i) => i.key));
  return items.map((i) => ({ ...i, slug: slugs.get(i.key)! }));
}

export async function loadListings(opts: LoadOptions): Promise<Listings> {
  const warn = opts.warn ?? ((m: string) => console.warn(`[feed] ${m}`));
  const now = opts.now ?? new Date();
  // The committed snapshot must be clean; anything wrong with it is a bug, so fail loudly.
  const snapshot = cleanFeed(opts.snapshot, (m) => {
    throw new Error(`snapshot.json: ${m}`);
  });

  let data: Feed = snapshot;
  let source: Listings['source'] = 'snapshot';
  if (!opts.feedUrl) {
    warn('FEED_URL is not set; building from the snapshot.');
  } else {
    try {
      const feed = await fetchFeed(
        opts.feedUrl,
        opts.fetchImpl ?? fetch,
        opts.timeoutMs ?? 30_000,
        warn,
      );
      const thin = thinReason(feed, snapshot, now, warn);
      if (thin) throw new FeedProblem(thin);
      data = feed;
      source = 'feed';
    } catch (e) {
      if (!(e instanceof FeedProblem)) throw e;
      warn(`${e.message}; building from the snapshot of ${snapshot.generatedAt}.`);
    }
  }

  if (data.jobs.length === 0 && data.trainings.length === 0) {
    throw new Error('Refusing to build an empty site: the feed failed and the snapshot is empty.');
  }

  return {
    generatedAt: data.generatedAt,
    source,
    jobs: withSlugs(data.jobs),
    trainings: withSlugs(data.trainings),
  };
}

/** Runs `fn` once and shares the result; a failure is not kept, so the next call tries again. */
export function onceUnlessFailed<T>(fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    pending ??= fn().catch((e: unknown) => {
      pending = undefined;
      throw e;
    });
    return pending;
  };
}

async function loadFresh(): Promise<Listings> {
  const { default: snapshot } = await import('./snapshot.json');
  return loadListings({
    feedUrl: import.meta.env?.['FEED_URL'] ?? process.env['FEED_URL'],
    snapshot: snapshot as Feed,
  });
}

const loadOnce = onceUnlessFailed(loadFresh);

/**
 * Listings for this build: fetched once and shared by every page. In `astro dev` every
 * call loads afresh, so local pages never show stale or failed data.
 */
export function getListings(): Promise<Listings> {
  return import.meta.env?.DEV ? loadFresh() : loadOnce();
}
