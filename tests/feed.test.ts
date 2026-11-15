import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadFeed, type Cell, type Grid } from './apps-script-stubs.ts';

// "Today" for every test: 15 Nov 2026, 08:30 in Lagos.
const NOW = new Date('2026-11-15T07:30:00Z');
const daysAgo = (n: number) => {
  const d = new Date(NOW.getTime() - n * 864e5);
  return d.toISOString().slice(0, 10);
};
// A real date cell: midnight in Lagos on the given day.
const dateCell = (iso: string) => new Date(`${iso}T00:00:00+01:00`);

const JOB_HEADERS = [
  'First seen',
  'Organisation',
  'Role / Programme',
  'Type',
  'Field',
  'Location',
  'Remote',
  'Eligibility',
  'Min class',
  'Max age',
  'NYSC',
  'Deadline',
  'Apply link',
  'Verified on',
  'Status',
  'Notes',
  'Found via',
  'Key',
];

type Job = Partial<Record<(typeof JOB_HEADERS)[number], Cell>>;

function job(over: Job = {}): Job {
  return {
    'First seen': '2026-11-14',
    Organisation: 'Deloitte Nigeria',
    'Role / Programme': 'Deloitte Academy',
    Type: 'Graduate Trainee',
    Field: 'Tech',
    Location: 'Lagos',
    Remote: '',
    Eligibility: '2:1 in Computer Science',
    'Min class': '2:1',
    'Max age': '26',
    NYSC: 'Required done',
    Deadline: '2026-11-27',
    'Apply link': 'https://jobs.example.com/deloitte',
    'Verified on': '2026-11-14',
    Status: 'Open',
    Notes: '24-month programme',
    'Found via': 'https://aggregator.example.com/secret-source',
    Key: 'deloitte nigeria|deloitte academy|2026',
    ...over,
  };
}

