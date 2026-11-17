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
      '2:1 or above',
      '26 or under',
      '24-month programme',
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
      'Never pay to apply',
    ]) {
      expect(html, text).toContain(text);
    }
    expect(html).not.toContain('application/ld+json');
  });
});

// GR-016: a ruled facts table instead of badges, a boxed deadline and a stamp.
const factsIn = (html: string) => {
  const dl = /<dl class="facts-table"[^>]*>([\s\S]*?)<\/dl>/.exec(html)?.[1] ?? '';
  return [...dl.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd([^>]*)>([\s\S]*?)<\/dd>/g)].map((m) => ({
    label: m[1]!.trim(),
    attrs: m[2]!,
    value: m[3]!
      .replace(/<[^>]+>/g, '')
      .replace(/&#39;/g, "'")
      .trim(),
  }));
};

describe('detail page: what must not be there (GR-016)', () => {
  it('has no badge, stamp or deadline chip, and no "New this week"', async () => {
    const fresh = job({ firstSeen: TODAY, remote: true, deadline: '2026-11-17' });
    for (const html of [await renderJob(fresh), await renderJob(job({ status: 'Closed' }))]) {
      expect(html).not.toMatch(
        /class="badge|data-badge|class="stamp|data-deadline-chip|deadline--/,
      );
      expect(html).not.toMatch(/New this week|data-detail-badges/);
    }
  });

  it('leaves out the Checked row for a missing or impossible date (no "Invalid Date")', async () => {
    for (const verifiedOn of ['', '2026-02-30', 'last week']) {
      const html = await renderJob(job({ verifiedOn }));
      expect(factsIn(html).map((f) => f.label)).toEqual(['Closes', 'Where']);
      expect(html).not.toMatch(/Invalid Date|NaN/);
    }
  });

  it('a closed page says so in the facts, with no Apply, and lists similar open rows', async () => {
    const html = await renderJob(job({ deadline: '2026-11-10' }));
    expect(html).toContain('This opening has closed');
    expect(html).not.toMatch(/Apply on|Apply by/);
    expect(factsIn(html)[0]).toMatchObject({
      label: 'Closes',
      value: 'Closed, deadline was Tue 10 Nov',
    });
    expect(html).toMatch(/<article class="row[\s\S]*?href="\/jobs\/other-job"/);
  });

  it('the notices have no fill and no side stripe', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['SafetyNote', 'Banner']) {
      const src = readFileSync(new URL(`../src/components/${f}.astro`, import.meta.url), 'utf8');
      const css = /<style>([\s\S]*?)<\/style>/.exec(src)![1]!;
      expect(css, f).not.toMatch(/background|border-left|border-inline-start/);
    }
  });
});

describe('detail page facts table (GR-016)', () => {
  it('shows Closes, Where and Checked in that order, Remote in Where', async () => {
    const html = await renderJob(job({ remote: true }));
    expect(factsIn(html)).toEqual([
      expect.objectContaining({ label: 'Closes', value: 'Fri 27 Nov, 12 days left' }),
      expect.objectContaining({ label: 'Where', value: 'Lagos · Remote' }),
      expect.objectContaining({ label: 'Checked', value: "14 Nov, on the employer's own page" }),
    ]);
  });

  it('says Remote once when the location already says it', async () => {
    const html = await renderJob(job({ remote: true, location: 'Remote (Nigeria)' }));
    expect(factsIn(html)[1]).toMatchObject({ label: 'Where', value: 'Remote (Nigeria)' });
  });

  it('marks Closes red within 7 days and not after', async () => {
    const soon = factsIn(await renderJob(job({ deadline: '2026-11-20' })))[0]!;
    expect(soon.attrs).toMatch(/data-urgent/);
    const far = factsIn(await renderJob(job()))[0]!;
    expect(far.attrs).not.toMatch(/data-urgent/);
  });

  it('keeps Apply after the facts table and "Who can apply"', async () => {
    const html = await renderJob(job());
    const order = ['class="facts-table"', 'Who can apply', 'data-apply'].map((t) =>
      html.indexOf(t),
    );
    expect(order.every((p) => p >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('a training says Rolling, its format as Where, and the provider in Checked', async () => {
    const t = {
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
    const html = await c.renderToString(TrainingPage, {
      params: { slug: t.slug },
      props: { listing: t, similar: [], today: TODAY },
    });
    expect(factsIn(html)).toEqual([
      expect.objectContaining({ label: 'Closes', value: 'Rolling' }),
      expect.objectContaining({ label: 'Where', value: 'Online' }),
      expect.objectContaining({ label: 'Checked', value: "12 Nov, on the provider's own page" }),
    ]);
  });
});

describe('trust pages and 404', () => {
  it('about says we do not hire, has the privacy note, and never mentions Found via', async () => {
    const html = await c.renderToString(About);
    expect(html).toContain("We don't hire or process applications");
    expect(html).toMatch(/no cookies/i);
    expect(html).not.toMatch(/found via/i);
  });

  // GR-014: Checked names where we confirm an opening.
  it('about defines Checked without the old wording that left out where we confirm it', async () => {
    const text = (await c.renderToString(About)).replace(/\s+/g, ' ');
    expect(text).not.toContain('the last date we confirmed the opening was real and still open');
  });

  it("about defines Checked as confirmed on the employer's or provider's own page, once", async () => {
    const html = await c.renderToString(About);
    const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
    const want =
      "Checked is the last date we confirmed on the employer's or provider's own page that the opening was real and still open.";
    expect(html).toMatch(/<strong[^>]*>Checked<\/strong>/);
    expect(text.split(want)).toHaveLength(2);
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
  const site = new URL('https://graduateradar.versionphi.com');

  it('sitemap lists the main pages and open listings with absolute URLs, not /design or 404', async () => {
    const res = await sitemap({ site } as never);
    const xml = await res.text();
    expect(res.headers.get('content-type')).toMatch(/xml/);
    expect(xml).toContain('<loc>https://graduateradar.versionphi.com/</loc>');
    expect(xml).toContain('<loc>https://graduateradar.versionphi.com/trainings</loc>');
    expect(xml).toMatch(/<loc>https:\/\/graduateradar\.versionphi\.com\/jobs\/[a-z0-9-]+<\/loc>/);
    expect(xml).not.toMatch(/\/design|404/);
  });

  it('robots points at the sitemap', async () => {
    const txt = await (await robots({ site } as never)).text();
    expect(txt).toContain('Sitemap: https://graduateradar.versionphi.com/sitemap.xml');
    expect(txt).toMatch(/User-agent: \*/);
  });
});
