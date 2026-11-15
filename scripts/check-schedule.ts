// Fails when the site or its docs promise an update schedule ("every Tuesday", "Tue/Fri",
// "on Fridays", "twice a week", "every morning"). Owner decision (15 Nov 2026): no
// schedule anywhere, so the sweep can change frequency without a copy change. A weekday
// on its own ("Interviews hold on Friday") is fine.
// Scans our own copy only. Never dist/ or the snapshot: listing notes from the sheet may
// name a day and must never fail a build or a lint run.
// Run: node scripts/check-schedule.ts   (part of npm run lint)
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walk } from './check-dashes.ts';

export interface ScheduleFinding {
  file: string;
  line: number;
}

const SCAN_DIRS = ['src', 'scripts/og', 'public'];
const SCAN_FILES = ['README.md', 'docs/build-spec.md', 'docs/launch.md'];
// Sheet data, not our copy.
const SKIP_FILES = new Set(['src/data/snapshot.json']);

const NAMES = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const DAY = `(?:${NAMES}|mon|tues|tue|wed|thurs|thu|fri|sat|sun)`;
const CLAIMS = [
  new RegExp(`\\b(?:every|each)\\s+${DAY}\\b`, 'gi'),
  new RegExp(`\\b${DAY}s?\\s*(?:and|&|/)\\s*${DAY}s?\\b`, 'gi'),
  new RegExp(`\\bon\\s+(?:${NAMES})s\\b`, 'gi'),
  /\bevery\s+(?:morning|evening|night|day|weekday|week)\b/gi,
  /\btwice\s+(?:a\s+week|weekly)\b/gi,
];

/** Tags become spaces (newlines kept), so "every <b>Tuesday</b>" still matches. */
function withoutTags(text: string): string {
  return text.replace(/<[^<>]*>/g, (tag) => tag.replace(/[^\n]/g, ' '));
}

export function findScheduleClaims(root: string): ScheduleFinding[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) walk(join(root, dir), files);
  for (const f of SCAN_FILES) if (existsSync(join(root, f))) files.push(join(root, f));

  const findings: ScheduleFinding[] = [];
  for (const full of files) {
    const rel = relative(root, full).split(sep).join('/');
    if (SKIP_FILES.has(rel)) continue;
    const text = withoutTags(readFileSync(full, 'utf8'));
    const lines = new Set<number>();
    // Whole-file matching, so a claim wrapped over two lines is still caught; the
    // finding names the line where it starts.
    for (const re of CLAIMS)
      for (const m of text.matchAll(re)) lines.add(text.slice(0, m.index).split('\n').length);
    for (const line of [...lines].sort((a, b) => a - b)) findings.push({ file: rel, line });
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const findings = findScheduleClaims(process.cwd());
  for (const f of findings)
    console.error(`${f.file}:${f.line}: update schedule claim (owner decision: no schedule)`);
  if (findings.length > 0) {
    console.error(`Schedule check failed: ${findings.length} finding(s).`);
    process.exit(1);
  }
  console.log('Schedule check passed.');
}
