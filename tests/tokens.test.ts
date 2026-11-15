// The chosen direction (A. Noticeboard) as tokens: every text pair the components use
// must meet the sunlight bar (body 7:1, everything else 4.5:1).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { failingPairs, type Pair } from '../src/design/contrast.ts';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const colours = Object.fromEntries(
  [...css.matchAll(/--(color-[a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [
    m[1]!,
    m[2]!.toLowerCase(),
  ]),
);

const PAIRS: Pair[] = [
  { fg: 'color-ink', bg: 'color-bg', use: 'body' },
  { fg: 'color-ink', bg: 'color-surface', use: 'body' },
  { fg: 'color-ink', bg: 'color-soon-bg', use: 'body' }, // safety note
  { fg: 'color-ink', bg: 'color-neutral-bg', use: 'body' }, // remote badge, info banner
  { fg: 'color-ink-muted', bg: 'color-bg', use: 'secondary' },
  { fg: 'color-ink-muted', bg: 'color-surface', use: 'secondary' },
  { fg: 'color-on-primary', bg: 'color-primary', use: 'action' },
  { fg: 'color-primary', bg: 'color-surface', use: 'action' },
  { fg: 'color-primary', bg: 'color-bg', use: 'action' },
  { fg: 'color-soon', bg: 'color-soon-bg', use: 'badge' },
  { fg: 'color-soon', bg: 'color-surface', use: 'badge' },
  { fg: 'color-new', bg: 'color-new-bg', use: 'badge' },
  { fg: 'color-ok', bg: 'color-ok-bg', use: 'badge' },
];

describe('tokens.css', () => {
  it('defines every colour the pairs use, as #rrggbb', () => {
    for (const p of PAIRS) {
      expect(colours, p.fg).toHaveProperty(p.fg);
      expect(colours, p.bg).toHaveProperty(p.bg);
    }
  });

  it('meets the sunlight contrast bar for every text pair', () => {
    expect(failingPairs(colours, PAIRS)).toEqual([]);
  });

  it('sets body text at 16 px or more and has a 4 px spacing base', () => {
    expect(css).toMatch(/--font-size-body:\s*1rem;/);
    expect(css).toMatch(/--space-1:\s*0\.25rem;/);
  });

  it('uses phone fonts only (no font files, chosen direction A)', () => {
    expect(css).not.toMatch(/@font-face|url\(/);
  });

  it('turns motion off for people who ask for less motion', () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});

describe('global.css', () => {
  const global = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

  it('gives every focusable element a visible focus ring', () => {
    expect(global).toMatch(/:focus-visible\s*\{[^}]*outline:[^}]*var\(--focus-ring/);
  });
});
