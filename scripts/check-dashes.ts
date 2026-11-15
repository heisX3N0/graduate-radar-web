// Fails when an em dash or en dash appears in source, docs or root markdown.
// House style bans both (global rules); this turns the rule into a check.
// Run: node scripts/check-dashes.ts   (part of npm run lint)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface DashFinding {
  file: string;
  line: number;
  char: 'em dash' | 'en dash';
}

const SCAN_DIRS = ['src', 'docs', 'scripts', 'tests', 'apps-script', 'public', '.github'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', '.git', '.claude']);
const TEXT_EXT = /\.(astro|ts|tsx|js|mjs|cjs|json|md|css|html|gs|txt|xml|svg|ya?ml)$/i;
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const DASHES: Record<string, DashFinding['char']> = { [EM]: 'em dash', [EN]: 'en dash' };

function walk(dir: string, out: string[]) {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (TEXT_EXT.test(name)) out.push(full);
  }
}

export function findDashes(root: string): DashFinding[] {
  const files: string[] = [];
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    if (statSync(full).isFile() && /\.md$/i.test(name)) files.push(full);
  }
  for (const dir of SCAN_DIRS) walk(join(root, dir), files);

  const findings: DashFinding[] = [];
  for (const full of files) {
    const rel = relative(root, full).split(sep).join('/');
    readFileSync(full, 'utf8')
      .split('\n')
      .forEach((text, i) => {
        for (const [ch, label] of Object.entries(DASHES)) {
          if (text.includes(ch)) findings.push({ file: rel, line: i + 1, char: label });
        }
      });
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const findings = findDashes(process.cwd());
  for (const f of findings)
    console.error(`${f.file}:${f.line}: ${f.char} (use a colon, comma, parentheses or "to")`);
  if (findings.length > 0) {
    console.error(`Dash check failed: ${findings.length} finding(s).`);
    process.exit(1);
  }
  console.log('Dash check passed.');
}
