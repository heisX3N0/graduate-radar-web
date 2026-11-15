// Fails when the site or its docs promise an update schedule ("every Tuesday", "Tue/Fri",
// "twice a week"). Owner decision (15 Nov 2026): no schedule anywhere, so the sweep can
// move to daily without a copy change. A weekday on its own is fine.
// Scans repo copy only, never dist/: listing notes from the sheet may name a day and
// must never fail a daily build.
// Run: node scripts/check-schedule.ts   (part of npm run lint)
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ScheduleFinding {
  file: string;
  line: number;
}

const SCAN_DIRS = ['src', 'scripts/og', 'public'];
const SCAN_FILES = ['README.md', 'docs/build-spec.md', 'docs/launch.md'];
const TEXT_EXT = /\.(astro|ts|tsx|js|mjs|json|md|css|html|txt|xml|svg)$/i;

const DAY =
  '(?:monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thu|friday|fri|saturday|sat|sunday|sun)';
const CLAIMS = [
  new RegExp(`\\bevery\\s+${DAY}\\b`, 'gi'),
  new RegExp(`\\b${DAY}s?\\s*(?:and|&|/)\\s*${DAY}s?\\b`, 'gi'),
  /\btwice\s+(?:a\s+week|weekly)\b/gi,
];

function walk(dir: string, out: string[]) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = lstatSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile() && TEXT_EXT.test(name)) out.push(full);
  }
}

export function findScheduleClaims(root: string): ScheduleFinding[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) walk(join(root, dir), files);
  for (const f of SCAN_FILES) if (existsSync(join(root, f))) files.push(join(root, f));

  const findings: ScheduleFinding[] = [];
  for (const full of files) {
    const rel = relative(root, full).split(sep).join('/');
    const text = readFileSync(full, 'utf8');
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
