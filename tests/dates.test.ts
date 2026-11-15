import { describe, expect, it } from 'vitest';
import {
  daysLeftLabel,
  effectiveStatus,
  isNewThisWeek,
  isRealDay,
  lagosToday,
  readDeadline,
} from '../src/lib/dates.ts';

describe('lagosToday', () => {
  it('is already the next day in Lagos at 23:30 UTC', () => {
    expect(lagosToday(new Date('2026-11-26T23:30:00Z'))).toBe('2026-11-27');
  });

  it('is still the same day in Lagos at 22:59 UTC', () => {
    expect(lagosToday(new Date('2026-11-26T22:59:00Z'))).toBe('2026-11-26');
  });
});

describe('isRealDay', () => {
  it.each(['2026-11-31', '2026-02-29', '2026-13-01', '26-11-01', '2026-1-01', '', 'Rolling'])(
    'rejects %j',
    (s) => {
      expect(isRealDay(s)).toBe(false);
    },
  );

  it('accepts a real day, including 29 Feb in a leap year', () => {
    expect(isRealDay('2026-11-30')).toBe(true);
    expect(isRealDay('2028-02-29')).toBe(true);
  });
});

describe('effectiveStatus: what must close', () => {
  it('treats a deadline of yesterday as Closed even when the sheet says Open', () => {
    expect(effectiveStatus({ status: 'Open', deadline: '2026-11-14' }, '2026-11-15')).toBe(
      'Closed',
    );
  });

  it('closes a 26 Nov deadline at 23:30 UTC on 26 Nov (already 27 Nov in Lagos)', () => {
    const today = lagosToday(new Date('2026-11-26T23:30:00Z'));
    expect(effectiveStatus({ status: 'Open', deadline: '2026-11-26' }, today)).toBe('Closed');
  });

  it('keeps a listing open on its deadline day', () => {
    expect(effectiveStatus({ status: 'Open', deadline: '2026-11-15' }, '2026-11-15')).toBe(
      'Closing soon',
    );
  });

  it.each(['Rolling', 'Not stated', ''])('never closes a %j deadline on its own', (deadline) => {
    expect(effectiveStatus({ status: 'Open', deadline }, '2030-01-01')).toBe('Open');
  });

  it('keeps Closed from the sheet even when the deadline is in the future', () => {
    expect(effectiveStatus({ status: 'Closed', deadline: '2027-01-01' }, '2026-11-15')).toBe(
      'Closed',
    );
  });

  it('treats an impossible deadline like Not stated, never as closed', () => {
    expect(effectiveStatus({ status: 'Open', deadline: '2026-11-31' }, '2026-12-05')).toBe('Open');
  });
});

describe('effectiveStatus and labels: happy path', () => {
  it('shows Closing soon and "5 days left" for a deadline in 5 days', () => {
    const today = '2026-11-15';
    expect(effectiveStatus({ status: 'Open', deadline: '2026-11-20' }, today)).toBe('Closing soon');
    const d = readDeadline('2026-11-20', today);
    expect(d).toEqual({ kind: 'date', date: '2026-11-20', daysLeft: 5 });
    expect(daysLeftLabel(5)).toBe('5 days left');
  });

  it('counts 7 days as closing soon and 8 as open', () => {
    expect(effectiveStatus({ status: 'Open', deadline: '2026-11-22' }, '2026-11-15')).toBe(
      'Closing soon',
    );
    expect(effectiveStatus({ status: 'Open', deadline: '2026-11-23' }, '2026-11-15')).toBe('Open');
  });

  it('keeps Closing soon from the sheet for a far deadline', () => {
    expect(effectiveStatus({ status: 'Closing soon', deadline: 'Rolling' }, '2026-11-15')).toBe(
      'Closing soon',
    );
  });

  it('labels today and one day in plain words', () => {
    expect(daysLeftLabel(0)).toBe('Closes today');
    expect(daysLeftLabel(1)).toBe('1 day left');
  });

  it('reads Rolling and Not stated deadlines', () => {
    expect(readDeadline('Rolling', '2026-11-15')).toEqual({ kind: 'rolling' });
    expect(readDeadline('Not stated', '2026-11-15')).toEqual({ kind: 'not-stated' });
    expect(readDeadline('', '2026-11-15')).toEqual({ kind: 'not-stated' });
  });
});

describe('isNewThisWeek', () => {
  it('is new when first seen 3 days ago, not when 7 or more', () => {
    expect(isNewThisWeek('2026-11-12', '2026-11-15')).toBe(true);
    expect(isNewThisWeek('2026-11-09', '2026-11-15')).toBe(true);
    expect(isNewThisWeek('2026-11-08', '2026-11-15')).toBe(false);
  });

  it('is not new for an empty, impossible or future first-seen date', () => {
    expect(isNewThisWeek('', '2026-11-15')).toBe(false);
    expect(isNewThisWeek('2026-11-31', '2026-12-01')).toBe(false);
    expect(isNewThisWeek('2026-11-20', '2026-11-15')).toBe(false);
  });
});
