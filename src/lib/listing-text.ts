// Shared wording for listings: list rows, detail pages and the share button all use these,
// so a listing reads the same everywhere. No Node-only APIs (also used in the browser).
import {
  CLOSING_SOON_DAYS,
  effectiveStatus,
  lagosToday,
  readDeadline,
  shortDate,
  weekday,
} from './dates.ts';
import { isAllowedLink } from './links.ts';

interface HasDeadline {
  status: string;
  deadline: string;
}

export type ApplyAction =
  { kind: 'web' | 'email'; href: string; label: string } | { kind: 'refused' };

/** How to present an Apply link; anything not https, http or mailto is refused. */
export function applyAction(href: string): ApplyAction {
  const h = href.trim();
  if (!isAllowedLink(h)) return { kind: 'refused' };
  if (/^mailto:/i.test(h)) return { kind: 'email', href: h, label: 'Apply by email' };
  return { kind: 'web', href: h, label: "Apply on the employer's site" };
}

/** The Closes row of a detail page's facts table (GR-016). */
export interface ClosesFact {
  text: string;
  /** Shown in red: closing within 7 days, or closed. */
  urgent: boolean;
  closed: boolean;
}

function dayText(day: string): string {
  return `${weekday(day)} ${shortDate(day)}`;
}

/**
 * "Fri 27 Nov, 12 days left"; "Sun 15 Nov, last day"; "Rolling"; "Deadline not stated";
 * "Closed, deadline was Tue 10 Nov". The browser uses this to bring the row up to date
 * between builds.
 */
export function closesFact(listing: HasDeadline, today: string): ClosesFact {
  const d = readDeadline(listing.deadline, today);
  if (effectiveStatus(listing, today) === 'Closed') {
    const text =
      d.kind === 'date' && d.daysLeft < 0 ? `Closed, deadline was ${dayText(d.date)}` : 'Closed';
    return { text, urgent: true, closed: true };
  }
  if (d.kind === 'date') {
    const left =
      d.daysLeft === 0 ? 'last day' : d.daysLeft === 1 ? '1 day left' : `${d.daysLeft} days left`;
    return {
      text: `${dayText(d.date)}, ${left}`,
      urgent: d.daysLeft <= CLOSING_SOON_DAYS,
      closed: false,
    };
  }
  if (d.kind === 'rolling') return { text: 'Rolling', urgent: false, closed: false };
  return { text: 'Deadline not stated', urgent: false, closed: false };
}

/** The Checked row: "14 Nov, on the employer's own page", or '' for a bad date (row left out). */
export function checkedFact(verifiedOn: string, source: 'employer' | 'provider'): string {
  const day = shortDate(verifiedOn);
  return day ? `${day}, on the ${source}'s own page` : '';
}

interface Eligibility {
  minClass?: string;
  maxAge?: string;
  nysc?: string;
  eligibility: string;
}

function classText(minClass = ''): string {
  if (minClass === '2:1' || minClass === '2:2') return `${minClass} or above`;
  if (minClass === 'Any') return 'Any degree class';
  return '';
}

/** Eligibility for the detail page checklist. Unstated items are left out. */
export function eligibilityItems(e: Eligibility): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];
  const cls = classText(e.minClass);
  if (cls) items.push({ label: 'Degree class', value: cls });
  if (e.maxAge) items.push({ label: 'Age', value: `${e.maxAge} or under` });
  if (e.nysc === 'Required done') items.push({ label: 'NYSC', value: 'Must have completed NYSC' });
  else if (e.nysc === 'Serving OK') items.push({ label: 'NYSC', value: 'Corps members can apply' });
  if (e.eligibility.trim()) items.push({ label: 'Other', value: e.eligibility.trim() });
  return items;
}

/** Where a job is: its location, plus "Remote" once when the location does not say it. */
export function placeText(location: string, remote: boolean): string {
  const parts = [location.trim()];
  if (remote && !/remote/i.test(location)) parts.push('Remote');
  return parts.filter(Boolean).join(' · ');
}

/** What a list row or card says when no requirement is stated. */
export const NO_REQUIREMENTS = 'Requirements not stated';

/** One line for a card: class, age and NYSC. */
export function eligibilitySummary(e: Eligibility): string {
  const parts: string[] = [];
  const cls = classText(e.minClass);
  if (cls) parts.push(cls);
  if (e.maxAge) parts.push(`Age ${e.maxAge} or under`);
  if (e.nysc === 'Required done') parts.push('NYSC completed');
  else if (e.nysc === 'Serving OK') parts.push('Corps members can apply');
  return parts.length > 0 ? parts.join(' · ') : NO_REQUIREMENTS;
}

/** WhatsApp share link: "title · organisation · Closes 27 Nov · page URL" (spec 6.5). */
export function shareUrl(
  listing: { title: string; organisation: string; deadline: string },
  pageUrl: string,
  today: string = lagosToday(),
): string {
  const d = readDeadline(listing.deadline, today);
  // A past deadline says "Closed", never "Closes" on a date already gone.
  const when = d.kind !== 'date' ? '' : d.daysLeft < 0 ? 'Closed' : `Closes ${shortDate(d.date)}`;
  const text = [listing.title, listing.organisation, when, pageUrl].filter(Boolean).join(' · ');
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** "1 opening", "17 openings", "0 trainings": the count wording in the heading and masthead. */
export function countText(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : `${noun}s`}`;
}
