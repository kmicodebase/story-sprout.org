# Analytics

Implements the PostHog metrics brief for the **website only**. The Studio is a
separate application and is not instrumented here.

The question this exists to answer: *of the educators we reach out to, how many
land on the site, how many click a training session, and how many finish signing
up?* Everything else was left out.

## Architecture

```
src/lib/analytics-schema.ts   allowlists + pure functions (no posthog import)
src/lib/analytics.ts          the only file that imports posthog-js
src/components/Analytics.astro  boots it, fires the landing + CTA events
src/components/SignupDialog.astro  fires the three training events
public/_headers               CSP: connect-src allows the PostHog host
tests/analytics.test.ts       allowlist / parser / page-group tests
tests/csp.test.ts             keeps the CSP and the configured host in step
scripts/audit-analytics.mjs   drives a real browser, asserts on real payloads
```

Every call goes through `capture()` in `analytics.ts`. That function drops any
event name or property key not on the allowlist, so a careless call site cannot
leak a field. It is wrapped in `try`/`catch` and returns early if PostHog failed
to start — analytics can never break the page or the sign-up.

### What is switched off, and why it is off structurally

`disable_external_dependency_loading: true` is the setting that matters most.
PostHog normally fetches extra bundles at runtime — the session recorder,
surveys, product tours — plus a remote config file that can **enable them from
the PostHog dashboard with no code change**. On a site used by children that is
not an acceptable failure mode, so the loader is off. The CSP is the second lock:
`script-src` does not include any PostHog host, so the browser would refuse the
script even if the setting were reverted.

Also off: `autocapture`, `capture_pageview`, `capture_pageleave`,
`disable_session_recording`, `disable_surveys`, `disable_product_tours`,
`disable_conversations`, `disable_web_experiments`, `enable_heatmaps`,
`advanced_disable_flags`. `person_profiles: 'identified_only'` combined with
never calling `identify()` means no person profile is ever created.

### Property scrubbing

PostHog attaches about forty `$` properties to every event by default. Two
groups are removed:

- **Everything containing a URL** — `$current_url`, `$pathname`, `$host`,
  `$referrer`, `$referring_domain`, and the five `$session_entry_*` equivalents.
  A story page URL contains the book's title, which is a child's work; a query
  string can contain anything a visitor was sent. `page_group` carries what we
  actually need.
- **`$raw_user_agent`** — `$browser`, `$os` and `$device_type` already answer
  "does this work on a school Chromebook" without the fingerprint.

`$ip` is set to `null`, which tells PostHog not to store an IP for the event.

The denylist was derived from an actual captured payload, not from
documentation. **Re-run `npm run audit:analytics` after upgrading posthog-js** —
new versions add new auto-properties, and a new URL-bearing one would not be
caught by anything else.

### Attribution

Outreach links may carry `utm_source`, `utm_medium`, `utm_campaign`,
`utm_content`, `batch_id`, `segment`, `outreach_id`. Each value must match
`/^[A-Za-z0-9._-]{1,64}$/` or it is dropped, so a hand-edited link cannot inject
markup or an email address.

They are read once at init, held in memory, and **removed from the address bar**
via `history.replaceState` before PostHog starts — which is what stops PostHog's
own UTM parsing from picking up unvalidated values. Order matters here.

`outreach_id` must be a random opaque id. It must not encode a name, an
organization, or a spreadsheet row.

## Event dictionary

Every event also carries `schema_version: "1"`, `surface: "website"`,
`environment`, and any valid attribution from the landing URL.

| Event | Fires when | Properties |
|---|---|---|
| `educator_landing_viewed` | Home page loads. Once per page load. | `landing_path`, `page_group` |
| `training_cta_clicked` | A training session button is clicked | `cta_location: "training_band"`, `training_date` |
| `training_registration_started` | The sign-up dialog opens. Once per session id. | `training_date` |
| `training_registration_completed` | `/api/signup` confirms the row reached the sheet. Once per session id. | `training_date` |
| `studio_cta_clicked` | A "Try Story Sprout Studio" link is clicked | `cta_location`, `page_group` |
| `educator_overview_opened` | A curriculum session deck is downloaded | `asset_id: "session-N"`, `page_group` |

`training_date` is a content slug such as `training-2026-09-06` — a date, not a
person. `cta_location` is a closed enum: `header`, `hero`, `footer`,
`training_band`, `research`, `about`, `curriculum`.

Events 4 and 5 from the brief (Studio activation and story completion) are **not
implemented** — deferred to whoever instruments the Studio.

## Configuration

