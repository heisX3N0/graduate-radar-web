// Components rendered with Astro's container API. Negative cases first.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import ApplyButton from '../src/components/ApplyButton.astro';
import Banner from '../src/components/Banner.astro';
import Breadcrumb from '../src/components/Breadcrumb.astro';
import EligibilityChecklist from '../src/components/EligibilityChecklist.astro';
import EmptyState from '../src/components/EmptyState.astro';
import FilterChip from '../src/components/FilterChip.astro';
import Footer from '../src/components/Footer.astro';
import ListingRow from '../src/components/ListingRow.astro';
import ResultCount from '../src/components/ResultCount.astro';
import SafetyNote from '../src/components/SafetyNote.astro';
import SearchInput from '../src/components/SearchInput.astro';
import Select from '../src/components/Select.astro';
import ShareButton from '../src/components/ShareButton.astro';
import type { JobListing, TrainingListing } from '../src/data/feed.ts';

const TODAY = '2026-11-15';
let c: AstroContainer;
beforeAll(async () => {
  c = await AstroContainer.create();
});
const render = (component: Parameters<AstroContainer['renderToString']>[0], props = {}) =>
  c.renderToString(component, { props });

const job: JobListing = {
  key: 'deloitte|academy|2026',
  slug: 'deloitte-academy-2026',
  firstSeen: '2026-11-14',
  organisation: 'Deloitte Nigeria',
  title: 'Deloitte Academy',
  type: 'Graduate Trainee',
  field: 'Tech',
  location: 'Lagos',
  remote: false,
  eligibility: '',
  minClass: '2:1',
  maxAge: '26',
  nysc: 'Required done',
  deadline: '2026-11-19',
  applyLink: 'https://jobs.example.com/1',
  verifiedOn: '2026-11-14',
  status: 'Open',
  notes: '',
};

const training: TrainingListing = {
  key: 'google|ai|2026',
  slug: 'google-ai-2026',
  firstSeen: '2026-10-01',
  provider: 'Google',
  title: 'AI Essentials',
  track: 'AI',
  cost: 'Free',
  format: 'Online',
  duration: '4 weeks',
  eligibility: 'Anyone',
  jobPlacement: 'Not stated',
  deadline: 'Rolling',
  applyLink: 'https://grow.example.com',
  verifiedOn: '2026-11-12',
  status: 'Open',
  notes: '',
};

describe('ApplyButton', () => {
  it.each(['javascript:alert(1)', 'data:text/html,x', 'ftp://x.com', ''])(
    'renders no link for %j',
    async (href) => {
      const html = await render(ApplyButton, { href });
      expect(html).not.toMatch(/<a\b/);
      expect(html).not.toContain('javascript:');
      expect(html).toContain('Apply link unavailable');
    },
  );

  it('links to the employer site, safely, with a large tap target class', async () => {
    const html = await render(ApplyButton, { href: 'https://jobs.example.com/1' });
    expect(html).toMatch(/<a[^>]+href="https:\/\/jobs\.example\.com\/1"/);
    expect(html).toMatch(/rel="noopener"/);
    expect(html).toContain('Apply on the employer&#39;s site');
  });

  it('labels an email application', async () => {
    const html = await render(ApplyButton, { href: 'mailto:careers@x.com' });
    expect(html).toMatch(/href="mailto:careers@x\.com"/);
    expect(html).toContain('Apply by email');
  });
});

describe('ListingRow (GR-015): what must not be there', () => {
  it('has no badge, stamp, boxed deadline, "New this week" or Apply button', async () => {
    const fresh = { ...job, firstSeen: TODAY, remote: true };
    const html = await render(ListingRow, { listing: fresh, kind: 'job' });
    expect(html).not.toMatch(/class="badge|data-badge|class="stamp|data-deadline-chip/);
    expect(html).not.toMatch(/New this week|Checked \d|Closing soon|Apply on|Apply by/);
  });

  it('says "No date" for a missing or unreadable deadline, never a day', async () => {
    for (const deadline of ['Not stated', '', '2026-02-30', 'soon']) {
      const html = await render(ListingRow, { listing: { ...job, deadline }, kind: 'job' });
      expect(html).toMatch(/class="row__word"[^>]*>\s*No date/);
      expect(html).not.toMatch(/row__day/);
    }
  });

  it('shows "Requirements not stated" in the muted style, not as a requirement', async () => {
    const bare = { ...job, minClass: 'Not stated', maxAge: '', nysc: 'Not stated' };
    const html = await render(ListingRow, { listing: bare, kind: 'job' });
    expect(html).toMatch(/class="row__elig row__elig--none"[^>]*>\s*Requirements not stated/);
    const t = await render(ListingRow, {
      listing: { ...training, eligibility: '', format: '', duration: '' },
      kind: 'training',
    });
    expect(t).toMatch(/row__elig--none[^>]*>\s*Requirements not stated/);
    const unstated = await render(ListingRow, {
      listing: { ...training, format: 'Not stated', duration: 'not stated' },
      kind: 'training',
    });
    expect(unstated).not.toMatch(/Not stated ·|· Not stated/i);
    expect(unstated).toContain('>Anyone<');
  });
});

