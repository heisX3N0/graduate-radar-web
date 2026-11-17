// Sections for the list pages (GR-015). Jobs are grouped by deadline, trainings by track;
// the Newest sort is one flat list. Pure functions, used at build time (the page without
// JavaScript) and in the browser (after every filter, and on load with today's date in
// Lagos), so keep imports to dates.ts only.
import { CLOSING_SOON_DAYS, effectiveStatus, readDeadline } from './dates.ts';

export interface Section {
  /** '' for the flat Newest list, which has no header. */
  id: string;
  label: string;
  /** Shown in red: only the first two job sections. */
  urgent: boolean;
  keys: string[];
}

interface Dated {
  key: string;
  status: string;
  deadline: string;
}

export type JobSectionId = 'today' | 'week' | 'later' | 'open';

export const JOB_SECTIONS: readonly { id: JobSectionId; label: string; urgent: boolean }[] = [
  { id: 'today', label: 'Closes today', urgent: true },
  { id: 'week', label: 'Next 7 days', urgent: true },
  { id: 'later', label: 'Later', urgent: false },
  { id: 'open', label: 'Rolling or no date', urgent: false },
];

/**
 * The section a job belongs in today, or null when it has closed. Only a real date can
 * put a listing in the first two sections; "Rolling", "Not stated" and anything
 * unreadable go to "Rolling or no date", whatever the sheet's status says.
 */
export function jobSectionOf(listing: Dated, today: string): JobSectionId | null {
  if (effectiveStatus(listing, today) === 'Closed') return null;
  const d = readDeadline(listing.deadline, today);
  if (d.kind !== 'date') return 'open';
  if (d.daysLeft === 0) return 'today';
  return d.daysLeft <= CLOSING_SOON_DAYS ? 'week' : 'later';
}

/** All four job sections in order, empty ones included (the page hides them). */
export function groupJobs(items: readonly Dated[], today: string): Section[] {
  const out = JOB_SECTIONS.map((s) => ({ ...s, keys: [] as string[] }));
  for (const item of items) {
    const id = jobSectionOf(item, today);
    if (id) out.find((s) => s.id === id)!.keys.push(item.key);
  }
  return out;
}

/** Training tracks from the data contract (spec 5); anything else is "Other". */
export const TRACKS = [
  'Software',
  'Data',
  'Product',
  'Design',
  'Cloud',
  'Cybersecurity',
  'AI',
  'Digital skills',
] as const;
export const OTHER_TRACK = 'Other';

export function trackOf(track: string): string {
  const t = track.trim();
  return (TRACKS as readonly string[]).includes(t) ? t : OTHER_TRACK;
}

/** Non-empty track sections: largest first, ties by name, "Other" always last. */
export function groupTrainings(
  items: readonly (Dated & { track: string })[],
  today: string,
): Section[] {
  const byTrack = new Map<string, string[]>();
  for (const item of items) {
    if (effectiveStatus(item, today) === 'Closed') continue;
    const track = trackOf(item.track);
    const keys = byTrack.get(track) ?? [];
    keys.push(item.key);
    byTrack.set(track, keys);
  }
  return [...byTrack]
    .map(([id, keys]) => ({ id, label: id, urgent: false, keys }))
    .sort(
      (a, b) =>
        Number(a.id === OTHER_TRACK) - Number(b.id === OTHER_TRACK) ||
        b.keys.length - a.keys.length ||
        a.id.localeCompare(b.id),
    );
}

/** Sections for a list, given items already filtered and sorted. */
export function listSections(
  kind: 'jobs' | 'trainings',
  items: readonly (Dated & { track?: string })[],
  sort: 'soon' | 'new',
  today: string,
): Section[] {
  if (sort === 'new') {
    const keys = items.filter((i) => effectiveStatus(i, today) !== 'Closed').map((i) => i.key);
    return [{ id: '', label: '', urgent: false, keys }];
  }
  if (kind === 'jobs') return groupJobs(items, today);
  return groupTrainings(
    items.map((i) => ({ ...i, track: i.track ?? '' })),
    today,
  );
}
