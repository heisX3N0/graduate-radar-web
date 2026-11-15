# Public routes

The site has no server code. Everything a visitor loads is a static file. The only endpoint that runs code for anyone on the internet is listed here. Anything not on this list must not exist.

| Endpoint | Runs as | Who can call it | What it returns | Guard |
| --- | --- | --- | --- | --- |
| Apps Script web app `/exec` (feed) | The owner's Google account | Anyone with the URL | JSON of public listing fields only (spec section 5.3) | Field allowlist in `apps-script/Feed.gs`. `tests/feed.test.ts` proves: `doGet` is the only route the script defines, `Found via` and unlisted columns never appear, no tab other than Jobs and Trainings & Scholarships is touched, unsafe Apply links and unknown statuses are dropped |

The feed URL is kept out of the repo (it is a Cloudflare Pages build variable and a local `.env`), but it is not a secret: treat it as public.

## Not public, but reachable: the deploy hook

The Cloudflare Pages deploy hook (GR-008) is a URL that starts a production build when it receives a POST. It has no other authentication, so it is a **secret**: it lives only in the Apps Script project's Script Properties (`DEPLOY_HOOK_URL`) and the Cloudflare dashboard, never in the repo. Who can read it: anyone who can open the Cloudflare project, and anyone with edit access to the Graduate Radar sheet (a bound script's Script Properties are visible to every editor of the sheet). Giving someone edit access to the sheet therefore also gives them the hook. If it leaks, the worst case is someone starting builds and using up the account's 500 builds a month; it cannot change the site's content (builds always use `main` and the feed). Fix: delete it in Cloudflare, create a new one, and replace the Script Property. `triggerRebuild` only calls `https://api.cloudflare.com/` URLs and never puts the hook in an error, including on network failures (`tests/rebuild.test.ts`).
