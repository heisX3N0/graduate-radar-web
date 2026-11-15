import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, failingPairs, MIN_RATIO } from '../src/design/contrast.ts';
import { DIRECTIONS, FONT_BUDGET_BYTES } from '../src/design/directions.ts';

describe('contrastRatio (WCAG 2.x)', () => {
  it('matches known values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('is the same whichever colour is first', () => {
    expect(contrastRatio('#17553a', '#fffcf5')).toBeCloseTo(
      contrastRatio('#fffcf5', '#17553a'),
      10,
    );
  });

  it('rejects a colour that is not #rrggbb', () => {
    expect(() => contrastRatio('green', '#ffffff')).toThrow(/#rrggbb/);
    expect(() => contrastRatio('#fff', '#ffffff')).toThrow(/#rrggbb/);
  });
});

describe('failingPairs: what must be refused', () => {
  const tokens = { ink: '#999999', paper: '#ffffff', button: '#2f80ed', onButton: '#ffffff' };

  it('fails grey body text that would pass plain AA but not our sunlight bar', () => {
    // #595959 on white is about 7.0; #767676 is about 4.54 (AA) but below 7.
    const t = { ink: '#767676', paper: '#ffffff' };
    const fails = failingPairs(t, [{ fg: 'ink', bg: 'paper', use: 'body' }]);
    expect(fails).toHaveLength(1);
    expect(fails[0]?.need).toBe(MIN_RATIO.body);
  });

  it('fails a light button below 4.5 for its label', () => {
    const fails = failingPairs(tokens, [{ fg: 'onButton', bg: 'button', use: 'action' }]);
    expect(fails).toHaveLength(1);
  });

  it('fails a pair that names a token that does not exist', () => {
    expect(() => failingPairs(tokens, [{ fg: 'nope', bg: 'paper', use: 'body' }])).toThrow(/nope/);
  });
});

describe('each brand direction', () => {
  it('there are two or three of them, with distinct ids', () => {
    expect(DIRECTIONS.length).toBeGreaterThanOrEqual(2);
    expect(DIRECTIONS.length).toBeLessThanOrEqual(3);
    expect(new Set(DIRECTIONS.map((d) => d.id)).size).toBe(DIRECTIONS.length);
  });

  it.each(DIRECTIONS.map((d) => [d.name, d] as const))(
    '%s: every text pair meets the sunlight bar (body 7:1, everything else 4.5:1)',
    (_name, d) => {
      expect(failingPairs(d.tokens, d.pairs)).toEqual([]);
    },
  );

  it.each(DIRECTIONS.map((d) => [d.name, d] as const))(
    '%s: checks body, muted, button, link and closing-soon text at least',
    (_name, d) => {
      const fgs = new Set(d.pairs.map((p) => p.fg));
      for (const t of ['ink', 'inkMuted', 'onPrimary', 'primary', 'soon']) expect(fgs).toContain(t);
    },
  );

  it.each(DIRECTIONS.map((d) => [d.name, d] as const))(
    '%s: fonts it downloads stay within the 50 KB budget',
    (_name, d) => {
      const bytes = d.fontFiles.reduce(
        (sum, f) => sum + statSync(new URL(`../${f}`, import.meta.url)).size,
        0,
      );
      expect(bytes).toBeLessThanOrEqual(FONT_BUDGET_BYTES);
    },
  );

  it.each(DIRECTIONS.map((d) => [d.name, d] as const))(
    '%s: states its reasoning and its downsides',
    (_name, d) => {
      expect(d.why.length).toBeGreaterThanOrEqual(2);
      expect(d.downsides.length).toBeGreaterThanOrEqual(1);
    },
  );
});
