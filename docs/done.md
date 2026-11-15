# Graduate Radar: done archive

Finished backlog items, newest first. Each entry: ID and title, merge SHA, what shipped, owner decisions (dated), deviations from the item.

---

- [x] **GR-009 Phone testing and budgets** (M). Done in f1bb663 (checks) and 2b411d7 (review fixes).
  - **Shipped:** `scripts/check-budgets.ts`, part of `npm run build`: every built page must stay within 50 KB of JavaScript and a 150 KB first load (HTML with inline styles and scripts, linked CSS, linked JS), all gzipped, and fails if a linked asset is missing. `scripts/check-mobile.ts` (`npm run check:mobile`, the fifth gate and a CI step after build): opens every built page in headless Chrome or Edge at 360 x 800 with mobile emulation, opens closed `<details>` panels, and fails on sideways scroll (naming the elements that stick out) or a tap target under 44 px (inline text links in a sentence are exempt). It talks to the browser over the DevTools protocol with Node's built-in WebSocket: no new dependency. `scripts/browsers.ts` (one browser lookup for this check and `npm run og`). Fixes the check found: `/design` overflowed at 360 px, and the breadcrumb could widen any grid column (now `min-width: 0` and `overflow: hidden`, with room for the focus ring); body text now wraps long unbroken words and URLs (`overflow-wrap: anywhere`). 13 new tests (324 in total).
  - **Measured, page weight (15 Nov 2026, this branch's build, snapshot data):** home page HTML 7.3 KB, CSS 1.5 KB, JS 10.0 KB, first load 18.8 KB gzipped (budgets 50 KB JS, 150 KB first load). All 30 built pages pass both budgets and the 360 px check.
  - **Measured, Lighthouse 13.6.0 (15 Nov 2026, live site, the GR-007 production build ef7b6a9, mobile defaults: simulated 150 ms RTT, 1.6 Mbps, 4x CPU slowdown; 3 runs per page, median):**
    - Home: Performance, Accessibility, Best practices and SEO all 100; LCP 0.99 s, TBT 5 ms, CLS 0.000; transfer 32.5 KB.
    - A job page (Deloitte cyber): all 100; LCP 0.96 s, TBT 66 ms, CLS 0.000; transfer 19.4 KB.
    - Trainings: all 100; LCP 0.96 s, TBT 0 ms, CLS 0.001; transfer 30.7 KB.
  - **Not verified (owner):** real Android phones over mobile data (3 or more), see the PR's manual tests.
  - **Deviations:**
    1. Lighthouse ran on the GR-007 build already live, not on this branch. This branch changes only CSS (one body rule, the breadcrumb, `/design`), so the scores should not move; a re-run after this deploys would confirm it.
    2. Lighthouse's mobile defaults simulate slow 4G, not the slow 3G named in spec section 9 (milestone 6). Slow 3G was not measured.
    3. The 360 px check measures the page in the browser rather than comparing screenshots, and it also checks tap targets (not in the item).
    4. The budgets apply to every built page, not only the home page. Fonts and images are not counted: the site uses system fonts and loads no images on its pages (the sharing image is fetched only by link previews).
    5. `npm run og` now looks for Chrome before Edge on Windows (shared lookup). A re-render with Chrome may differ by a few pixels from the current image, which was made with Edge.

- [x] **GR-007 Detail pages, trust pages, SEO and sharing** (L). Done in 1675d6c (pages) and 4ffeb57 (review fixes).
  - **Shipped:** `/jobs/<slug>` and `/trainings/<slug>` for every listing in the feed (closed ones: "This opening has closed", no Apply, no JSON-LD, `noindex`, similar open listings); a small browser re-check (448 bytes gzipped) that updates days left and closes the page if the deadline passes after the build; `/about` (from the Start here tab, with the privacy note), `/stay-safe`, `404`; canonical, Open Graph and Twitter tags with absolute URLs; favicon; sharing image `public/og-default.png` (1200 x 630, 50,507 bytes) from `scripts/og/og.html` via `npm run og`; JobPosting JSON-LD on open job pages; `sitemap.xml` and `robots.txt`; `scripts/check-dist.ts`, now part of `npm run build`. 45 new tests (311 in total).
  - **Verified (15 Nov 2026, one run each):** browser pane at 360 x 800 on the MoMo job page: Apply, "Never pay to apply", WhatsApp text in spec format, canonical and image URLs absolute, JobPosting with validThrough, no sideways scroll, all tap targets at least 44 px, breadcrumb one row; About, Stay safe and 404 without overflow; an unknown job address returns the 404 page with status 404; sitemap has 28 addresses (4 pages, 17 jobs, 7 trainings). The dist scan failed (exit 1) on an injected "Found via" and on a detail page without "Never pay to apply", and passed again after a clean build.
  - **Not verified (owner):** Google's Rich Results test on a live job page, and the WhatsApp preview card from a real share.
  - **Owner decisions (2026-11-15):** `/about` copy from the Start here tab, no name or company, no Found via or Ctrl+F lines.
  - **Deviations:**
    1. The dist scan runs inside `npm run build` (review finding), so Cloudflare's daily builds refuse to deploy private data; CI's separate step was removed.
    2. Detail pages re-check the deadline in the browser (review finding; not in the item).
    3. The scan matches the field forms of "Found via" (a label, a header cell, the field names), not the bare phrase, so ordinary notes don't fail the build. It cannot know the aggregator domains themselves; the feed's field allowlist remains the main guard.
    4. Slugs repeat the year for keys whose title already ends in one (for example `...programme-2026-2026`), because the key includes both. Harmless; noted for the sweep.

- [x] **GR-006 Jobs and Trainings list pages** (L). Done in dbfdfb5 (pages) and 6cb17fd (review fixes).
  - **Shipped:** `/` and `/trainings` with hero (data date), "Closing this week", search, filters, sort, result count, cards and empty state; every open listing in the HTML without JavaScript. `src/lib/filters.ts` (groups, degree class rule, URL state, open-only, sort, Fuse.js search), `src/scripts/list-page.ts` (filters cards in place, URL state, re-checks deadlines and refreshes card labels in Lagos time), `src/lib/list-data.ts` (slim browser data, script-safe JSON), `src/lib/links.ts` (link check without Zod), components ListLayout and ClosingSoon. On phones the filters fold under "Filters and sort". 70 new tests (266 in total).
  - **Measured (15 Nov 2026):** browser script 10,864 bytes gzipped, no Zod (budget 50 KB). Jobs page first load about 19 KB gzipped (HTML 6.3 KB, CSS 2.4 KB, script 10.9 KB; budget 150 KB). Filter plus search over 300 synthetic listings: 2.05 ms median, 9.04 ms slowest (50 runs, Node 24.14 on this PC, not throttled). In the browser pane at 360 x 800: no sideways scroll, all tap targets at least 44 px, bad URLs load the full list, filters combine, a shared link reproduces the view, no network calls for search. First listing card starts 928 px down with filters folded.
  - **Owner decisions (2026-11-15):** "Min class: Any" means below a 2:2, labelled "Third class or pass".
  - **Deviations:**
    1. The "throttled mid-range profile" timing was not possible from here; the number above is unthrottled Node. A mid-range phone will be slower; GR-009 measures on real phones.
    2. Filters fold under "Filters and sort" on phones (not in the spec) because, open, they pushed the first listing far down the page.
    3. The page tests were written after the pages; a mutation check (removing the open-only filter) made 3 of them fail, so they do catch the leak they guard.
    4. Review finding on duplicated listing text deferred, recorded in `docs/infra-capacity.md` with a trigger of about 150 listings.

- [x] **GR-005 Design system: tokens and components** (L). Done in 7dd31d4 (system) and 1e6d0a2 (review fixes).
  - **Shipped:** `src/styles/tokens.css` and `global.css` from direction A (Noticeboard); 19 components in `src/components/` (Header, Footer, Hero, SearchInput, FilterBar, FilterChip, Select, ResultCount, ListingCard for jobs and trainings, StatusBadge, StatusStamp, DeadlineChip, EligibilityChecklist, ApplyButton, ShareButton, SafetyNote, EmptyState, Banner, Breadcrumb) and `src/layouts/Base.astro`; `src/lib/listing-text.ts` (shared wording); `scripts/check-styles.ts` in `npm run lint`; `/design` is now the showcase of every token and component state; the placeholder home page uses the new frame. Directions B and C, `src/design/samples.ts` and Bricolage Grotesque removed. Components tested with Astro's container API (`vitest.config.ts` uses `getViteConfig`). 196 tests: 82 in new files (tokens 6, style check 14, wording 23, components 32, contrast 7, of which 6 moved from the removed directions test); 24 removed with B and C.
  - **Verified (15 Nov 2026, `/design` in the browser pane at 360 x 800, one run each):** page width 360, nothing past the edge; 24 visible tap targets, all at least 44 px; 30 keyboard Tab stops, all with a visible focus ring.
  - **Owner decisions (2026-11-15):** direction A with the Checked stamp; "Checked", not "Verified"; no ticks on eligibility; no Apply on cards.
  - **Deviations:**
    1. SkeletonCard not built: nothing loads on the client (spec 7 lists it only "if any client loading is used").
    2. The look-alike between "New this week" and the stamp is solved by a rule: badges are filled, stamps are outlined.
    3. Apply links use `rel="noopener"` without `noreferrer` (review finding), so employers see visits come from graduate-radar.pages.dev. The browser's default referrer policy sends only the site address, never the page path. The owner can veto.
    4. The 360 px, tap target and focus checks were done by hand in the browser pane; the automatic checks are in GR-009.

- [x] **GR-004 Brand directions on /design** (M). Done in f7734a8 (directions), 1199c5c (review fixes), 5baf30d (Checked stamp).
  - **Shipped:** `/design` (noindex, not linked) with three directions (A. Noticeboard, B. Stamped, C. Bright Start), each beside a 360 px phone frame of real listings; `src/design/directions.ts` (tokens, type, reasoning, downsides), `src/design/contrast.ts` (WCAG contrast with a sunlight bar: body 7:1, everything else 4.5:1), `src/design/samples.ts` (safe sample picking), `shortDate` in `src/lib/dates.ts`, `docs/design.md`. 26 new tests (138 in total).
  - **Verified:** every direction passes every contrast pair (ink on paper 15.9:1, 15.7:1, 16.4:1); font budget from real file sizes (C: 41.3 KB, A and B: 0 KB); 360 px in the browser pane, page width exactly 360 px and nothing past the edge (one run each, before and after the stamp).
  - **Owner decisions (2026-11-15):** Direction A, Noticeboard, with B's verified stamp adapted as a quiet ink-green "Checked <date>" stamp (not "Verified"; no ticks on eligibility). Recorded in `docs/design.md` and in GR-005.
  - **Deviations:**
    1. The 360 px check was by hand in the browser pane, not an automatic test; the automatic check is in GR-009.
    2. The other directions are not deleted here; GR-005 deletes B, C and the font dependency when it builds the system (so `/design` keeps working until then).
    3. Review finding 6 (hard-coded greys on `/design`) moved to GR-005.

- [x] **GR-008 Deploy, daily rebuild and analytics** (M). Done in ce36c84 (rebuild and steps), 8ad01ae (review fixes), f961ad5 (measured builds).
  - **Shipped:** live at https://graduate-radar.pages.dev (Cloudflare Pages, build image v3, Node from `.nvmrc`). `triggerRebuild` only calls `https://api.cloudflare.com/` hooks, throws on any non-2xx answer or network error, and never puts the hook URL in an error. Deploy hook `daily-rebuild` (branch `main`) in Script Properties; one time-based `triggerRebuild` trigger. Web Analytics enabled. Failed-deployment emails for production. README "Deploy (Cloudflare Pages)" with 11 steps and failure handling; `docs/public-routes.md` covers the hook; capacity doc has the first measured builds. 12 new tests (112 in total).
  - **Verified (15 Nov 2026):** live site HTTP 200 from Cloudflare's Lagos location, "Open now: 17 jobs and 7 trainings. Data from 2026-11-15" (one fetch). Preview `https://gr-008-deploy.graduate-radar.pages.dev` built for this PR, same counts, with the Web Analytics script. Owner screenshots: `FEED_URL` set, deploy hook present, one `triggerRebuild` trigger (not yet run), Web Analytics enabled, failed-deployment notification set.
  - **Not yet verified:** that the production build read the live feed rather than the snapshot (same counts either way; the build log's `[feed]` lines would show it); the first scheduled 07:30 rebuild (16 Nov); the Web Analytics script on production (it arrives with the next production build).
  - **Owner decisions (2026-11-15):** deploy early; Pages, not Workers; owner did the dashboard and Apps Script steps; old Worker deleted by the owner.
  - **Deviations:**
    1. My first setup steps described the older Pages flow; the dashboard's Create button made a Worker instead, whose build failed. The owner deleted it and created the Pages project. Lesson: read the live dashboard (or ask for a screenshot) before giving click paths.
    2. The deleted Worker's Git connection still runs a "Workers Builds: graduate-radar" check on every push, which fails at once ("This Worker does not exist on your account"). It is not a required check and uses no Pages builds. No documented way to remove it was found.
    3. Build duration comes from commit and check times (1 sample), not the dashboard's Details page.

- [x] **GR-003 Data layer: feed, snapshot, dates and slugs** (M). Done in cf18964 (data layer) and 8a44fc6 (review fixes).
  - **Shipped:** `src/data/schema.ts` (feed contract in Zod, via Astro's bundled copy, so no new dependency; unknown fields stripped), `src/data/feed.ts` (`getListings()`: one fetch per build, 30 second timeout, per-listing checks, snapshot fallback, refuses an empty site, slugs), `src/lib/dates.ts` (Lagos today, deadlines, effective status, new this week, days-left labels), `src/lib/slug.ts` (hash suffix on collision; slugs never move when other rows change), `scripts/snapshot.ts` (`npm run snapshot`, same rules as the build), first `src/data/snapshot.json` from the live feed (17 jobs, 7 trainings). The placeholder page shows open counts and the date the data came from, to prove the build reads the feed.
  - **Verified:** builds with the live feed (no warning), with no `FEED_URL` and with a broken URL (HTTP 404) both fell back to the snapshot with one warning; a local `.env` alone feeds the build. 100 tests (61 new for this item: 25 dates, 8 slugs, 28 loader).
  - **Owner decisions (2026-11-15):** none new.
  - **Deviations:**
    1. `src/lib/filters.ts` moved to GR-006: its rules depend on that item's UI, and one ("Min class: Any") is an open question there.
    2. Item test 2 said any schema failure uses the snapshot. After review, one bad listing is dropped alone with a warning; only a wrong top-level shape uses the snapshot. Reason: one odd row should not freeze the whole site.
    3. The half-count rule compares with the snapshot's listings still open today, and is skipped (with a warning) once the snapshot is over 14 days old. Reason: a real drop in openings (for example over the holidays) would otherwise freeze the site on the snapshot.
    4. `npm run snapshot` sets the exit code instead of calling `process.exit`, which crashed Node 24.14 on Windows while the fetch timer was open.

- [x] **GR-002 Apps Script feed** (M). Done in 157aea3 (feed), 5f46160 (review fixes), b501a18 (single read).
  - **Shipped:** `apps-script/Feed.gs` deployed as the sheet's web app (Version 1, 15 Nov 2026, 02:02, after b501a18 was pushed; the deployed code was not compared line by line with the repo). Field allowlist, header lookup by name, Apply links limited to `https`, `http`, `mailto`, statuses Open, Closing soon and Closed for 60 days, dates normalised in Lagos time (real calendar days only), first row kept for a repeated Key, tab refused on a duplicated header, cache size checked in bytes. Every cell read once as displayed plus the three date columns raw. 33 feed tests run the real file against Apps Script stand-ins. README deploy steps, `.env.example`, public routes updated; spec 5.4 points to `Feed.gs`.
  - **Live check (15 Nov 2026, one fetch):** HTTP 200, `application/json`, 17,015 bytes. 17 jobs (14 Open, 3 Closing soon) and 7 trainings (6 Open, 1 Closing soon). Only allowlisted fields, no `Found via` text anywhere, every Apply link `https` or `mailto`, every date valid, no repeated keys.
  - **Owner decisions (2026-11-15):** gmail.com account; owner deploys, guided; feed reads the original sheet, and the public copy stays as the "Publish to web" fallback; no `@OnlyCurrentDoc`; the double read fixed rather than skipped.
  - **Deviations:**
    1. Added beyond the item, from review: byte-based cache guard, real-date check, repeated Key and duplicate header handling, future `Verified on` dropped, route test, and a single cell read.
    2. `npm run build` fails inside a worktree when the main checkout has no `node_modules` (the bundler reads the parent `tsconfig.json`). Proved by building the same files outside the checkout; recorded in `CLAUDE.md`; CI not affected.
  - **Data to look at (not feed bugs):** one job applies through a `bit.ly` short link (destination hidden) and one through a `@gmail.com` address (a red flag on the Stay safe list).

- [x] **GR-001 Repo, scaffold and project rules** (S). Done in c663748 (scaffold) and 3775b38 (review fixes).
  - **Shipped:** public repo `heisX3N0/graduate-radar-web`; Astro 7.4.12 static site (one placeholder page) with TypeScript, ESLint, Prettier, Vitest; `npm run lint` (ESLint, Prettier check, dash check), `check`, `test`, `build`; `scripts/check-dashes.ts` with 6 tests; CI workflow running the four gates on every PR and on main; `CLAUDE.md`, `README.md`, `docs/public-routes.md`, PR template, `.gitattributes` (LF), `.nvmrc` (24); spec moved to `docs/build-spec.md`.
  - **Owner decisions (2026-11-15):** first docs-only commit went straight to `main` (6e1a2ea); `/code-review` before each PR instead of an automatic review.
  - **Deviations:**
    1. TypeScript is pinned to 6.0.3, not the latest 7.0.2: typescript-eslint 8.72 supports `<6.1.0` and @astrojs/check 0.9 supports `^5 || ^6` (npm peer ranges, 15 Nov 2026).
    2. CI does not reuse agent-vault's shared workflows: the only one there is the Claude PR review, which this repo does not use (owner decision above). The CI file is local to the repo.
    3. Negative CI check: a throwaway draft PR (heisX3N0/graduate-radar-web#1, closed, branch deleted) proved CI fails on a lint error (run 43658187154). Lint stops the job first, so the failing test and the dash were proved failing locally on the same commit (exit 1 each), not in CI.
    4. `engines.node` is `^22.23.4 || ^24.16.0 || >=26.3.0` to match eslint-plugin-astro. The owner's machine has Node 24.14.0, which works with warnings; updating to 24.16 or later removes them.
