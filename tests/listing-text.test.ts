// Shared wording for listings, used by cards, detail pages and the share button.
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  checkedFact,
  closesFact,
  eligibilityItems,
  eligibilitySummary,
  shareUrl,
} from '../src/lib/listing-text.ts';

const TODAY = '2026-11-15';
const base = {
  status: 'Open',
  deadline: '2026-11-27',
  firstSeen: '2026-11-14',
  remote: false,
  minClass: '2:1',
  maxAge: '26',
  nysc: 'Required done',
  eligibility: 'Computer Science or related',
};

describe('browser safety', () => {
  it('listing-text and filters never import the Zod schema (keeps the browser bundle small)', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of [
      '../src/lib/listing-text.ts',
      '../src/lib/filters.ts',
      '../src/lib/links.ts',
    ]) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(src, f).not.toMatch(/data\/schema|astro\/zod/);
    }
  });
});

describe('applyAction: what must be refused', () => {
  it.each(['javascript:alert(1)', 'data:text/html,x', 'ftp://x.com', 'www.x.com', '', 'mailto:'])(
    'refuses %j',
    (href) => {
      expect(applyAction(href)).toEqual({ kind: 'refused' });
    },
  );
});

describe('applyAction: happy path', () => {
  it('labels a web link and an email link differently', () => {
    expect(applyAction('https://jobs.example.com/1')).toEqual({
      kind: 'web',
      href: 'https://jobs.example.com/1',
      label: "Apply on the employer's site",
    });
    expect(applyAction('mailto:careers@x.com')).toEqual({
      kind: 'email',
      href: 'mailto:careers@x.com',
      label: 'Apply by email',
    });
  });
});

describe('closesFact: what must be refused (GR-016)', () => {
  it('never says a past deadline is still open, and is red', () => {
    expect(closesFact({ ...base, deadline: '2026-11-10' }, TODAY)).toEqual({
      text: 'Closed, deadline was Tue 10 Nov',
      urgent: true,
      closed: true,
    });
  });

  it('says Closed for a listing the sheet marked Closed, even with a future date', () => {
    expect(closesFact({ ...base, status: 'Closed' }, TODAY)).toEqual({
      text: 'Closed',
      urgent: true,
      closed: true,
    });
  });

  it('never shows a day for Rolling, Not stated or an impossible date, and is not red', () => {
    expect(closesFact({ ...base, deadline: 'Rolling' }, TODAY)).toEqual({
      text: 'Rolling',
      urgent: false,
      closed: false,
    });
    for (const deadline of ['Not stated', '', '2026-02-30', 'soon']) {
      expect(closesFact({ ...base, deadline }, TODAY)).toEqual({
        text: 'Deadline not stated',
        urgent: false,
        closed: false,
      });
    }
  });
});

describe('closesFact: happy path (GR-016)', () => {
  it('gives the weekday, date and days left, red within 7 days and ink after', () => {
    expect(closesFact({ ...base, deadline: '2026-11-15' }, TODAY)).toMatchObject({
      text: 'Sun 15 Nov, last day',
      urgent: true,
    });
    expect(closesFact({ ...base, deadline: '2026-11-16' }, TODAY)).toMatchObject({
      text: 'Mon 16 Nov, 1 day left',
      urgent: true,
    });
    expect(closesFact({ ...base, deadline: '2026-11-22' }, TODAY).urgent).toBe(true);
    expect(closesFact({ ...base, deadline: '2026-11-23' }, TODAY)).toEqual({
      text: 'Mon 23 Nov, 8 days left',
      urgent: false,
      closed: false,
    });
  });
});

describe('checkedFact (GR-016)', () => {
  it('says nothing for a missing or impossible date (never "Invalid Date")', () => {
    for (const d of ['', 'yesterday', '2026-02-30', '2026-13-01']) {
      expect(checkedFact(d, 'employer')).toBe('');
    }
  });

  it("names the date and the employer's or provider's own page", () => {
    expect(checkedFact('2026-11-14', 'employer')).toBe("14 Nov, on the employer's own page");
    expect(checkedFact('2026-11-14', 'provider')).toBe("14 Nov, on the provider's own page");
  });
});

describe('eligibility', () => {
  it('lists class, age, NYSC and the rest, skipping what is not stated', () => {
    expect(eligibilityItems(base)).toEqual([
      { label: 'Degree class', value: '2:1 or above' },
      { label: 'Age', value: '26 or under' },
      { label: 'NYSC', value: 'Must have completed NYSC' },
      { label: 'Other', value: 'Computer Science or related' },
    ]);
  });

  it('says so when nothing is stated', () => {
    const none = { minClass: 'Not stated', maxAge: '', nysc: 'Not stated', eligibility: '' };
    expect(eligibilityItems(none)).toEqual([]);
    expect(eligibilitySummary(none)).toBe('Requirements not stated');
  });

  it('summarises for a card in one line', () => {
    expect(eligibilitySummary(base)).toBe('2:1 or above · Age 26 or under · NYSC completed');
    expect(eligibilitySummary({ ...base, minClass: 'Any', nysc: 'Serving OK', maxAge: '' })).toBe(
      'Any degree class · Corps members can apply',
    );
  });
});

describe('shareUrl', () => {
  it('builds a WhatsApp link with title, organisation, closing date and page URL', () => {
    const url = shareUrl(
      { title: 'Deloitte Academy', organisation: 'Deloitte Nigeria', deadline: '2026-11-27' },
      'https://graduateradar.versionphi.com/jobs/deloitte',
      TODAY,
    );
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe(
      'Deloitte Academy · Deloitte Nigeria · Closes 27 Nov · https://graduateradar.versionphi.com/jobs/deloitte',
    );
  });

  it('never says "Closes" for a deadline that has passed', () => {
    const text = decodeURIComponent(
      shareUrl(
        { title: 'T', organisation: 'O', deadline: '2026-11-10' },
        'https://x.dev/a',
        '2026-11-20',
      ).slice('https://wa.me/?text='.length),
    );
    expect(text).toBe('T · O · Closed · https://x.dev/a');
  });

  it('leaves out the closing date when there is none', () => {
    const text = decodeURIComponent(
      shareUrl({ title: 'T', organisation: 'O', deadline: 'Rolling' }, 'https://x.dev/a').split(
        '=',
      )[1]!,
    );
    expect(text).toBe('T · O · https://x.dev/a');
  });

  it('encodes characters that would break the link', () => {
    const url = shareUrl(
      { title: 'A & B #1', organisation: 'O?', deadline: '' },
      'https://x.dev/a',
    );
    const query = url.slice('https://wa.me/?text='.length);
    expect(query).not.toMatch(/[ &#?]/);
    expect(query).toContain('A%20%26%20B%20%231');
  });
});
