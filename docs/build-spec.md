# Graduate Radar website: build spec for Claude Code

Owner: Boluwatife Olapade · Written 15 Nov 2026 · Revised 15 Nov 2026 (see section 14) · Target: launch within one week

This doc is the handoff. Read it fully before writing code. It explains what to build, why each choice was made, and what "done" looks like. Where something is marked **Decide**, ask Boluwatife before building that part. Owner decisions made so far are in section 12.

---

## 1. Context (what already exists)

Graduate Radar is a free, checked directory of opportunities for Nigerian graduates:

- **Jobs:** graduate trainee programmes, graduate internships, entry-level and NYSC roles in Nigeria, plus remote roles open to people in Nigeria.
- **Trainings & Scholarships:** free or low-cost tech trainings and tech scholarships.

It already runs on a Google Sheet that is kept up to date automatically:

- **Spreadsheet ID:** `1dRl1vgvRixtVZJIkXbd6iNFpeBjgzKkaz1L-tp8k6yo` (time zone Africa/Lagos)
- **A Claude scheduled task ("Graduate Radar sweep")** runs on a schedule (set in the task itself, not repeated here). It finds new openings, checks them for scams, writes them to the sheet, marks closed ones, and logs each run.
- **Public tabs:** `Start here`, `Jobs`, `Trainings & Scholarships`.
- **Private tabs (must never reach the website):** `Postgrad Scholarships`, `Calendar`, `Review`, `Sources`, `Settings`, `Log`.

The sheet is also published with Google's "Publish to web", but that view is static: text gets cut off, nothing can be sorted or filtered, and it reads badly on phones. **This website replaces it as the public face.** The sheet stays as the database.

## 2. Goals and non-goals

**Goals (v1)**

1. A fast, mobile-first website where a Nigerian graduate can find an opening they qualify for in under a minute.
2. Search plus filters (type, field, location, remote, closing soon, minimum degree class).
3. One page per listing, so Google can index it and WhatsApp shows a proper preview card when it's shared.
4. Updates itself from the sheet with no manual work.
5. Costs nothing to run (a domain is the only optional cost), and stays inside free-plan limits (see `docs/infra-capacity.md`).
6. A small, reusable design system, so later products (community, an Aimery-style CV tool) share the same look.

**Non-goals (v1)**

- No user accounts, logins, saved jobs or comments.
- No collecting personal data. Sign-ups (email or WhatsApp) come later.
- No editing data on the website. All edits happen in the sheet.
- No CMS or database. The sheet is the database.

## 3. Audience and constraints (drive every decision)

- **Mostly on phones**, often mid-range Android, often on slow or expensive mobile data.
- **Mostly arriving from WhatsApp links.** The preview card and first screen matter most.
- **Trust is the product.** Graduates are targeted by fake jobs and "pay to apply" scams. The site must look credible, show when each listing was last checked, and repeat "never pay to apply".
- **Low maintenance.** Boluwatife has a full-time job and other projects. Nothing should need daily attention.

## 4. Architecture

```
Claude sweep (scheduled)     ──► Google Sheet (database, unchanged)
                                     │
                                     ▼
                 Apps Script web app "feed"  ── JSON of public listings only
                                     │
           (daily 07:30 trigger) ──► Cloudflare Pages deploy hook
                                     │
                                     ▼
                Astro static build ──► Cloudflare Pages (hosting, free)
                                     │
                                     ▼
              Visitor's phone: static pages + small client-side filter/search
```

### Why each piece

