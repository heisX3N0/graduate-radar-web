// Scans the built site (dist/) after `npm run build` (acceptance criteria 1 and 7):
// - no "Found via" field and no private-tab text in any HTML, JS, JSON, XML, CSS or text file;
// - every job and training detail page says "Never pay to apply";
// - at least one detail page exists (an empty build means something went wrong).
// Run: node scripts/check-dist.ts [dist]   (npm run check:dist; CI runs it after build)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface DistFinding {
  file: string;
  reason: string;
}

const TEXT = /\.(html|js|mjs|json|xml|txt|css|webmanifest)$/i;
// The field forms only: a label ("Found via:"), a table header cell (">Found via<"), or
// the field names (foundVia, found_via). A note that just says "found via LinkedIn" is
// ordinary listing text and must not fail the build.
const FORBIDDEN: [RegExp, string][] = [
  [/\bfound\s*via\s*:/i, 'the private "Found via" column'],
  [/>\s*found\s*via\s*</i, 'the private "Found via" column'],
  [/\bfoundVia\b|\bfound_via\b/i, 'the private "Found via" field'],
  [/postgrad\s+scholarships/i, 'the private "Postgrad Scholarships" tab'],
];
const DETAIL = /^(jobs|trainings)\/[^/]+\.html$/;
const SAFETY = /Never pay to apply/;

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (TEXT.test(name)) out.push(full);
  }
  return out;
}

export function checkDist(dist: string): DistFinding[] {
  const findings: DistFinding[] = [];
  let details = 0;
  for (const full of files(dist)) {
    const file = relative(dist, full).split(sep).join('/');
    const text = readFileSync(full, 'utf8');
    const hit = FORBIDDEN.find(([re]) => re.test(text));
    if (hit) findings.push({ file, reason: `contains ${hit[1]}` });
    if (DETAIL.test(file)) {
      details += 1;
      if (!SAFETY.test(text))
        findings.push({ file, reason: 'detail page without "Never pay to apply"' });
    }
  }
  if (details === 0) findings.push({ file: '(dist)', reason: 'no detail pages were built' });
  return findings.sort((a, b) => a.file.localeCompare(b.file));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = process.argv[2] ?? 'dist';
  const findings = checkDist(dist);
  for (const f of findings) console.error(`${f.file}: ${f.reason}`);
  if (findings.length > 0) {
    console.error(`Dist check failed: ${findings.length} finding(s).`);
    process.exitCode = 1;
  } else {
    console.log('Dist check passed.');
  }
}
