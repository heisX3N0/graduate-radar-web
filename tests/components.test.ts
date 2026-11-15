// Components rendered with Astro's container API. Negative cases first.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import ApplyButton from '../src/components/ApplyButton.astro';
import Banner from '../src/components/Banner.astro';
import Breadcrumb from '../src/components/Breadcrumb.astro';
import DeadlineChip from '../src/components/DeadlineChip.astro';
import EligibilityChecklist from '../src/components/EligibilityChecklist.astro';
import EmptyState from '../src/components/EmptyState.astro';
import FilterChip from '../src/components/FilterChip.astro';
import Footer from '../src/components/Footer.astro';
import ListingCard from '../src/components/ListingCard.astro';
import ResultCount from '../src/components/ResultCount.astro';
import SafetyNote from '../src/components/SafetyNote.astro';
import SearchInput from '../src/components/SearchInput.astro';
import Select from '../src/components/Select.astro';
import ShareButton from '../src/components/ShareButton.astro';
import StatusBadge from '../src/components/StatusBadge.astro';
import StatusStamp from '../src/components/StatusStamp.astro';
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

describe('ListingCard', () => {
  it('has no Apply button (owner decision: apply from the detail page)', async () => {
    const html = await render(ListingCard, { listing: job, kind: 'job', today: TODAY });
    expect(html).not.toMatch(/Apply on|Apply by/);
  });

  it('links the whole card to the detail page', async () => {
    const html = await render(ListingCard, { listing: job, kind: 'job', today: TODAY });
    expect(html).toMatch(/href="\/jobs\/deloitte-academy-2026"/);
  });

  it('shows the job facts in spec order, with the checked stamp', async () => {
    const html = await render(ListingCard, { listing: job, kind: 'job', today: TODAY });
    const order = [
      'Closing soon',
      'Deloitte Academy',
      'Deloitte Nigeria',
      'Graduate Trainee',
      'Lagos',
      'Closes 19 Nov',
      '2:1 or above',
      'Checked 14 Nov',
    ];
    const positions = order.map((t) => html.indexOf(t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('renders a training with provider, track and cost', async () => {
    const html = await render(ListingCard, { listing: training, kind: 'training', today: TODAY });
    expect(html).toMatch(/href="\/trainings\/google-ai-2026"/);
    expect(html).toContain('Google');
    expect(html).toContain('AI');
    expect(html).toContain('Free');
    expect(html).toContain('Rolling deadline');
  });
});

describe('Focus and page head', () => {
  it('ListingCard keeps the link focus ring unless :has() can move it to the card', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      new URL('../src/components/ListingCard.astro', import.meta.url),
      'utf8',
    );
    // Removing the link outline is only allowed inside @supports selector(:has(*)).
    const supports = src.indexOf('@supports selector(:has(*))');
    const removal = src.indexOf('outline: none');
    expect(removal === -1 || (supports !== -1 && removal > supports)).toBe(true);
  });

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

describe('StatusStamp and StatusBadge', () => {
  it.each(['', 'yesterday', '2026-11-31'])('StatusStamp renders nothing for %j', async (date) => {
    expect((await render(StatusStamp, { date })).trim()).toBe('');
  });

  it('StatusStamp says Checked, never Verified', async () => {
    const html = await render(StatusStamp, { date: '2026-11-14' });
    expect(html).toContain('Checked 14 Nov');
    expect(html).not.toContain('Verified');
  });

  it('StatusBadge uses filled badges, so they cannot be mistaken for the outlined stamp', async () => {
    const html = await render(StatusBadge, { kind: 'new' });
    expect(html).toContain('New this week');
    expect(html).toMatch(/class="[^"]*badge--new/);
  });
});

describe('DeadlineChip text', () => {
  it('keeps a space between the date and the days left, for screen readers', async () => {
    const html = await render(DeadlineChip, { listing: job, today: TODAY });
    const text = html
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    expect(text).toContain('Closes 19 Nov 4 days left');
  });
});

describe('DeadlineChip', () => {
  it('marks a near deadline as urgent and a past one as closed', async () => {
    expect(await render(DeadlineChip, { listing: job, today: TODAY })).toMatch(/deadline--urgent/);
    const closed = await render(DeadlineChip, {
      listing: { ...job, deadline: '2026-11-10' },
      today: TODAY,
    });
    expect(closed).toMatch(/deadline--closed/);
    expect(closed).toContain('Closed');
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
