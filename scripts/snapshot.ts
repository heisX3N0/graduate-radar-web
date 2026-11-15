// npm run snapshot: refresh src/data/snapshot.json from the live feed.
//
// The snapshot is what the build uses when the feed is down or looks wrong, so this
// script refuses to replace it with something worse: it stops if the feed fails the
// schema, has no jobs or trainings, or has fewer than half of the current snapshot's
// count. Pass --force to accept a smaller feed on purpose (for example after a cleanup).
// FEED_URL comes from the environment or a local .env file.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { FeedSchema } from '../src/data/schema.ts';

const SNAPSHOT = new URL('../src/data/snapshot.json', import.meta.url);

function fail(message: string): never {
  console.error(`Snapshot not written: ${message}`);
  process.exit(1);
}

if (!process.env['FEED_URL'] && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env['FEED_URL'];
if (!url) fail('FEED_URL is not set (environment or .env).');

const force = process.argv.includes('--force');

const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000) }).catch(
  (e: Error) => fail(`fetch failed (${e.message})`),
);
if (!res.ok) fail(`feed answered HTTP ${res.status}`);
let body: unknown;
try {
  body = JSON.parse(await res.text());
} catch {
  fail('feed did not return JSON');
}
const parsed = FeedSchema.safeParse(body);
if (!parsed.success) {
  const first = parsed.error.issues[0];
  fail(`feed failed the schema at ${first?.path.join('.')}: ${first?.message}`);
}
const feed = parsed.data;

const current = FeedSchema.safeParse(JSON.parse(readFileSync(SNAPSHOT, 'utf8')));
for (const list of ['jobs', 'trainings'] as const) {
  const got = feed[list].length;
  const had = current.success ? current.data[list].length : 0;
  if (got === 0) fail(`feed has no ${list}.`);
  if (!force && got < had / 2)
    fail(
      `feed has ${got} ${list}, fewer than half the snapshot's ${had}. Use --force if this is expected.`,
    );
}

writeFileSync(SNAPSHOT, `${JSON.stringify(feed, null, 2)}\n`);
console.log(
  `Snapshot written: ${feed.jobs.length} jobs, ${feed.trainings.length} trainings (feed generated ${feed.generatedAt}).`,
);
