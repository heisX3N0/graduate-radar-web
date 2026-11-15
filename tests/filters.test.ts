// Filter, search, sort and URL state for the list pages (spec 6.3). Pure functions,
// shared by the build and the browser.
import { describe, expect, it } from 'vitest';
import {
  costBucket,
  filterJobs,
  filterTrainings,
  formatBucket,
  jobFiltersToQuery,
  locationBuckets,
  makeJobSearch,
  MAX_QUERY_LENGTH,
  meetsClass,
  openOnly,
  parseJobFilters,
  parseTrainingFilters,
  trainingFiltersToQuery,
  type JobItem,
  type TrainingItem,
} from '../src/lib/filters.ts';

const TODAY = '2026-11-15';
const OPTIONS = {
  types: ['Graduate Trainee', 'Entry level', 'Internship'],
  fields: ['Tech', 'Finance', 'Any discipline', 'Engineering'],
};

const job = (key: string, over: Partial<JobItem> = {}): JobItem => ({
  key,
  title: `Role ${key}`,
  organisation: `Org ${key}`,
  type: 'Graduate Trainee',
  field: 'Tech',
  location: 'Lagos',
  remote: false,
  minClass: 'Not stated',
  eligibility: '',
  status: 'Open',
  deadline: '2026-12-20',
  firstSeen: '2026-11-01',
  ...over,
});

const training = (key: string, over: Partial<TrainingItem> = {}): TrainingItem => ({
  key,
  title: `Course ${key}`,
  provider: `Provider ${key}`,
  track: 'AI',
  cost: 'Free',
  format: 'Online',
  jobPlacement: 'Not stated',
  eligibility: '',
  status: 'Open',
  deadline: 'Rolling',
  firstSeen: '2026-11-01',
  ...over,
});

const params = (q: string) => new URLSearchParams(q);
const keys = (items: { key: string }[]) => items.map((i) => i.key);

describe('never listed: closed and past-deadline listings', () => {
  const items = [
    job('open'),
    job('past', { deadline: '2026-11-14' }),
    job('marked', { status: 'Closed' }),
  ];

  it('openOnly drops both', () => {
    expect(keys(openOnly(items, TODAY))).toEqual(['open']);
  });

  it('filterJobs drops both, whatever the filters', () => {
    const f = parseJobFilters(params(''), OPTIONS);
    expect(keys(filterJobs(items, f, TODAY))).toEqual(['open']);
    expect(keys(filterJobs(items, { ...f, q: 'Role' }, TODAY))).toEqual(['open']);
  });

  it('filterTrainings drops a past deadline too', () => {
    const t = [training('a'), training('b', { deadline: '2026-11-01' })];
    expect(
      keys(filterTrainings(t, parseTrainingFilters(params(''), { tracks: ['AI'] }), TODAY)),
    ).toEqual(['a']);
  });
});

describe('search index is built only when needed', () => {
  it('filterJobs with no search text never builds a Fuse index', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/lib/filters.ts', import.meta.url), 'utf8');
    // No eager default parameter that builds an index on every call.
    expect(src).not.toMatch(/search: Search = make/);
  });
});

describe('bad URLs load the unfiltered list', () => {
  it.each([
    'type=Astronaut',
    'field=%E0%A4%A',
    'loc=Mars',
    'class=first',
    'sort=random',
    'remote=yes&soon=maybe',
    'type=&field=&loc=',
    '%%%',
  ])('ignores %j', (q) => {
    expect(() => parseJobFilters(params(q), OPTIONS)).not.toThrow();
    const f = parseJobFilters(params(q), OPTIONS);
    expect({ ...f, q: '' }).toEqual(parseJobFilters(params(''), OPTIONS));
  });

  it('caps the search text and trims it', () => {
    const long = 'a'.repeat(500);
    expect(parseJobFilters(params(`q=${long}`), OPTIONS).q).toHaveLength(MAX_QUERY_LENGTH);
    expect(parseJobFilters(params('q=%20%20cyber%20%20'), OPTIONS).q).toBe('cyber');
  });
});

