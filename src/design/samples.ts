// Picks real listings for /design that show the cases the design must handle:
// a dated closing-soon job, a remote job, and a fully specified detail page.
// Never returns undefined, whatever the size of the feed, so the build cannot break.
import type { JobListing } from '../data/feed.ts';
import { effectiveStatus } from '../lib/dates.ts';

export interface Samples {
  cards: JobListing[];
  detail: JobListing;
}

export function pickSamples(jobs: readonly JobListing[], today: string): Samples {
  if (jobs.length === 0) throw new Error('pickSamples: no jobs to show');
  const open = jobs.filter((j) => effectiveStatus(j, today) !== 'Closed');
  const pool = open.length > 0 ? open : [...jobs];
  const used = new Set<string>();

  const take = (test: (j: JobListing) => boolean): JobListing | undefined => {
    const found =
      pool.find((j) => !used.has(j.key) && test(j)) ?? pool.find((j) => !used.has(j.key));
    if (found) used.add(found.key);
    return found;
  };

  const soon = take((j) => effectiveStatus(j, today) === 'Closing soon' && /^\d/.test(j.deadline));
  const remote = take((j) => j.remote);
  const detail =
    take((j) => (j.minClass === '2:1' || j.minClass === '2:2') && j.maxAge !== '') ??
    soon ??
    pool[0]!;
  const cards = [soon, remote].filter((j): j is JobListing => j !== undefined);
  return { cards: cards.length > 0 ? cards : [detail], detail };
}