| Piece | Choice | Rationale | Rejected alternatives |
|---|---|---|---|
| Database | Existing Google Sheet | The sweep, review workflow and owner habits already live there. Zero migration. | Supabase/Airtable: unnecessary until accounts exist. |
| Data feed | Apps Script web app returning JSON | Free; runs as the owner, so the sheet stays private; we control exactly which fields leave the sheet; looks up columns **by header name**, so the owner can move columns safely. | "Publish to web" CSV: exposes columns by position, and any column move or added column silently breaks parsing; can't filter out closed or private fields. Sheets API with a key: needs the sheet shared publicly. |
| Site generator | Astro (latest stable), TypeScript | Ships HTML with almost no JavaScript, which is ideal for cheap phones and slow data. Static pages per listing give SEO and WhatsApp previews. Small interactive "islands" only where needed (filters). | Next.js: heavier JS and more than we need. Plain SPA (React/Vite): blank page until JS loads, poor SEO, no per-listing previews. |
| Styling | Plain CSS with design tokens (CSS custom properties), scoped Astro component styles | Tokens make the design system portable to future products; no build-time CSS framework to learn or upgrade. | Tailwind: fine, but tokens-in-CSS keeps the design system explicit and framework-free. If Claude Code strongly prefers Tailwind, map tokens into its theme instead. |
| Interactivity | Vanilla TypeScript (or Preact island if it clearly simplifies) for filters; Fuse.js for fuzzy search | A few hundred rows, so filtering in the browser is instant and needs no server. | Server search (Algolia etc.): overkill, adds cost and accounts. |
| Hosting | Cloudflare Pages (free plan), at `graduateradar.versionphi.com` (custom domain, GR-012; `*.pages.dev` kept but `noindex`) | Free with unmetered bandwidth, global CDN including a Lagos location, deploy hooks, preview deploys per branch. Builds count against the account's 500 builds a month, shared with Aimery (see `docs/infra-capacity.md`). | Workers static assets: third-party sources say Cloudflare now points new projects there, but it uses `*.workers.dev` and we found no documented deploy hook for Workers Builds. A plain static site can move later by hand. Vercel/Netlify: also fine; Cloudflare chosen for bandwidth terms and Nigeria latency. |
| Freshness | Daily rebuild via deploy hook, plus deadline logic in the browser | The sheet changes when the sweep runs, but deadlines pass daily. A daily 07:30 rebuild catches sweep results and drops expired listings; browser-side date checks keep "Closing soon"/"Closed" correct even between builds. | Fetching the feed live on every visit: slower first paint, depends on Apps Script uptime and quotas, worse SEO. |
| Analytics | Cloudflare Web Analytics only (page views, cookie-free) | Simple and low-maintenance; same Cloudflare account, nothing new to run; no cookies, so the privacy note stays one line. Detail-page views show which listings people open. | Mixpanel: tracks Apply clicks, filters and shares, but the browser SDK eats much of the JS budget and is one more service to maintain. GA4: heavier script, cookie banner concerns. |
| Code hosting | Public GitHub repo `heisX3N0/graduate-radar-web` | Cloudflare Pages builds from GitHub automatically. Public repos use no Actions minutes (the account's 2,000 a month are shared and near 70%). Everything in the repo is already public data; the feed URL is a Cloudflare build setting, never committed. | Private repo: CI would draw on the shared Actions minutes. |

## 5. Data contract

### 5.1 Source columns (header names are the contract, order is not)

The owner moves columns freely, so **every reader and writer must look columns up by header name in row 1, never by position.** Renaming a header is the only breaking change.

**Jobs tab headers**
`First seen, Organisation, Role / Programme, Type, Field, Location, Remote, Eligibility, Min class, Max age, NYSC, Deadline, Apply link, Verified on, Status, Notes, Found via, Key`

**Trainings & Scholarships tab headers**
`First seen, Provider, Programme, Track, Cost, Format, Duration, Eligibility, Job placement?, Deadline, Apply link, Found via, Verified on, Status, Notes, Key`

Value conventions written by the sweep:

- Dates are `yyyy-MM-dd` text, but some may be real date cells whose display value is in another format (for example `14/11/2026`). The feed must normalise every date field to `yyyy-MM-dd` in Africa/Lagos (from the raw cell value when it is a real date), and send an empty string for anything it cannot parse. Never pass a date to `new Date()` without checking its format first.
- `Deadline` can also be `Rolling` or `Not stated`.
- `Status`: `Open`, `Closing soon`, `Closed` (owner may write other values; treat unknown values as hidden).
- `Remote`: `Yes` or blank.
- `Type` (jobs): Graduate Trainee / Internship / Entry level / NYSC placement.
- `Field` (jobs): Tech / Finance / Engineering / Sales & Ops / Any discipline / Other.
- `Track` (trainings): Software / Data / Product / Design / Cloud / Cybersecurity / AI / Digital skills / Other.
- `Min class`: 2:1 / 2:2 / Any / Not stated. `NYSC`: Required done / Serving OK / Not stated.
- `Apply link` may be a `mailto:` link. Only `https:`, `http:` and `mailto:` links are allowed; the feed skips any row whose link has another scheme (for example `javascript:`), and the site validates again at build time.
- `Key` is unique per listing: `lowercase organisation|role|year`.

### 5.2 What the feed exposes

- **Include:** everything needed to display and filter.
- **Exclude:** `Found via` (aggregator links are internal; the owner deliberately moved them out of view) and anything from private tabs.
- **Fields are an allowlist.** Only the headers named in `FEED_TABS` leave the sheet. A new column added to the sheet never reaches the website until it is added to the allowlist on purpose.
- **Rows included:** `Status` is `Open` or `Closing soon`, **plus** `Closed` rows whose `Verified on` is within the last 60 days (so shared links to recently closed listings show a "Closed" page instead of a 404). Skip rows with no `Key`, no `Apply link`, or an Apply link with a scheme other than `https`, `http` or `mailto`.
- **The feed is a public route.** It runs as the owner with "Anyone" access, so it is on the repo's named list of public endpoints, and a test checks that its response contains only allowlisted fields.

### 5.3 Feed JSON shape

```json
{
  "generatedAt": "2026-11-15T07:30:00.000Z",
  "jobs": [
    {
      "key": "deloitte nigeria|deloitte academy - cyber security programme|2026",
      "firstSeen": "2026-11-14",
      "organisation": "Deloitte Nigeria",
      "title": "Deloitte Academy - Cyber Security Programme",
      "type": "Graduate Trainee",
      "field": "Tech",
      "location": "Lagos",
      "remote": false,
      "eligibility": "2:1 in Computer Science, Engineering or related; ...",
      "minClass": "2:1",
      "maxAge": "26",
      "nysc": "Required done",
      "deadline": "2026-11-27",
      "applyLink": "https://jobs.smartrecruiters.com/...",
      "verifiedOn": "2026-11-14",
      "status": "Open",
      "notes": "24-month programme; cybersecurity certifications an advantage"
    }
  ],
  "trainings": [
    {
      "key": "...",
      "firstSeen": "...",
      "provider": "...",
      "title": "...",
      "track": "AI",
      "cost": "Free",
      "format": "Online",
      "duration": "4 weeks, self-paced",
      "eligibility": "...",
      "jobPlacement": "Not stated",
      "deadline": "Rolling",
      "applyLink": "...",
      "verifiedOn": "...",
      "status": "Open",
      "notes": "..."
    }
  ]
}
```

### 5.4 Apps Script feed

The feed code lives in `apps-script/Feed.gs` (tested by `tests/feed.test.ts`, which runs the real file against stand-ins for the Apps Script services). It replaced the starting code that was here, so there is only one copy to keep in sync with the bound script.

Create it as the bound script of the Graduate Radar sheet (Extensions > Apps Script). Set the script time zone to Africa/Lagos. Keep feed code in its own file (`Feed.gs`).

Deploy: Deploy > New deployment > Web app > Execute as **Me** > Who has access **Anyone**. Put the `/exec` URL in Cloudflare Pages as the build environment variable `FEED_URL`. Put the Cloudflare deploy hook URL in Script Properties as `DEPLOY_HOOK_URL`, then run `installRebuildTrigger()` once.

Note: Apps Script web apps answer with a redirect to `script.googleusercontent.com`; the build-time fetch must follow redirects (Node `fetch` does by default).

Note: the sheet is on a gmail.com account (owner, 15 Nov 2026), so no Workspace admin can block "Anyone" access, and consumer quotas apply: 90 minutes of trigger runtime and 20,000 URL fetches a day (see `docs/infra-capacity.md`).

## 6. Website specification

### 6.1 Pages (v1)

| Route | Purpose | Key content |
|---|---|---|
| `/` | Jobs home | Short hero (one line: what this is, and the last updated date; no update schedule, owner decision 15 Nov 2026). "Closing this week" strip. Search + filters. Job cards. Link to trainings. |
| `/trainings` | Trainings home | Same pattern for trainings. Filters: track, cost, format, job placement, closing soon. |
| `/jobs/[slug]` | Job detail | Title, organisation, type, location/remote, deadline (with "X days left"), eligibility broken into a checklist (degree class, max age, NYSC, other text), notes, **Apply** button, "Verified on" date, "Never pay to apply" note, Share to WhatsApp button, back link. Closed listings show a clear "This opening has closed" banner, no Apply button, and links to similar open listings. |
| `/trainings/[slug]` | Training detail | Same pattern: provider, track, cost, format, duration, job placement, eligibility, deadline, Apply. |
| `/about` | Trust page | Who runs it, how listings are found and checked, "we don't hire or process applications". |
| `/stay-safe` | Scam guidance | Never pay to apply; red flags (Gmail-only recruiters, fees, too-good pay); how to verify an employer; what to do if asked for money. |
| `/design` | Design system showcase (not linked in nav) | Tokens, type scale, every component in every state. |
| `404` | Friendly not-found | Search box + link home. |

**Slugs:** derived from `key`: lowercase, replace `|` and non-alphanumerics with `-`, collapse repeats, trim. Example: `deloitte-nigeria-deloitte-academy-cyber-security-programme-2026`. Slugs must be stable across rebuilds (same key, same slug). If two keys collide after slugifying, **every** colliding listing gets `-` plus the first 6 hex characters of a hash of its full key (for example SHA-1). The suffix depends only on the key, so reordering, adding or removing rows never moves a listing to another URL. Do not use a counter such as `-2`: it depends on row order.

### 6.2 Listing card

Shows, in this order: status badge (Closing soon / Remote / New this week), title, organisation, type · field, location, deadline chip ("Closes 27 Nov · 12 days left", "Rolling", or "Deadline not stated"), one-line eligibility summary (min class · max age · NYSC). Whole card links to the detail page. No Apply button on cards: Apply is on the detail page only, so people read eligibility first (owner decision, 15 Nov 2026).

### 6.3 Search and filters

- **Search:** fuzzy over title, organisation/provider, field/track, location, eligibility text (Fuse.js, threshold ~0.35).
- **Jobs filters:** Type, Field, Location (derived buckets: Lagos, Abuja, Port Harcourt, Other Nigeria, Remote), Remote only, Closing soon (≤7 days), Min class I have (2:1 / 2:2 / Any: shows listings whose requirement I meet, treating "Not stated" as meets).
- **Trainings filters:** Track, Cost (Free / Free + stipend / Scholarship / Low-cost), Format, Job placement, Closing soon.
- **Sort:** Closing soonest (default), Newest.
- Filter state goes in the URL query string so filtered views can be shared on WhatsApp.
- Filters must work without layout jumps; show a result count; clear empty state with "Clear filters".
- Without JavaScript, the full list still renders (progressive enhancement).

### 6.4 Date logic (runs at build time and again in the browser)

- Today = current date in Africa/Lagos.
- If `deadline` is a date before today, treat as Closed regardless of `status`.
- If `deadline` is within 7 days, show "Closing soon" regardless of `status`.
- `Rolling` and `Not stated` never auto-close.
- "New this week": `firstSeen` within 7 days.
- Lists hide Closed items; detail pages for Closed items still render with the banner.

### 6.5 SEO and sharing

- Each page: unique `<title>` and meta description (e.g. "Deloitte Academy Cyber Security Programme · Deloitte Nigeria · Closes 27 Nov | Graduate Radar").
- Open Graph and Twitter tags on every page. v1: one well-designed static OG image for the site plus per-listing title/description. v1.1: per-listing OG images generated at build (e.g. Satori via an Astro OG integration).
- `JobPosting` structured data (schema.org JSON-LD) on job detail pages, with `validThrough` from the deadline when it is a date. Never emit it for closed listings; Google asks for expired postings to drop it. Treat Google's jobs results as a possible bonus, not a promise: Google may rank listings low when the page only links out to the employer to apply.
- `sitemap.xml` and `robots.txt`.
- Share button: `https://wa.me/?text=` + encoded "title · organisation · closes date · page URL".

### 6.6 Performance and accessibility budget

- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95.
- Home page under ~150 KB transferred on first load (excluding analytics); JavaScript under ~50 KB gzipped.
- System font stack or one self-hosted variable font with `font-display: swap`. No large hero images.
- Usable on a 360 px wide screen; tap targets ≥ 44 px; colour contrast WCAG AA; keyboard navigable; visible focus states; form controls labelled.

### 6.7 Analytics (Cloudflare Web Analytics only)

v1 uses Cloudflare Web Analytics page views and nothing else (owner decision, 15 Nov 2026). Detail-page views stand in for `listing_viewed`. Apply clicks, filter use and shares are not tracked in v1; if they are wanted later, add a tiny counter as its own backlog item. `/about` carries a one-line privacy note: no cookies, no personal data, cookie-free page counts by Cloudflare.

## 7. Design system

Build it first (day 2 morning), then pages from its components only.

**Brand attributes:** trustworthy, calm, warm, youthful but not childish, clearly Nigerian without clichés, readable on bad screens in sunlight.

**Tokens (CSS custom properties in `src/styles/tokens.css`)**

- Colour: one primary (suggested deep green, with tints/shades), one warm accent for "Closing soon", neutral grey scale, semantic colours (success, warning, danger, info). Light mode for v1; structure tokens so dark mode can be added.
- Typography: type scale (e.g. 12/14/16/18/20/24/30), line heights, weights. Body 16 px minimum.
- Spacing scale (4 px base), radii, shadows (subtle), borders, z-index, breakpoints (mobile first; 640 / 960 / 1200).
- Motion: short durations, respect `prefers-reduced-motion`.

**Components (`src/components/`)**

Header, Footer, Hero, SearchInput, FilterBar (chips on mobile, sidebar on desktop), FilterChip, Select, ResultCount, ListingCard (job and training variants), StatusBadge, DeadlineChip, EligibilityChecklist, ApplyButton (handles `mailto:`), ShareButton, SafetyNote, EmptyState, Banner (info/warning/closed), Breadcrumb, SkeletonCard (if any client loading is used).

Document every component and state on `/design`. Name things so they can be extracted into a shared package later for other Version Phi or community products.

**Name:** Graduate Radar (owner decision, 15 Nov 2026).

**Directions first:** before the tokens are final, `/design` shows 2 to 3 genuinely different brand directions (colour, type, the card and the detail page in each), each with its reasoning from the audience above. The owner picks one; the others are deleted. No generic AI-template looks: no default gradients, no interchangeable SaaS card grids.

## 8. Repo layout

```
graduate-radar-web/
├── CLAUDE.md                 # rules for Claude Code (see section 11)
├── README.md                 # setup, env vars, deploy, how data flows
├── BACKLOG.md                # open work only
├── docs/build-spec.md        # this file
├── docs/done.md              # done archive: shipped items, owner decisions, deviations
├── docs/infra-capacity.md    # free-plan limits and what each action costs
├── docs/public-routes.md     # named list of public endpoints (the feed)
├── apps-script/Feed.gs       # copy of the Apps Script feed (source of truth is the bound script; keep in sync)
├── scripts/snapshot.ts       # npm run snapshot: refresh src/data/snapshot.json from the feed
├── astro.config.mjs
├── package.json
├── public/                   # favicon, og-default.png, robots.txt
├── src/
│   ├── data/feed.ts          # fetch FEED_URL at build, validate, normalise, slugify; fallback to cached snapshot
│   ├── data/snapshot.json    # last good feed (committed) so local dev and failed fetches still build
│   ├── lib/dates.ts          # Lagos "today", deadline status, days left
│   ├── lib/filters.ts        # filter + search logic shared by build and browser
│   ├── styles/tokens.css
│   ├── styles/global.css
│   ├── components/…
│   ├── layouts/Base.astro
│   └── pages/
│       ├── index.astro
│       ├── trainings.astro
│       ├── jobs/[slug].astro
│       ├── trainings/[slug].astro
│       ├── about.astro
│       ├── stay-safe.astro
│       ├── design.astro
│       └── 404.astro
└── tests/                    # unit tests for dates, slugify, filters, feed validation
```

**Build resilience:** validate the feed with a schema (e.g. Zod). Build from `snapshot.json` instead of the feed, and log a loud warning, when: the fetch fails, the response is not valid, or the feed has fewer than half as many listings as the snapshot (jobs and trainings counted separately). Never publish an empty site.

**Snapshot refresh:** Cloudflare builds cannot commit to the repo, so the snapshot only changes when someone runs `npm run snapshot` (fetches the feed, validates it, writes `snapshot.json`) and commits the result. The date logic still hides expired listings in a stale snapshot, but new listings are missing while the build is on it. Refresh it as part of any PR, and at least monthly.

## 9. Milestones (one week)

| Day | Deliverable | Done when |
|---|---|---|
| 1 | Apps Script feed deployed; repo scaffolded; `feed.ts` + snapshot; date and slug utilities with tests | `/exec` URL returns valid JSON with only public fields; tests pass |
| 2 | Design system tokens + core components + `/design` page | Every component renders in all states on a 360 px screen |
| 3 | Jobs and Trainings list pages with search, filters, URL state | Filtering 100+ items feels instant on a mid-range phone; works without JS (unfiltered) |
| 4 | Detail pages, About, Stay safe, 404, SEO tags, JSON-LD, sitemap, WhatsApp share | Shared link shows a correct preview in WhatsApp; Google Rich Results test passes for a job page |
| 5 | Cloudflare Pages deploy, domain, deploy hook + daily trigger, analytics | A change in the sheet appears on the live site after the next rebuild with no manual steps |
| 6 | Phone testing (3+ real Android phones, slow 3G throttling), fixes, Lighthouse | Budgets in 6.6 met |
| 7 | Launch: update `Start here` tab and WhatsApp post to point to the site | Live |

## 10. Acceptance criteria (v1)

1. No private tab data or `Found via` links appear anywhere in the built site or network responses.
2. Moving columns in the sheet does not change the site output; renaming a required header makes the feed log an error and the build fall back to the snapshot.
3. A listing whose deadline passes disappears from lists the next day, even if the sweep hasn't marked it Closed.
4. Every listing has a stable URL and a working Apply action (including `mailto:`).
5. Search finds "deloitte", "cyber", "abuja", "2:1" style queries; filters combine correctly; URLs reproduce filtered views.
6. Budgets in 6.6 are met on the production URL.
7. "Never pay to apply" appears on every detail page and the Stay safe page is linked from the footer.
8. Running cost is ₦0 per month, excluding an optional domain.

## 11. CLAUDE.md for the repo (starter)

```markdown
# Graduate Radar web: rules for Claude Code

- Data comes only from the Apps Script feed (FEED_URL). Never read the spreadsheet directly and never add private tabs or the "Found via" field.
- Columns in the sheet are matched by header name, never position. Header names are the contract (see docs/build-spec.md section 5).
- Mobile first, low data: keep JS minimal; prefer static HTML; respect the budgets in section 6.6.
- Use design tokens from src/styles/tokens.css; no hard-coded colours, sizes or spacing in components.
- Dates are evaluated in Africa/Lagos. Use src/lib/dates.ts for all deadline logic.
- Trust copy matters: keep "Never pay to apply" on every detail page.
- Plain, warm British/Nigerian English in UI copy; no em or en dashes anywhere.
- Before finishing a task: run tests, build, and check the page at 360 px width.
```

## 12. Owner decisions (15 Nov 2026)

1. **Domain:** `graduateradar.versionphi.com` (owner decision, 15 Nov 2026, GR-012). The `*.pages.dev` address still answers but carries `noindex`; no redirect.
2. **Name:** Graduate Radar.
3. **Colour and font:** Claude Code proposes 2 to 3 distinct directions on `/design`; the owner picks one.
4. **Apply button:** detail page only.
5. **Analytics:** Cloudflare Web Analytics page views only. No Mixpanel in v1.
6. **Repo:** new public repo `heisX3N0/graduate-radar-web`, cloned into the Graduate Radar folder.
7. **Hosting:** Cloudflare Pages, not Workers static assets, for v1.
8. **This spec:** fixes applied in place (section 14); decisions recorded here and in each backlog item.

9. **Google account:** the sheet is on a gmail.com account, so "Anyone" web apps are allowed and consumer Apps Script quotas apply.
10. **Reviews:** run `/code-review` on each diff before opening its PR (no automatic review on this repo).
11. **Logo:** none for v1; the name is set as a typographic wordmark.
12. **About page:** says no more about who runs the site than the sheet's `Start here` tab; copy adapted from that tab, without the `Found via` and Ctrl+F lines.
13. **Deploy early:** Cloudflare Pages is connected right after the data layer, so later PRs get preview URLs.
14. **Fallback:** the "Publish to web" view stays live after launch.

## 13. Later (not v1)

- Email or WhatsApp sign-up for weekly digests (Brevo or Buttondown free tier).
- Per-listing OG images.
- Postgrad scholarships section if requested (data already collected privately).
- Calendar of recurring programmes once it has months of evidence.
- Accounts, saved listings and an Aimery-style "tailor my CV to this role" tool (Supabase free tier when needed).
- Event counts (Apply clicks, filters, shares) with a tiny counter, if page views turn out not to be enough.
- Moving hosting to Workers static assets, if Cloudflare stops adding features to Pages.

## 14. Changes since the first draft (15 Nov 2026)

1. Slug collisions use a hash of the key, not `-2`, so URLs never move when rows are reordered (6.1).
2. Apply links must be `https`, `http` or `mailto`; other schemes are dropped in the feed and checked again at build (5.1, 5.2, 5.4).
3. Date fields are normalised to `yyyy-MM-dd` in Lagos time from the raw cell value, so real date cells shown as `14/11/2026` are not misread (5.1, 5.4).
4. Snapshot fallback has a set threshold (under half the snapshot's count) and a refresh script (8).
5. Workspace accounts may block "Anyone" web apps; check before day 1 ends (5.4).
6. JobPosting: never on closed listings; Google jobs results are a bonus, not a promise (6.5).
7. Analytics is Cloudflare Web Analytics only; Mixpanel removed (4, 6.7).
8. Hosting stays on Pages; repo is public; feed is on a named public-routes list with a field-allowlist test (4, 5.2).
9. Owner decisions recorded (12); `/design` starts with 2 to 3 brand directions (7).