function grid(headers: string[], rows: Job[]): Grid {
  return [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
}

const TRAINING_HEADERS = [
  'First seen',
  'Provider',
  'Programme',
  'Track',
  'Cost',
  'Format',
  'Duration',
  'Eligibility',
  'Job placement?',
  'Deadline',
  'Apply link',
  'Found via',
  'Verified on',
  'Status',
  'Notes',
  'Key',
];

const training = (over: Job = {}): Job => ({
  'First seen': '2026-11-10',
  Provider: 'Google',
  Programme: 'AI Essentials',
  Track: 'AI',
  Cost: 'Free',
  Format: 'Online',
  Duration: '4 weeks',
  Eligibility: 'Anyone',
  'Job placement?': 'Not stated',
  Deadline: 'Rolling',
  'Apply link': 'https://grow.example.com/ai',
  'Found via': 'https://aggregator.example.com/t',
  'Verified on': '2026-11-12',
  Status: 'Open',
  Notes: '',
  Key: 'google|ai essentials|2026',
  ...over,
});

function run(jobs: Job[], trainings: Job[] = [training()], headers = JOB_HEADERS) {
  const h = loadFeed({
    Jobs: grid(headers, jobs),
    'Trainings & Scholarships': grid(TRAINING_HEADERS, trainings),
    // Private tabs exist in the real sheet; the feed must never open them.
    'Postgrad Scholarships': grid(['Key'], [{ Key: 'private' }]),
    Review: grid(['Key'], [{ Key: 'private' }]),
  });
  const out = JSON.parse(h.feed.doGet().body) as {
    generatedAt: string;
    jobs: Record<string, unknown>[];
    trainings: Record<string, unknown>[];
  };
  return { ...h, out };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('feed: what must never leave the sheet', () => {
  it('never outputs Found via, or any column not on the allowlist, wherever it sits', () => {
    const headers = [...JOB_HEADERS];
    headers.splice(3, 0, 'Internal score'); // new column between allowed ones
    const { out } = run([job({ 'Internal score': '9/10' } as Job)], [training()], headers);
    const body = JSON.stringify(out);
    expect(body).not.toContain('aggregator.example.com');
    expect(body).not.toContain('9/10');
    for (const row of [...out.jobs, ...out.trainings]) {
      expect(Object.keys(row)).not.toContain('foundVia');
    }
  });

  it('only opens the two public tabs', () => {
    const { opened } = run([job()]);
    expect([...new Set(opened)].sort()).toEqual(['Jobs', 'Trainings & Scholarships']);
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', '', 'ftp://example.com', 'www.example.com'])(
    'drops a row whose Apply link is %j',
    (link) => {
      const { out } = run([job({ 'Apply link': link })]);
      expect(out.jobs).toEqual([]);
    },
  );

  it('drops a row with no Key', () => {
    expect(run([job({ Key: '' })]).out.jobs).toEqual([]);
  });

  it.each(['Draft', 'open', 'Rejected', ''])('drops a row whose Status is %j', (status) => {
    expect(run([job({ Status: status })]).out.jobs).toEqual([]);
  });

  it('drops a Closed row verified 61 days ago, keeps one verified 59 days ago', () => {
    const { out } = run([
      job({ Status: 'Closed', 'Verified on': daysAgo(61), Key: 'old|x|2026' }),
      job({ Status: 'Closed', 'Verified on': daysAgo(59), Key: 'recent|x|2026' }),
    ]);
    expect(out.jobs.map((j) => j['key'])).toEqual(['recent|x|2026']);
  });

  it('drops a Closed row whose Verified on cannot be read', () => {
    const { out } = run([job({ Status: 'Closed', 'Verified on': 'last week' })]);
    expect(out.jobs).toEqual([]);
  });

  it('returns no rows and logs an error when a required header is missing, other tab unaffected', () => {
    for (const missing of ['Key', 'Apply link', 'Status']) {
      const headers = JOB_HEADERS.filter((h) => h !== missing);
      const { out, errors } = run([job()], [training()], headers);
      expect(out.jobs).toEqual([]);
      expect(out.trainings).toHaveLength(1);
      expect(errors.join('\n')).toContain('Jobs');
    }
  });
});

describe('feed: review fixes (GR-002)', () => {
  it('exposes doGet as the only web app route (docs/public-routes.md)', () => {
    expect(run([job()]).routes).toEqual(['doGet']);
  });

  it('still answers when the body is under the character limit but over 100 KB in bytes', () => {
    // 40,000 naira signs: 40,000 characters, 120,000 bytes in UTF-8.
    const { out, cache } = run([job({ Notes: '₦'.repeat(40000) })]);
    expect(out.jobs).toHaveLength(1);
    expect(cache.has('feed')).toBe(false);
  });

  it.each(['2026-13-01', '2026-11-31', '2026-02-29', '2026-00-10'])(
    'sends an empty string for the impossible date %j',
    (bad) => {
      const { out } = run([job({ Deadline: bad })]);
      expect(out.jobs[0]?.['deadline']).toBe('');
    },
  );

  it('keeps only the first row of a duplicated Key and logs it', () => {
    const { out, errors } = run([
      job({ Notes: 'first' }),
      job({ Notes: 'second' }),
      job({ Key: 'other|x|2026' }),
    ]);
    expect(out.jobs.map((j) => j['notes'])).toEqual(['first', '24-month programme']);
    expect(errors.join('\n')).toContain('duplicate Key');
  });

  it('drops a Closed row whose Verified on is in the future', () => {
    const { out } = run([job({ Status: 'Closed', 'Verified on': '2027-11-14' })]);
    expect(out.jobs).toEqual([]);
  });

  it('refuses a tab where an allowlisted header appears twice, and logs it', () => {
    const headers = [...JOB_HEADERS, 'Status'];
    const { out, errors } = run([job()], [training()], headers);
    expect(out.jobs).toEqual([]);
    expect(out.trainings).toHaveLength(1);
    expect(errors.join('\n')).toContain('duplicate header');
  });
});

describe('feed: sheet reads', () => {
  it('reads every cell once for display, and raw values only for the date columns', () => {
    const rows = [job(), job({ Key: 'b|b|2026' }), job({ Key: 'c|c|2026' })];
    const { reads } = run(rows);
    const jobs = reads.filter((r) => r.tab === 'Jobs');
    const height = rows.length + 1; // header row included
    // One display read of the whole tab.
    expect(jobs.filter((r) => r.kind === 'display')).toEqual([
      { tab: 'Jobs', kind: 'display', cells: height * JOB_HEADERS.length },
    ]);
    // Raw reads: one single column per date header (First seen, Deadline, Verified on), no more.
    const raw = jobs.filter((r) => r.kind === 'raw');
    expect(raw).toHaveLength(3);
    expect(raw.every((r) => r.cells === height)).toBe(true);
  });

  it('does no raw reads at all for a tab it refuses', () => {
    const headers = JOB_HEADERS.filter((h) => h !== 'Key');
    const { reads } = run([job()], [training()], headers);
    expect(reads.filter((r) => r.tab === 'Jobs' && r.kind === 'raw')).toEqual([]);
  });
});

describe('feed: dates', () => {
  it('turns a real date cell shown as dd/MM/yyyy into yyyy-MM-dd', () => {
    const { out } = run([
      job({ Deadline: dateCell('2026-11-27'), 'First seen': dateCell('2026-11-14') }),
    ]);
    expect(out.jobs[0]).toMatchObject({ deadline: '2026-11-27', firstSeen: '2026-11-14' });
  });

  it('sends an empty string for a date typed as text in another format', () => {
    const { out } = run([job({ Deadline: '14/11/2026' })]);
    expect(out.jobs[0]?.['deadline']).toBe('');
  });

  it('keeps Rolling and Not stated deadlines', () => {
    const { out } = run([
      job({ Deadline: 'Rolling', Key: 'a|a|2026' }),
      job({ Deadline: 'Not stated', Key: 'b|b|2026' }),
    ]);
    expect(out.jobs.map((j) => j['deadline'])).toEqual(['Rolling', 'Not stated']);
  });

  it('uses a real Verified on date cell for the 60 day rule', () => {
    const { out } = run([job({ Status: 'Closed', 'Verified on': dateCell(daysAgo(10)) })]);
    expect(out.jobs).toHaveLength(1);
  });
});

describe('feed: layout changes', () => {
  it('gives identical rows when columns are moved', () => {
    const rows = [job(), job({ Key: 'b|b|2026', Remote: 'Yes', Status: 'Closing soon' })];
    const shuffled = [...JOB_HEADERS].reverse();
    const a = run(rows).out.jobs;
    const b = run(rows, [training()], shuffled).out.jobs;
    expect(b).toEqual(a);
  });
});

describe('feed: happy path', () => {
  it('outputs Open, Closing soon and mailto rows with the contract field names', () => {
    const { out } = run([
      job(),
      job({ Key: 'b|b|2026', Status: 'Closing soon', Remote: 'Yes' }),
      job({ Key: 'c|c|2026', 'Apply link': 'mailto:careers@example.com' }),
    ]);
    expect(out.jobs).toHaveLength(3);
    expect(out.jobs[0]).toEqual({
      key: 'deloitte nigeria|deloitte academy|2026',
      firstSeen: '2026-11-14',
      organisation: 'Deloitte Nigeria',
      title: 'Deloitte Academy',
      type: 'Graduate Trainee',
      field: 'Tech',
      location: 'Lagos',
      remote: false,
      eligibility: '2:1 in Computer Science',
      minClass: '2:1',
      maxAge: '26',
      nysc: 'Required done',
      deadline: '2026-11-27',
      applyLink: 'https://jobs.example.com/deloitte',
      verifiedOn: '2026-11-14',
      status: 'Open',
      notes: '24-month programme',
    });
    expect(out.jobs[1]?.['remote']).toBe(true);
    expect(out.trainings[0]).toMatchObject({
      provider: 'Google',
      track: 'AI',
      deadline: 'Rolling',
    });
    expect(out.generatedAt).toBe(NOW.toISOString());
  });

  it('serves the cached body for 10 minutes instead of reading the sheet again', () => {
    const h = run([job()]);
    const first = h.opened.length;
    h.feed.doGet();
    expect(h.opened.length).toBe(first);
    expect(h.cache.has('feed')).toBe(true);
  });
});
