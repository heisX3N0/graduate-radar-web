// Build-time helpers for the list pages: the slimmed listing data the browser script
// needs (only what filtering and search use), and safe JSON for a <script> data block.
import type { JobListing, TrainingListing } from '../data/feed.ts';
import type { JobItem, TrainingItem } from './filters.ts';

export function toJobItem(j: JobListing): JobItem {
  return {
    key: j.key,
    title: j.title,
    organisation: j.organisation,
    type: j.type,
    field: j.field,
    location: j.location,
    remote: j.remote,
    minClass: j.minClass,
    eligibility: j.eligibility,
    status: j.status,
    deadline: j.deadline,
    firstSeen: j.firstSeen,
  };
}

export function toTrainingItem(t: TrainingListing): TrainingItem {
  return {
    key: t.key,
    title: t.title,
    provider: t.provider,
    track: t.track,
    cost: t.cost,
    format: t.format,
    jobPlacement: t.jobPlacement,
    eligibility: t.eligibility,
    status: t.status,
    deadline: t.deadline,
    firstSeen: t.firstSeen,
  };
}

/**
 * JSON safe to place inside <script type="application/json">: "<" is escaped so listing
 * text can never close the script element or open an HTML comment, and the two Unicode
 * line separators are escaped. JSON.parse reads it back unchanged.
 */
const LINE_SEP = new RegExp(String.fromCharCode(0x2028), 'g');
const PARA_SEP = new RegExp(String.fromCharCode(0x2029), 'g');

export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(LINE_SEP, '\\u2028')
    .replace(PARA_SEP, '\\u2029');
}

/** Distinct non-empty values, in a stable order, for filter options. */
export function distinct(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
