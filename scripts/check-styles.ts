// Fails when a component or layout style uses a hard-coded colour, size or spacing
// instead of a design token from src/styles/tokens.css (repo CLAUDE.md).
// Run: node scripts/check-styles.ts   (part of npm run lint)
//
// Checked: declarations inside <style> blocks of .astro files in src/components and
// src/layouts. Allowed: var(--token), 0, percentages, unitless numbers, keywords,
// and @media lines (custom properties cannot be used in media queries).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface StyleFinding {
  file: string;
  line: number;
  text: string;
  reason: string;
}

const RULES: [RegExp, string][] = [
  [/#[0-9a-f]{3,8}\b/i, 'hex colour'],
  [/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i, 'colour function'],
  [/(?<![\w-])-?\d*\.?\d+(?:px|rem|em|vh|vw|vmin|vmax|pt|cm|mm|in)\b/i, 'length literal'],
  [
    /\b(?:red|blue|green|black|white|gray|grey|orange|yellow|purple|pink|brown|navy|teal|maroon|silver)\b/i,
    'named colour',
  ],
];

/** Hard-coded values in the <style> blocks of one .astro source. */
export function findHardCoded(source: string, file = '(inline)'): StyleFinding[] {
  const lines = source.split('\n');
  const findings: StyleFinding[] = [];
  let inStyle = false;
  let inComment = false;
  lines.forEach((raw, i) => {
    if (/<style\b/.test(raw)) {
      inStyle = true;
      return;
    }
    if (/<\/style>/.test(raw)) {
      inStyle = false;
      return;
    }
    if (!inStyle) return;
    let line = raw;
    if (inComment) {
      const end = line.indexOf('*/');
      if (end === -1) return;
      line = line.slice(end + 2);
      inComment = false;
    }
    line = line.replace(/\/\*.*?\*\//g, '');
    const start = line.indexOf('/*');
    if (start !== -1) {
      line = line.slice(0, start);
      inComment = true;
    }
    const text = line.trim();
    if (!text || text.startsWith('@media') || text.startsWith('@container')) return;
    const colon = text.indexOf(':');
    // Declarations only: "property: value". Selectors such as "a:hover {" are skipped.
    if (colon <= 0 || text.endsWith('{') || text.endsWith(',')) return;
    const value = text.slice(colon + 1);
    for (const [re, reason] of RULES) {
      if (re.test(value)) {
        findings.push({ file, line: i + 1, text, reason });
        break;
      }
    }
  });
  return findings;
}

function astroFiles(dir: string, out: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) astroFiles(full, out);
    else if (name.endsWith('.astro')) out.push(full);
  }
  return out;
}

/** Every finding in src/components and src/layouts. */
export function scanComponents(
  root = fileURLToPath(new URL('..', import.meta.url)),
): StyleFinding[] {
  const files = [
    ...astroFiles(join(root, 'src', 'components')),
    ...astroFiles(join(root, 'src', 'layouts')),
  ];
  return files.flatMap((f) =>
    findHardCoded(readFileSync(f, 'utf8'), relative(root, f).split(sep).join('/')),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const findings = scanComponents();
  for (const f of findings)
    console.error(
      `${f.file}:${f.line}: ${f.reason}: ${f.text} (use a token from src/styles/tokens.css)`,
    );
  if (findings.length > 0) {
    console.error(`Style check failed: ${findings.length} finding(s).`);
    process.exitCode = 1;
  } else {
    console.log('Style check passed.');
  }
}
