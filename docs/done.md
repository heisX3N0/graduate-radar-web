# Graduate Radar: done archive

Finished backlog items, newest first. Each entry: ID and title, merge SHA, what shipped, owner decisions (dated), deviations from the item.

---

- [x] **GR-001 Repo, scaffold and project rules** (S). Done in c663748 (scaffold) and 3775b38 (review fixes).
  - **Shipped:** public repo `heisX3N0/graduate-radar-web`; Astro 7.4.12 static site (one placeholder page) with TypeScript, ESLint, Prettier, Vitest; `npm run lint` (ESLint, Prettier check, dash check), `check`, `test`, `build`; `scripts/check-dashes.ts` with 6 tests; CI workflow running the four gates on every PR and on main; `CLAUDE.md`, `README.md`, `docs/public-routes.md`, PR template, `.gitattributes` (LF), `.nvmrc` (24); spec moved to `docs/build-spec.md`.
  - **Owner decisions (2026-11-15):** first docs-only commit went straight to `main` (6e1a2ea); `/code-review` before each PR instead of an automatic review.
  - **Deviations:**
    1. TypeScript is pinned to 6.0.3, not the latest 7.0.2: typescript-eslint 8.72 supports `<6.1.0` and @astrojs/check 0.9 supports `^5 || ^6` (npm peer ranges, 15 Nov 2026).
    2. CI does not reuse agent-vault's shared workflows: the only one there is the Claude PR review, which this repo does not use (owner decision above). The CI file is local to the repo.
    3. Negative CI check: a throwaway draft PR (heisX3N0/graduate-radar-web#1, closed, branch deleted) proved CI fails on a lint error (run 43658187154). Lint stops the job first, so the failing test and the dash were proved failing locally on the same commit (exit 1 each), not in CI.
    4. `engines.node` is `^22.23.4 || ^24.16.0 || >=26.3.0` to match eslint-plugin-astro. The owner's machine has Node 24.14.0, which works with warnings; updating to 24.16 or later removes them.
