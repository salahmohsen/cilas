# Analytics (PostHog)

CILAS uses PostHog (EU Cloud, free plan) as its only analytics tool. There is no Google Analytics. It counts visits to the public pages, a few actions and errors. It runs in PostHog's cookieless mode: it sets no cookie and stores nothing in a visitor's browser, so the site needs no consent banner.

Without the keys the site builds and runs as before, loads no analytics code, makes no request to PostHog, and the dashboard widgets are hidden.

## What is tracked

Automatic events, on public pages only:

| Event         | When                                                  | Notes                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$pageview`   | A page loads, or the address changes without a reload | Path and campaign tags (`utm_*`, `ref`) only. Referrer is cut to origin and path. A person's name in `/people/<name>` is replaced by `[person]`.                                        |
| `$exception`  | An unhandled browser error                            | Known noise is dropped (cancelled requests, extensions, `ResizeObserver`). One page load sends at most 5, and one of each kind.                                                         |
| `$web_vitals` | A page has loaded and been used                       | LCP, CLS, FCP and INP, sent together about 5 seconds after the numbers are ready. Addresses nested in the event (`navigationURL`, the attribution's `url`) are cleaned like the others. |

Events the site sends itself, through `track()` (`src/lib/analytics/track.ts`). Properties are public labels, never text a person typed:

| Event                   | Where                                                                                              | Properties                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apply_started`         | First time someone enters a field of an application form (`src/components/forms/payload-form.tsx`) | `kind` (`course` or `programme`), `id` (slug)                            |
| `apply_submitted`       | The application was accepted by the server                                                         | `kind`, `id`                                                             |
| `register_clicked`      | The Register link on an event page (`src/components/events/register-link.tsx`)                     | `kind: 'event'`, `id` (slug)                                             |
| `calendar_added`        | Add to calendar on an event, or subscribe or download on the calendar page                         | `source`: `event-google`, `event-ics`, `feed-subscribe`, `feed-download` |
| `newsletter_subscribed` | A good signup (`src/lib/newsletter-subscribe.ts`)                                                  | `place`: `footer` or `page`. Never the address.                          |
| `push_enabled`          | A device was turned on in settings                                                                 | none                                                                     |
| `login`                 | A good sign-in with a password                                                                     | `method: 'password'`                                                     |
| `contact_submitted`     | The contact form was sent                                                                          | `topic`, one of the form's own labels                                    |

Server errors (`src/instrumentation.ts`, `onRequestError`) are sent with `posthog-node` as `$exception` with `source: 'server'`. Each one reports its route pattern, method and stack. The message is kept only for public pages, cleaned of emails and secrets. A private route (Spaces, settings, admin, API) reports the error name and stack with the message withheld. Query strings are never sent. One fault reports once every 10 minutes, and the process sends at most 60 an hour. Not-found, redirects, cancelled requests and bot probes (`/wp-login.php`, `.env`) are ignored.

## What is never sent, and why

An allowlist decides (`src/lib/analytics/paths.ts`). A page counts only if its first path segment is one of: home, `about`, `apply`, `articles`, `calendar`, `contact`, `events`, `governance`, `people`, `study`. Everything else is excluded by default, so a new private route stays private until someone adds it on purpose:

- Spaces (`/spaces`), settings, profile, login, forgot and reset, the signed-in copies of pages.
- `/admin` and `/api`.
- Any path with a `preview` segment.

Why: these pages show posts, comments, names, emails and tokens. No page view or error is sent from them.

