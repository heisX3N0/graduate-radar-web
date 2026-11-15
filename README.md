# Graduate Radar web

A free, checked list of graduate trainee programmes, entry-level jobs and free tech trainings for Nigerian graduates. This repo is the public website. The Google Sheet stays the database; the site is rebuilt from it every day.

Status: scaffold (GR-001), the Apps Script feed (GR-002), the data layer (GR-003) and the Cloudflare deploy with a daily rebuild (GR-008). See `BACKLOG.md` for what comes next.

## How data flows

```
Claude sweep (scheduled)                -> Google Sheet (database)
Apps Script web app (feed)              -> JSON of public listing fields only
Daily 07:30 trigger                     -> Cloudflare Pages deploy hook
Astro static build                      -> Cloudflare Pages (*.pages.dev)
```

Full detail: `docs/build-spec.md` section 4. Deploy setup: "Deploy (Cloudflare Pages)" below.

### In the build

`src/data/feed.ts` (`getListings()`) fetches `FEED_URL` once per build and checks each listing against the contract in `src/data/schema.ts`. Fields not in the contract are stripped. A listing is dropped, with a `[feed]` warning, if it fails the contract, has an Apply link that is not `https`, `http` or `mailto`, or repeats a key; the rest of the feed is still used. Every listing gets a stable `slug` (`src/lib/slug.ts`).

The build uses the committed snapshot (`src/data/snapshot.json`) instead of the feed, with a `[feed]` warning in the build log, when:

- `FEED_URL` is not set;
- the fetch fails, times out (30 seconds) or answers anything but HTTP 200 with JSON;
- the JSON does not have the contract's top-level shape (`generatedAt`, `jobs`, `trainings`);
- after dropping bad listings, the feed has no jobs or no trainings;
- or either list has fewer than half as many listings as the snapshot has still open today. This last check is skipped, with a warning, when the snapshot is more than 14 days old, so an old snapshot cannot hold the site back after a real drop in openings.

The placeholder page shows the date the data came from, so a site stuck on the snapshot shows an old date.

If the feed fails and the snapshot is empty too, the build stops rather than publish an empty site.

Dates: `src/lib/dates.ts` holds all deadline logic, in Lagos time. A date deadline before today closes a listing whatever the sheet says; a deadline 7 days away or fewer shows "Closing soon"; `Rolling` and `Not stated` never close on their own; "New this week" means first seen 0 to 6 days ago.

### Refreshing the snapshot

The build cannot update the snapshot itself, so refresh it by hand: in any PR, and at least monthly.

```bash
npm run snapshot
```

It reads `FEED_URL` from the environment or `.env` and uses the build's own rules: it refuses to write if the feed is unreachable or has the wrong shape, has no jobs or trainings, or has fewer than half the listings still open in the current snapshot (add `-- --force` to accept a smaller feed on purpose; an empty list is never accepted). Bad listings are dropped, as in the build. Commit the new `src/data/snapshot.json`.

## Search and filters (`/` and `/trainings`)

The server renders every open listing (closed and past-deadline listings are never in the HTML), so the full list works with JavaScript off. `src/scripts/list-page.ts` (10,185 bytes gzipped, measured on the 15 Nov 2026 build; budget 50 KB) adds search, filters and sort on top, and re-checks deadlines against today in Lagos so a listing that closed since the last build disappears.

- **Logic:** `src/lib/filters.ts`, shared by the build and the browser (imports only `dates.ts` and Fuse.js, so no Zod reaches the browser).
- **Search:** Fuse.js (`fuse.js/basic`), threshold 0.35, over title, organisation or provider, field or track, location, degree class and eligibility. Typo-tolerant ("Deloite" finds Deloitte).
- **Jobs filters:** Type, Field, Location (Lagos, Abuja, Port Harcourt, Other Nigeria, Remote; "listed as Lagos" notes are ignored), Remote only, Closing soon (7 days or fewer), Degree class I have (2:1 or above shows everything; 2:2 hides 2:1-only listings; "Third class or pass" shows only listings that accept any class or do not state one; owner decision 15 Nov 2026).
- **Trainings filters:** Track, Cost (Free, Free + stipend, Scholarship, Low-cost), Format (Online, In person, Hybrid, Not stated), Job placement, Closing soon.
- **Sort:** closing soonest (dated deadlines first, earliest first, then the rest newest first) or newest.
- **URL:** `q`, `type`, `field`, `loc`, `remote=1`, `soon=1`, `class=21|22|any`, `sort=new` (jobs); `q`, `track`, `cost`, `format`, `place=1`, `soon=1`, `sort=new` (trainings). Defaults are left out; unknown or malformed values are ignored, so any link loads. The search text only ever goes into this page's own URL; the page makes no network requests for search.
- **Phones:** search is always visible; the other filters fold under "Filters and sort", which opens on desktop and when a shared link has filters set, and shows how many are on.

## Detail pages, SEO and sharing

