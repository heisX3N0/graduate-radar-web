# Graduate Radar backlog

Open work only. Done items move to `docs/done.md` with what shipped, owner decisions (dated) and deviations. The full spec is `docs/build-spec.md`. Free-plan costs come from `docs/infra-capacity.md`.

Order: GR-001, GR-002, GR-003, then GR-008 (deploy early, owner decision 15 Nov 2026), then GR-004 to GR-007, GR-009, GR-010. Items stay in ID order below. Sizes: S under half a day, M about a day, L more than a day.

Owner decisions that apply to every item (15 Nov 2026): `*.pages.dev` address for launch; name Graduate Radar; 2 to 3 brand directions on `/design`, owner picks; Apply button on detail pages only; Cloudflare Web Analytics only, no Mixpanel; public repo `heisX3N0/graduate-radar-web` cloned into this folder; Cloudflare Pages, not Workers; spec fixes applied in place (spec section 14).

---

- [ ] **GR-003 Data layer: feed, snapshot, dates and slugs** (M)
  - **Why:** Every page reads listings through one module, so validation, the snapshot fallback, Lagos dates and stable slugs must be right once. The first-draft slug rule (`-2` on collision) could move a listing to another URL when rows were reordered.
  - **Do:** `src/data/feed.ts` (fetch `FEED_URL`, Zod schema, normalise, re-check link schemes, fall back to `snapshot.json` when the fetch fails, the response is invalid, or either list has under half the snapshot's count); `scripts/snapshot.ts` (`npm run snapshot`); first `src/data/snapshot.json` from the live feed; `src/lib/dates.ts` (Lagos today, deadline status, days left, "new this week"); `src/lib/slug.ts` (hash suffix on collision, spec 6.1); `src/lib/filters.ts` (filter and search logic shared by build and browser, used from GR-006).
  - **Tests:** Negative first:
    1. Fetch throws, returns 500, or returns HTML: build uses the snapshot and logs one warning.
    2. Feed JSON fails the schema (missing `key`, wrong type): snapshot used.
    3. Feed has 0 jobs, or fewer than half the snapshot's jobs: snapshot used (same for trainings, counted separately).
    4. A listing with a `javascript:` Apply link is dropped at build even if the feed lets it through.
    5. Deadline yesterday (Lagos) with Status Open: treated as Closed and hidden from lists.
    6. Lagos day boundary: at 23:30 UTC on 26 Nov, Lagos is 27 Nov, so a 26 Nov deadline is closed.
    7. `Rolling`, `Not stated` and `''` deadlines never close.
    8. Two keys that slugify to the same text both get hash suffixes, and their slugs do not change when the input order is reversed or a third listing is added.
    Happy path: deadline in 5 days shows Closing soon and "5 days left"; slug matches the spec example; first seen 3 days ago is "New this week".
  - **Docs:** README "How data flows" and "Refreshing the snapshot".
  - **Cost:** per build: 1 feed fetch (1 Apps Script execution). `npm run snapshot`: 1 execution. Users supported: unchanged.
  - **Depends on:** GR-002 (a live feed for the first snapshot).
  - **Open questions for the owner:** none.

- [ ] **GR-004 Brand directions on /design** (M)
  - **Why:** You asked for 2 to 3 real directions to choose from, not a generic template. The choice sets every token, so it comes before the component build.
  - **Do:** Build `/design` (not in nav) showing 2 to 3 distinct directions. Each one has: a colour system (primary, warm "Closing soon" accent, neutrals, semantic colours) checked for WCAG AA and for sunlight readability on cheap screens; a type choice (system stack or one self-hosted variable font, with its weight in KB); a job card and a detail page header in that direction; and a short reason grounded in the audience (trust, phones, WhatsApp arrivals, Nigerian without clichés). Share the preview URL or screenshots at 360 px for you to pick.
  - **Tests:** Negative first: any colour pair used for text below AA contrast fails a contrast check script; a direction whose font adds more than 50 KB fails the budget check. Happy path: each direction renders at 360 px with no horizontal scroll.
  - **Docs:** A short "Brand directions" note in `docs/design.md` with each direction's reasoning; after your pick, record the choice and delete the rest.
  - **Cost:** per visit: nothing metered. Builds: 1 per push. Users supported: unchanged.
  - **Depends on:** GR-001.
  - **Open questions for the owner:** none.
  - **Owner decisions (2026-11-15):** No colour or brand preferences: start from the audience and brand attributes only. No logo for now; each direction sets the name "Graduate Radar" as a typographic wordmark in its own type, so no logo file is needed. A logo can be its own item later.

- [ ] **GR-005 Design system: tokens and components** (L)
  - **Why:** Pages must be built only from shared components so later products (community, CV tool) reuse the look.
  - **Do:** Final `src/styles/tokens.css` and `global.css` from the chosen direction (spec section 7), then every component in spec 7 (Header, Footer, Hero, SearchInput, FilterBar, FilterChip, Select, ResultCount, ListingCard job and training variants, StatusBadge, DeadlineChip, EligibilityChecklist, ApplyButton with `mailto:`, ShareButton, SafetyNote, EmptyState, Banner, Breadcrumb). `/design` shows every component in every state. No Apply button on cards (owner decision).
  - **Tests:** Negative first: a lint rule or test fails on hard-coded colours, sizes or spacing in component styles (tokens only); ApplyButton refuses to render a link whose scheme is not `https`, `http` or `mailto`; focus states visible (keyboard test on `/design`). Happy path: every component renders at 360 px in all states; tap targets at least 44 px.
  - **Docs:** `docs/design.md` (tokens, component list, naming for later extraction).
  - **Cost:** per visit: nothing metered. Builds: 1 per push. Users supported: unchanged.
  - **Depends on:** GR-004 (your pick).
  - **Open questions for the owner:** none until GR-004 is decided.

- [ ] **GR-006 Jobs and Trainings list pages** (L)
  - **Why:** Finding an opening you qualify for in under a minute is the main goal.
  - **Do:** `/` and `/trainings` per spec 6.1 and 6.3: hero with last-updated date, "Closing this week" strip, full server-rendered list, Fuse.js search, filters, sort, filter state in the URL, result count, empty state. Without JavaScript the full list still shows. Includes `src/lib/filters.ts` (filter and search logic shared by build and browser), moved here from GR-003 because its rules depend on this item's UI choices.
  - **Tests:** Negative first:
    1. Closed and past-deadline listings never appear in the lists (server and browser).
    2. A URL with unknown or malformed filter values loads the unfiltered list without errors.
    3. "Min class I have: 2:2" hides 2:1-only listings and keeps "Not stated" ones.
    4. Search text is never written to the URL beyond the `q` parameter and is never sent anywhere.
    5. With JavaScript disabled, all open listings render.
    Happy path: "deloitte", "cyber", "abuja", "2:1" find the expected listings; filters combine; a copied URL reproduces the view; filtering 300 items stays instant (measured on a throttled mid-range profile, with the number reported).
  - **Docs:** README "Search and filters".
  - **Cost:** per visit: nothing metered (filtering runs in the browser). JS budget: Fuse.js plus filter code, measured and reported against 50 KB gzipped. Users supported: unchanged.
  - **Depends on:** GR-003, GR-005.
  - **Open questions for the owner:** "Min class I have" offers 2:1, 2:2 and Any. Does "Any" mean "show me everything" (no class filter), or "I have below a 2:2, show only listings that accept any class or don't say"? Recommended: the second, labelled plainly (for example "Third class or pass").

- [ ] **GR-007 Detail pages, trust pages, SEO and sharing** (L)
  - **Why:** Most visitors arrive on one listing from WhatsApp; the preview card, trust copy and Apply action decide whether they stay.
  - **Do:** `/jobs/[slug]`, `/trainings/[slug]`, `/about` (with the one-line privacy note), `/stay-safe`, `404`. Titles, meta descriptions, Open Graph and Twitter tags, one static OG image, `JobPosting` JSON-LD, `sitemap.xml`, `robots.txt`, WhatsApp share link (spec 6.1, 6.5).
  - **Tests:** Negative first:
    1. A Closed listing's page shows the closed banner, no Apply button, no JSON-LD, and links to similar open listings.
    2. JSON-LD is never emitted for a listing whose deadline has passed.
    3. A built-output scan finds no `Found via` value, no aggregator domain from that column, and no private-tab text anywhere in `dist/` (acceptance criterion 1).
    4. "Never pay to apply" is on every detail page (scan of `dist/`).
    5. An unknown slug serves the 404 page.
    Happy path: `mailto:` Apply opens mail; share text is "title · organisation · closes date · URL"; Rich Results test passes for one job page (manual); WhatsApp preview shows title and image (manual).
  - **Docs:** README "SEO and sharing".
  - **Cost:** per visit: nothing metered. Files per site: 1 per listing (about 0.5% of the 20,000 limit at 100 listings, estimate). Users supported: unchanged.
  - **Depends on:** GR-003, GR-005.
  - **Open questions for the owner:** none.
  - **Owner decisions (2026-11-15):** `/about` says nothing more about who runs the site than the sheet's `Start here` tab does today (no name, no company). Its copy is adapted from that tab: what Graduate Radar is, how it works (added every Tuesday and Friday, links to the employer's own page, suspicious listings checked and left out), what each section holds, how to read a listing, stay safe, and good to know ("we don't hire or process applications", "always confirm on the organisation's page"). Deviation for the website: drop the "Found via" line (that field never reaches the site) and the "use Ctrl+F" tip (the site has search). "WhatsApp channel: coming soon" stays out until a channel exists.

