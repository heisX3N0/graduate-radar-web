import { describe, expect, it } from 'vitest';
import type { JobListing } from '../src/data/feed.ts';
import { pickSamples } from '../src/design/samples.ts';

const TODAY = '2026-11-15';
const job = (n: number, over: Partial<JobListing> = {}): JobListing => ({
  key: `k${n}`,
  slug: `s${n}`,
  firstSeen: '2026-11-14',
  organisation: `Org ${n}`,
  title: `Role ${n}`,
  type: 'Graduate Trainee',
  field: 'Tech',
  location: 'Lagos',
  remote: false,
  eligibility: '',
  minClass: 'Not stated',
  maxAge: '',
  nysc: 'Not stated',
  deadline: 'Not stated',
  applyLink: 'https://x.example.com',
  verifiedOn: '2026-11-14',
  status: 'Open',
  notes: '',
  ...over,
});

describe('pickSamples: never breaks the build', () => {
  it('works with a single listing', () => {
    const s = pickSamples([job(1)], TODAY);
    expect(s.cards.length).toBeGreaterThanOrEqual(1);
    expect(s.cards.every(Boolean)).toBe(true);
    expect(s.detail).toBeDefined();
  });

  it('uses closed listings only when nothing is open', () => {
    const closed = job(1, { status: 'Closed' });
    const s = pickSamples([closed], TODAY);
    expect(s.detail.key).toBe('k1');
  });

  it('throws a clear error when there are no jobs at all', () => {
    expect(() => pickSamples([], TODAY)).toThrow(/no jobs/i);
  });

  it('never shows the same listing twice as a card', () => {
    const s = pickSamples([job(1), job(2)], TODAY);
    expect(new Set(s.cards.map((c) => c.key)).size).toBe(s.cards.length);
  });
});

describe('pickSamples: shows the cases the design must handle', () => {
  it('prefers a dated closing-soon job, a remote job, and a fully specified detail', () => {
    const soon = job(1, { deadline: '2026-11-19' });
    const remote = job(2, { remote: true });
    const full = job(3, { minClass: '2:1', maxAge: '26', deadline: '2026-11-27' });
    const s = pickSamples([full, remote, soon, job(4)], TODAY);
    expect(s.cards.map((c) => c.key)).toEqual(['k1', 'k2']);
    expect(s.detail.key).toBe('k3');
  });
});
