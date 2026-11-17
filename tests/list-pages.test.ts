// The list pages as served: what is in the HTML before any JavaScript runs.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import snapshot from '../src/data/snapshot.json';
import JobsPage from '../src/pages/index.astro';
import TrainingsPage from '../src/pages/trainings.astro';
import { lagosToday } from '../src/lib/dates.ts';
import { openOnly, sortListings } from '../src/lib/filters.ts';
import { groupJobs, groupTrainings } from '../src/lib/sections.ts';

let jobsHtml: string;
let trainingsHtml: string;
// 25 Nov 2026: several snapshot deadlines (18, 19, 24 Nov) have passed by then, so the
// 'never closed' checks have real closed listings to catch.
const NOW = new Date('2026-11-25T08:00:00Z');
let today = '';
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  today = lagosToday();
  // Empty FEED_URL in both process.env and import.meta.env (Vitest loads .env into the
  // latter), so the pages always build from the snapshot, never the live feed.
  vi.stubEnv('FEED_URL', '');
  fetchSpy = vi.spyOn(globalThis, 'fetch');
  const c = await AstroContainer.create();
  jobsHtml = await c.renderToString(JobsPage);
  trainingsHtml = await c.renderToString(TrainingsPage);
});

it('builds from the snapshot without touching the network, even when .env has FEED_URL', () => {
  expect(fetchSpy).not.toHaveBeenCalled();
});

afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  fetchSpy.mockRestore();
});

