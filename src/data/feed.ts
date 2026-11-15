// Loads listings for the build (spec section 8, "Build resilience").
//
// Fetches FEED_URL once, checks it against the contract, and falls back to the
// committed snapshot (src/data/snapshot.json) when the feed is unreachable, not valid,
// or suspiciously thin. Never returns an empty site: if both are empty, the build fails.
import { assignSlugs } from '../lib/slug.ts';
import { FeedSchema, isAllowedLink, type Feed, type Job, type Training } from './schema.ts';

export type FeedFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type JobListing = Job & { slug: string };
export type TrainingListing = Training & { slug: string };

export interface Listings {
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
}

/** The feed is used only if each list has at least this share of the snapshot's count. */
const MIN_SHARE_OF_SNAPSHOT = 0.5;

class FeedProblem extends Error {}

async function fetchFeed(url: string, fetchImpl: FeedFetch, timeoutMs: number): Promise<Feed> {
  let res: Response;
  try {
    res = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new FeedProblem(`fetch failed (${(e as Error).message})`);
  }
  if (!res.ok) throw new FeedProblem(`feed answered HTTP ${res.status}`);
  let body: unknown;
  try {
    body = JSON.parse(await res.text());
  } catch {
    throw new FeedProblem(
      `feed did not return JSON (content-type ${res.headers.get('content-type')})`,
    );
  }
  const parsed = FeedSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new FeedProblem(`feed failed the schema at ${first?.path.join('.')}: ${first?.message}`);
  }
  return parsed.data;
}

function tooThin(feed: Feed, snapshot: Feed): string | null {
  for (const list of ['jobs', 'trainings'] as const) {
    const got = feed[list].length;
    const had = snapshot[list].length;
    if (got === 0) return `feed has no ${list}`;
    if (got < had * MIN_SHARE_OF_SNAPSHOT)
      return `feed has ${got} ${list}, fewer than half the snapshot's ${had}`;
  }
  return null;
}

/** Drops unsafe links and repeated keys, then adds slugs. */
function prepare<T extends { key: string; applyLink: string }>(
  items: readonly T[],
  list: string,
  warn: (m: string) => void,
): (T & { slug: string })[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const item of items) {
    if (!isAllowedLink(item.applyLink)) {
      warn(`Dropped ${list} "${item.key}": Apply link is not https, http or mailto.`);
      continue;
    }
    if (seen.has(item.key)) {
      warn(`Dropped ${list} "${item.key}": duplicate key.`);
      continue;
    }
    seen.add(item.key);
    kept.push(item);
  }
  const slugs = assignSlugs(kept.map((i) => i.key));
  return kept.map((i) => ({ ...i, slug: slugs.get(i.key)! }));
}

export async function loadListings(opts: LoadOptions): Promise<Listings> {
  const warn = opts.warn ?? ((m: string) => console.warn(`[feed] ${m}`));
  const fetchImpl = opts.fetchImpl ?? fetch;
  const snapshot = FeedSchema.parse(opts.snapshot);

  let data: Feed = snapshot;
  let source: Listings['source'] = 'snapshot';
  if (!opts.feedUrl) {
    warn('FEED_URL is not set; building from the snapshot.');
  } else {
    try {
      const feed = await fetchFeed(opts.feedUrl, fetchImpl, opts.timeoutMs ?? 30_000);
      const thin = tooThin(feed, snapshot);
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
    jobs: prepare(data.jobs, 'job', warn),
    trainings: prepare(data.trainings, 'training', warn),
  };
}

let cached: Promise<Listings> | undefined;

/** Listings for this build. Fetched once per build, shared by every page. */
export function getListings(): Promise<Listings> {
  cached ??= (async () => {
    const { default: snapshot } = await import('./snapshot.json');
    return loadListings({
      feedUrl: import.meta.env?.['FEED_URL'] ?? process.env['FEED_URL'],
      snapshot: snapshot as Feed,
    });
  })();
  return cached;
}
