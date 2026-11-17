# Infrastructure capacity and low-overhead design

Graduate Radar runs entirely on free plans until the owner decides otherwise. This doc records where each free limit runs out, what each user action costs, and the principles that keep those costs low. Read it before adding anything that uses a limited resource (a build, an Apps Script execution or URL fetch, a Worker request, a heavy dependency), and use the checklist at the end in the pull request.

Last reviewed: 2026-11-15, after the first Cloudflare builds (GR-008); principle 3 and the Apps Script rows reworded in GR-014. Figures marked "measured" come from those builds; the rest are estimates from the code and the spec (`docs/build-spec.md`). Each number says whether it was measured (with the sample) or estimated (from what). Re-check against real usage (see [Measuring](#measuring)) and update this doc in the same PR whenever the infrastructure or a hot path changes.

Some limits are per account and shared with other projects; the rows below marked "shared" use what is left after them. The account-wide figures are tracked outside this repo.

## When each piece hits its limit

Graduate Radar is a static site. A visitor's session (open the home page, filter, open 1 to 3 listings, tap Apply or Share) only loads static files from Cloudflare's CDN and sends one analytics beacon per page. No server code runs for a visitor, so **visitors do not use any metered free limit**. The metered limits are used by the daily rebuild and by development.

A typical day: 1 scheduled rebuild (1 Pages build, 1 to 2 feed executions, 1 URL fetch from Apps Script). That is about **31 Pages builds a month from the schedule alone**, plus development builds.

| Service | Free limit | What we use | Breaks at about |
| --- | --- | --- | --- |
| Cloudflare Pages builds (shared) | 500 a month per account (Cloudflare Pages limits, 2026-11-15). About 300 left after the other projects on the account (their estimate, tracked outside this repo) | Measured on 15 Nov 2026: 4 builds on day one (3 production builds of one commit, 1 from the GitHub push and 2 with a different source icon, most likely the deploy hook test runs, not confirmed; 1 preview for PR #5), from the Deployments list and the PR's Cloudflare comment. Estimated from the schedule: 31 a month from the daily rebuild, plus 1 per push to any branch (preview builds count). About 60 to 100 a month in launch week's pace, 40 to 50 a month after | Over 300 a month, which needs about 9 pushes a day every day on top of the schedule. Development pace, not users, decides this |
| Cloudflare Pages concurrent builds (shared) | 1 at a time per account (same source) | Measured: one preview build was done within 41 seconds of its commit (commit 02:04:53 UTC, Cloudflare check finished 02:05:34 UTC; 1 sample, includes queue, install, build and upload) | Never fails; a build waits in the queue if another project on the account is building at the same moment |
| Cloudflare Pages build time | 20 minutes per build (same source) | Measured: under 41 seconds end to end for 1 page and 24 listings (1 sample, above). Grows with listing pages from GR-007 | Thousands of listings; not a concern at hundreds |
| Cloudflare Pages files per site | 20,000 (same source) | Estimated: 1 HTML file per listing plus about 50 assets and pages. A few hundred listings means under 1,000 files | About 19,000 listings at once (open plus closed within 60 days) |
| Cloudflare Pages bandwidth and static requests | Unmetered, free (Cloudflare migration guide: static asset requests are free) | Estimated: home page under 150 KB, detail page under 60 KB (spec budgets, not measured) | No free-plan wall; Cloudflare's general fair-use terms apply |
| Cloudflare Web Analytics | Free; no per-site event limit found (not checked in detail) | 1 beacon per page view | Not known; check the dashboard once real traffic arrives |
| Apps Script URL fetch | 20,000 a day (consumer Google account) (Google Apps Script quotas, 2026-11-15) | Estimated: 1 a day (deploy hook call) | Not reachable by v1. Other processes on the same Google account share this limit; their use is tracked outside this repo |
| Apps Script trigger runtime | 90 minutes a day (consumer Google account) (same source) | Estimated: a few seconds a day for `triggerRebuild` | Not reachable by v1 |
| Apps Script simultaneous executions | 30 per user (same source) | Estimated: 1 to 2 feed calls per build, plus any manual `npm run snapshot` | Only if someone hammers the public `/exec` URL. The 10 minute cache keeps each call cheap; abuse would fail calls, not cost money |
| GitHub Actions minutes (shared) | 2,000 a month for private repos; public repos are not charged (GitHub billing docs) | 0: the repo is public (owner decision, 15 Nov 2026) | No wall while the repo stays public. If it goes private, every CI minute comes out of the account's shared 2,000 |

**In user terms:** no free limit grows with visitors. Trouble does not start at any daily-user count we can foresee; the static pages are served from Cloudflare's CDN for free. The first wall is **Pages builds**, and it is driven by development: about 9 pushes a day, every day, on top of the daily rebuild would use the 300 builds left on the account. If the account ran out, new deploys (including the daily rebuild) would stop until the month resets, while the live site kept serving the last good build. The browser-side date logic would still hide expired listings, but new listings would not appear.

### What each action costs

| Action | Pages builds | Apps Script executions | Apps Script URL fetches | Metered requests |
| --- | --- | --- | --- | --- |
| Visitor opens any page | 0 | 0 | 0 | 0 (static) |
| Visitor filters or searches | 0 | 0 | 0 | 0 (runs in the browser) |
| Visitor taps Apply or Share | 0 | 0 | 0 | 0 (link out) |
| Daily scheduled rebuild | 1 | 1 (trigger) + 1 to 2 (feed fetch during build) | 1 | 0 |
| Push to any branch | 1 | 1 to 2 (feed fetch during build) | 0 | 0 |
| `npm run snapshot` | 0 | 1 | 0 | 0 |
| Someone opens the `/exec` feed URL directly | 0 | 1 (cached result after the first in 10 minutes) | 0 | 0 |

All estimates from the spec; nothing measured yet.

## Known overheads to fix

| Overhead | Cost today | Fix | Backlog ID |
| --- | --- | --- | --- |
| List pages send listing text twice: in the rows and in the JSON block the search uses | Measured 17 Nov 2026 (GR-015 rows), jobs page, 17 jobs from the snapshot: JSON block 2,297 bytes gzipped of a 6,240 byte page (15 Nov, with cards: 2,298 of 6,252). Estimated about 40 KB gzipped at 300 listings, a real share of the 150 KB home page budget | Read search text from the card DOM, or trim eligibility text in the JSON; do it before the list passes about 150 listings | GR-006 review (deferred) |

## Upgrade order

If the project ever needs paid capacity, the order to pay in, each step keeping the free allowance and charging only above it. Every paid step is an owner decision.

1. Cloudflare Pages builds: first cut development builds (turn off preview builds for branches that do not need them, batch pushes). Paid Workers plan only if that is not enough.
2. Apps Script: move the sheet to a Workspace account only if the account's processes together need the higher URL fetch quota.

## Principles

1. **Price every user action before building it.** Per action: each limited resource it uses, and what caps anything that grows.
2. **Spend the scarcest resource only where it earns it.** Pages builds are the scarcest (shared across the account). One scheduled build a day; no build per sheet edit; no extra scheduled builds without updating this doc.
3. **Writes follow user intent, not keystrokes or events.** The website never writes anything. The sheet is the only store; the owner and private automated processes write to it.
4. **Reads: never fetch what you already have.** The feed is fetched once per build, never by a visitor's browser.
5. **Everything stored has a reason and a lifetime.** Closed listings leave the feed 60 days after their last check; `snapshot.json` is replaced on each refresh.
6. **Keep each request cheap.** Visitors get static files only. No Pages Functions or Workers in v1.
7. **Fail cheaply.** A failed or thin feed falls back to the snapshot once per build, with one log warning; no retry loops.
8. **Free limits are per account, not per user.** Every scheduled build, preview build, and other projects' builds share the 500.

## Measuring

- Pages builds: Cloudflare dashboard, Workers & Pages, the project, Deployments (count for the month). Works from a phone. GitHub shows a "Cloudflare Pages" check on each commit, but its start and end times are equal (it only marks the finish); a deployment's Details page shows the build duration.
- Web Analytics: Cloudflare dashboard, Analytics & Logs, Web Analytics. Works from a phone.
- Apps Script executions and URL fetches: script editor, Executions (left sidebar). Desktop only in practice.
- GitHub Actions: none expected while the repo is public; check github.com/settings/billing if that changes.

## PR checklist (infrastructure cost)

- [ ] Listed per user action: each limited resource used
- [ ] Anything that grows with users, rows or time has a cap, and the cap is named
- [ ] No new "read everything" query, loop of queries or polling on a hot path
- [ ] Writes happen once per user intent
- [ ] New stored data has a reason, a reader and a lifetime
- [ ] Failures are bounded (no retry loops, no per-request alert floods)
- [ ] The capacity effect is stated: users supported unchanged, or the new first wall
- [ ] This doc (and the account-wide figures for shared rows) updated if a number changed

## Sources

Free-plan figures checked on 2026-11-15:

- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare static asset billing (migration guide): https://developers.cloudflare.com/workers/static-assets/migrate-from-pages/
- Google Apps Script quotas: https://developers.google.com/apps-script/guides/services/quotas
- GitHub Actions billing for public repos: not re-read on 2026-11-15; from GitHub's billing docs as previously known. Check before relying on it.
