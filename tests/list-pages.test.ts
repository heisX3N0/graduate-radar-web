// The list pages as served: what is in the HTML before any JavaScript runs.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import snapshot from '../src/data/snapshot.json';
import JobsPage from '../src/pages/index.astro';
import TrainingsPage from '../src/pages/trainings.astro';
import { lagosToday } from '../src/lib/dates.ts';
import { openOnly } from '../src/lib/filters.ts';

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
    expect(jobsHtml.match(/<article class="card/g)?.length ?? 0).toBe(openKeys().length);
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

  it('links cards to /trainings/<slug>', () => {
    expect(trainingsHtml).toMatch(/href="\/trainings\/[a-z0-9-]+"/);
  });
});
