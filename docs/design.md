# Design

Graduate Radar uses **direction A, Noticeboard, with the "Checked" stamp**, chosen by the owner on 15 Nov 2026 (GR-004): the vacancies page of a newspaper you trust, made for a phone. Live showcase: `/design` (not linked, not indexed), with every token and every component in every state.

## Why this look

- **Trust first.** Graduates are targeted by fake jobs. Newsprint paper, serif headlines and hairline rules borrow the credibility of national newspapers' vacancies pages, where graduates have long found real openings.
- **Fast on slow data.** Phone fonts only (Noto Serif and Roboto on Android): 0 KB of fonts downloaded.
- **Readable in sunlight.** Near-black ink on warm paper, 15.9:1 (measured, `contrastRatio`).
- **One strong colour.** Ink green is saved for actions (Apply, links) and the Checked stamp. Red is for urgency only (closing soon, closed, warnings).

## Tokens (`src/styles/tokens.css`)

The only place colours, sizes and spacing are defined. `scripts/check-styles.ts` (part of `npm run lint`) fails if a component or layout style uses a hard-coded colour, length or named colour. `tests/tokens.test.ts` checks every text colour pair against a sunlight bar: 7:1 for body text, 4.5:1 for everything else.

- **Colour:** `--color-bg`, `--color-surface`, `--color-neutral-bg`, `--color-ink`, `--color-ink-muted`, `--color-rule`, `--color-primary`, `--color-on-primary`, `--color-primary-soft`, `--color-soon`, `--color-soon-bg`, `--color-ok`, `--color-ok-bg`, `--color-new`, `--color-new-bg`.
- **Type:** `--font-display` (serif), `--font-body` (sans); sizes `--font-size-xs` (12) to `--font-size-2xl` (30), body 16; line heights, weights, `--tracking-caps`.
- **Space:** `--space-1` (4 px) to `--space-12` (48 px).
- **Shape:** square (`--radius-none`, `--radius-sm` 2 px); borders `--border-thin`, `--border-stamp`, `--border-strong`, `--border-double`, `--border-accent`.
- **Layout:** `--tap-min` (44 px), `--tap-comfort` (48 px), `--measure`, `--container`, `--sidebar`, `--label-width`.
- **Other:** z-index layers, focus ring (3 px ink), motion durations (0 when `prefers-reduced-motion`).
- **Breakpoints** cannot be custom properties in media queries, so they are written in `@media` lines only: 40rem (640 px), 60rem (960 px), 75rem (1200 px).
- **Dark mode:** not in v1. Redefine the `--color-*` tokens under `prefers-color-scheme: dark`; nothing else needs to change.

## Components (`src/components/`)

Named generically so they can move into a shared package for later products.

| Component | What it is | States on `/design` |
| --- | --- | --- |
| Header | Masthead: serif wordmark, double rule, main nav (current page marked) | as used |
| Footer | Never pay to apply, update schedule, Stay safe and About links | as used |
| ListHead | List page heading set like a newspaper section, and one line: count, where each listing was checked, last updated (the data's date) | with date |
| StatusBadge | Filled label: Closing soon, Remote, New this week | all three |
| StatusStamp | Outlined "Checked 14 Nov"; never "Verified"; nothing for a bad date | with and without date |
| DeadlineChip | Boxed deadline: red within 7 days, muted when closed | 6 states |
| ListingRow | Ledger row on list pages: date column, title, organisation and place, eligibility; whole row links to the detail page; no badges, stamp or boxed deadline | today, next 7 days, later, rolling, no date, training |
| ListSection | Ruled section header with a count that stays at the top while its rows scroll; red only when urgent; hidden when empty | all four job sections, one track |
| ListingCard | Similar openings on detail pages (the list pages use rows); whole card links to the detail page; no Apply button | 6 job states, 1 training |
| EligibilityChecklist | Labelled list, no ticks | stated, not stated |
| ApplyButton | Web or email; refuses any other link | web, email, refused |
| ShareButton | WhatsApp link: title, organisation, closing date, page | as used |
| SafetyNote | Never pay to apply, link to Stay safe | as used |
| Banner | info, warning, closed | all three |
| Breadcrumb | Labelled nav, current page marked | as used |
| SearchInput | Labelled search box | empty |
| Select | Labelled native select | value chosen |
| FilterChip | Toggle with `aria-pressed` | on, off |
| FilterBar | Search and the Filters toggle on one row; the filters open below; one column at every width (GR-017 brings the desktop rail) | as used |
| ResultCount | "17 openings", polite live region | 0, 1, many |
| EmptyState | No matches, with Clear filters | as used |
| Base layout | Head, skip link, Header, main, Footer | every page |

Not built: SkeletonCard. Lists render on the server and filter in place, so nothing loads on the client (spec 7 lists it only "if any client loading is used").

Rules the components follow:

- **Badges are filled, stamps are outlined.** Filled badges are facts about a listing; outlined stamps (Checked, deadline) are marks made by Graduate Radar. This keeps "New this week" from looking like the Checked stamp.
- **No Apply in lists** (owner decision): people read eligibility on the detail page first.
- **Rows, not cards, on list pages** (owner decision 17 Nov 2026): the section header says how soon a listing closes, so a row carries no badge, stamp or boxed deadline. Red is for the first two section headers only.
- **No ticks on eligibility**: a tick beside "2:1 or above" reads as "you meet this".
- **Tap targets** at least 44 px; Apply at least 48 px.
- **Focus:** every focusable element shows a 3 px ink ring when reached by keyboard; a focused row or card rings the whole row or card.
- **Wording** for deadlines, badges, eligibility, Apply and sharing comes from `src/lib/listing-text.ts`, so it reads the same everywhere.

## Checks done on 15 Nov 2026 (`/design`, browser pane at 360 x 800, one run each)

- Page width exactly 360 px; no element past the right edge.
- 24 visible tap targets, all at least 44 px tall.
- 30 keyboard Tab stops, every one with a visible focus ring (links, search, select, chips, cards, Apply, Share, skip link).
