// List sections (GR-015): jobs by deadline, trainings by track, Newest as a flat list.
// Pure functions, used at build time and in the browser. Negative cases first.
import { describe, expect, it } from 'vitest';
import {
  groupJobs,
  groupTrainings,
  jobSectionOf,
  listSections,
  trackOf,
} from '../src/lib/sections.ts';

const TODAY = '2026-11-17';
const item = (
  key: string,
  deadline: string,
  extra: Partial<{ status: string; track: string }> = {},
) => ({
  key,
  deadline,
  status: 'Open',
  track: 'AI',
  ...extra,
});
const keysOf = (sections: { id: string; keys: string[] }[]) =>
  Object.fromEntries(sections.map((s) => [s.id, s.keys]));

describe('sections: what must be refused', () => {
  it('puts a listing whose deadline was yesterday in Lagos in no section', () => {
    expect(jobSectionOf(item('a', '2026-11-16'), TODAY)).toBeNull();
    const all = groupJobs([item('a', '2026-11-16'), item('b', '2026-11-17')], TODAY);
    expect(all.flatMap((s) => s.keys)).toEqual(['b']);
  });

  it('puts a listing the sheet marks Closed in no section', () => {
    expect(jobSectionOf(item('a', '2026-12-01', { status: 'Closed' }), TODAY)).toBeNull();
  });

  it('never puts Rolling, Not stated or an unreadable deadline in the first two sections', () => {
    for (const deadline of ['Rolling', 'Not stated', '', '2026-02-30', 'next week', '17/11/2026']) {
      expect(jobSectionOf(item('a', deadline), TODAY)).toBe('open');
      // Even when the sheet says "Closing soon".
      expect(jobSectionOf(item('a', deadline, { status: 'Closing soon' }), TODAY)).toBe('open');
    }
  });

  it('moves a listing the build put in "Next 7 days" to "Closes today" when today is its deadline', () => {
    const builtOn = '2026-11-16';
    const row = item('a', '2026-11-17');
    expect(jobSectionOf(row, builtOn)).toBe('week');
    expect(jobSectionOf(row, TODAY)).toBe('today');
  });

  it('sends a training with an empty or unknown track to "Other", and keeps "Other" last', () => {
    expect(trackOf('')).toBe('Other');
    expect(trackOf('  ')).toBe('Other');
    expect(trackOf('Basket weaving')).toBe('Other');
    const sections = groupTrainings(
      [
        item('a', 'Rolling', { track: '' }),
        item('b', 'Rolling', { track: 'Basket weaving' }),
        item('c', 'Rolling', { track: 'Other' }),
        item('d', 'Rolling', { track: 'AI' }),
      ],
      TODAY,
    );
    expect(sections.map((s) => s.id)).toEqual(['AI', 'Other']);
    expect(sections.at(-1)!.keys).toEqual(['a', 'b', 'c']);
  });

  it('leaves out closed trainings and drops a track left with none', () => {
    const sections = groupTrainings(
      [item('a', '2026-11-01', { track: 'Data' }), item('b', 'Rolling', { track: 'AI' })],
      TODAY,
    );
    expect(sections.map((s) => s.id)).toEqual(['AI']);
  });

  it('gives Newest one flat list with no section headers', () => {
    const flat = listSections(
      'jobs',
      [item('a', '2026-11-17'), item('b', 'Rolling')],
      'new',
      TODAY,
    );
    expect(flat).toEqual([{ id: '', label: '', urgent: false, keys: ['a', 'b'] }]);
  });

  it('gives Newest no rows when every listing has closed', () => {
    expect(listSections('trainings', [item('a', '2026-11-01')], 'new', TODAY)[0]!.keys).toEqual([]);
  });

  it('keeps an empty job section, with no rows, so the page can hide it', () => {
    const sections = groupJobs([item('a', 'Rolling')], TODAY);
    expect(keysOf(sections)).toEqual({ today: [], week: [], later: [], open: ['a'] });
  });
});

describe('sections: happy path', () => {
  it('orders job sections and keeps the given order inside each', () => {
    const sections = groupJobs(
      [
        item('t1', '2026-11-17'),
        item('w1', '2026-11-18'),
        item('w7', '2026-11-24'),
        item('l1', '2026-11-25'),
        item('l2', '2027-01-10'),
        item('r1', 'Rolling'),
        item('n1', 'Not stated'),
      ],
      TODAY,
    );
    expect(sections.map((s) => [s.id, s.label, s.urgent])).toEqual([
      ['today', 'Closes today', true],
      ['week', 'Next 7 days', true],
      ['later', 'Later', false],
      ['open', 'Rolling or no date', false],
    ]);
    expect(keysOf(sections)).toEqual({
      today: ['t1'],
      week: ['w1', 'w7'],
      later: ['l1', 'l2'],
      open: ['r1', 'n1'],
    });
  });

  it('orders training tracks by size, largest first, ties by name, "Other" last', () => {
    const sections = groupTrainings(
      [
        item('o1', 'Rolling', { track: 'Other' }),
        item('o2', 'Rolling', { track: 'Other' }),
        item('o3', 'Rolling', { track: 'Other' }),
        item('d1', 'Rolling', { track: 'Design' }),
        item('a1', 'Rolling', { track: 'AI' }),
        item('s1', 'Rolling', { track: 'Software' }),
        item('s2', 'Rolling', { track: 'Software' }),
      ],
      TODAY,
    );
    expect(sections.map((s) => [s.id, s.keys.length])).toEqual([
      ['Software', 2],
      ['AI', 1],
      ['Design', 1],
      ['Other', 3],
    ]);
    expect(sections.every((s) => s.label === s.id && !s.urgent)).toBe(true);
  });

  it('listSections picks jobs or trainings grouping for the closing-soonest sort', () => {
    const jobs = listSections('jobs', [item('a', '2026-11-17')], 'soon', TODAY);
    expect(jobs.map((s) => s.id)).toEqual(['today', 'week', 'later', 'open']);
    const trainings = listSections('trainings', [item('a', 'Rolling')], 'soon', TODAY);
    expect(trainings.map((s) => s.id)).toEqual(['AI']);
  });
});
