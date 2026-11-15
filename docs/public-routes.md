# Public routes

The site has no server code. Everything a visitor loads is a static file. The only endpoint that runs code for anyone on the internet is listed here. Anything not on this list must not exist.

| Endpoint | Runs as | Who can call it | What it returns | Guard |
| --- | --- | --- | --- | --- |
| Apps Script web app `/exec` (feed) | The owner's Google account | Anyone with the URL | JSON of public listing fields only (spec section 5.3) | Field allowlist in `apps-script/Feed.gs`; tests prove `Found via` and private tabs never appear (GR-002) |

The feed URL is kept out of the repo (it is a Cloudflare Pages build variable and a local `.env`), but it is not a secret: treat it as public.

Not yet added: the Cloudflare Pages deploy hook (GR-008). It is a URL that starts a build, so it is a secret: it lives only in the Apps Script's Script Properties and the Cloudflare dashboard.
