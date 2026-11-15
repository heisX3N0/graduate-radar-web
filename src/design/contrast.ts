// WCAG 2.x contrast, with a higher bar than plain AA because the audience reads on
// mid-range phone screens, often outdoors in strong sunlight (spec section 3).

/** What a text pair is used for, and the minimum ratio it needs. */
export const MIN_RATIO = {
  /** Running text: listing titles, eligibility, notes. WCAG AAA level. */
  body: 7,
  /** Secondary text: organisation, labels, dates. WCAG AA. */
  secondary: 4.5,
  /** Button labels and links. WCAG AA. */
  action: 4.5,
  /** Badge and chip text on their tinted background. WCAG AA. */
  badge: 4.5,
} as const;

export type PairUse = keyof typeof MIN_RATIO;

export interface Pair {
  fg: string;
  bg: string;
  use: PairUse;
}

export interface PairFailure extends Pair {
  ratio: number;
  need: number;
}

function channel(hex: string, i: number): number {
  const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Colour "${hex}" is not #rrggbb`);
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

/** Contrast ratio between two #rrggbb colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pairs (by token name) that fall below the ratio their use needs. */
export function failingPairs(
  tokens: Readonly<Record<string, string>>,
  pairs: readonly Pair[],
): PairFailure[] {
  const colour = (name: string) => {
    const c = tokens[name];
    if (!c) throw new Error(`Unknown colour token "${name}"`);
    return c;
  };
  return pairs
    .map((p) => ({
      ...p,
      ratio: contrastRatio(colour(p.fg), colour(p.bg)),
      need: MIN_RATIO[p.use],
    }))
    .filter((p) => p.ratio < p.need);
}
