// The desktop broadsheet frame (GR-017), as served: what is in the HTML before any CSS or
// JavaScript. Widths and positions are checked in a real browser by scripts/check-mobile.ts
// (360, 768, 1024 and 1280 px); these tests pin the structure that makes that layout work
// with each part in the page once.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { JobListing, TrainingListing } from '../src/data/feed.ts';
import snapshot from '../src/data/snapshot.json';
import About from '../src/pages/about.astro';
import JobsPage from '../src/pages/index.astro';
import JobPage from '../src/pages/jobs/[slug].astro';
import StaySafe from '../src/pages/stay-safe.astro';
import TrainingsPage from '../src/pages/trainings.astro';
import TrainingPage from '../src/pages/trainings/[slug].astro';
import { CHANNEL_URL } from '../src/lib/site.ts';

// A build a month after the snapshot was taken: the site is stuck on old data, so the
// date line must show the snapshot's day (Sunday 15 November 2026), never this one.
const BUILD = new Date('2026-12-20T08:00:00Z');
const TODAY = '2026-12-20';
const pages: Record<string, string> = {};

const jobs = snapshot.jobs as unknown as JobListing[];
const trainings = snapshot.trainings as unknown as TrainingListing[];
const job: JobListing = { ...jobs[0]!, slug: 'a-job', deadline: '2027-01-30', status: 'Open' };
const training: TrainingListing = {
  ...trainings[0]!,
  slug: 'a-training',
  deadline: 'Rolling',
  status: 'Open',
};

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(BUILD);
  vi.stubEnv('FEED_URL', '');
  const c = await AstroContainer.create();
  pages['jobs'] = await c.renderToString(JobsPage);
  pages['trainings'] = await c.renderToString(TrainingsPage);
  pages['job'] = await c.renderToString(JobPage, {
    params: { slug: job.slug },
    props: { listing: job, today: TODAY, similar: [{ ...job, slug: 'b', key: 'b' }] },
  });
  pages['training'] = await c.renderToString(TrainingPage, {
    params: { slug: training.slug },
    props: { listing: training, today: TODAY, similar: [{ ...training, slug: 'c', key: 'c' }] },
  });
  pages['about'] = await c.renderToString(About);
  pages['stay-safe'] = await c.renderToString(StaySafe);
});

afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const count = (html: string, re: RegExp) => [...html.matchAll(re)].length;
const nav = (html: string) => /<nav[^>]*aria-label="Main"[^>]*>([\s\S]*?)<\/nav>/.exec(html)![1]!;
const dateline = (html: string) => /<div[^>]*data-dateline[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1];
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.])/g, '$1')
    .trim();
// The rail runs from its own element to the next part after it: the footer on a list
// page, the way back on a detail page.
const rail = (html: string) =>
  /<[a-z]+[^>]*data-rail[^>]*>([\s\S]*?)(?:<footer|class="detail__back)/.exec(html);
const at = (html: string, needle: RegExp) => {
  const m = needle.exec(html);
  expect(m, `${needle} not found`).not.toBeNull();
  return m!.index;
};

describe('masthead: what must be refused', () => {
  it.each(['jobs', 'trainings', 'job', 'about'])('%s: no About link in the main nav', (p) => {
    expect(nav(pages[p]!)).not.toMatch(/href="\/about"/);
  });

  it.each(['jobs', 'trainings', 'job', 'training', 'about', 'stay-safe'])(
    '%s: the date line shows the data date, never the build date',
    (p) => {
      const line = text(dateline(pages[p]!) ?? '');
      expect(line).toContain('Updated Sunday 15 November 2026');
      expect(line).not.toMatch(/20 December|December 2026|Invalid/);
    },
  );
});

describe('each part is in the page once', () => {
  it.each(['jobs', 'trainings', 'job', 'training'])(
    '%s: exactly one "Never pay to apply" notice',
    (p) => {
      expect(count(pages[p]!, /class="safety[" ]/g)).toBe(1);
    },
  );

  it.each(['jobs', 'trainings'])('%s: one filters form, one list and one rail', (p) => {
    expect(count(pages[p]!, /data-filters[ >=]/g)).toBe(1);
    expect(count(pages[p]!, /data-items[ >=]/g)).toBe(1);
    expect(count(pages[p]!, /data-rail[ >=]/g)).toBe(1);
  });

  it.each(['jobs', 'trainings', 'job', 'training'])('%s: no positive tabindex', (p) => {
    expect(pages[p]).not.toMatch(/tabindex="[1-9]/);
  });

  it('the link to the other list appears once in the page body', () => {
    const main = (html: string) => /<main[\s\S]*<\/main>/.exec(html)![0];
    expect(count(main(pages['jobs']!), /href="\/trainings"/g)).toBe(1);
    expect(count(main(pages['trainings']!), /href="\/"/g)).toBe(1);
  });
});

describe('keyboard order follows the page', () => {
  it.each(['jobs', 'trainings'])('%s: masthead, filters, list, right rail, footer', (p) => {
    const html = pages[p]!;
    const order = [/<header class="masthead/, /data-filters/, /data-items/, /data-rail/, /<footer/];
    const idx = order.map((re) => at(html, re));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  it.each(['job', 'training'])('%s: facts, Apply and Share, then the rail', (p) => {
    const html = pages[p]!;
    const order = [
      /class="facts-table/,
      /data-apply/,
      /class="share/,
      /data-rail/,
      /class="safety/,
    ];
    const idx = order.map((re) => at(html, re));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
});

describe('happy path', () => {
  it.each(['jobs', 'trainings'])(
    '%s: the rail has the notice, three red flags, and the channel',
    (p) => {
      const r = rail(pages[p]!);
      expect(r, 'rail').not.toBeNull();
      const body = r![1]!;
      expect(body).toMatch(/class="safety/);
      const flags = /<ul[^>]*data-flags[^>]*>([\s\S]*?)<\/ul>/.exec(body)![1]!;
      expect(count(flags, /<li/g)).toBe(3);
      expect(count(flags, /href="\/stay-safe"/g)).toBe(3);
      expect(body).toContain(`href="${CHANNEL_URL}"`);
    },
  );

  it('the jobs date line has the count and where each was checked', () => {
    const line = text(dateline(pages['jobs']!)!);
    expect(line).toMatch(/Graduate jobs and free trainings for Nigerian graduates/);
    expect(line).toMatch(/\d+ openings, each checked on the employer's own page/);
    expect(dateline(pages['jobs']!)).toMatch(/data-total/);
  });

  it('the trainings date line counts trainings and names the provider', () => {
    expect(text(dateline(pages['trainings']!)!)).toMatch(
      /\d+ trainings?, each checked on the provider's own page/,
    );
  });

  it('a detail page has the notice and similar openings in the rail', () => {
    const r = rail(pages['job']!);
    expect(r, 'rail').not.toBeNull();
    expect(r![1]).toMatch(/class="safety/);
    expect(r![1]).toMatch(/class="similar/);
  });

  it('a detail page keeps Apply and Share together', () => {
    const actions = /class="detail__actions[^>]*>([\s\S]*?)data-rail/.exec(pages['job']!);
    expect(actions, 'actions').not.toBeNull();
    expect(actions![1]).toMatch(/data-apply/);
    expect(actions![1]).toMatch(/class="share/);
  });

  it('a job row carries its place as its own element, for the wide ledger column', () => {
    expect(pages['job']).toMatch(/class="row row--placed/);
    expect(pages['job']).toMatch(/class="row__place/);
    // Trainings have no place: their rows keep two columns.
    expect(pages['training']).not.toMatch(/row--placed|row__place/);
  });
});
