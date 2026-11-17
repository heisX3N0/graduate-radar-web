# Graduate Radar backlog

Open work only. Done items move to `docs/done.md` with what shipped, owner decisions (dated) and deviations. The full spec is `docs/build-spec.md`. Free-plan costs come from `docs/infra-capacity.md`.

Order: GR-001, GR-002, GR-003, then GR-008 (deploy early, owner decision 15 Nov 2026), then GR-004 to GR-007, GR-009, GR-010, GR-011, GR-012, GR-013. Then GR-015, GR-016, GR-017, one after another (owner decision 17 Nov 2026). Items stay in ID order below. Sizes: S under half a day, M about a day, L more than a day.

Owner decisions that apply to every item (15 Nov 2026): `*.pages.dev` address for launch (replaced by `graduateradar.versionphi.com` in GR-012, owner decision 15 Nov 2026); name Graduate Radar; 2 to 3 brand directions on `/design`, owner picks; Apply button on detail pages only; Cloudflare Web Analytics only, no Mixpanel; public repo `heisX3N0/graduate-radar-web` cloned into this folder; Cloudflare Pages, not Workers; spec fixes applied in place (spec section 14).

---

Background for GR-015 to GR-017: a design audit on 17 Nov 2026 (built site served locally, 360 x 800 and 1280 x 800, one run each) checked the pages against spec 7's rule of no generic template looks. The basics held up (text contrast 6.2:1 to 17.5:1, focus ring 17.46:1, home first load 22.1 KB gzipped, "Never pay to apply" on 63 of 63 detail pages). What read as generic was the card structure, the tinted badges and the centred desktop layout. The owner chose the "ledger by deadline" direction on phones and the "broadsheet" direction on desktop from mockups built with 15 real listings from that day's build (the mockups are not in the repo).

- [ ] **GR-017 Desktop: broadsheet layout** (M)
  - **Why:** at 1280 x 800 (one run) the content is a 960 px block centred with 160 px of empty paper each side; the wordmark, nav, hero and "Last updated" line are all centred. Centring everything and leaving the width unused reads as a template, not as a vacancies page. After GR-015 the list is one column, which leaves the same empty sides.
  - **Do:**
    1. Header from 960 px: wordmark on the left, nav on the right (Jobs, Trainings, Stay safe; About stays in the footer), and a date line under it above the double rule. The date line shows the data's "updated" date ("Updated Tuesday 17 November 2026 · Graduate jobs and free trainings for Nigerian graduates"), never the build date (GR-011), with the count and "each checked on the employer's own page" on the right. Phones keep the GR-015 header.
    2. List pages from 1200 px: three columns in a wider container (new token, about 76rem): filters in a left rail that stays in view (open, no Filters button), the ledger in the middle with location in its own right-aligned column, and a right rail with the "Never pay to apply" notice, three red flags linking to Stay safe, a link to the other list, and the WhatsApp channel link.
    3. List pages from 960 to 1199 px: filters rail and ledger; the notice sits above the list.
    4. Detail pages from 960 px: the article at reading width on the left (about 42.5rem); a right rail that stays in view with the notice and similar openings; Apply and Share side by side.
    5. Nothing is centred at any width. Trainings use the same frame.
    6. Each part is in the DOM once, placed by grid areas (no copies for desktop), so screen readers and the no-JS page read it once.
    7. Extend `npm run check:mobile` (or add a check) to also load each page type at 768, 1024 and 1280 px.
  - **Tests:**
    1. No page scrolls sideways at 360, 768, 1024 or 1280 px.
    2. At 1280 px no ledger title column is narrower than 480 px, and nothing is laid out as a card grid.
    3. Each page has exactly one "Never pay to apply" notice element (plus the footer line); it is not duplicated for desktop.
    4. Keyboard order is masthead, filters, list, right rail, footer, and every stop shows the focus ring.
    5. At 1024 px the notice is above the list, not lost below 39 listings.
    6. Below 960 px the page matches GR-015 (no rails).
    7. The date line shows the data's date, not the build date: a build from a stale snapshot shows the snapshot's date. No About link in the main nav.
    8. Happy path: at 1280 px the masthead's wordmark is left aligned; the three columns appear on both list pages; the detail page's rail stays in view while the article scrolls.
  - **Docs:** spec 6.6 (widths checked), 7 (breakpoints in use, layout per width); `docs/design.md` layout and tokens; README only if it lists the checks.
  - **Cost:** per visitor: 0 metered requests, 0 Pages builds; CSS grows slightly (estimate under 1 KB gzipped), no JS. Dev: about 3 to 5 Pages builds (estimate); the wider page check adds CI time, not charged while the repo is public. Users supported: unchanged.
  - **Depends on:** GR-015 and GR-016 merged and deployed (it lays out their finished rows, notice and facts table).
  - **Open questions for the owner:** none.
  - **Owner decisions (2026-11-17):** broadsheet, not list and detail side by side; the date line shows the data's updated date; About stays out of the main nav; do it now, because the cost is low.
