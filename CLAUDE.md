# Graduate Radar web: rules for Claude Code

The owner's global rules (`~/.claude/CLAUDE.md`, version 2026-10-22) apply in full: discuss before building, backlog items, one worktree and PR per item, negative tests first, Cost as free-plan capacity, no em or en dashes. This file adds the project's rules and takes precedence where they differ.

## Where things are

- Spec: `docs/build-spec.md` (data contract in section 5, website in 6, design system in 7).
- Open work: `BACKLOG.md`. Done archive: `docs/done.md`.
- Free-plan limits and what each action costs: `docs/infra-capacity.md`.
- Public endpoints (the only ones allowed): `docs/public-routes.md`.

## Gates (run all four before every commit)

```bash
npm run lint    # eslint, prettier --check, dash check, style check (tokens only)
npm run check   # astro check (types)
npm test        # vitest
npm run build   # astro build, then the dist scan (scripts/check-dist.ts)
```

Node 24.16 or later on the 24 line (see `.nvmrc` and `engines`; eslint-plugin-astro needs 24.16+). TypeScript is pinned to 6.0 because typescript-eslint and @astrojs/check do not support TypeScript 7 yet (checked 15 Nov 2026).

Gotcha: worktrees live inside the main checkout (`.claude/worktrees/`). Astro's bundler also reads the main checkout's `tsconfig.json`, so if the main checkout has no `node_modules`, `npm run build` in a worktree fails with "Tsconfig not found astro/tsconfigs/strictest". Fix: run `npm ci` in the main checkout once (and again after dependency changes merge). CI and Cloudflare are not affected.

## Reviews

No automatic PR review on this repo. Run `/code-review` on the diff before opening each PR and put its findings, and how each was answered, in the PR's Review section (owner decision, 15 Nov 2026). Merge with a merge commit.

## Data rules

- Data comes only from the Apps Script feed (`FEED_URL`). Never read the spreadsheet directly and never add private tabs or the `Found via` field.
- Columns in the sheet are matched by header name, never position. Header names are the contract (spec section 5).
- Apply links must be `https`, `http` or `mailto`. Check again at build even though the feed filters them.
- Dates are evaluated in Africa/Lagos. Use `src/lib/dates.ts` for all deadline logic.
- Never commit `FEED_URL`, the deploy hook URL or any `.env` file.

## Website rules

- Mobile first, low data: keep JS minimal; prefer static HTML; respect the budgets in spec section 6.6.
- Use design tokens from `src/styles/tokens.css`; no hard-coded colours, sizes or spacing in components.
- Trust copy matters: keep "Never pay to apply" on every detail page.
- Plain, warm British/Nigerian English in UI copy; no em or en dashes anywhere (the dash check enforces this).
- Before finishing a task: run the gates and check the page at 360 px width.

## Infrastructure cost

Every backlog item and PR has a Cost line from `docs/infra-capacity.md`: per user action, each free limit it uses, ending with the capacity effect. Pages builds are the scarcest limit (500 a month, shared with Aimery on the same Cloudflare account).
