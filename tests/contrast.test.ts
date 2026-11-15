// Unit tests for the contrast checker that tests/tokens.test.ts relies on
// (moved here from the GR-004 directions test when directions B and C were removed).
import { describe, expect, it } from 'vitest';
import { contrastRatio, failingPairs, MIN_RATIO } from '../src/design/contrast.ts';

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
    // #767676 on white is about 4.54 (AA) but below 7.
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

  it('passes a pair that meets its bar', () => {
    expect(
      failingPairs({ a: '#000000', b: '#ffffff' }, [{ fg: 'a', bg: 'b', use: 'body' }]),
    ).toEqual([]);
  });
});
