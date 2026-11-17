// Components may only use design tokens: no hard-coded colours, sizes or spacing
// (repo CLAUDE.md). scripts/check-styles.ts turns that rule into a check.
import { describe, expect, it } from 'vitest';
import {
  findHardCoded,
  findUnknownTokens,
  scanComponents,
  scanTokens,
} from '../scripts/check-styles.ts';

const style = (body: string) => `---\n---\n<p class="x">x</p>\n<style>\n${body}\n</style>\n`;

describe('findHardCoded: what must be refused', () => {
  it.each([
    ['a hex colour', '.x { color: #1a1a1a; }'],
    ['a short hex colour', '.x { background: #fff; }'],
    ['rgb()', '.x { color: rgb(0 0 0 / 0.5); }'],
    ['hsl()', '.x { color: hsl(120 50% 50%); }'],
    ['a px size', '.x { padding: 12px; }'],
    ['a rem size', '.x { margin-top: 1.5rem; }'],
    ['an em size', '.x { gap: 0.5em; }'],
    ['a named colour', '.x { color: red; }'],
  ])('refuses %s', (_name, css) => {
    expect(findHardCoded(style(css)).length).toBeGreaterThan(0);
  });

  it('checks the continuation lines of a wrapped declaration', () => {
    const css = [
      '.x {',
      '  grid-template-columns:',
      '    repeat(auto-fill, minmax(12rem, 1fr));',
      '}',
    ].join('\n');
    expect(findHardCoded(style(css)).length).toBeGreaterThan(0);
  });

  it('checks a wrapped value whose lines end in commas', () => {
    const css = [
      '.x {',
      '  box-shadow:',
      '    0 0 0 var(--space-1),',
      '    0 2px 4px currentColor;',
      '}',
    ].join('\n');
    expect(findHardCoded(style(css)).length).toBeGreaterThan(0);
  });

  it('reports the line of the problem', () => {
    const found = findHardCoded(style('.x {\n  color: var(--color-ink);\n  padding: 8px;\n}'));
    expect(found).toEqual([expect.objectContaining({ line: 7, text: 'padding: 8px;' })]);
  });
});

describe('findHardCoded: what is allowed', () => {
  it('allows tokens, zero, percentages, keywords and calc of tokens', () => {
    const css = [
      '.x {',
      '  color: var(--color-ink);',
      '  padding: var(--space-2) 0;',
      '  width: 100%;',
      '  border: var(--border-thin) solid currentColor;',
      '  background: transparent;',
      '  margin: calc(var(--space-1) * -1);',
      '  flex: 1 1 auto;',
      '  z-index: var(--z-raised);',
      '}',
    ].join('\n');
    expect(findHardCoded(style(css))).toEqual([]);
  });

  it('ignores markup and frontmatter outside <style>', () => {
    expect(findHardCoded('---\nconst c = "#ff0000";\n---\n<p style="x">12px</p>')).toEqual([]);
  });
});

describe('the real components', () => {
  it('use tokens only', () => {
    expect(scanComponents()).toEqual([]);
  });
});

describe('findUnknownTokens (GR-016)', () => {
  const known = new Set(['color-ink', 'space-2']);

  it('fails a reference to a token tokens.css does not define', () => {
    const src = '<style>\n.a { color: var(--color-new); }\n.b { gap: var(--space-2); }\n</style>';
    expect(findUnknownTokens(src, 'x.astro', known)).toEqual([
      expect.objectContaining({ file: 'x.astro', line: 2, reason: 'unknown token --color-new' }),
    ]);
  });

  it('fails one used as a fallback or inside calc too', () => {
    const src = '<style>.a { margin: calc(-1 * var(--space-9, var(--color-ok-bg))); }</style>';
    expect(findUnknownTokens(src, 'x.astro', known).map((f) => f.reason)).toEqual([
      'unknown token --space-9',
      'unknown token --color-ok-bg',
    ]);
  });

  it('ignores comments both ways: no failure for a commented-out reference, no cover from a commented declaration', () => {
    const commented =
      '<style>\n/* was: background: var(--color-soon-bg); */\n.a { color: var(--color-ink); }\n</style>';
    expect(findUnknownTokens(commented, 'x.astro', known)).toEqual([]);
    const hidden = '<style>\n/* --color-new: #000; */\n.a { color: var(--color-new); }\n</style>';
    expect(findUnknownTokens(hidden, 'x.astro', known)).toEqual([
      expect.objectContaining({ line: 3, reason: 'unknown token --color-new' }),
    ]);
  });

  it('allows a custom property the same file declares', () => {
    const src =
      '<style>.a { --local: 1rem; padding: var(--local); color: var(--color-ink); }</style>';
    expect(findUnknownTokens(src, 'x.astro', known)).toEqual([]);
  });

  it('every component, layout, page and global.css uses only defined tokens', () => {
    expect(scanTokens()).toEqual([]);
  });
});
