// Components may only use design tokens: no hard-coded colours, sizes or spacing
// (repo CLAUDE.md). scripts/check-styles.ts turns that rule into a check.
import { describe, expect, it } from 'vitest';
import { findHardCoded, scanComponents } from '../scripts/check-styles.ts';

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