describe('Min class I have (owner decision 15 Nov 2026)', () => {
  it('2:2 hides 2:1-only listings and keeps 2:2, Any and Not stated', () => {
    expect(meetsClass('2:1', '2:2')).toBe(false);
    expect(meetsClass('2:2', '2:2')).toBe(true);
    expect(meetsClass('Any', '2:2')).toBe(true);
    expect(meetsClass('Not stated', '2:2')).toBe(true);
    expect(meetsClass('', '2:2')).toBe(true);
  });

  it('"any" means below a 2:2: only Any and Not stated', () => {
    expect(meetsClass('2:1', 'any')).toBe(false);
    expect(meetsClass('2:2', 'any')).toBe(false);
    expect(meetsClass('Any', 'any')).toBe(true);
    expect(meetsClass('Not stated', 'any')).toBe(true);
  });

  it('2:1 meets everything, and no choice filters nothing', () => {
    for (const req of ['2:1', '2:2', 'Any', 'Not stated']) {
      expect(meetsClass(req, '2:1')).toBe(true);
      expect(meetsClass(req, '')).toBe(true);
    }
  });

  it('applies through filterJobs', () => {
    const items = [job('a', { minClass: '2:1' }), job('b', { minClass: '2:2' }), job('c')];
    const f = parseJobFilters(params('class=22'), OPTIONS);
    expect(keys(filterJobs(items, f, TODAY))).toEqual(['b', 'c']);
  });
});

describe('search text stays on the page', () => {
  it('only q and known filter keys ever reach the URL', () => {
    const f = parseJobFilters(params('q=cyber&type=Internship&utm=x&email=a%40b.com'), OPTIONS);
    const query = jobFiltersToQuery(f);
    expect(new URLSearchParams(query).toString()).toBe('q=cyber&type=Internship');
  });

  it('defaults are left out of the URL', () => {
    expect(jobFiltersToQuery(parseJobFilters(params(''), OPTIONS))).toBe('');
    expect(jobFiltersToQuery(parseJobFilters(params('sort=soon'), OPTIONS))).toBe('');
  });

  it('the filter module never calls the network', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/lib/filters.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|navigator\./);
  });
});

describe('location, cost and format groups', () => {
  it.each([
    ['Lagos', false, ['Lagos']],
    ['Lagos / Abuja', false, ['Lagos', 'Abuja']],
    ['Berger, Lagos', false, ['Lagos']],
    ['Port Harcourt, Rivers', false, ['Port Harcourt']],
    ['Onitsha, Anambra (listed as Lagos)', false, ['Other Nigeria']],
    ['Remote (EMEA), listed as Lagos', true, ['Remote']],
    ['Remote (Abuja-based company)', true, ['Remote']],
    ['Akwa Ibom', false, ['Other Nigeria']],
    ['Nigeria (location not stated)', false, ['Other Nigeria']],
    ['Lagos', true, ['Lagos', 'Remote']],
  ])('%j (remote %s) is %j', (loc, remote, buckets) => {
    expect(locationBuckets(loc, remote)).toEqual(buckets);
  });

  it.each([
    ['Free', 'Free'],
    ['Free with monthly stipend', 'Free + stipend'],
    ['Fully funded scholarship', 'Scholarship'],
    ['NGN 15,000', 'Low-cost'],
  ])('cost %j is %j', (cost, bucket) => {
    expect(costBucket(cost)).toBe(bucket);
  });

  it.each([
    ['Online', 'Online'],
    ['Online (training centres available)', 'Online'],
    ['Hybrid', 'Hybrid'],
    ['In person (Lagos)', 'In person'],
    ['Physical, Yaba', 'In person'],
    ['Not stated (Enugu)', 'Not stated'],
  ])('format %j is %j', (format, bucket) => {
    expect(formatBucket(format)).toBe(bucket);
  });
});

