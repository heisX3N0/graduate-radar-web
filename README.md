# Graduate Radar web

A free, checked list of graduate trainee programmes, entry-level jobs and free tech trainings for Nigerian graduates: **https://graduateradar.versionphi.com**

Most visitors are on mid-range Android phones, on slow or expensive mobile data, and arrive from a WhatsApp link. They are also the people fake "pay to apply" jobs target. Those facts drive every decision below: static pages, a small JavaScript budget, a link preview that reads well in WhatsApp, and trust copy on every listing.

The whole system runs on free plans, with no server code in the request path.

## Architecture

```
Google Sheet (private, the database)
      │  read by header name
      ▼
Apps Script web app ("the feed")   JSON of allow-listed public fields only
      │  fetched once per build
      ▼
Astro static build                 validates, falls back to a committed snapshot
      │
      ▼
Cloudflare Pages (CDN)             static HTML, CSS and a small script

Scheduled trigger in Apps Script ──► Cloudflare deploy hook ──► rebuild
```

- **The sheet stays the database.** Listings are curated in a private Google Sheet. The website never reads the sheet directly and never writes anything.
- **The feed is the only public data route** (`apps-script/Feed.gs`, listed in `docs/public-routes.md`). It looks columns up by header name, so columns can move freely, and it sends only the fields named in an allow-list. A new column never reaches the website until someone adds it to the list on purpose.
- **The build does the work once.** Each build fetches the feed once, checks every listing against a schema (`src/data/schema.ts`) and renders one page per listing. Visitors only ever download static files.
- **Freshness comes from two places.** A scheduled rebuild picks up new rows and drops closed ones, and the browser re-checks deadlines against today's date in Lagos, so a listing that closed since the last build disappears without a rebuild.

## Design decisions and trade-offs

| Decision | Why | Trade-off accepted |
| --- | --- | --- |
| Google Sheet as the database, read through an Apps Script web app | The curation workflow already lives in the sheet. The web app runs as the sheet's owner, so the sheet stays private, and it controls exactly which fields leave it | Apps Script quotas and cold starts. Only the build calls it, never a visitor |
| Static site (Astro) instead of a single-page app or server rendering | Pages arrive as finished HTML, so they show on a cheap phone before any JavaScript runs. One page per listing gives search engines and WhatsApp previews something real to read | New data needs a rebuild, so the build count is the budget to watch (see `docs/infra-capacity.md`) |
| Search and filters in the browser (Fuse.js) | A few hundred listings filter instantly on the phone, with no search server and no extra account | All listing text ships with the list page. The size is measured and the budget is enforced |
| Committed snapshot as a fallback | A feed outage, a bad deploy of the feed or a half-empty sheet must not publish an empty or broken site | The snapshot has to be refreshed by hand (`npm run snapshot`) |
| Deadlines evaluated in Africa/Lagos, at build time and again in the browser | "Closes today" has to mean today in Nigeria, whatever time zone the build server uses | Date logic in one module (`src/lib/dates.ts`), shared by both sides |
| Cookie-free analytics, page views only | No cookie banner and one line of privacy copy. Detail-page views are enough to show which listings people open | Apply clicks, filters and shares are not tracked |
| Plain CSS with design tokens | The design system stays portable to later products and needs no CSS framework upgrade | Components must use tokens; a lint check enforces it |

### The feed and the snapshot

`src/data/feed.ts` drops a listing, with a `[feed]` warning in the build log, if it fails the contract, repeats a key, or has an Apply link that is not `https`, `http` or `mailto` (checked again at build even though the feed filters them). Fields outside the contract are stripped.

The build uses the committed snapshot (`src/data/snapshot.json`) instead of the feed when:

- `FEED_URL` is not set (local development);
- the fetch fails, times out after 30 seconds, or does not return JSON with HTTP 200;
- the JSON does not have the contract's top-level shape;
- after dropping bad listings, there are no jobs or no trainings;
- either list has fewer than half as many listings as the snapshot still has open today. This guard is skipped once the snapshot is more than 14 days old, so an old snapshot cannot hold back a real drop in openings.

If the feed fails and the snapshot is empty too, the build stops rather than publish an empty site. The page shows the date its data came from, so a site running on the snapshot is visible.

### Listings and dates

