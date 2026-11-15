import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findDashes } from '../scripts/check-dashes.ts';

const EN = String.fromCharCode(0x2013);
const EM = String.fromCharCode(0x2014);

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dash-check-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function file(path: string, text: string) {
  const full = join(root, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, text);
}

describe('findDashes', () => {
  it('reports an em dash in UI source', () => {
    file('src/pages/index.astro', `<p>Apply now ${EM} it is free</p>`);
    const found = findDashes(root);
    expect(found).toEqual([{ file: 'src/pages/index.astro', line: 1, char: 'em dash' }]);
  });

  it('reports an en dash in docs, with the right line number', () => {
    file('docs/notes.md', `First line\nOpen 9${EN}5`);
    expect(findDashes(root)).toEqual([{ file: 'docs/notes.md', line: 2, char: 'en dash' }]);
  });

  it('checks root markdown files such as README.md and BACKLOG.md', () => {
    file('README.md', `Setup ${EM} easy`);
    file('BACKLOG.md', `Days 1${EN}7`);
    expect(findDashes(root).map((f) => f.file)).toEqual(['BACKLOG.md', 'README.md']);
  });

  it('checks root config files such as package.json and astro.config.mjs', () => {
    file('package.json', `{ "description": "Jobs ${EM} free" }`);
    file('astro.config.mjs', `// Days 1${EN}7`);
    expect(findDashes(root).map((f) => f.file)).toEqual(['astro.config.mjs', 'package.json']);
  });

  it('ignores node_modules, dist and .astro', () => {
    file('node_modules/pkg/readme.md', `x ${EM} y`);
    file('dist/index.html', `x ${EM} y`);
    file('.astro/types.d.ts', `x ${EM} y`);
    expect(findDashes(root)).toEqual([]);
  });

  it('passes plain hyphens, middle dots and colons', () => {
    file('src/a.ts', 'const s = "GR-001 · Closes 27 Nov: 12 days left";');
    expect(findDashes(root)).toEqual([]);
  });
});