- [ ] **GR-008 Deploy, daily rebuild and analytics** (M)
  - **Why:** The site must update itself from the sheet with no manual work, and be live on `*.pages.dev`.
  - **Do:** Connect the repo to Cloudflare Pages (build command, `FEED_URL` as a build variable), create the deploy hook, put it in the Apps Script's Script Properties as `DEPLOY_HOOK_URL`, run `installRebuildTrigger()` once, turn on Cloudflare Web Analytics. You do the dashboard steps (they change account settings); I guide each one. Add Graduate Radar's rows to agent-vault's `shared-quotas.md` after merge.
  - **Tests:** Negative first: with `FEED_URL` unset the build uses the snapshot and logs the warning (checked in a preview deploy); with a wrong `FEED_URL` the same; a second run of `installRebuildTrigger()` leaves exactly one trigger. Happy path: change a listing's Notes in the sheet, run `triggerRebuild`, and the live page shows the change after the build; the next morning's 07:30 build appears in the deployments list without anyone touching it.
  - **Docs:** README "Deploy", `docs/infra-capacity.md` with the first measured build time and build count.
  - **Cost:** per day: 1 Pages build, 1 URL fetch, 2 to 3 Apps Script executions. Per month: about 31 of the account's roughly 300 remaining builds (estimate). Users supported: unchanged.
  - **Depends on:** GR-002, GR-003.
  - **Open questions for the owner:** none.
  - **Owner decisions (2026-11-15):** Deploy early: build this right after GR-003 and before GR-004, so every later PR gets a preview URL to open on a phone. Cost of that choice: preview builds start counting against the shared 500 a month from day 2 instead of day 5 (about 10 to 20 extra builds in launch week, estimate).

