import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadListings, type FeedFetch } from '../src/data/feed.ts';
import { FeedSchema, type Feed } from '../src/data/schema.ts';

const job = (n: number, over: Record<string, unknown> = {}) => ({
  key: `org ${n}|role ${n}|2026`,
  firstSeen: '2026-11-14',
  organisation: `Org ${n}`,
  title: `Role ${n}`,
  type: 'Graduate Trainee',
  field: 'Tech',
  location: 'Lagos',
  remote: false,
  eligibility: '2:1',
  minClass: '2:1',
  maxAge: '26',
  nysc: 'Required done',
  deadline: '2026-11-27',
  applyLink: `https://jobs.example.com/${n}`,
  verifiedOn: '2026-11-14',
  status: 'Open',
  notes: '',
  ...over,
});

const training = (n: number, over: Record<string, unknown> = {}) => ({
  key: `provider ${n}|course ${n}|2026`,
  firstSeen: '2026-11-10',
  provider: `Provider ${n}`,
  title: `Course ${n}`,
  track: 'AI',
  cost: 'Free',
  format: 'Online',
  duration: '4 weeks',
  eligibility: 'Anyone',
  jobPlacement: 'Not stated',
  deadline: 'Rolling',
  applyLink: `https://learn.example.com/${n}`,
  verifiedOn: '2026-11-12',
  status: 'Open',
  notes: '',
  ...over,
});

const feedOf = (jobs: number, trainings: number) => ({
  generatedAt: '2026-11-15T07:30:00.000Z',
  jobs: Array.from({ length: jobs }, (_, i) => job(i)),
  trainings: Array.from({ length: trainings }, (_, i) => training(i)),
});

// The committed-style snapshot the build falls back to: 10 jobs, 4 trainings.
const SNAPSHOT = feedOf(10, 4) as unknown as Feed;

function respond(body: string, status = 200, type = 'application/json'): FeedFetch {
  return async () => new Response(body, { status, headers: { 'content-type': type } });
}

async function load(fetchImpl: FeedFetch, snapshot: Feed = SNAPSHOT, feedUrl = 'https://x/exec') {
  const warnings: string[] = [];
  const result = await loadListings({
    feedUrl,
    fetchImpl,
    snapshot,
    warn: (m) => warnings.push(m),
  });
  return { result, warnings };
}

describe('loadListings: falls back to the snapshot', () => {
  it.each([
    [
      'the fetch throws',
      (async () => {
        throw new Error('network down');
      }) as FeedFetch,
    ],
    ['the feed answers 500', respond('oops', 500)],
    ['the feed answers HTML', respond('<html>Sign in</html>', 200, 'text/html')],
    ['the body is not JSON', respond('{not json')],
  ])('when %s, with one warning', async (_name, fetchImpl) => {
    const { result, warnings } = await load(fetchImpl);
    expect(result.source).toBe('snapshot');
    expect(result.jobs).toHaveLength(10);
    expect(warnings).toHaveLength(1);
  });

  it('when FEED_URL is not set', async () => {
    const { result, warnings } = await load(respond('{}'), SNAPSHOT, '');
    expect(result.source).toBe('snapshot');
    expect(warnings[0]).toContain('FEED_URL');
  });

  it.each([
    [
      'a job has no key',
      { ...feedOf(10, 4), jobs: [job(1, { key: undefined }), ...feedOf(9, 0).jobs] },
    ],
    [
      'remote is a string',
      { ...feedOf(10, 4), jobs: [job(1, { remote: 'Yes' }), ...feedOf(9, 0).jobs] },
    ],
    [
      'a status is unknown',
      { ...feedOf(10, 4), jobs: [job(1, { status: 'Draft' }), ...feedOf(9, 0).jobs] },
    ],
    ['trainings is missing', { generatedAt: 'x', jobs: feedOf(10, 0).jobs }],
  ])('when the feed fails the schema (%s)', async (_name, body) => {
    const { result, warnings } = await load(respond(JSON.stringify(body)));
    expect(result.source).toBe('snapshot');
    expect(warnings[0]).toMatch(/schema/i);
  });

  it.each([
    ['0 jobs', feedOf(0, 4)],
    ['4 jobs against 10 in the snapshot', feedOf(4, 4)],
    ['0 trainings', feedOf(10, 0)],
    ['1 training against 4 in the snapshot', feedOf(10, 1)],
  ])('when the feed has %s', async (_name, body) => {
    const { result, warnings } = await load(respond(JSON.stringify(body)));
    expect(result.source).toBe('snapshot');
    expect(warnings[0]).toMatch(/fewer|no /i);
  });

  it('fails the build when both the feed and the snapshot are empty', async () => {
    await expect(load(respond('oops', 500), feedOf(0, 0) as unknown as Feed)).rejects.toThrow(
      /empty/i,
    );
  });
});

describe('loadListings: what never reaches a page', () => {
  it('drops a listing with a javascript: Apply link even if the feed lets it through', async () => {
    const body = feedOf(10, 4);
    body.jobs[0] = job(0, { applyLink: 'javascript:alert(1)' });
    const { result, warnings } = await load(respond(JSON.stringify(body)));
    expect(result.source).toBe('feed');
    expect(result.jobs.map((j) => j.key)).not.toContain(job(0).key);
    expect(result.jobs).toHaveLength(9);
    expect(warnings.join('\n')).toContain('Apply link');
  });

  it('strips fields that are not in the contract, such as foundVia', async () => {
    const body = feedOf(10, 4);
    body.jobs[0] = job(0, { foundVia: 'https://aggregator.example.com/x' });
    const { result } = await load(respond(JSON.stringify(body)));
    expect(JSON.stringify(result)).not.toContain('aggregator.example.com');
  });

  it('keeps only the first of two listings with the same key', async () => {
    const body = feedOf(10, 4);
    body.jobs.push(job(0, { title: 'Duplicate' }));
    const { result, warnings } = await load(respond(JSON.stringify(body)));
    expect(result.jobs.filter((j) => j.key === job(0).key)).toHaveLength(1);
    expect(result.jobs.find((j) => j.key === job(0).key)?.title).toBe('Role 0');
    expect(warnings.join('\n')).toContain('duplicate');
  });
});

describe('loadListings: happy path', () => {
  it('uses the feed and gives every listing a stable slug', async () => {
    const { result, warnings } = await load(respond(JSON.stringify(feedOf(10, 4))));
    expect(result.source).toBe('feed');
    expect(warnings).toEqual([]);
    expect(result.jobs[0]?.slug).toBe('org-0-role-0-2026');
    expect(result.trainings[0]?.slug).toBe('provider-0-course-0-2026');
    expect(result.generatedAt).toBe('2026-11-15T07:30:00.000Z');
  });

  it('accepts a feed with exactly half the snapshot count', async () => {
    const { result } = await load(respond(JSON.stringify(feedOf(5, 2))));
    expect(result.source).toBe('feed');
  });
});

describe('committed snapshot', () => {
  const raw = readFileSync(new URL('../src/data/snapshot.json', import.meta.url), 'utf8');

  it('passes the schema, has listings, and holds no Found via data', () => {
    const snap = FeedSchema.parse(JSON.parse(raw));
    expect(snap.jobs.length).toBeGreaterThan(0);
    expect(snap.trainings.length).toBeGreaterThan(0);
    expect(raw).not.toMatch(/found ?via/i);
  });
});
