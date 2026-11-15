# Launch (GR-010)

Drafts for the owner to publish by hand: the sheet's `Start here` tab and the WhatsApp post. Claude does not edit the sheet or post anything. `tests/launch-copy.test.ts` checks the text in the two `text` blocks below. The checks fail if either draft links to the Google Sheet or its "Publish to web" view, mentions `Found via`, drops "Never pay to apply", has anything other than the website home page as its first link, or links to a page the site does not build. If you change a draft, change it here first and run `npm test`.

Why the website must be the first link: WhatsApp builds the preview card from the first link in a message.

## Start here tab

Clear the tab's old text first (select it all and press Delete), so no old line or link is left below the new text. Then paste one line per row, starting in A1. These drafts were written without seeing the current tab (Claude never reads the sheet). Keep any line of yours that is still true, except a `Found via` line or the Ctrl+F tip: the website's search replaces the tip.

```text
GRADUATE RADAR
Checked graduate jobs and free tech trainings for Nigerian graduates.

Use the website: https://graduate-radar.pages.dev
It has search, filters (type, field, location, degree class) and a page for every opening with its Apply link. It works well on phones and uses little data.
Trainings and scholarships: https://graduate-radar.pages.dev/trainings

How it works
We add new openings and mark closed ones as we find them.
Every listing links to the employer's or provider's own page wherever possible.
This sheet is the list behind the website. The website updates from it every morning.

Stay safe
Never pay to apply. If anyone asks you for a fee, stop and don't send money.
Apply only through the Apply link or the organisation's official website.
How to spot a fake job: https://graduate-radar.pages.dev/stay-safe
```

## WhatsApp post

WhatsApp shows `*text*` as bold. Send it to yourself first to check the preview card.

```text
*Graduate Radar is now a website*

Checked graduate trainee programmes, entry-level jobs and free tech trainings for Nigerian graduates, all in one place:
https://graduate-radar.pages.dev

What's new:
• Search, and filter by type, field, location and degree class
• Every opening has its own page with the deadline and the Apply link
• Works well on phones and uses little data

Never pay to apply. If anyone asks you for a fee, stop.

Please share with anyone looking for a graduate role.
```

## Owner steps

1. Paste the `Start here` draft into the sheet's `Start here` tab. **Expected:** the tab's first link is the website.
2. Send the WhatsApp post to yourself. **Expected:** the preview card shows the Graduate Radar image and title, and tapping the link opens the site.
3. Post it where the old sheet link was shared.
4. Open the old "Publish to web" link in a private browser window. **Expected:** it still loads (kept as a fallback, owner decision 15 Nov 2026).

## The fallback

The sheet's "Publish to web" view stays live after launch (owner decision, 15 Nov 2026). It is managed in the sheet under File, Share, Publish to web. Its address is not stored in this repo on purpose, so nothing here points people to it. Downside: anyone who still has the old link sees the old view (cut-off text, no filters, and whatever columns the published tabs show, possibly `Found via`). To stop it later, use Stop publishing on the same screen.