- A dated deadline before today closes a listing, whatever its status in the sheet. Seven days or fewer shows "Closing soon". `Rolling` and `Not stated` never close on their own.
- Every listing gets a stable slug from its key (`src/lib/slug.ts`). When two keys collide, each gets a short hash of its full key rather than a counter, so reordering rows never moves a listing to a new address.
- Closed listings keep their page for 60 days with "This opening has closed", no Apply button and links to similar open listings, so a link shared in a group chat does not end in a 404.

### Search, filters and shareable links

The server renders every open listing, so the full list works with JavaScript off. `src/scripts/list-page.ts` (10,515 bytes gzipped, measured on the 17 Nov 2026 build) adds search, filters, sort and sections on top. The filter logic in `src/lib/filters.ts` is shared by the build and the browser.

- Typo-tolerant search over title, organisation, field, location and eligibility ("Deloite" finds Deloitte).
- Filters for type, field, location, remote and the degree class you hold. Trainings filter by track, cost, format and job placement.
- Listings sit in sections: jobs by deadline ("Closes today", "Next 7 days", "Later", "Rolling or no date"), trainings by track. The browser regroups them after every change and on load with today's date in Lagos. Newest is one flat list.
- Filter state lives in the URL, so a filtered view can be shared on WhatsApp. Unknown or malformed values are ignored, so any link loads. Search text never leaves the page.

### Search engines and sharing

- Every page has a unique title and description, a canonical link, and Open Graph tags with absolute URLs, so a WhatsApp share shows a proper preview card.
- Open job pages carry schema.org `JobPosting` data. Closed listings and trainings never do.
- `sitemap.xml` lists the main pages and every open listing.
- `public/_headers` sends `noindex` on every `*.pages.dev` address, including branch previews, so only the real domain appears in search.

## Guardrails as code

Each rule that matters is a check that fails the build or the lint, not a line in a document.

| Check | Fails when |
| --- | --- |
| `scripts/check-dist.ts` (in `npm run build`) | any built file contains a private field or private tab name; a detail page lacks "Never pay to apply"; a page lacks the site footer or the WhatsApp channel link; the `noindex` rule for `pages.dev` is missing or would also hide the real domain; no detail pages were built |
| `scripts/check-budgets.ts` (in `npm run build`) | any page ships more than 50 KB of JavaScript or a first load over 150 KB, gzipped. The home page was 18.8 KB on 15 Nov 2026 |
| `scripts/check-mobile.ts` (`npm run check:mobile`) | at 360 x 800 in headless Chrome or Edge, any page scrolls sideways or has a tap target under 44 px |
| `scripts/check-styles.ts` (in `npm run lint`) | a component hard-codes a colour, size or spacing instead of a token from `src/styles/tokens.css` |
| `scripts/check-dashes.ts` (in `npm run lint`) | an em or en dash appears in source or docs (house style) |
| `scripts/check-schedule.ts` (in `npm run lint`) | the site or its docs promise how often the list changes, so the update rhythm can change without a copy change |
| `tests/feed.test.ts` | the feed sends a field outside its allow-list, a private tab, or a non-web Apply link. It runs the real `Feed.gs` against stand-ins for the Apps Script services |

CI runs lint, types, tests, build and the 360 px check on every pull request.

## Run it locally

Needs Node 24.16 or later on the 24 line (`.nvmrc`).

```bash
npm install
```

```bash
npm run dev
```

With no `FEED_URL` set, the site builds from the committed snapshot, so no credentials are needed. To build from a live feed, copy `.env.example` to `.env` and set `FEED_URL`.

The gates, run before every commit:

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

```bash
npm run check:mobile
```

## Repo map

```
apps-script/Feed.gs     the feed (tested here, deployed to Apps Script)
src/data/               feed loader, schema, committed snapshot
src/lib/                dates, filters, slugs, SEO, site constants
src/scripts/            browser scripts: list search, filters and sort; detail-page deadline re-check
src/components/         design system components (shown on /design)
src/styles/tokens.css   design tokens
scripts/                build checks, snapshot refresh, sharing image
tests/                  Vitest unit and integration tests
docs/                   spec, capacity model, public routes, design notes
```

## Docs

- `docs/build-spec.md`: the spec, with the reasoning and rejected alternatives for each choice.
- `docs/infra-capacity.md`: each free-plan limit, what every action costs, and where the system would break first.
- `docs/public-routes.md`: the only public endpoints.
- `docs/design.md`: the design system.
- `BACKLOG.md` and `docs/done.md`: open and shipped work.
- `CLAUDE.md`: working rules for AI-assisted development in this repo.
