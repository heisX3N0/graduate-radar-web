// Brand directions for the owner to choose from (GR-004). Each one is a full colour
// system, a type choice and a point of view, grounded in the audience (spec section 3):
// graduates on mid-range Android phones, often outdoors, arriving from WhatsApp, and
// wary of fake jobs. The chosen one becomes src/styles/tokens.css in GR-005; the others
// are deleted.
import type { Pair } from './contrast.ts';

/** Fonts a direction downloads may not add more than this to a page (spec 6.6). */
export const FONT_BUDGET_BYTES = 50 * 1024;

export interface Direction {
  id: 'noticeboard' | 'stamped' | 'brightstart';
  name: string;
  /** One line: the idea. */
  idea: string;
  why: string[];
  downsides: string[];
  /** Font stacks. */
  display: string;
  body: string;
  /** Font files this direction downloads, relative to the repo root. */
  fontFiles: string[];
  fontNote: string;
  /** Colour tokens (#rrggbb). Same names in every direction. */
  tokens: Record<string, string>;
  /** Text pairs checked for contrast (tests/directions.test.ts). */
  pairs: Pair[];
}

const SYSTEM_SANS =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif';
const SYSTEM_SERIF = 'Georgia, "Noto Serif", "Droid Serif", "Times New Roman", serif';

/** Pairs every direction must pass. */
const COMMON_PAIRS: Pair[] = [
  { fg: 'ink', bg: 'bg', use: 'body' },
  { fg: 'ink', bg: 'surface', use: 'body' },
  { fg: 'inkMuted', bg: 'bg', use: 'secondary' },
  { fg: 'inkMuted', bg: 'surface', use: 'secondary' },
  { fg: 'onPrimary', bg: 'primary', use: 'action' },
  { fg: 'primary', bg: 'surface', use: 'action' },
  { fg: 'primary', bg: 'bg', use: 'action' },
  { fg: 'soon', bg: 'soonBg', use: 'badge' },
  { fg: 'soon', bg: 'surface', use: 'badge' },
  { fg: 'ok', bg: 'okBg', use: 'badge' },
  { fg: 'newText', bg: 'newBg', use: 'badge' },
];

export const DIRECTIONS: Direction[] = [
  {
    id: 'noticeboard',
    name: 'Noticeboard',
    idea: 'The vacancies page of a newspaper you trust, made for a phone.',
    why: [
      'For years Nigerian graduates found real openings in the vacancies pages of national papers. Borrowing that look (newsprint paper, serif headlines, hairline rules, a red stamp for closing dates) says "checked, not hype" before anyone reads a word.',
      'Serif headlines and a plain sans body come from fonts already on every Android phone (Noto Serif and Roboto), so this direction downloads nothing: the fastest of the three on slow, expensive data.',
      'Near-black ink on warm paper gives about 16:1 contrast, which stays readable in direct sun. The one strong colour, a deep ink green, is saved for Apply and links, so the action is never in doubt.',
    ],
    downsides: [
      'Can read as old-fashioned to some 22 year olds; the youthfulness has to come from the writing and spacing, not the look.',
      "Serif display text depends on each phone's serif font, so headlines look slightly different on Samsung, Tecno and iPhone.",
    ],
    display: SYSTEM_SERIF,
    body: SYSTEM_SANS,
    fontFiles: [],
    fontNote: 'Phone fonts only: 0 KB downloaded.',
    tokens: {
      bg: '#f6f1e7',
      surface: '#fffcf5',
      ink: '#191714',
      inkMuted: '#57514a',
      rule: '#cfc5b3',
      primary: '#17553a',
      onPrimary: '#ffffff',
      primarySoft: '#e3eee6',
      soon: '#a3241b',
      soonBg: '#fbe6e1',
      ok: '#1f5c38',
      okBg: '#e4f0e7',
      newText: '#1d3f6e',
      newBg: '#e3eaf5',
    },
    pairs: COMMON_PAIRS,
  },
  {
    id: 'stamped',
    name: 'Stamped',
    idea: 'Every listing looks like it has been checked and signed off.',
    why: [
      'Trust is the product. This direction puts the checking on the surface: a dashed "Verified 14 Nov" stamp on each card, an eligibility checklist with ticks, and calm, official forms, like a well-run bank or a certificate, not a startup.',
      'Deep emerald on a cool off-white is serious without being cold, and it reads as Nigerian through colour alone, with no flag stripes or pattern clichés.',
      'Plain phone fonts with tabular figures keep dates and ages lined up and crisp at small sizes, and cost 0 KB.',
    ],
    downsides: [
      'The closest of the three to an "app" look, so it needs care in GR-005 not to drift into a generic dashboard.',
      'Green for both Apply and "verified" means the two signals share a colour; the stamp shape has to carry the difference.',
    ],
    display: SYSTEM_SANS,
    body: SYSTEM_SANS,
    fontFiles: [],
    fontNote: 'Phone fonts only: 0 KB downloaded.',
    tokens: {
      bg: '#eef3f0',
      surface: '#ffffff',
      ink: '#0e1c15',
      inkMuted: '#44564c',
      rule: '#c6d3cb',
      primary: '#0a6847',
      onPrimary: '#ffffff',
      primarySoft: '#ddf0e6',
      soon: '#9a3412',
      soonBg: '#ffedd5',
      ok: '#0a6847',
      okBg: '#ddf0e6',
      newText: '#1e3a8a',
      newBg: '#e0e7ff',
    },
    pairs: COMMON_PAIRS,
  },
  {
    id: 'brightstart',
    name: 'Bright Start',
    idea: 'Warm, confident and young: the first rung, not a waiting room.',
    why: [
      'Indigo, the colour of adire dyeing, used as a colour only (no patterns), gives a Nigerian warmth that is not green-white-green. A sunflower highlight under the days-left number makes deadlines impossible to miss.',
      'One characterful typeface, Bricolage Grotesque, gives the brand a voice that can carry later products (community, CV tool). Big, bold numbers ("12 days") are what people screenshot and share on WhatsApp.',
      'Dark indigo ink on cream is about 16:1, so the warmth costs nothing in sunlight readability.',
    ],
    downsides: [
      'Downloads one font file, 41.3 KB (measured, Latin only, all weights). Text shows in the phone font until it arrives (font-display: swap), so headlines can shift slightly on slow data.',
      'Bolder and more playful: harder to keep calm and credible next to scam warnings, and the most likely to date in a few years.',
    ],
    display: '"Bricolage Grotesque Variable", ' + SYSTEM_SANS,
    body: SYSTEM_SANS,
    fontFiles: [
      'node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2',
    ],
    fontNote:
      'One variable font for headings, Latin only: 41.3 KB downloaded. Body text uses phone fonts.',
    tokens: {
      bg: '#fff6e9',
      surface: '#ffffff',
      ink: '#1b1530',
      inkMuted: '#4e4763',
      rule: '#e8dcc8',
      primary: '#33268a',
      onPrimary: '#ffffff',
      primarySoft: '#ece8fb',
      soon: '#a33a06',
      soonBg: '#ffe7cc',
      sun: '#ffc83d',
      ok: '#1d6b45',
      okBg: '#dcf2e5',
      newText: '#33268a',
      newBg: '#ece8fb',
    },
    pairs: [...COMMON_PAIRS, { fg: 'ink', bg: 'sun', use: 'body' }],
  },
];
