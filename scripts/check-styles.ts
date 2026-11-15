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

/**
 * Hard-coded values in the <style> blocks of one .astro source. The CSS is read as
 * statements, not lines: text ending in "{" is a selector or at-rule (skipped), text
 * ending in ";" or "}" is a declaration (checked in full), so a value Prettier wraps
 * over several lines is still checked. Reported line: where the declaration starts.
 */
export function findHardCoded(source: string, file = '(inline)'): StyleFinding[] {
  const findings: StyleFinding[] = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
  let block: RegExpExecArray | null;
  while ((block = re.exec(source))) {
    const css = block[1]!;
    const firstLine = source.slice(0, block.index + block[0].indexOf('>') + 1).split('\n').length;
    // Blank out comments but keep newlines, so line numbers stay right.
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
    let start = 0;
    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if (ch !== '{' && ch !== '}' && ch !== ';') continue;
      const raw = clean.slice(start, i);
      const lead = raw.length - raw.trimStart().length;
      const text = raw.trim().replace(/\s+/g, ' ');
      const line = firstLine + clean.slice(0, start + lead).split('\n').length - 1;
      start = i + 1;
      if (ch === '{' || !text) continue; // selector, at-rule or empty
      const colon = text.indexOf(':');
      if (colon <= 0) continue;
      const value = text.slice(colon + 1);
      const hit = RULES.find(([rule]) => rule.test(value));
      if (hit) findings.push({ file, line, text: `${text};`, reason: hit[1] });
    }
  }
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
