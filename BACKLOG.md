# Graduate Radar backlog

Open work only. Done items move to `docs/done.md` with what shipped, owner decisions (dated) and deviations. The full spec is `docs/build-spec.md`. Free-plan costs come from `docs/infra-capacity.md`.

Order: GR-001, GR-002, GR-003, then GR-008 (deploy early, owner decision 15 Nov 2026), then GR-004 to GR-007, GR-009, GR-010, GR-011. Items stay in ID order below. Sizes: S under half a day, M about a day, L more than a day.

Owner decisions that apply to every item (15 Nov 2026): `*.pages.dev` address for launch; name Graduate Radar; 2 to 3 brand directions on `/design`, owner picks; Apply button on detail pages only; Cloudflare Web Analytics only, no Mixpanel; public repo `heisX3N0/graduate-radar-web` cloned into this folder; Cloudflare Pages, not Workers; spec fixes applied in place (spec section 14).

---

- [ ] **GR-011 Remove the update schedule from the site and docs** (S)
  - **Why:** The site promises "Updated every Tuesday and Friday", but the sweep will move to daily over time, and each change of schedule would mean editing copy in many places. Found 13 mentions in 12 files (grep, 15 Nov 2026): the hero (`src/components/Hero.astro:18`), the footer on every page (`src/components/Footer.astro:11`), the empty results message (`src/components/EmptyState.astro:12`), About (`src/pages/about.astro:22`), the meta descriptions of `/` and `/trainings` (`src/pages/index.astro:59`, `src/pages/trainings.astro:53`), the green stamp on the sharing image (`scripts/og/og.html:74`, baked into `public/og-default.png`), both launch drafts (`docs/launch.md:20`, `:45`), `README.md:10` and `docs/build-spec.md` lines 19, 53 and 77. No test checks the wording.
  - **Do:**
    - Site copy (option A): hero keeps one line, "Graduate trainee programmes, entry-level jobs and free tech trainings.", with the existing "Last updated <date>" line as the only freshness signal. Footer and About: "We add new openings and mark closed ones as we find them." Empty results: "Try fewer filters, or check back soon." Meta descriptions end without a schedule.
    - Sharing image: the green stamp reads "Checked openings"; re-render `public/og-default.png` with `npm run og`.
    - `docs/launch.md`: both drafts drop the schedule line (not yet published, so the owner has nothing to edit by hand).
    - `README.md` and `docs/build-spec.md`: describe "a scheduled Claude sweep" without days or a time, so a move to daily needs no doc edit. Spec line 77 says the sheet changes when the sweep runs rather than "twice a week".
    - A check in `npm run lint` that fails on a schedule claim ("every Monday" to "every Sunday", "Tuesday and Friday", "Tue and Fri", "Tue/Fri", "twice a week") in `src/`, `scripts/og/`, `public/` text files, `docs/launch.md`, `README.md` and `docs/build-spec.md`. `docs/done.md` and `BACKLOG.md` are history and are skipped.
  - **Tests:** Negative first: the new check fails on "Updated every Tuesday and Friday" in a component, on "Tue/Fri" in the README and on "twice a week" in the spec, with file and line; it fails on a schedule line inside a launch draft; it does not fail on a weekday on its own ("Interviews hold on Friday"), so ordinary text is not caught. Not scanned: the built site, because listing notes from the sheet can name a day and must never fail a daily build. Happy path: the repo passes the check after the copy change; the hero still shows "Last updated"; the 360 px check and budgets still pass; the new sharing image is 1200 x 630 and within the size of the current one (50,507 bytes) or close to it.
  - **Docs:** README (data flow line and the new lint check), `docs/build-spec.md`, `docs/launch.md`, `docs/done.md`.
  - **Cost:** per visit: unchanged (static, same page sizes within a few bytes). Cloudflare Pages: one preview build for the PR and one production build on merge (of 500 a month, shared with Aimery). Dev only: one CI run per push. Users supported: unchanged. Money: $0.
  - **Depends on:** GR-010 (merged).
  - **Side effects:** WhatsApp keeps its stored preview for links already shared, so old shares may show the old stamp for a while. Google shows the old description until it recrawls. `npm run og` now uses Chrome, not Edge, so the image may differ by a few pixels beyond the stamp. "Last updated" moves every morning with the daily rebuild, even on days the sweep adds nothing.
  - **Open questions for the owner:** none.
  - **Owner decisions (2026-11-15):** option A (no schedule anywhere; the "Last updated" date stays); sharing image stamp "Checked openings"; README and spec drop the sweep's days and time too; the launch drafts are not yet published.