- [ ] **GR-009 Phone testing and budgets** (M)
  - **Why:** The audience is on mid-range Android over slow data; spec 6.6 sets hard budgets.
  - **Do:** Lighthouse mobile on the production URL (home, a job page, trainings), page weight and JS size measured, fixes for anything over budget. Owner tests on 3 or more real Android phones over mobile data.
  - **Tests:** Negative first: a CI size check fails if home page JS is over 50 KB gzipped or home page transfer is over 150 KB (excluding analytics); a 360 px screenshot check fails on horizontal scroll. Happy path: Lighthouse mobile Performance at least 90, Accessibility at least 95, SEO at least 95 (3 runs each, median reported).
  - **Docs:** `docs/done.md` entry with the measured numbers and sample sizes.
  - **Cost:** per visit: nothing metered. Users supported: unchanged.
  - **Depends on:** GR-006, GR-007, GR-008.
  - **Open questions for the owner:** none.

- [ ] **GR-010 Launch** (S)
  - **Why:** The sheet's `Start here` tab and the WhatsApp post still point to the old "Publish to web" view.
  - **Do:** Draft the new `Start here` text and the WhatsApp post for you. You publish them; editing the sheet and posting are yours to approve, and I only change the sheet if you ask me to.
  - **Tests:** Negative first: the WhatsApp post and `Start here` tab do not point people to the "Publish to web" URL as the main link; the "Publish to web" URL still loads after launch (kept as a fallback). Happy path: the WhatsApp post's link shows the preview card and opens the site.
  - **Docs:** README "Launch" note (the fallback exists and where); `docs/done.md`.
  - **Cost:** nothing metered beyond visits (static). Users supported: unchanged.
  - **Depends on:** GR-009.
  - **Open questions for the owner:** none.
  - **Owner decisions (2026-11-15):** Keep the "Publish to web" view live as a fallback after launch. Downside: anyone who finds it sees the old view (cut-off text, no filters, and whatever columns the published tabs show, possibly `Found via`); the website is the link we share.