- **Pages:** `/jobs/<slug>` and `/trainings/<slug>` for every listing in the feed, including Closed ones checked in the last 60 days, so a shared link to a closed listing shows "This opening has closed" (no Apply button, links to similar open listings) instead of a 404. After 60 days the listing leaves the feed and its address gets the 404 page. Also `/about`, `/stay-safe` and `404`.
- **Every page:** unique title and description, canonical link, Open Graph and Twitter tags with absolute URLs (from `SITE_URL`, default `https://graduate-radar.pages.dev`; `src/lib/site.ts`), and one sharing image, `public/og-default.png` (1200 x 630, 49.8 KB). Edit `scripts/og/og.html` and run `npm run og` to regenerate it (needs Edge or Chrome installed).
- **JobPosting data** (schema.org JSON-LD) on open job pages only: never on closed or past-deadline listings, never on trainings. `validThrough` comes from the deadline when it is a date; remote jobs are marked telecommute, open to applicants in Nigeria. Google may still rank listings low because applications happen on the employer's site.
- **Sharing:** the WhatsApp button opens `https://wa.me/?text=` with "title · organisation · Closes 27 Nov · page URL" ("Closed" for a past deadline).
- **sitemap.xml** lists the main pages and every open listing; **robots.txt** allows everything and points to the sitemap. `/design` and `404` carry `noindex`.
- **`npm run check:dist`** (CI runs it after the build) scans `dist/` and fails if any file contains "Found via" or the private "Postgrad Scholarships" tab name, if a detail page lacks "Never pay to apply", or if no detail pages were built.

## Budgets and phone checks (spec 6.6)

- **Page weight** (`scripts/check-budgets.ts`, part of `npm run build`): every built page must stay within 50 KB of JavaScript and a 150 KB first load (HTML plus its CSS and JS), gzipped. Cloudflare's analytics script is added at serve time and is not counted. On 15 Nov 2026 the home page was 18.8 KB (HTML 7.3, CSS 1.4, JS 10.0).
- **360 px** (`scripts/check-mobile.ts`, `npm run check:mobile`, run in CI after the build): opens every built page in headless Chrome or Edge at 360 x 800 and fails on sideways scroll or a tap target under 44 px (inline text links in a sentence are exempt). Needs Chrome or Edge installed, or `CHROME_PATH`.
- **Lighthouse** is run by hand on the live site (it is not a CI step): mobile defaults, 3 runs per page, median reported in `docs/done.md`.

## Data feed (Apps Script)

`apps-script/Feed.gs` turns the sheet's two public tabs into JSON. It runs inside the sheet's own Apps Script project; the repo copy exists so it can be tested (`tests/feed.test.ts`). Change it here first, run the tests, then paste it into the script editor so the two stay the same.

What it sends: only the fields in `FEED_TABS` (never `Found via`, never the private tabs), rows that are Open or Closing soon plus Closed rows checked in the last 60 days, Apply links that start with `https://`, `http://` or `mailto:`, and dates as `yyyy-MM-dd` (or `Rolling`, `Not stated`, or empty for anything that is not a real date). It keeps the first row of a repeated `Key`, and sends nothing for a tab where a column name appears twice; both are logged in the script's Executions page.

### Deploying or updating the feed (owner)

1. Open the Graduate Radar sheet, then Extensions > Apps Script.
2. Project Settings (gear icon): set Time zone to `(GMT+01:00) Lagos`.
3. Editor: add a file named `Feed` (Script type). Paste the whole of `apps-script/Feed.gs` into it and save.
4. First time only: Deploy > New deployment > type Web app. Description "Graduate Radar feed". Execute as: Me. Who has access: Anyone. Deploy, then approve the access prompt (it asks to read your spreadsheets and connect to an external service; the second is for the daily rebuild in GR-008).
5. Copy the Web app URL (ends in `/exec`). Put it in a local `.env` as `FEED_URL=...` (see `.env.example`). Never commit it.
6. Later updates: paste the new code, save, then Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy. The `/exec` URL stays the same.

Check: open the `/exec` URL in a browser. You should see JSON with `generatedAt`, `jobs` and `trainings`, and no `Found via` links anywhere.

## Deploy (Cloudflare Pages)

The site is static and hosted on Cloudflare Pages (free plan). Cloudflare builds from GitHub: every push to `main` deploys the live site, and every other branch gets a preview URL. Node comes from `.nvmrc`.

### First-time setup (owner; not timed, 11 steps)