const keysIn = (html: string) =>
  [...html.matchAll(/<li data-key="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));
const dataIn = (html: string) => {
  const m = /<script type="application\/json" id="list-data">([\s\S]*?)<\/script>/.exec(html);
  return JSON.parse(m![1]!) as { items: { key: string }[] };
};

describe('jobs page HTML', () => {
  const openKeys = () => openOnly(snapshot.jobs, today).map((j) => j.key);

  it('has closed listings to test against on this date', () => {
    expect(snapshot.jobs.length - openKeys().length).toBeGreaterThan(0);
  });

  it('never contains a closed or past-deadline listing', () => {
    const shown = new Set(keysIn(jobsHtml));
    const closed = snapshot.jobs.filter((j) => !openKeys().includes(j.key)).map((j) => j.key);
    for (const k of closed) expect(shown.has(k)).toBe(false);
  });

  it('renders every open listing without JavaScript', () => {
    expect(keysIn(jobsHtml).sort()).toEqual(openKeys().sort());
    expect(jobsHtml.match(/<article class="row/g)?.length ?? 0).toBe(openKeys().length);
  });

  it('gives the browser script exactly the listings on the page, without Apply links', () => {
    const data = dataIn(jobsHtml);
    expect(data.items.map((i) => i.key).sort()).toEqual(openKeys().sort());
    expect(JSON.stringify(data)).not.toMatch(/applyLink|https?:\/\//);
  });

  it('has no Apply buttons on the list', () => {
    expect(jobsHtml).not.toMatch(/Apply on|Apply by/);
  });

  it('labels every filter and offers "Third class or pass"', () => {
    for (const id of ['q', 'type', 'field', 'loc', 'class', 'sort']) {
      expect(jobsHtml).toMatch(new RegExp(`<label[^>]+for="${id}"`));
    }
    expect(jobsHtml).toContain('Third class or pass');
  });
});

describe('trainings page HTML', () => {
  it('renders every open training without JavaScript, and nothing closed', () => {
    const open = openOnly(snapshot.trainings, today)
      .map((t) => t.key)
      .sort();
    expect(keysIn(trainingsHtml).sort()).toEqual(open);
  });

  it('links rows to /trainings/<slug>', () => {
    expect(trainingsHtml).toMatch(/href="\/trainings\/[a-z0-9-]+"/);
  });
});

// GR-015: ledger rows grouped into sections. Negative cases first.
const sectionsIn = (html: string) =>
  [...html.matchAll(/<section[^>]*data-section="([^"]*)"[^>]*>([\s\S]*?)<\/section>/g)].map(
    (m) => ({
      id: m[1]!,
      hidden: /^<section[^>]*\shidden/.test(m[0]),
      count: /data-section-count[^>]*>\s*(\d+)/.exec(m[2]!)?.[1],
      keys: keysIn(m[2]!),
    }),
  );

describe('list pages: what must not be there (GR-015)', () => {
  it('no list row has a badge, a Checked stamp, a boxed deadline or "New this week"', () => {
    for (const html of [jobsHtml, trainingsHtml]) {
      expect(html).not.toMatch(/class="badge|data-badge|class="stamp|data-deadline-chip/);
      expect(html).not.toMatch(/New this week|Checked \d/);
    }
  });

  it('has no "Closing this week" strip and no "Closing soon" filter', () => {
    for (const html of [jobsHtml, trainingsHtml]) {
      expect(html).not.toMatch(/data-closing-soon|Closing this week/);
      expect(html).not.toMatch(/data-filter="soon"|name="soon"/);
      expect(html).not.toMatch(/>\s*Closing soon\s*</);
    }
  });

  it('has exactly one <h1> on each list page', () => {
    expect(jobsHtml.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(trainingsHtml.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it('holds every open listing exactly once without JavaScript', () => {
    const jobs = keysIn(jobsHtml);
    expect(new Set(jobs).size).toBe(jobs.length);
    const trainings = keysIn(trainingsHtml);
    expect(new Set(trainings).size).toBe(trainings.length);
    expect(trainings.sort()).toEqual(
      openOnly(snapshot.trainings, today)
        .map((t) => t.key)
        .sort(),
    );
  });

  it('hides each empty job section', () => {
    for (const s of sectionsIn(jobsHtml)) expect(s.hidden).toBe(s.keys.length === 0);
  });
});

describe('list pages: sections and heading (GR-015)', () => {
  it('jobs: four sections in deadline order, each holding the right rows and count', () => {
    const want = groupJobs(sortListings(openOnly(snapshot.jobs, today), 'soon'), today);
    const got = sectionsIn(jobsHtml);
    expect(got.map((s) => s.id)).toEqual(['today', 'week', 'later', 'open']);
    expect(got.map((s) => s.keys)).toEqual(want.map((s) => s.keys));
    expect(got.map((s) => s.count)).toEqual(want.map((s) => String(s.keys.length)));
  });

  it('jobs: red (urgent) only on the first two section headers', () => {
    const urgent = [...jobsHtml.matchAll(/<section[^>]*data-section="([^"]*)"[^>]*>/g)]
      .filter((m) => /data-urgent/.test(m[0]))
      .map((m) => m[1]);
    expect(urgent).toEqual(['today', 'week']);
  });

  it('trainings: one section per track, largest first, "Other" last', () => {
    const want = groupTrainings(sortListings(openOnly(snapshot.trainings, today), 'soon'), today);
    const got = sectionsIn(trainingsHtml);
    expect(got.map((s) => s.id)).toEqual(want.map((s) => s.id));
    expect(got.map((s) => s.keys)).toEqual(want.map((s) => s.keys));
  });

  it('opens with a short heading and one plain line with the count and the data date', () => {
    const open = openOnly(snapshot.jobs, today).length;
    const text = (html: string) => html.replace(/<[^>]+>/g, '');
    expect(jobsHtml).toMatch(/<h1[^>]*>\s*Graduate jobs\s*<\/h1>/);
    expect(text(jobsHtml)).toMatch(
      new RegExp(
        `${open} openings, each checked on the employer's own page\\. Updated \\d+ \\w{3}\\.`,
      ),
    );
    // The count sits in its own element so the list script can bring it up to today.
    expect(jobsHtml).toMatch(new RegExp(`data-total[^>]*>${open} openings<`));
    expect(trainingsHtml).toMatch(/<h1[^>]*>\s*Free tech trainings\s*<\/h1>/);
    expect(text(trainingsHtml)).toMatch(
      /\d+ trainings?, each checked on the provider's own page\./,
    );
  });

  it('puts a turning marker on the Filters toggle', () => {
    expect(jobsHtml).toMatch(/<summary[^>]*>[\s\S]*?class="[^"]*lists__marker/);
  });
});
