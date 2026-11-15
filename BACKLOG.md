# Graduate Radar backlog

Open work only. Done items move to `docs/done.md` with what shipped, owner decisions (dated) and deviations. The full spec is `docs/build-spec.md`. Free-plan costs come from `docs/infra-capacity.md`.

Order: GR-001, GR-002, GR-003, then GR-008 (deploy early, owner decision 15 Nov 2026), then GR-004 to GR-007, GR-009, GR-010, GR-011, GR-012, GR-013. Items stay in ID order below. Sizes: S under half a day, M about a day, L more than a day.

Owner decisions that apply to every item (15 Nov 2026): `*.pages.dev` address for launch (replaced by `graduateradar.versionphi.com` in GR-012, owner decision 15 Nov 2026); name Graduate Radar; 2 to 3 brand directions on `/design`, owner picks; Apply button on detail pages only; Cloudflare Web Analytics only, no Mixpanel; public repo `heisX3N0/graduate-radar-web` cloned into this folder; Cloudflare Pages, not Workers; spec fixes applied in place (spec section 14).

---

- [ ] **GR-013 WhatsApp channel link in the footer and on About** (S)
  - **Why:** The owner has started a WhatsApp channel, "Graduate Radar Nigeria" (`https://www.whatsapp.com/channel/0029VbDs41p11ulNTNQBxp1T`; the link given redirects there, checked 15 Nov 2026, one fetch). The site does not link to it: the footer (`src/components/Footer.astro`, on all 30 pages) has only Stay safe and About, and `src/pages/about.astro` says in a comment "no WhatsApp channel until one exists".
  - **Do:**
    - One constant for the channel link (for example `CHANNEL_URL` in `src/lib/site.ts`), used by both places.
    - Footer: a link "Follow Graduate Radar on WhatsApp" beside Stay safe and About.
    - About: a section "Follow on WhatsApp" with "See new openings in the Graduate Radar Nigeria channel on WhatsApp." and the link; update the comment at the top.
    - Plain link, same tab (on phones it opens the WhatsApp app); no tracking parameters.
  - **Tests:** Negative first: the link constant must be `https://www.whatsapp.com/channel/` plus an ID (refuses `http`, a bare `whatsapp.com` without `www`, `wa.me` or any other host); the dist check fails if a built page's footer lacks the channel link, or if About lacks it. Happy path: footer and About render the agreed wording and the link; the 360 px check passes (the new link is at least 44 px tall); the schedule check still passes; budgets still pass.
  - **Docs:** README (one line where the footer is described, or the Launch section); `docs/done.md`.
  - **Cost:** per visit: about 100 bytes more HTML per page (estimate), no requests until someone taps the link. Pages builds: one preview build for the PR and one production build on merge (of 500 a month, shared with Aimery). Users supported: unchanged. Money: $0.
  - **Depends on:** GR-012 (merged).
  - **Side effects:** the privacy note on About stays true (the site sends nothing to WhatsApp unless someone taps the link); the page makes no claim about who can see channel followers (WhatsApp's rule, not checked).
  - **Open questions for the owner:** none.
  - **Owner decisions (2026-11-15):** wording as proposed; the `www` form of the link; launch drafts stay site-only (the owner adds the channel to the sheet and the post by hand).
