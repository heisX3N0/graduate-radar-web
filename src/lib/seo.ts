// Page titles, descriptions, JobPosting structured data (spec 6.5) and similar listings
// for detail pages. Build time only.
import type { JobListing, TrainingListing } from '../data/feed.ts';
import { effectiveStatus, readDeadline, shortDate } from './dates.ts';
import { sortListings } from './filters.ts';
import { eligibilitySummary } from './listing-text.ts';

type Dated = { status: string; deadline: string };

/** "Closes 27 Nov", "Closed", "Rolling deadline", or '' when not stated. */
function deadlinePhrase(l: Dated, today: string): string {
  if (effectiveStatus(l, today) === 'Closed') return 'Closed';
  const d = readDeadline(l.deadline, today);
  if (d.kind === 'date') return `Closes ${shortDate(d.date)}`;
  if (d.kind === 'rolling') return 'Rolling deadline';
  return '';
}

const join = (parts: string[]) => parts.filter(Boolean).join(' · ');

/** "Title · Organisation · Closes 27 Nov" (Base adds "| Graduate Radar"). */
export function jobTitle(j: JobListing, today: string): string {
  return join([j.title, j.organisation, deadlinePhrase(j, today)]);
}

export function trainingTitle(t: TrainingListing, today: string): string {
  return join([t.title, t.provider, deadlinePhrase(t, today)]);
}

function clip(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function jobDescription(j: JobListing, today: string): string {
  const when = deadlinePhrase(j, today);
  return clip(
    `${j.organisation}: ${j.type} in ${j.location}. ${eligibilitySummary(j)}.${when ? ` ${when}.` : ''}`,
  );
}

export function trainingDescription(t: TrainingListing, today: string): string {
  const when = deadlinePhrase(t, today);
  return clip(
    `${t.provider}: ${t.track} training, ${t.cost}, ${t.format}.${t.duration ? ` ${t.duration}.` : ''}${when ? ` ${when}.` : ''}`,
  );
}

const EMPLOYMENT: Record<string, string> = {
  'Graduate Trainee': 'FULL_TIME',
  'Entry level': 'FULL_TIME',
  Internship: 'INTERN',
  'NYSC placement': 'TEMPORARY',
};

/**
 * schema.org JobPosting for a job page, or null for a closed or past-deadline listing
 * (Google asks for expired postings to drop it). The job's own page is the URL; people
 * apply on the employer's site, so directApply is false.
 */
export function jobPostingJsonLd(
  j: JobListing,
  site: string,
  today: string,
): Record<string, unknown> | null {
  if (effectiveStatus(j, today) === 'Closed') return null;
  const d = readDeadline(j.deadline, today);
  const description = [j.eligibility, j.notes, "Apply on the organisation's own website."]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n\n');
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: j.title,
    description,
    datePosted: j.firstSeen,
    employmentType: EMPLOYMENT[j.type] ?? 'OTHER',
    hiringOrganization: { '@type': 'Organization', name: j.organisation },
    url: `${site.replace(/\/$/, '')}/jobs/${j.slug}`,
    directApply: false,
  };
  if (d.kind === 'date') ld['validThrough'] = `${d.date}T23:59:59+01:00`;
  if (j.remote) {
    ld['jobLocationType'] = 'TELECOMMUTE';
    ld['applicantLocationRequirements'] = { '@type': 'Country', name: 'Nigeria' };
  } else {
    ld['jobLocation'] = {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: j.location, addressCountry: 'NG' },
    };
  }
  return ld;
}

/**
 * Up to `max` open listings like this one: same group first (field for jobs, track for
 * trainings), closing soonest; then other open listings if the group has too few.
 */
export function similarListings<
  T extends { key: string; status: string; deadline: string; firstSeen: string },
>(listing: T, all: readonly T[], today: string, group: (l: T) => string, max = 3): T[] {
  const open = all.filter((l) => l.key !== listing.key && effectiveStatus(l, today) !== 'Closed');
  const same = sortListings(
    open.filter((l) => group(l) === group(listing)),
    'soon',
  );
  const rest = sortListings(
    open.filter((l) => group(l) !== group(listing)),
    'soon',
  );
  return [...same, ...rest].slice(0, max);
}
