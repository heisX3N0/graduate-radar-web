// All deadline logic for Graduate Radar (spec section 6.4). Runs at build time and,
// from GR-006, in the browser, so it must stay free of Node-only APIs.
// Days are `yyyy-MM-dd` strings in Africa/Lagos time.

export const TZ = 'Africa/Lagos';
/** A deadline this many days away or fewer shows "Closing soon". */
export const CLOSING_SOON_DAYS = 7;
/** A listing first seen fewer than this many days ago is "New this week". */
export const NEW_DAYS = 7;

export type ListingStatus = 'Open' | 'Closing soon' | 'Closed';

export type Deadline =
  { kind: 'date'; date: string; daysLeft: number } | { kind: 'rolling' } | { kind: 'not-stated' };

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Lagos as `yyyy-MM-dd`. */
export function lagosToday(now: Date = new Date()): string {
  return dayFormat.format(now);
}

/** True for `yyyy-MM-dd` text that names a real calendar day. */
export function isRealDay(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const t = new Date(Date.UTC(y, mo, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo && t.getUTCDate() === d;
}

/** Whole days from `from` to `to` (both real `yyyy-MM-dd` days). Negative if `to` is earlier. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
}

/** Reads a deadline value from the feed. Anything that is not a real day or "Rolling" is "not stated". */
export function readDeadline(deadline: string, today: string): Deadline {
  if (isRealDay(deadline))
    return { kind: 'date', date: deadline, daysLeft: daysBetween(today, deadline) };
  if (deadline === 'Rolling') return { kind: 'rolling' };
  return { kind: 'not-stated' };
}

/**
 * The status a visitor should see. A date deadline before today closes the listing
 * whatever the sheet says; a deadline within CLOSING_SOON_DAYS shows "Closing soon".
 * Rolling and unstated deadlines never close on their own.
 */
export function effectiveStatus(
  listing: { status: string; deadline: string },
  today: string,
): ListingStatus {
  if (listing.status === 'Closed') return 'Closed';
  const d = readDeadline(listing.deadline, today);
  if (d.kind === 'date') {
    if (d.daysLeft < 0) return 'Closed';
    if (d.daysLeft <= CLOSING_SOON_DAYS) return 'Closing soon';
  }
  return listing.status === 'Closing soon' ? 'Closing soon' : 'Open';
}

/** "New this week": first seen between today and NEW_DAYS - 1 days ago. */
export function isNewThisWeek(firstSeen: string, today: string): boolean {
  if (!isRealDay(firstSeen)) return false;
  const age = daysBetween(firstSeen, today);
  return age >= 0 && age < NEW_DAYS;
}

/** Plain-words label for days left on an open listing. */
export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'Closes today';
  return daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;
}
