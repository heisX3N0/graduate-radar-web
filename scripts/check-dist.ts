// Scans the built site (dist/) after `npm run build` (acceptance criteria 1 and 7):
// - no "Found via" field and no private-tab text in any HTML, JS, JSON, XML, CSS or text file;
// - every job and training detail page says "Never pay to apply";
// - at least one detail page exists (an empty build means something went wrong);
// - no page points to the old address graduate-radar.pages.dev, and `_headers` keeps
//   pages.dev out of search (noindex) without touching the real site (GR-012).
// Run: node scripts/check-dist.ts [dist]   (npm run check:dist; CI runs it after build)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANNEL_URL } from '../src/lib/site.ts';

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
// GR-013: every page has the site footer (Footer.astro, class "footer"), the footer links
// the WhatsApp channel, and About has its own section for it. Other <footer> elements
// (inside a card, say) are not the site footer.
const CHANNEL_HREF = `href="${CHANNEL_URL}"`;
const SITE_FOOTER = /<footer\b[^>]*\bclass="footer\b[^"]*"[^>]*>[\s\S]*?<\/footer>/i;
// GR-012: the site moved to graduateradar.versionphi.com. Our own old address must not
// appear in canonical links, sharing tags, JSON-LD, the sitemap or robots.txt. Only this
// project's host is refused: an employer's own *.pages.dev Apply link is fine.
const OLD_HOST = /\bgraduate-radar\.pages\.dev\b/i;
// Cloudflare's documented rule (Pages "Headers" docs, read 15 Nov 2026): noindex on the
// pages.dev address and its preview addresses, never on the real site.
const NOINDEX_HOSTS = ['https://:project.pages.dev/*', 'https://:version.:project.pages.dev/*'];

/** Each rule in a Cloudflare `_headers` file: its URL pattern and its header lines. */
function headerRules(text: string): { pattern: string; headers: string[] }[] {
  const rules: { pattern: string; headers: string[] }[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\s/.test(line)) rules.at(-1)?.headers.push(line.trim());
    else rules.push({ pattern: line.trim(), headers: [] });
  }
  return rules;
}

function checkHeaders(dist: string): DistFinding[] {
  const path = join(dist, '_headers');
  if (!existsSync(path))
    return [{ file: '_headers', reason: 'missing (the pages.dev noindex rule)' }];
  const findings: DistFinding[] = [];
  const noindex = headerRules(readFileSync(path, 'utf8')).filter((r) =>
    // "none" means noindex plus nofollow, so it hides a page too.
    r.headers.some((h) => /^x-robots-tag\s*:.*\b(?:noindex|none)\b/i.test(h)),
  );
  for (const want of NOINDEX_HOSTS)
    if (!noindex.some((r) => r.pattern === want))
      findings.push({ file: '_headers', reason: `no noindex rule for ${want}` });
  for (const r of noindex)
    if (!/^https:\/\/[^/]*\.pages\.dev\//i.test(r.pattern))
      findings.push({
        file: '_headers',
        reason: `noindex rule for ${r.pattern} would hide the real site`,
      });
  return findings;
}

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
  let hasAbout = false;
  for (const full of files(dist)) {
    const file = relative(dist, full).split(sep).join('/');
    const text = readFileSync(full, 'utf8');
    const hit = FORBIDDEN.find(([re]) => re.test(text));
    if (hit) findings.push({ file, reason: `contains ${hit[1]}` });
    if (file.endsWith('.html')) {
      const footer = text.match(SITE_FOOTER)?.[0];
      if (footer === undefined) findings.push({ file, reason: 'no site footer' });
      else if (!footer.includes(CHANNEL_HREF))
        findings.push({ file, reason: 'footer without the WhatsApp channel link' });
    }
    if (file === 'about.html') {
      hasAbout = true;
      if (!text.replace(SITE_FOOTER, '').includes(CHANNEL_HREF))
        findings.push({ file, reason: 'no WhatsApp channel section' });
    }
    if (OLD_HOST.test(text))
      findings.push({ file, reason: 'points to the old address graduate-radar.pages.dev' });
    if (DETAIL.test(file)) {
      details += 1;
      if (!SAFETY.test(text))
        findings.push({ file, reason: 'detail page without "Never pay to apply"' });
    }
  }
  if (details === 0) findings.push({ file: '(dist)', reason: 'no detail pages were built' });
  if (!hasAbout) findings.push({ file: 'about.html', reason: 'missing' });
  findings.push(...checkHeaders(dist));
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
