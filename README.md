# Graduate Radar web

A free, checked list of graduate trainee programmes, entry-level jobs and free tech trainings for Nigerian graduates. This repo is the public website. The Google Sheet stays the database; the site is rebuilt from it every day.

Status: scaffold only (GR-001). See `BACKLOG.md` for what comes next.

## How data flows

```
Claude sweep (Tue and Fri 05:41 Lagos) -> Google Sheet (database)
Apps Script web app (feed)              -> JSON of public listing fields only
Daily 07:30 trigger                     -> Cloudflare Pages deploy hook
Astro static build                      -> Cloudflare Pages (*.pages.dev)
```

Full detail: `docs/build-spec.md` section 4. The feed (GR-002), the data layer (GR-003) and the deploy (GR-008) are not built yet.

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

None yet. `FEED_URL` (the Apps Script `/exec` URL) arrives with GR-002 and GR-003. Never commit it; use a local `.env`.

## Docs

- `docs/build-spec.md`: the spec.
- `BACKLOG.md`: open work. `docs/done.md`: what shipped.
- `docs/infra-capacity.md`: free-plan limits and what each action costs.
- `docs/public-routes.md`: the only public endpoints.
- `CLAUDE.md`: rules for Claude Code in this repo.
