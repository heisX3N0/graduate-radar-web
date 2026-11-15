# Graduate Radar backlog

Open work only. Done items move to `docs/done.md` with what shipped, owner decisions (dated) and deviations. The full spec is `docs/build-spec.md`. Free-plan costs come from `docs/infra-capacity.md`.

Order: GR-001, GR-002, GR-003, then GR-008 (deploy early, owner decision 15 Nov 2026), then GR-004 to GR-007, GR-009, GR-010, GR-011, GR-012, GR-013. Items stay in ID order below. Sizes: S under half a day, M about a day, L more than a day.

Owner decisions that apply to every item (15 Nov 2026): `*.pages.dev` address for launch (replaced by `graduateradar.versionphi.com` in GR-012, owner decision 15 Nov 2026); name Graduate Radar; 2 to 3 brand directions on `/design`, owner picks; Apply button on detail pages only; Cloudflare Web Analytics only, no Mixpanel; public repo `heisX3N0/graduate-radar-web` cloned into this folder; Cloudflare Pages, not Workers; spec fixes applied in place (spec section 14).

---

- [ ] **GR-014 Say where "Checked" is confirmed, and who writes to the sheet** (S)

  **Why:** Two lines will soon be out of date. The About page defines Checked as "the last date we confirmed the opening was real and still open" (`src/pages/about.astro:62`). It does not say where we confirm it. The owner wants the definition to name the place: the employer's or provider's own page. And `docs/infra-capacity.md` principle 3 says "only the sweep and the owner write to it". Private automated processes will also write to the sheet, so that line will be wrong (owner decisions, 15 Nov 2026). Five other lines describe later automation in more detail than the owner wants in a public repo, and two of them are out of date: `docs/build-spec.md` lines 72, 166 and 360, and `docs/infra-capacity.md` lines 23 and 55.

  **Do:**
  - `src/pages/about.astro`: change the sentence to "**Checked** is the last date we confirmed on the employer's or provider's own page that the opening was real and still open."
  - `docs/infra-capacity.md` principle 3: change "The sheet is the only store, and only the sweep and the owner write to it." to "The sheet is the only store; the owner and private automated processes write to it." Update "Last reviewed".
  - `docs/build-spec.md` line 72 (Data feed row): drop the last clause of the "Why" cell, so it ends at "so the owner can move columns safely."
  - `docs/build-spec.md` line 166: drop the sentence about a later addition to the same project; keep "Keep feed code in its own file (`Feed.gs`)."
  - `docs/build-spec.md` line 360 (later list): remove the bullet.
  - `docs/infra-capacity.md` line 23 (Apps Script URL fetch row): "Breaks at about" becomes "Not reachable by v1. Other processes on the same Google account share this limit; their use is tracked outside this repo."
  - `docs/infra-capacity.md` line 55 (upgrade order): "move the sheet to a Workspace account only if the account's processes together need the higher URL fetch quota."
  - Nothing else. No other page or test changes wording. Lines about keeping the private `Found via` field out of the feed (spec line 109, `docs/done.md`, test fixtures) stay as they are.

  **Tests:**
  - Negative first:
    - The built About page no longer contains the old sentence ("the last date we confirmed the opening was real and still open").
    - `npm run lint` passes: no em or en dashes, no update schedule in the new copy.
    - After the change, `git grep -i "phase 2\|scraper"` finds nothing outside `docs/done.md`.
  - Happy path: the built About page contains the new sentence once, inside the "Checked" definition; the 360 px check passes for About.

  **Docs:** `docs/infra-capacity.md` principle 3 and lines 23 and 55, `docs/build-spec.md` lines 72, 166 and 360 (above). README unchanged. `docs/public-routes.md` unchanged (no new route).

  **Cost:** per visitor: unchanged (static page, a few more words). Per change: 1 preview build for the PR push and 1 production build on merge, from the shared 500 a month (measured pattern from GR-008: 1 build per push to any branch). Users supported: unchanged. Dev-only: 0 GitHub Actions minutes (public repo).

  **Depends on:** nothing. Should be merged before the new writers start publishing rows, so the definition is true from the first such row.

  **Open questions for the owner:** none.

  **Owner decisions (2026-11-15):**
  - "Checked" stays as the word; the definition names the employer's or provider's own page; principle 3 gets one neutral line; `docs/public-routes.md` unchanged.
  - Make the five existing mentions neutral in this item. Git history still holds the old wording.
