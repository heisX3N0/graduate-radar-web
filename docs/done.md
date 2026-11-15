# Graduate Radar: done archive

Finished backlog items, newest first. Each entry: ID and title, merge SHA, what shipped, owner decisions (dated), deviations from the item.

---

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
