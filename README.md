# Graduate Radar web

A free, checked list of graduate trainee programmes, entry-level jobs and free tech trainings for Nigerian graduates. This repo is the public website. The Google Sheet stays the database; the site is rebuilt from it every day.

Status: scaffold (GR-001), the Apps Script feed (GR-002) and the data layer (GR-003). See `BACKLOG.md` for what comes next.

## How data flows

```
Claude sweep (Tue and Fri 05:41 Lagos) -> Google Sheet (database)
Apps Script web app (feed)              -> JSON of public listing fields only
Daily 07:30 trigger                     -> Cloudflare Pages deploy hook
Astro static build                      -> Cloudflare Pages (*.pages.dev)
```

Full detail: `docs/build-spec.md` section 4. The deploy and daily trigger (GR-008) are not built yet.

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

`npm run lint` runs ESLint, Prettier (check only) and the dash check (`scripts/check-dashes.ts`), which fails on any em or en dash in source, docs or root markdown files.

## Environment variables

- `FEED_URL`: the Apps Script `/exec` URL. Used by the build and by `npm run snapshot`. Set it in a local `.env` (copy `.env.example`) and, from GR-008, as a Cloudflare Pages build variable. Never commit it.

## Docs

- `docs/build-spec.md`: the spec.
- `BACKLOG.md`: open work. `docs/done.md`: what shipped.
- `docs/infra-capacity.md`: free-plan limits and what each action costs.
- `docs/public-routes.md`: the only public endpoints.
- `CLAUDE.md`: rules for Claude Code in this repo.