```
PUBLIC_POSTHOG_KEY=phc_...
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
PUBLIC_ANALYTICS_ENABLED=true
```

These live in `site/.env`, which is gitignored. `.env.example` documents them.

**They are read at build time, not at runtime.** This site is built locally and
deployed as prebuilt static files, so setting these in the Cloudflare dashboard
does nothing — the values are already baked into the JavaScript bundle. To
change one, edit `.env` and rebuild.

The project API key is a public write-only key. It is meant to be in the browser
bundle. No personal or administrative PostHog credential appears anywhere in
this repository.

To turn analytics off entirely, set `PUBLIC_ANALYTICS_ENABLED=false` and rebuild.

## Verification

```
npm test                    # 15 unit tests: allowlists, parsers, CSP
npm run audit:analytics     # offline: asserts on real payloads, sends nothing
npm run verify:live         # drives the DEPLOYED site; events really are sent
npm run verify:live -- --submit   # ...including a real registration
```

`verify:live` is the one that answers "is it actually running in production".
It drives https://story-sprout.org in a real browser and lets the requests
through, tagging everything `batch_id=test_internal`. Add `--submit` to exercise
`training_registration_completed` end to end — that writes a labelled row to the
Google Sheet and emails the organizers, so delete the row afterwards.

The audit serves the built site, drives the whole funnel in headless Chrome,
intercepts every PostHog request and **blocks it**, then asserts on what would
have been sent. Nothing leaves the machine, so it is safe to run against the
production key. It covers three scenarios: an outreach landing with a hostile
URL (an email address in an unrelated param, markup in `utm_content`), a story
page whose URL contains a book title, and a visitor sending Global Privacy
Control.

Last run: all checks passed. Confirmed on the wire — no name, no email address,
no organization, no book title, no URL properties, no injected markup, `$ip`
null, no identified person, no session-recording payload, and nothing at all
captured under GPC.

Two caveats worth knowing when testing by hand:

- **PostHog silently discards events from user agents it classifies as bots**,
  and plain headless Chrome is one. Both scripts override the user agent.
- **Only https://story-sprout.org is instrumented.** The legacy microsite at
  storysprout.kindnessmattersinc.org, the old Bubble app, and the Studio on
  GitHub Pages are separate properties and contain no PostHog code. Testing
  those and finding nothing is the expected result, not a fault.

The sign-up round trip goes through Google Apps Script and regularly takes more
than six seconds. A verification script that gives up sooner will report a
false failure while the row is being written correctly.

## Limitations

- **Persistence is `memory`.** Nothing is written to cookies or storage, which
  is why the site needs no consent banner. The cost is real: every navigation
  starts a fresh anonymous id, so unique-visitor counts measure page loads
  rather than people, and a funnel spanning two pages will not join up. The
  funnel we care about — land, click a session, register — happens entirely on
  the home page in one page load, so it is unaffected. Switching to
  `sessionStorage` would fix cross-page funnels and is still cookieless; it
  would need a privacy-notice change.
- Bot filtering means real traffic counts are slightly under-reported.
- Registration is counted client-side after the endpoint confirms. A visitor who
  closes the tab in the same instant is missed. The Google Sheet is the record of
  truth for who actually signed up; these numbers are for ratios.
- No Studio instrumentation, so there is no view of what happens after someone
  leaves for the Studio.

## Dashboard setup

In PostHog, one funnel answers the outreach question:

`educator_landing_viewed` → `training_cta_clicked` →
`training_registration_started` → `training_registration_completed`

Break it down by `utm_campaign` or `batch_id` to compare outreach batches. Filter
`batch_id = test_internal` **out** of real reporting — that value is reserved for
manual testing.

Worth watching alongside it: `studio_cta_clicked` by `cta_location`, which says
which placement is doing the work, and `educator_overview_opened` by `asset_id`,
which says which session decks people actually open.

## Rollback

Fastest, no rebuild: in PostHog, project settings → **temporarily disable** the
project, or delete the API key. Events stop being accepted immediately.

In this repository: set `PUBLIC_ANALYTICS_ENABLED=false` in `.env`, then
`npm run build && npx wrangler pages deploy dist --project-name story-sprout`.
`init()` returns early and nothing is sent.

To remove it completely: delete `src/components/Analytics.astro`, its `<Analytics />`
in `BaseLayout.astro`, `src/lib/analytics*.ts`, the `data-cta` attributes, the
`capture` calls in `SignupDialog.astro`, `npm uninstall posthog-js`, revert the
`connect-src` in `public/_headers`, and restore the "no analytics" wording in
`src/pages/privacy.astro`.
