# Design

## Brand directions (GR-004)

Three directions for the owner to choose from, shown on `/design` (not linked, not indexed). Each renders the same real listings from the feed at phone width, so the choice is about the look, not the content. The definitions live in `src/design/directions.ts`; the reasoning below is also on the page.

All three start from the same constraints (spec section 3): mid-range Android phones, often read outdoors; visitors arriving from WhatsApp; and trust as the product, because graduates are targeted by fake jobs.

| | A. Noticeboard | B. Stamped | C. Bright Start |
| --- | --- | --- | --- |
| Idea | The vacancies page of a newspaper you trust, made for a phone | Every listing looks checked and signed off | Warm, confident and young: the first rung |
| Colour | Near-black ink on warm newsprint; deep ink green for Apply; vermilion stamp for closing dates | Deep emerald on cool off-white; burnt orange for closing dates | Indigo (adire colour, no patterns) on cream; sunflower highlight; kola orange for closing dates |
| Type | Phone serif for headlines, phone sans for text | Phone sans throughout, tabular figures | Bricolage Grotesque for headlines, phone sans for text |
| Font download | 0 KB | 0 KB | 41.3 KB (measured: one variable Latin file, all weights) |
| Structure | Square cards, double-ruled masthead, boxed red deadline stamp | Rounded cards with a green edge, dashed "Verified" stamp, ticked checklist | Round cards, soft shadow, big highlighted day count, pill buttons |
| Main risk | Can feel old-fashioned to some younger readers | Closest to a generic "app" look | Font download on slow data; playful tone next to scam warnings |

### Noticeboard with a "Checked" stamp (owner request, 15 Nov 2026)

The owner liked A and asked whether B's verified stamp would work with it. It is shown on A's cards, adapted:

- It says **"Checked 14 Nov"**, not "Verified": we check listings, we cannot guarantee them, and the sheet's own copy says "checked".
- Ink green, solid thin border, square corners, upright, 12 px: smaller and quieter than the red deadline stamp, so red stays the only urgent colour.
- B's ticks on the eligibility list are not brought across: a tick beside "2:1 or above" reads as "you meet this".
- To resolve in GR-005: the green "New this week" badge looks similar to the stamp; one of them should change shape or colour.

## Rules every direction meets

- **Contrast, set higher than usual for sunlight** (`src/design/contrast.ts`, checked by `tests/directions.test.ts` on every build): body text at least 7:1 (WCAG AAA), secondary text, buttons, links and badges at least 4.5:1 (WCAG AA). Measured ratios for ink on paper: Noticeboard 15.9:1, Stamped 15.7:1, Bright Start 16.4:1.
- **Font budget:** fonts a direction downloads may not exceed 50 KB (spec 6.6); the test reads the real file sizes.
- **360 px:** no horizontal scroll at 360 px wide (checked by hand in the browser pane on 15 Nov 2026: page width 360, no element past the edge). An automatic check comes with GR-009.
- **Tap targets:** the Apply button is at least 48 px tall.
- **No hard-coded brand colours in components:** every colour is a token with the same name in each direction (`bg`, `surface`, `ink`, `inkMuted`, `rule`, `primary`, `onPrimary`, `primarySoft`, `soon`, `soonBg`, `ok`, `okBg`, `newText`, `newBg`), so GR-005 can turn the chosen set into `src/styles/tokens.css` directly.

## After the choice

The owner picks one direction by name. GR-005 then: writes its tokens to `src/styles/tokens.css`, deletes the other two (and the Bricolage Grotesque dependency if C is not chosen), and turns `/design` into the component showcase.
