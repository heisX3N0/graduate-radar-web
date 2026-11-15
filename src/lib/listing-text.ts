// Shared wording for listings: cards, detail pages and the share button all use these,
// so a listing reads the same everywhere. No Node-only APIs (also used in the browser).
import { effectiveStatus, isNewThisWeek, lagosToday, readDeadline, shortDate } from './dates.ts';
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

export interface DeadlineDisplay {
  kind: 'date' | 'rolling' | 'not-stated' | 'closed';
  text: string;
  sub: string;
  /** Closing within 7 days (shown in red). */
  urgent: boolean;
}

export function deadlineDisplay(listing: HasDeadline, today: string): DeadlineDisplay {
  const d = readDeadline(listing.deadline, today);
  if (effectiveStatus(listing, today) === 'Closed') {
    const sub = d.kind === 'date' && d.daysLeft < 0 ? `Deadline was ${shortDate(d.date)}` : '';
    return { kind: 'closed', text: 'Closed', sub, urgent: false };
  }
  if (d.kind === 'date') {
    if (d.daysLeft === 0) return { kind: 'date', text: 'Closes today', sub: '', urgent: true };
    const sub = d.daysLeft === 1 ? '1 day left' : `${d.daysLeft} days left`;
    return { kind: 'date', text: `Closes ${shortDate(d.date)}`, sub, urgent: d.daysLeft <= 7 };
  }
  if (d.kind === 'rolling')
    return { kind: 'rolling', text: 'Rolling deadline', sub: '', urgent: false };
  return { kind: 'not-stated', text: 'Deadline not stated', sub: 'Apply early', urgent: false };
}

export type BadgeKind = 'soon' | 'remote' | 'new';
export const BADGE_TEXT: Record<BadgeKind, string> = {
  soon: 'Closing soon',
  remote: 'Remote',
  new: 'New this week',
};

/** Badges for a card, in a fixed order. Closed listings get none. */
export function statusBadges(
  listing: HasDeadline & { firstSeen: string; remote?: boolean },
  today: string,
): { kind: BadgeKind; text: string }[] {
  const status = effectiveStatus(listing, today);
  if (status === 'Closed') return [];
  const kinds: BadgeKind[] = [];
  if (status === 'Closing soon') kinds.push('soon');
  if (listing.remote) kinds.push('remote');
  if (isNewThisWeek(listing.firstSeen, today)) kinds.push('new');
  return kinds.map((kind) => ({ kind, text: BADGE_TEXT[kind] }));
}

/**
 * What a card should show today: its deadline wording and badges. The browser uses
 * this to refresh cards rendered at build time, so labels stay right between builds.
 */
export function cardState(
  listing: HasDeadline & { firstSeen: string; remote?: boolean },
  today: string,
): { deadline: DeadlineDisplay; badges: { kind: BadgeKind; text: string }[] } {
  return { deadline: deadlineDisplay(listing, today), badges: statusBadges(listing, today) };
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

/** One line for a card: class, age and NYSC. */
export function eligibilitySummary(e: Eligibility): string {
  const parts: string[] = [];
  const cls = classText(e.minClass);
  if (cls) parts.push(cls);
  if (e.maxAge) parts.push(`Age ${e.maxAge} or under`);
  if (e.nysc === 'Required done') parts.push('NYSC completed');
  else if (e.nysc === 'Serving OK') parts.push('Corps members can apply');
  return parts.length > 0 ? parts.join(' · ') : 'Requirements not stated';
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
