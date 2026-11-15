// Detail pages, trust pages, 404, sitemap and robots, as served.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { JobListing, TrainingListing } from '../src/data/feed.ts';
import NotFound from '../src/pages/404.astro';
import About from '../src/pages/about.astro';
import JobPage from '../src/pages/jobs/[slug].astro';
import StaySafe from '../src/pages/stay-safe.astro';
import TrainingPage from '../src/pages/trainings/[slug].astro';
import { GET as robots } from '../src/pages/robots.txt.ts';
import { GET as sitemap } from '../src/pages/sitemap.xml.ts';

const TODAY = '2026-11-15';
let c: AstroContainer;
beforeAll(async () => {
  vi.stubEnv('FEED_URL', '');
  c = await AstroContainer.create();
});

const job = (over: Partial<JobListing> = {}): JobListing => ({
  key: 'deloitte|cyber|2026',
  slug: 'deloitte-cyber-2026',
  firstSeen: '2026-11-14',
  organisation: 'Deloitte Nigeria',
  title: 'Deloitte Academy - Cyber Security Programme',
  type: 'Graduate Trainee',
  field: 'Tech',
  location: 'Lagos',
  remote: false,
  eligibility: '2:1 in Computer Science or related',
  minClass: '2:1',
  maxAge: '26',
  nysc: 'Required done',
  deadline: '2026-11-27',
  applyLink: 'https://jobs.example.com/1',
  verifiedOn: '2026-11-14',
  status: 'Open',
  notes: '24-month programme',
  ...over,
});
const other = job({
  key: 'other',
  slug: 'other-job',
  title: 'Other Tech Job',
  deadline: '2026-11-30',
});

const renderJob = (listing: JobListing, similar: JobListing[] = [other]) =>
  c.renderToString(JobPage, {
    params: { slug: listing.slug },
    props: { listing, similar, today: TODAY },
  });

describe('closed job page', () => {
  it.each([
    ['marked Closed in the sheet', job({ status: 'Closed' })],
    ['past its deadline', job({ deadline: '2026-11-10' })],
  ])('when %s: closed banner, no Apply, no JSON-LD, similar open listings', async (_n, listing) => {
    const html = await renderJob(listing);
    expect(html).toContain('This opening has closed');
    expect(html).not.toMatch(/Apply on|Apply by/);
    expect(html).not.toContain('application/ld+json');
    expect(html).toMatch(/href="\/jobs\/other-job"/);
  });
});

describe('closed pages and browser re-checks', () => {
  it('a closed listing page is noindex; an open one is not', async () => {
    expect(await renderJob(job({ status: 'Closed' }))).toMatch(
      /<meta name="robots" content="noindex"/,
    );
    expect(await renderJob(job())).not.toMatch(/<meta name="robots" content="noindex"/);
  });

  it('an open page carries a hidden closed banner and its dates, so the browser can close it later', async () => {
    const html = await renderJob(job());
    expect(html).toMatch(/data-closed-banner[^>]*hidden|hidden[^>]*data-closed-banner/);
    expect(html).toMatch(/data-detail[^>]*data-deadline="2026-11-27"/);
  });
});