describe('search finds what graduates type', () => {
  const items = [
    job('deloitte-cyber', {
      title: 'Deloitte Academy - Cyber Security Programme',
      organisation: 'Deloitte Nigeria',
      minClass: '2:1',
      eligibility: '2:1 in Computer Science',
    }),
    job('julius', {
      title: 'Electrical Engineer Trainee',
      organisation: 'Julius Berger Nigeria Plc',
      location: 'Abuja',
      field: 'Engineering',
    }),
    job('momo', {
      title: 'MoMo Graduate Development Programme',
      organisation: 'MoMo PSB',
      field: 'Any discipline',
    }),
  ];
  const search = makeJobSearch(items);
  const find = (q: string) =>
    keys(filterJobs(items, { ...parseJobFilters(params(''), OPTIONS), q }, TODAY, search));

  it.each([
    ['deloitte', 'deloitte-cyber'],
    ['Deloite', 'deloitte-cyber'],
    ['cyber', 'deloitte-cyber'],
    ['abuja', 'julius'],
    ['2:1', 'deloitte-cyber'],
    ['momo', 'momo'],
  ])('%j finds %j', (q, key) => {
    expect(find(q)).toContain(key);
  });

  it('a search with no match returns nothing', () => {
    expect(find('zzzzqqq')).toEqual([]);
  });
});

describe('filters combine, sort, and round-trip through the URL', () => {
  const items = [
    job('a', { type: 'Internship', remote: true, deadline: '2026-11-18', firstSeen: '2026-11-02' }),
    job('b', {
      type: 'Internship',
      remote: false,
      deadline: '2026-11-17',
      firstSeen: '2026-11-10',
    }),
    job('c', {
      type: 'Graduate Trainee',
      remote: true,
      deadline: 'Rolling',
      firstSeen: '2026-11-14',
    }),
    job('d', { type: 'Internship', remote: true, deadline: 'Not stated', firstSeen: '2026-11-12' }),
  ];

  it('type and remote together', () => {
    const f = parseJobFilters(params('type=Internship&remote=1'), OPTIONS);
    expect(keys(filterJobs(items, f, TODAY)).sort()).toEqual(['a', 'd']);
  });

  it('closing soon keeps only deadlines within 7 days', () => {
    const f = parseJobFilters(params('soon=1'), OPTIONS);
    expect(keys(filterJobs(items, f, TODAY))).toEqual(['b', 'a']);
  });

  it('sorts closing soonest first, then undated by newest; or newest first', () => {
    const f = parseJobFilters(params(''), OPTIONS);
    expect(keys(filterJobs(items, f, TODAY))).toEqual(['b', 'a', 'c', 'd']);
    expect(keys(filterJobs(items, { ...f, sort: 'new' }, TODAY))).toEqual(['c', 'd', 'b', 'a']);
  });

  it('a copied URL reproduces the view', () => {
    const f = parseJobFilters(
      params('q=role&type=Internship&loc=Lagos&remote=1&soon=1&class=21&sort=new'),
      OPTIONS,
    );
    const again = parseJobFilters(params(jobFiltersToQuery(f)), OPTIONS);
    expect(again).toEqual(f);
  });

  it('training filters round-trip too', () => {
    const t = parseTrainingFilters(
      params('q=ai&track=AI&cost=Free&format=Online&place=1&soon=1&sort=new'),
      { tracks: ['AI'] },
    );
    expect(parseTrainingFilters(params(trainingFiltersToQuery(t)), { tracks: ['AI'] })).toEqual(t);
  });

  it('filters 300 listings with a search quickly (measured, Node)', () => {
    const many = Array.from({ length: 300 }, (_, i) =>
      job(`k${i}`, { title: `Graduate trainee ${i} cyber`, organisation: `Company ${i % 40}` }),
    );
    const s = makeJobSearch(many);
    const f = { ...parseJobFilters(params('type=Graduate%20Trainee&soon=0'), OPTIONS), q: 'cyber' };
    const start = performance.now();
    for (let i = 0; i < 20; i++) filterJobs(many, f, TODAY, s);
    const perRun = (performance.now() - start) / 20;
    expect(perRun).toBeLessThan(50);
  });
});
