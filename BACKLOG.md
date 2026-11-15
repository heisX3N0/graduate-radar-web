# Graduate Radar backlog

Open work only. Done items move to `docs/done.md` with what shipped, owner decisions (dated) and deviations. The full spec is `docs/build-spec.md`. Free-plan costs come from `docs/infra-capacity.md`.

Order: GR-001, GR-002, GR-003, then GR-008 (deploy early, owner decision 15 Nov 2026), then GR-004 to GR-007, GR-009, GR-010. Items stay in ID order below. Sizes: S under half a day, M about a day, L more than a day.

Owner decisions that apply to every item (15 Nov 2026): `*.pages.dev` address for launch; name Graduate Radar; 2 to 3 brand directions on `/design`, owner picks; Apply button on detail pages only; Cloudflare Web Analytics only, no Mixpanel; public repo `heisX3N0/graduate-radar-web` cloned into this folder; Cloudflare Pages, not Workers; spec fixes applied in place (spec section 14).

---

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
  - **Open questions for the owner:** none.
  - **Owner decisions (2026-11-15):** "Min class I have" option "Any" means "I have below a 2:2": it shows only listings that accept any class or do not state one, and is labelled plainly ("Third class or pass"). 2:1 shows everything; 2:2 hides listings that need a 2:1.

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