1. **Create the project.** Cloudflare dashboard > Workers & Pages > Create > Pages > Connect to Git. Pick GitHub, authorise Cloudflare for `heisX3N0/graduate-radar-web` only, and select it.
2. **Build settings.** Project name: `graduate-radar` (the live address becomes `https://graduate-radar.pages.dev`; if the name is taken Cloudflare adds a suffix, then set `SITE_URL` in step 3). Production branch: `main`. Framework preset: Astro. Build command: `npm run build`. Build output directory: `dist`. Root directory: blank.
3. **Environment variables** (same screen, "Environment variables (advanced)"): add `FEED_URL` = the `/exec` URL, type Text. If the address is not `https://graduate-radar.pages.dev`, also add `SITE_URL` = the real address. Save and Deploy.
4. After the first build finishes, open Settings > Variables and Secrets and check `FEED_URL` is set for both Production and Preview.
5. **Deploy hook.** Settings > Builds > Deploy hooks > Add deploy hook. Name: `daily-rebuild`. Branch: `main`. Copy the URL it shows (it starts `https://api.cloudflare.com/`). It is a secret: anyone with it can start builds. Never paste it into the repo, a chat or a ticket.
6. **Give the hook to Apps Script.** Graduate Radar sheet > Extensions > Apps Script > Project Settings (gear) > Script Properties > Add script property: `DEPLOY_HOOK_URL` = the hook URL. Save.
7. **Update the feed code** (Feed.gs changed in GR-008): paste the new `apps-script/Feed.gs` over the old one, save, then Deploy > Manage deployments > edit > Version: New version > Deploy.
8. **Test the hook once.** In the editor, pick `triggerRebuild` in the function menu and Run. Expected: the run succeeds, and a new deployment with Source "Deploy hook" appears in Cloudflare within a minute.
9. **Schedule it.** Pick `installRebuildTrigger` and Run once. Then Triggers (clock icon) should show exactly one trigger: `triggerRebuild`, Day timer, 7am to 8am. Running it again replaces it rather than adding a second.
10. **Web Analytics.** Cloudflare > the `graduate-radar` Pages project > Metrics > Web Analytics > Enable. Cloudflare adds its page counter to the next deployment; no code change.
11. **Failed-build emails.** Cloudflare dashboard > Notifications > Add > Pages > deployment failure, for the `graduate-radar` project, production only, to your email. Without this, a build that fails in Cloudflare leaves the site silently out of date (the hook call itself still succeeds, so Apps Script reports nothing).

### When something goes wrong

- **A Cloudflare build fails:** the failed-build email from step 11 arrives; the live site keeps the last good build. Open the build log in Cloudflare (Deployments, the failed one).
- **The daily rebuild fails** (no hook, wrong hook, network error, or Cloudflare refuses it): `triggerRebuild` throws, so the run shows as Failed in Apps Script > Executions, and Google sends the trigger owner a failure email (Google's default for script-made triggers is a daily summary; not checked on this account). The live site keeps serving the last good build.
- **The feed is down at build time:** the build uses `src/data/snapshot.json` and logs a `[feed]` warning in the Cloudflare build log; the page's "Data from" date shows the snapshot's date.
- **The hook URL leaks:** delete it in Cloudflare (Settings > Builds > Deploy hooks), add a new one, and replace `DEPLOY_HOOK_URL` in Script Properties.

## Launch

The website replaces the sheet's "Publish to web" view as the link we share. `docs/launch.md` holds the drafts the owner publishes by hand (the sheet's `Start here` tab and the WhatsApp post) and the owner's launch steps; `tests/launch-copy.test.ts` checks that both drafts lead with the website and never link to the Sheet.

**Fallback:** the "Publish to web" view stays live (owner decision, 15 Nov 2026). It is managed in the sheet under File, Share, Publish to web, and its address is deliberately not in this repo. Anyone with the old link still sees the old view, which may show columns the website never sends (such as `Found via`).

## Setup

Needs Node 24.16 or later on the 24 line (`.nvmrc`, `engines` in package.json).

```bash
npm install
```

```bash
npm run dev
```

## Gates

Run all four before every commit. CI runs the same on every pull request.

```bash
npm run lint
```

```bash
npm run check
```

```bash
npm test
```

```bash
npm run build
```

`npm run lint` runs ESLint, Prettier (check only) and the dash check (`scripts/check-dashes.ts`), which fails on any em or en dash in source, docs or root files, and the style check (`scripts/check-styles.ts`), which fails on any hard-coded colour, size or spacing in a component or layout style (use `src/styles/tokens.css`), and the schedule check (`scripts/check-schedule.ts`), which fails on any claim about which days or how often the list is updated (patterns in the script) in the site, the sharing image, the launch drafts, this README or the spec. The site promises no schedule (owner decision, 15 Nov 2026), so the sweep can change frequency without a copy change. It never scans `dist/`, because listing notes from the sheet may name a day.

## Environment variables

- `FEED_URL`: the Apps Script `/exec` URL. Used by the build and by `npm run snapshot`. Set it in a local `.env` (copy `.env.example`) and as a Cloudflare Pages variable (Production and Preview). Never commit it.
- `SITE_URL` (optional): the site's public address, used for absolute links. Defaults to `https://graduate-radar.pages.dev`; set it in Cloudflare if the address differs or when a custom domain is added.
- `DEPLOY_HOOK_URL`: not an environment variable of the site. It lives only in the Apps Script project's Script Properties and in the Cloudflare dashboard. Secret.

## Docs

- `docs/build-spec.md`: the spec.
- `BACKLOG.md`: open work. `docs/done.md`: what shipped.
- `docs/infra-capacity.md`: free-plan limits and what each action costs.
- `docs/public-routes.md`: the only public endpoints.
- `docs/launch.md`: launch drafts (Start here tab, WhatsApp post) and the fallback.
- `CLAUDE.md`: rules for Claude Code in this repo.
