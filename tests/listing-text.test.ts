// Shared wording for listings, used by cards, detail pages and the share button.
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  deadlineDisplay,
  eligibilityItems,
  eligibilitySummary,
  shareUrl,
  statusBadges,
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

describe('deadlineDisplay', () => {
  it('marks 7 days or fewer as urgent', () => {
    expect(deadlineDisplay({ ...base, deadline: '2026-11-19' }, TODAY)).toEqual({
      kind: 'date',
      text: 'Closes 19 Nov',
      sub: '4 days left',
      urgent: true,
    });
  });

  it('is calm for a far deadline', () => {
    expect(deadlineDisplay(base, TODAY)).toMatchObject({ text: 'Closes 27 Nov', urgent: false });
  });

  it('says "Closes today" on the deadline day', () => {
    expect(deadlineDisplay({ ...base, deadline: TODAY }, TODAY)).toMatchObject({
      text: 'Closes today',
      sub: '',
      urgent: true,
    });
  });

  it('shows Closed for a past deadline, whatever the sheet says', () => {
    expect(deadlineDisplay({ ...base, deadline: '2026-11-10' }, TODAY)).toEqual({
      kind: 'closed',
      text: 'Closed',
      sub: 'Deadline was 10 Nov',
      urgent: false,
    });
  });

  it('shows Closed for a listing the sheet marked Closed', () => {
    expect(deadlineDisplay({ ...base, status: 'Closed' }, TODAY)).toMatchObject({ kind: 'closed' });
  });

  it('reads Rolling and Not stated plainly', () => {
    expect(deadlineDisplay({ ...base, deadline: 'Rolling' }, TODAY)).toMatchObject({
      text: 'Rolling deadline',
      urgent: false,
    });
    expect(deadlineDisplay({ ...base, deadline: 'Not stated' }, TODAY)).toMatchObject({
      text: 'Deadline not stated',
      sub: 'Apply early',
    });
  });
});

describe('statusBadges', () => {
  it('never badges a closed listing', () => {
    expect(statusBadges({ ...base, deadline: '2026-11-10', remote: true }, TODAY)).toEqual([]);
  });

  it('shows Closing soon, Remote and New this week in that order', () => {
    expect(
      statusBadges({ ...base, deadline: '2026-11-19', remote: true }, TODAY).map((b) => b.kind),
    ).toEqual(['soon', 'remote', 'new']);
  });

  it('shows nothing for an ordinary listing first seen long ago', () => {
    expect(statusBadges({ ...base, firstSeen: '2026-10-01' }, TODAY)).toEqual([]);
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
      'https://graduate-radar.pages.dev/jobs/deloitte',
    );
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe(
      'Deloitte Academy · Deloitte Nigeria · Closes 27 Nov · https://graduate-radar.pages.dev/jobs/deloitte',
    );
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