describe('open job page', () => {
  it('has the facts, Apply, Never pay to apply, share, and JobPosting data', async () => {
    const html = await renderJob(job());
    for (const text of [
      'Deloitte Academy - Cyber Security Programme',
      'Deloitte Nigeria',
      'Closes 27 Nov',
      '2:1 or above',
      '26 or under',
      '24-month programme',
      'Checked 14 Nov',
      'Never pay to apply',
      'Share on WhatsApp',
    ]) {
      expect(html, text).toContain(text);
    }
    expect(html).toMatch(/href="https:\/\/jobs\.example\.com\/1"/);
    expect(html).toContain('"@type":"JobPosting"');
    expect(html).toMatch(/<div data-closed-banner[^>]*hidden/);
  });

  it('a mailto Apply link opens email', async () => {
    const html = await renderJob(job({ applyLink: 'mailto:careers@example.com' }));
    expect(html).toMatch(/href="mailto:careers@example\.com"[^>]*>\s*Apply by email/);
  });

  it('has a unique title, description, canonical and sharing tags with absolute URLs', async () => {
    const html = await renderJob(job());
    expect(html).toContain(
      '<title>Deloitte Academy - Cyber Security Programme · Deloitte Nigeria · Closes 27 Nov | Graduate Radar</title>',
    );
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/[^"]+\/jobs\/deloitte-cyber-2026"/);
    expect(html).toMatch(/<meta property="og:title" content="Deloitte Academy/);
    expect(html).toMatch(/<meta property="og:image" content="https:\/\/[^"]+\/og-default\.png"/);
    expect(html).toMatch(/<meta name="twitter:card" content="summary_large_image"/);
  });

  it('never puts listing text that could break out inside the JSON-LD block', async () => {
    const html = await renderJob(job({ notes: '</script><script>alert(1)</script>' }));
    const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]!;
    expect(block).not.toContain('</script>');
    expect(JSON.parse(block).description).toContain('alert(1)');
  });
});

describe('training page', () => {
  const t: TrainingListing = {
    key: 'google|ai|2026',
    slug: 'google-ai-2026',
    firstSeen: '2026-11-10',
    provider: 'Google',
    title: 'AI Essentials',
    track: 'AI',
    cost: 'Free',
    format: 'Online',
    duration: '4 weeks',
    eligibility: 'Anyone',
    jobPlacement: 'Yes',
    deadline: 'Rolling',
    applyLink: 'https://grow.example.com',
    verifiedOn: '2026-11-12',
    status: 'Open',
    notes: '',
  };

  it('shows provider, track, cost, format, duration, placement, and never JobPosting data', async () => {
    const html = await c.renderToString(TrainingPage, {
      params: { slug: t.slug },
      props: { listing: t, similar: [], today: TODAY },
    });
    for (const text of [
      'AI Essentials',
      'Google',
      'AI',
      'Free',
      'Online',
      '4 weeks',
      'Job placement',
      'Rolling deadline',
      'Never pay to apply',
    ]) {
      expect(html, text).toContain(text);
    }
    expect(html).not.toContain('application/ld+json');
  });
});

describe('trust pages and 404', () => {
  it('about says we do not hire, has the privacy note, and never mentions Found via', async () => {
    const html = await c.renderToString(About);
    expect(html).toContain("We don't hire or process applications");
    expect(html).toMatch(/no cookies/i);
    expect(html).not.toMatch(/found via/i);
  });

  it('stay safe covers fees, Gmail-only recruiters and what to do', async () => {
    const html = await c.renderToString(StaySafe);
    expect(html).toContain('Never pay to apply');
    expect(html).toMatch(/gmail/i);
    expect(html).toMatch(/If someone asks you for money/i);
  });

  it('404 offers a search that goes to the jobs list, and a link home', async () => {
    const html = await c.renderToString(NotFound);
    expect(html).toMatch(/<form[^>]+action="\/"[^>]*>/);
    expect(html).toMatch(/name="q"/);
    expect(html).toMatch(/<meta name="robots" content="noindex"/);
  });
});

describe('sitemap and robots', () => {
  const site = new URL('https://graduate-radar.pages.dev');

  it('sitemap lists the main pages and open listings with absolute URLs, not /design or 404', async () => {
    const res = await sitemap({ site } as never);
    const xml = await res.text();
    expect(res.headers.get('content-type')).toMatch(/xml/);
    expect(xml).toContain('<loc>https://graduate-radar.pages.dev/</loc>');
    expect(xml).toContain('<loc>https://graduate-radar.pages.dev/trainings</loc>');
    expect(xml).toMatch(/<loc>https:\/\/graduate-radar\.pages\.dev\/jobs\/[a-z0-9-]+<\/loc>/);
    expect(xml).not.toMatch(/\/design|404/);
  });

  it('robots points at the sitemap', async () => {
    const txt = await (await robots({ site } as never)).text();
    expect(txt).toContain('Sitemap: https://graduate-radar.pages.dev/sitemap.xml');
    expect(txt).toMatch(/User-agent: \*/);
  });
});
