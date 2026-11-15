// npm run snapshot: refresh src/data/snapshot.json from the live feed.
//
// The snapshot is what the build uses when the feed is down or looks wrong, so this
// script uses the build's own rules (src/data/feed.ts) and refuses to replace it with
// something worse: it stops if the feed is unreachable or has the wrong shape, has no
// jobs or trainings, or has fewer than half the listings still open in the current
// snapshot. Pass --force to accept a smaller feed on purpose (never an empty list).
// FEED_URL comes from the environment or a local .env file.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cleanFeed, fetchFeed, thinReason } from '../src/data/feed.ts';
import type { Feed } from '../src/data/schema.ts';

const SNAPSHOT = new URL('../src/data/snapshot.json', import.meta.url);
const warn = (m: string) => console.warn(`[snapshot] ${m}`);

class Stop extends Error {}

// Sets the exit code and stops. Not process.exit(): on Windows that can crash Node while
// the fetch timeout timer is still open.
function fail(message: string): never {
  console.error(`Snapshot not written: ${message}`);
  process.exitCode = 1;
  throw new Stop(message);
}

async function main(): Promise<void> {
  if (!process.env['FEED_URL'] && existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env['FEED_URL'];
  if (!url) fail('FEED_URL is not set (environment or .env).');
  const force = process.argv.includes('--force');

  let feed: Feed;
  try {
    feed = await fetchFeed(url, fetch, 30_000, warn);
  } catch (e) {
    fail((e as Error).message);
  }

  let current: Feed = { generatedAt: '', jobs: [], trainings: [] };
  try {
    current = cleanFeed(JSON.parse(readFileSync(SNAPSHOT, 'utf8')), warn);
  } catch (e) {
    warn(`current snapshot could not be read (${(e as Error).message}); not comparing with it.`);
  }

  for (const list of ['jobs', 'trainings'] as const) {
    if (feed[list].length === 0) fail(`feed has no ${list}.`);
  }
  const thin = thinReason(feed, current, new Date(), warn);
  if (thin && !force) fail(`${thin}. Use --force if this is expected.`);

  writeFileSync(SNAPSHOT, `${JSON.stringify(feed, null, 2)}\n`);
  console.log(
    `Snapshot written: ${feed.jobs.length} jobs, ${feed.trainings.length} trainings (feed generated ${feed.generatedAt}).`,
  );
}

await main().catch((e: unknown) => {
  if (!(e instanceof Stop)) throw e;
});