One gate (`src/lib/analytics/policy.ts`, PostHog's `before_send`) checks every event, whatever raised it, and drops it if the page is excluded. On the events it keeps, it cleans every property that holds an address, found by its name (ending in `url`, `pathname` or `referrer`, in any letter case), not only `$current_url`. It also looks inside nested objects, as the `$web_vitals_*_event` objects of a web vital. PostHog adds its own: the page a visit started on (`$session_entry_url`, `$session_entry_referrer`) and the page before (`$prev_pageview_pathname`). An address on this site is dropped when its page is excluded, and otherwise loses its query, its hash and a person's name. An address on another site keeps only its origin and path. A search engine keyword (`$session_entry_ph_keyword`) is dropped. A browser error message is cleaned of emails and secrets, as a server error message is.

`tests/unit/analytics-sdk.unit.spec.ts` runs the real posthog-js with the site's settings and checks what leaves after the gate. Run it after each posthog-js upgrade: a new SDK can add properties.

The two exceptions are `login` and `push_enabled`. They happen on pages that are otherwise excluded (the login and settings pages). They are sent with no address (`/[private]`), no referrer and no other property.

Never done: `posthog.identify`, autocapture, page-leave events, heart beats, heat maps, feature flags, surveys, session recordings (cookieless mode cannot record).

## Cookieless

`cookieless_mode: 'always'` in `src/lib/analytics/client.ts`, and "Cookieless server hash mode" on in the PostHog project (Settings, Web analytics). The browser stores nothing: no cookie, no `localStorage`, no `sessionStorage`. PostHog makes each event's `distinct_id` on its servers from a hash of the project, the IP, the user agent, the host and a salt that it deletes each day. It removes the IP before it stores the event. `person_profiles: 'identified_only'` and no one is identified, so no person profile is made. `respect_dnt` is on.

What this means for the numbers: a visitor is one person on one day. Reloads, new tabs and other pages on the same day stay one visitor. Someone who comes back on another day counts again, so a 30-day "Visitors" total is a count of person-days. Two people on the same network with the same browser version on the same day count as one. The dashboard explains this behind the info icon (a hover card) on the Visitors, Traffic, Where visitors come from, Audience and Application funnel widgets. Use `info` on `WidgetCard` for any longer note.

The hash needs the visitor's real IP. See the relay below: without it, every visitor shares one IP and one hash.

Cookieless mode removes the IP before GeoIP runs, so events have no country. The Audience widget shows the browser's time zone (`$timezone`) in its place.

Session recording cannot run in this mode (posthog-js 1.444 throws if it starts), so it is off in the client and in the project.

### Staff devices

A device that opens `/admin` gets one `localStorage` flag, `cilas:staff-device` (`isStaffDevice` in `client.ts`). Analytics never starts on that device again, so the team's own visits are not counted. It is the only thing analytics stores, and only on staff devices. To count a staff device again, clear the flag in the browser's site data.

## How events reach PostHog

The browser sends to the site's own address, `/relay-k3/*` (`INGEST_PATH` in `src/lib/analytics/hosts.ts`). `src/proxy.ts` forwards it to PostHog with `relayRequest`: `static` and `array` to `eu-assets.i.posthog.com`, the rest to `eu.i.posthog.com`.

The relay changes two headers. It sets `X-Forwarded-For` to the visitor's IP from Cloudflare's `cf-connecting-ip` (else the first address already in `X-Forwarded-For`). Without this, PostHog saw the address of the proxy in front of the Next server (`10.0.1.191`), so GeoIP found nothing and the cookieless hash would join all visitors. It also removes the `cookie` header, so the site's cookies, the login cookie among them, never reach PostHog. Ad blockers that list `posthog.com` do not break it. The path name is arbitrary on purpose; PostHog advises against obvious names.

Related settings:

- `skipTrailingSlashRedirect: true` is needed because PostHog paths end in a slash. `src/proxy.ts` puts the redirect back for the site's own pages (`/en/about/` goes to `/en/about`).
- The relay is handled first in `src/proxy.ts`, before the language and trailing-slash redirects.
- The site sets no Content-Security-Policy, so nothing else is needed. If one is added, allow `'self'` for `script-src`, `connect-src` and `worker-src blob:` (the recorder).
- `robots.txt` disallows `/relay-k3/`.

## Web vitals

`capture_performance: { web_vitals: true, network_timing: false }` in `src/lib/analytics/client.ts`. PostHog loads its web vitals script through the relay (`/relay-k3/static/`) and sends one `$web_vitals` event per page with LCP, CLS, FCP and INP. INP and LCP carry attribution: the CSS selector of the slow element and timing parts. A resource address in the attribution is kept only when it is on another site (origin and path); one on this site is dropped unless it is a public page.

The client setting turns them on; the project toggle is not needed. See them on the dashboard's Web vitals widget, or in PostHog, Web analytics, Web vitals. The widget shows, for each metric, the share of page loads within Google's "good" limit (LCP 2.5 s, INP 200 ms, CLS 0.1, FCP 1.8 s) and the 75th percentile. At 75% good or more a metric passes Google's test. Values over 15 minutes are discarded as noise (PostHog's default).

## Dashboard

The admin dashboard home shows these widgets (`src/components/admin/dashboard/widgets/analytics.tsx`), all built from Arc charts. They are in the default layout only when the three server settings below are set, and they can be added, moved or removed like the others. Reset layout works as before.

| Widget                   | Arc component         | Data                                                                |
| ------------------------ | --------------------- | ------------------------------------------------------------------- |
| Visitors, Page views     | Sparkline             | Daily counts for 30 days, change against the 30 days before         |
| Site errors              | Metric card           | `$exception` events, last 7 days                                    |
| Traffic                  | Line chart            | Page views and visitors per day                                     |
| Application funnel       | Progress              | Viewed an apply page, `apply_started`, `apply_submitted`            |
| Top pages                | Progress              | Page views by path, both languages added together                   |
| Page movement            | Slope chart           | The busiest pages, now against the 30 days before                   |
| Where visitors come from | Waffle chart          | `utm_source`, else referring domain; the site itself is dropped     |
| Audience                 | Donut chart, Progress | Language, device, browser time zone                                 |
| What visitors do         | list                  | The six own events above, with change                               |
| Courses and events       | Progress              | Views of `/study/<slug>` and `/events/<slug>`                       |
| Web vitals               | Gauge                 | Share of page loads rated good for LCP, INP, CLS, FCP, with p75     |
| PostHog free plan        | Usage meter           | This month's events (errors left out) and errors against the limits |
| Daily activity           | Activity heatmap      | Page views per day for a year                                       |