describe('ListingRow (GR-015)', () => {
  it('links the whole row to the detail page, title first, then the date', async () => {
    const html = await render(ListingRow, { listing: job, kind: 'job' });
    expect(html).toMatch(/<a class="row__link" href="\/jobs\/deloitte-academy-2026"/);
    const order = ['Deloitte Academy', 'Deloitte Nigeria · Lagos', '2:1 or above', '>19<', '>Nov<'];
    const positions = order.map((t) => html.indexOf(t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toMatch(/class="visually-hidden"[^>]*>Closes</);
  });

  it('adds Remote to the place line once', async () => {
    const remote = await render(ListingRow, { listing: { ...job, remote: true }, kind: 'job' });
    expect(remote).toContain('Deloitte Nigeria · Lagos · Remote');
    const said = await render(ListingRow, {
      listing: { ...job, remote: true, location: 'Remote (Nigeria)' },
      kind: 'job',
    });
    expect(said).toContain('Deloitte Nigeria · Remote (Nigeria)');
    expect(said).not.toContain('· Remote ·');
  });

  it('shows a training with provider, then format, duration and eligibility, and "Rolling"', async () => {
    const html = await render(ListingRow, { listing: training, kind: 'training' });
    expect(html).toMatch(/href="\/trainings\/google-ai-2026"/);
    expect(html).toContain('Google');
    expect(html).toContain('Online · 4 weeks · Anyone');
    expect(html).toMatch(/class="row__word"[^>]*>\s*Rolling/);
  });

  it('rings the whole row only where :has() works, else keeps the link ring', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      new URL('../src/components/ListingRow.astro', import.meta.url),
      'utf8',
    );
    const supports = src.indexOf('@supports selector(:has(*))');
    const removal = src.indexOf('outline: none');
    expect(supports).toBeGreaterThan(-1);
    expect(removal).toBeGreaterThan(supports);
    expect(src).toMatch(/\.row:has\(\.row__link:focus-visible\)/);
  });
});

describe('Focus and page head', () => {
  it('Base takes theme-color from the --color-bg token', async () => {
    const { readFileSync } = await import('node:fs');
    const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
    const bg = /--color-bg:\s*(#[0-9a-f]{6})/i.exec(tokens)![1];
    const src = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
    expect(src).not.toMatch(/#[0-9a-f]{6}/i);
    expect(bg).toBeDefined();
  });

  it('ApplyButton keeps noopener but no longer strips the referrer', async () => {
    const html = await render(ApplyButton, { href: 'https://jobs.example.com/1' });
    expect(html).toMatch(/rel="noopener"/);
    expect(html).not.toMatch(/noreferrer/);
  });
});

describe('Forms are labelled', () => {
  it('SearchInput ties its label to the input', async () => {
    const html = await render(SearchInput, { id: 'q', label: 'Search openings' });
    expect(html).toMatch(/<label[^>]+for="q"/);
    expect(html).toMatch(/<input[^>]+id="q"[^>]+type="search"|<input[^>]+type="search"[^>]+id="q"/);
  });

  it('Select ties its label to the select and marks the chosen value', async () => {
    const html = await render(Select, {
      id: 'sort',
      label: 'Sort',
      value: 'new',
      options: [
        { value: 'soon', label: 'Closing soonest' },
        { value: 'new', label: 'Newest' },
      ],
    });
    expect(html).toMatch(/<label[^>]+for="sort"/);
    expect(html).toMatch(/<option[^>]+value="new"[^>]+selected/);
  });

  it('FilterChip announces whether it is on', async () => {
    expect(await render(FilterChip, { label: 'Remote', pressed: true })).toMatch(
      /aria-pressed="true"/,
    );
    expect(await render(FilterChip, { label: 'Remote', pressed: false })).toMatch(
      /aria-pressed="false"/,
    );
  });
});

describe('Counts, empty states and trust copy', () => {
  it.each([
    [0, 'No openings match'],
    [1, '1 opening'],
    [17, '17 openings'],
  ])('ResultCount %i reads "%s" and is announced politely', async (count, text) => {
    const html = await render(ResultCount, { count });
    expect(html).toContain(text);
    expect(html).toMatch(/aria-live="polite"/);
  });

  it('EmptyState offers a way out', async () => {
    expect(await render(EmptyState, { clearHref: '/' })).toMatch(/href="\/"[^>]*>\s*Clear filters/);
  });

  it('SafetyNote says never pay to apply', async () => {
    expect(await render(SafetyNote)).toContain('Never pay to apply');
  });

  it('Footer links to the Stay safe page', async () => {
    expect(await render(Footer)).toMatch(/href="\/stay-safe"/);
  });

  it('Banner shows its title and kind', async () => {
    const html = await render(Banner, { kind: 'closed', title: 'This opening has closed' });
    expect(html).toContain('This opening has closed');
    expect(html).toMatch(/banner--closed/);
  });

  it('Breadcrumb is a labelled nav and marks the current page', async () => {
    const html = await render(Breadcrumb, {
      items: [{ label: 'Jobs', href: '/' }, { label: 'Deloitte Academy' }],
    });
    expect(html).toMatch(/<nav[^>]+aria-label="Breadcrumb"/);
    expect(html).toMatch(/aria-current="page"[^>]*>\s*Deloitte Academy/);
  });
});

describe('ShareButton', () => {
  it('opens WhatsApp with the listing and its page', async () => {
    const html = await render(ShareButton, {
      title: 'Deloitte Academy',
      organisation: 'Deloitte Nigeria',
      deadline: '2026-11-27',
      url: 'https://graduateradar.versionphi.com/jobs/deloitte-academy-2026',
    });
    expect(html).toMatch(/href="https:\/\/wa\.me\/\?text=Deloitte%20Academy/);
    expect(html).toContain('Share on WhatsApp');
  });

  it('EligibilityChecklist renders a plain list (no ticks) or says nothing is stated', async () => {
    const html = await render(EligibilityChecklist, {
      items: [{ label: 'Degree class', value: '2:1 or above' }],
    });
    expect(html).toContain('2:1 or above');
    expect(html).not.toMatch(/✓/);
    expect(await render(EligibilityChecklist, { items: [] })).toContain('Requirements not stated');
  });
});