The Arc Pro funnel chart is not used (no licence); the funnel is built from Progress bars.

How the data arrives: the server posts HogQL to `POST {POSTHOG_API_HOST}/api/projects/{id}/query/` with the personal key as a bearer token (`src/lib/analytics/posthog-query.ts`, queries in `queries.ts`). Timeout 5 seconds. Each answer is cached for 10 minutes for all admins (`unstable_cache`, tag `admin-stats`). The key stays on the server.

Without the settings, the analytics widgets are not shown. If PostHog is slow or fails, each widget shows "Could not load from PostHog" (the log holds the status, never the key). Other widgets are not affected.

To check the queries against the real project: `pnpm analytics:check` (needs the three server settings; prints row counts only).

PostHog's own "CILAS overview" dashboard was not created: the key we hold is read-only, and creating a dashboard needs a key with write scope. Build one in PostHog from the same events if wanted.

## Settings

| Name                       | Where                      | Needed for                                                                    |
| -------------------------- | -------------------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`  | build argument and runtime | Everything. The public project key (`phc_...`). Blank means analytics is off. |
| `NEXT_PUBLIC_POSTHOG_HOST` | build argument and runtime | The ingestion host. Default `https://eu.i.posthog.com`.                       |
| `POSTHOG_API_HOST`         | runtime                    | Dashboard. `https://eu.posthog.com`.                                          |
| `POSTHOG_PROJECT_ID`       | runtime                    | Dashboard. `329899`.                                                          |
| `POSTHOG_PERSONAL_API_KEY` | runtime, secret            | Dashboard. A personal key with the Query read scope only.                     |

The two `NEXT_PUBLIC_*` values are inlined into the browser code at build time, so Dokploy must pass them as build arguments (the `Dockerfile` declares both) and changing them needs a new build. The three dashboard values are read at run time.

## Staying on the free plan

Free limits per month (check https://posthog.com/pricing before relying on them): 1,000,000 events, 1,000,000 flag requests, 100,000 exceptions. No payment method is on the account, so PostHog stops counting at the limit; nothing is charged.

How the design stays far below them: no autocapture, no page-leave, no heart beats; a page view is one event; web vitals add about 30% of the page view count (PostHog's average); the own events fire once per action; exceptions are limited per page load and per server process; bots are filtered by PostHog; feature flags are not evaluated.

To check usage: the "PostHog free plan" widget on the dashboard, or PostHog's Billing page (Organization settings). The widget counts the calendar month, which is close to PostHog's billing period.

## Add an event

1. Add it to `AnalyticsEvents` in `src/lib/analytics/events.ts` with its properties (labels only).
2. Call `track('name', { ... })` where it happens. It does nothing when PostHog is off or the page is excluded.
3. Add a test next to the ones in `tests/unit/analytics-events.unit.spec.tsx`, and a row to the table above.
4. To show it on the dashboard, add its key to `GOALS` in `src/lib/analytics/stats.ts` and to the `goals` query.

If the event must fire on an excluded page, add it to `ANYWHERE_EVENTS` in `events.ts`. Do this only for an event with no page context, as `login` and `push_enabled`.

## Rotate the personal key

1. In PostHog, Settings, Personal API keys: create a new key with scope "Query: read" only, and, if available, limited to this project.
2. Put it in Dokploy as `POSTHOG_PERSONAL_API_KEY` for the `cilas-web` app and redeploy (no rebuild is needed).
3. Run `pnpm analytics:check` once, or open the dashboard, to confirm.
4. Delete the old key in PostHog.

Rotate it at once if it was ever pasted into a chat, a log or a commit.

## Known limits

- Run `pnpm analytics:check` after changing a query. A wrong column fails only at PostHog, so a mock-only test does not catch it. The old recordings meter read `min_first_timestamp`, a column that does not exist, and stayed hidden because failed widgets then showed nothing.
- The visitor IP comes from Cloudflare's `cf-connecting-ip`. A request that reaches the server without Cloudflare can set its own `X-Forwarded-For` and so its own cookieless hash. This only affects counts.
- Counts before the cookieless switch (November 2026) are page loads, not visitors, and include staff visits.
- Bots that do not set a recognised user agent can still count as visitors.
