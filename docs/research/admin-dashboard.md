# Admin dashboard research

Date: 31 October 2026. Stack: Next 16.4.2, Payload 3.91.0, `payload-theme` 0.9.4 (0.10.0 is out; it adds no nav or dashboard API). Findings come from the installed source in `node_modules` (paths below are relative to it) and from the running admin on this branch.

**Deferred:** the media drawer flicker (question 5) is out of scope for this pass.

## 1. Why the two nav links did not show

**Root cause.** `payload-theme` replaces two Payload slots, and the replacements do not render the slots we used.

| Our config (before)                    | What happened                                                                                                                            | Evidence                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `beforeNavLinks: [WorkLinks]`          | `beforeNavLinks` is rendered only by Payload's `DefaultNav`                                                                              | `@payloadcms/next/dist/elements/Nav/index.js:113`                                            |
|                                        | The theme sets `components.Nav = 'payload-theme/client#Nav'`, a client sidebar built only from `config.collections` and `config.globals` | `payload-theme/dist/index.js:139`, `dist/components/Nav/index.js` (no `beforeNavLinks` read) |
| `beforeDashboard: [ReviewQueueWidget]` | `beforeDashboard` is rendered only by Payload's `DefaultDashboard`                                                                       | `@payloadcms/next/dist/views/Dashboard/Default/index.js:18-23`                               |
|                                        | The theme sets `views.dashboard.Component = 'payload-theme/rsc#Dashboard'`, which never reads `beforeDashboard`                          | `payload-theme/dist/index.js:165-167`, `dist/components/Dashboard/index.js`                  |

Reproduced on the running admin as a super admin: `GET /admin` had zero "Reviews and applications" links, zero "Newsletter subscribers" links and no "Waiting for review" box. Both were dead config in `src/payload.config.ts` (old lines 125 and 140). The same finding explains the comment in `src/components/admin/subscribers-link.tsx` ("the theme's sidebar has no place for custom links").

**Fix applied (small, no patch to Payload or the theme).**

- `admin.components.actions` renders in the top bar and the theme only appends to it (`payload-theme/dist/index.js:151`). `WorkLinks` now sits there (`src/payload.config.ts`, `src/components/admin/work-links.tsx`, `src/app/(payload)/custom.css`). Payload passes `user` to actions (`@payloadcms/next/dist/templates/Default/index.js:46-71`), so the admin-only check still works.
- The review queue moved to the theme's own option: `payloadTheme({ dashboard: { widgets: [{ component: '.../review-queue#ReviewQueueWidget', width: 'full' }] } })`. The theme renders widgets below its collection cards (`dist/components/Dashboard/index.js:405-421`), so the box is low on the page. Question 2 replaces this placement.
- `pnpm generate:importmap` ran; `importMap.js` only reorders entries.

**Verification.** After the change, `GET /admin` as the super admin contains both links and the "Waiting for review" box. In the browser the two links sit in the top bar (x 907 to 1243 px at 1280 px width) beside the bell and theme buttons, and the queue renders. Links hide under 700 px width; the dashboard remains the fallback there.

**Options not taken.**

- Own `Nav`, re-assigned after `payloadTheme()` (the theme README allows this): needs a fork of about 300 lines of theme code; breaks on every theme upgrade.
- A portal that injects links into `.pt-nav__wrap`: hydration flicker, fragile.
- Upstream feature request (`nav.links` option): worth filing; no code needed here.

## 2. Replacing the dashboard home

Payload 3.91 has three layers (`payload/dist/config/types.d.ts:605-650,774-780`; `@payloadcms/next/dist/views/Dashboard/`):

| Mechanism                                                              | What it does                                                                                                                                                                                                                                                                                       | Works with payload-theme?                                                                                                                                                        |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin.components.beforeDashboard` / `afterDashboard`                  | Components around the default dashboard                                                                                                                                                                                                                                                            | No. The theme replaces the view.                                                                                                                                                 |
| `admin.dashboard: { widgets, defaultLayout }` (marked `@experimental`) | Native modular dashboard. Each widget is `{ slug, Component, label, minWidth, maxWidth, fields }`; users drag, resize and add widgets; layout saves in user preferences (`ModularDashboard/index.js`). Widget server props: `{ cookies, locale, permissions, req, user, widgetData, widgetSlug }`. | Only if the theme view is replaced by `DefaultDashboard` (exported from `@payloadcms/next/views`). The theme CSS targets `pt-dash`, so the native grid is unstyled by the theme. |
| `admin.components.views.dashboard.Component`                           | Replaces the whole home view. Receives full `AdminViewServerProps` (`initPageResult`, `payload`, `user`, ...). Payload wraps it in the default template and `Gutter` is ours to add (`views/Dashboard/index.js`).                                                                                  | Yes, if re-assigned after `payloadTheme()`. The theme README documents this order for `Nav`; the same holds for the dashboard view.                                              |
| Theme `dashboard.widgets`                                              | Components below the theme's cards                                                                                                                                                                                                                                                                 | Yes, but only an append area.                                                                                                                                                    |

**Update, 1 November 2026: the spike below reversed this recommendation. The dashboard now uses the native engine inside our view (see "Spike result").**

**Original recommendation: custom view, re-assigned after the theme.**

- A tiny plugin `src/plugins/admin-dashboard.ts`, placed after `payloadTheme()` and before or inside `roleNav()`, sets `admin.components.views.dashboard.Component` to `/components/admin/dashboard/dashboard-view#DashboardView`.
- `DashboardView` is a server component. For admins it renders the Arc widgets. For everyone else it returns the theme's own `Dashboard` (`import { Dashboard } from 'payload-theme/rsc'`), so fellows and students keep today's cards.
- Each widget is an independent async server component inside `<Suspense>`, so one slow query does not block the page.
- Why not the native widgets API: it is experimental ("subject to change"), saves a per-user layout that drifts from code, and the theme does not style it. The widget files below are shaped like native widgets (server component, plain props), so moving later is a config change.
- Remove the `dashboard.widgets` entry added in question 1 once the view lands; the queue becomes a widget in the new view.

## 3. Arc components inside the admin

**Data.** Server components fetch with the Local API and pass plain arrays to Arc client components.

- Use `payload.count`, `payload.find` with `select` and `pagination: false`, with `overrideAccess: false` and `user` (as the theme does). `src/lib/review-queue.ts` is the pattern; it uses `overrideAccess: true` because the page is admin-only, which is acceptable behind the `isAdminUser` check.
- Payload has no group-by. Bucket `createdAt` in JavaScript (30 or 90 days, `select: { createdAt: true }`), as `payload-theme/dist/components/Dashboard/index.js` does, or use raw Drizzle (`payload.db.drizzle`) for large tables.
- No `cacheComponents` in `next.config.ts`; admin pages are dynamic. Start uncached; add `unstable_cache` per widget only if the page is slow.

**Client boundary.** Every Arc chart is `'use client'` (`src/components/arc/bar-chart/bar-chart.tsx:1`, same for line, donut, sparkline, metric-card, usage-meter, animated-counter). Props must be serializable. Arc props such as `formatValue`, `formatTick` and `onActiveChange` are functions, so a server component cannot pass them. Make a thin `'use client'` wrapper per chart (`widgets/*-client.tsx`) that holds the formatters.

**CSS: this is the main risk.** Arc and the admin define the same custom property names.

| Name                                                                          | Admin (`src/app/(payload)/custom.css`)   | Arc (`src/components/arc/foundation.css`) |
| ----------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| `--background`, `--foreground`, `--border`, `--accent`, `--accent-foreground` | shadcn values on `:root` (lines 17-31)   | Arc values on `:root`                     |
| `--radius*`, `--font-body`, `--text-*`                                        | shadcn `--radius`; Payload `--font-body` | Arc scales                                |

Importing `foundation.css` into the admin layout would repaint every admin control that reads those names. It also contains global `:focus` and `:focus-visible` rules with `!important` (end of the file) that would change focus rings across the admin. Today only `src/app/(frontend)/[locale]/layout.tsx:6` imports it.

Plan:

1. Create `src/components/admin/dashboard/arc-scope.css`: the token blocks of `foundation.css` re-scoped. `:root` becomes `.arc-scope`; `:root[data-theme='dark']` becomes `[data-theme='dark'] .arc-scope`; drop the accent presets and the global focus rules; add a scoped `:focus-visible` rule. Generate it with a small script (`scripts/build-arc-scope.mjs`) so it follows Arc updates.
2. Bind the accent to the theme: `.arc-scope { --accent: var(--pt-accent); --accent-strong: var(--pt-accent-hover); }`. The chart `--series-*` palette derives from `--accent`, so charts follow the admin accent.
3. Wrap the dashboard in `<div className="arc-scope">` and import the CSS in `dashboard-view.tsx` (a CSS import in a server component works in Next; CSS modules of Arc load with their components).
4. Dark mode: Payload sets `data-theme` on `<html>` (the same attribute the admin `custom.css` and Arc use), so the scoped dark block applies with no JavaScript.
5. Fonts: leave Arc's `--font-display` and `--font-body` unset inside the scope so the admin font (Payload or theme font) shows. Set them to `inherit` in the scope.

Check list for implementation: `motion` is installed (`package.json`); light and dark; RTL is not needed in the admin (locale `ar` exists but the admin chrome is LTR); reduced motion is handled inside Arc.

## 4. Widget inventory

Collections (28, `src/collections`): users, people, memberships, media, courses, enrollments, programmes, cycles, governance, articles, publications, press, events, newsletters, mailing-lists, submission-files, notifications, places, spaces, space-posts, space-comments, space-files, space-reactions, space-consents, space-visits, space-preferences, space-votes, space-rsvps. Plugins add `forms`, `form-submissions` (applications), `redirects`. Newsletter subscribers live in Resend, not the database (`src/lib/resend-contacts.ts`, ADR 0005).

**Free Arc statistics and chart components** (from the Arc registry, `tier: free`):

| Component                          | Installed? | Use                          |
| ---------------------------------- | ---------- | ---------------------------- |
| `metric-card`                      | yes        | KPI tile                     |
| `animated-counter`                 | yes        | Count inside custom tiles    |
| `sparkline`                        | yes        | Trend beside a KPI           |
| `bar-chart`                        | yes        | One measure per day or week  |
| `line-chart`                       | yes        | Several series over time     |
| `donut-chart`                      | yes        | Share of a total             |
| `usage-meter`                      | yes        | Segments against a limit     |
| `timeline`                         | yes        | Recent activity feed         |
| `sortable-data-table`              | yes        | Top lists                    |
| `empty-state`, `badge`, `skeleton` | yes        | Empty, status, loading       |
| `gauge`                            | no         | Single value against a range |
| `activity-heatmap`                 | no         | A year of daily activity     |
| `streamgraph`                      | no         | Layered series over time     |
| `brush-chart`                      | no         | Zoomable long series         |
| `waffle-chart`                     | no         | Part of whole in 100 cells   |
| `slope-chart`                      | no         | Two-period comparison        |
| `treemap`                          | no         | Hierarchy by size            |
| `ridgeline`                        | no         | Distributions (not needed)   |

Pro components (`split-bar`, `sunburst`, `sankey-flow`, `funnel-chart`, `radar-chart`, `realtime-stream`, `race-bar-chart`, `metric-ticker`, `presence-stack`, `data-grid`) are licensed. Do not use or rebuild them. Uninstalled free items install with `pnpm dlx shadcn@latest add @uiarc/<id>` (registry `@uiarc` is in `components.json`); do not re-add installed ones.

**Widget table.** First pass uses installed components only.

| #   | Widget                  | Arc component                               | Metric and query                                                                                   | Source                                          |
| --- | ----------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Waiting for review      | existing `ReviewQueueWidget` (plus `badge`) | Articles, courses, publications with `review.status = submitted`; applications with `status = new` | `src/lib/review-queue.ts`                       |
| 2   | Quick actions           | `button`, `button-group`                    | Links: Reviews and applications, Newsletter subscribers, New article, New event, New course, Media | Static links                                    |
| 3   | Open applications       | `metric-card` + `sparkline`                 | Count of `form-submissions` with `status = new`; daily new in 30 days                              | `form-submissions`                              |
| 4   | Applications by outcome | `donut-chart`                               | `form-submissions` grouped by `status` (new, accepted, rejected), last 90 days                     | `form-submissions`                              |
| 5   | Applications per day    | `bar-chart`                                 | Submissions per day, 30 days                                                                       | `form-submissions.createdAt`                    |
| 6   | Newsletter subscribers  | `usage-meter` + `metric-card`               | `accountContactCount` against `FREE_CONTACT_LIMIT` (1000); per list from `mailing-lists`           | Resend; hide if no `RESEND_API_KEY`             |
| 7   | Enrollments by stage    | `donut-chart`                               | `enrollments.status`: applied, accepted, confirmed, completed, withdrawn                           | `enrollments`                                   |
| 8   | Enrollments over time   | `line-chart`                                | Created per week, split by status group                                                            | `enrollments.createdAt`                         |
| 9   | Content pipeline        | `metric-card` x4                            | Draft vs published counts for articles, courses, events, publications (`_status`)                  | Versioned collections                           |
| 10  | Upcoming events         | `sortable-data-table`                       | Next 5 events by `schedule.start_date`                                                             | `events`                                        |
| 11  | Community activity      | `line-chart`                                | New `space-posts`, `space-comments`, `space-reactions` per day, 30 days                            | Spaces collections                              |
| 12  | Active spaces           | `sortable-data-table` + `avatar-group`      | Spaces ranked by posts in 30 days                                                                  | `space-posts`                                   |
| 13  | Accounts by role        | `donut-chart`                               | `users.roles`: super_admin, admin, fellow, member, non_degree_seeking                              | `users`                                         |
| 14  | New accounts            | `sparkline` in `metric-card`                | `users.createdAt`, 30 days                                                                         | `users`                                         |
| 15  | Media storage           | `usage-meter`                               | Sum of `media.filesize` by mime group against a chosen budget                                      | `media` (scan `select: { filesize, mimeType }`) |
| 16  | Recent changes          | `timeline`                                  | Latest document versions or notifications                                                          | `payload.findVersions`, `notifications`         |
| 17  | Visits heatmap (later)  | `activity-heatmap` (install)                | `space-visits.last_visited_at` per day                                                             | `space-visits`                                  |
| 18  | Content health (later)  | `gauge` (install)                           | Share of published pages with SEO title and description                                            | `seoPlugin` meta fields                         |

## 5. Recommended architecture

```
src/plugins/admin-dashboard.ts                 sets views.dashboard.Component (after payloadTheme)
src/components/admin/dashboard/
  dashboard-view.tsx                           server: admin gets the grid, others get theme Dashboard
  arc-scope.css                                generated, scoped Arc tokens
  dashboard.module.css                         grid layout, widget card shell
  widgets/<name>.tsx                           one async server component per widget (table above)
  widgets/<name>-client.tsx                    thin 'use client' wrappers with formatters
  quick-actions.tsx                            links (reuse WorkLinks routes)
src/lib/admin-stats.ts                         Local API queries and bucketing helpers (unit-tested)
scripts/build-arc-scope.mjs                    foundation.css to arc-scope.css
tests/unit/admin-stats.test.ts                 bucketing, status grouping, empty data
```

Edits: `src/payload.config.ts` (add the plugin; drop `dashboard.widgets`), `src/components/admin/work-links.tsx` (keep in top bar), `src/components/admin/subscribers-link.tsx` (keep).

## 6. Risks

- **Token collision** between Arc and the admin (section 3). Mitigation: scoped file; never import `foundation.css` in the admin.
- **Theme upgrade** (0.10.0 changes the dashboard markup and CSS). Mitigation: our view does not use `pt-dash` classes; the non-admin fallback uses the theme export, which stays public (`payload-theme/rsc`).
- **Experimental native widgets API** (section 2): not used.
- **Query cost** on every dashboard load: many counts. Mitigation: `Suspense` per widget, `select` only needed fields, `limit` on scans, `unstable_cache` later.
- **Resend dependency**: widget 6 calls an external API on page load. Mitigation: short timeout, hide on failure, cache 10 minutes.
- **Access**: custom views are not protected by Payload access rules. Keep the `isAdminUser` check in `DashboardView` and use `overrideAccess: false` for anything shown to non-admins.
- **Dev setup**: `next dev` blocks `/_next` assets for `127.0.0.1` (no hydration, disabled controls); use `localhost`. Cookies are shared across `localhost` ports, so other dev servers can swap the logged-in user. Starting dev with `TYPESENSE_API_KEY=` empty skips the search sync and boots much faster.

## 7. Implementation plan (one session)

1. Branch from `main`. Add `scripts/build-arc-scope.mjs`; generate `arc-scope.css`; add the accent binding. (30 min)
2. Write `src/lib/admin-stats.ts` with tests first: day bucketing, status grouping, empty data. (45 min)
3. Add the plugin and `DashboardView` with the grid, the non-admin fallback and a `Suspense` shell; wire the plugin after `payloadTheme()`; remove the `dashboard.widgets` entry. (30 min)
4. Build widgets 1 to 5 and 9 (queue, quick actions, applications, content pipeline). (60 min)
5. Build widgets 6 to 8, 10 to 16, with the Resend fallback. (90 min)
6. Check light and dark, narrow width, a fellow account (theme dashboard) and an empty database. Run `npx tsc --noEmit`, `pnpm lint`, unit tests, `pnpm generate:importmap`. (30 min)
7. Optional follow-up: install `activity-heatmap` and `gauge`; file the `nav.links` request upstream; consider the native widgets API when it leaves experimental.

## 8. Spike result: the native modular dashboard (1 November 2026)

**Question.** Can admins customise the dashboard (drag, resize, add, remove) with Payload's own engine, which is experimental in 3.91?

**Answer. Yes, with one CSS rule. Shipped.** Tested in the preview browser on 3.91.0 with `payload-theme` 0.9.4, as an admin account, against a local database.

| Check                                 | Result                                     | How                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render our widgets through the engine | Works                                      | `admin.dashboard = { widgets, defaultLayout }` in `src/plugins/admin-dashboard.ts`; the view renders `DefaultDashboard` (`@payloadcms/next/views`) inside our `.arc-scope` wrapper. Widgets are server components (`native.tsx`), each behind its own Suspense.                               |
| Style                                 | Works                                      | The engine's grid and controls come from Payload's own CSS (layer `payload-default`); our Arc tokens apply inside `.arc-scope`. The theme does not need to style anything.                                                                                                                    |
| Edit controls reachable               | **Broken by the theme, fixed by one rule** | The engine mounts Edit Dashboard, Add widget and Reset layout in the header breadcrumb (`.app-header__step-nav-wrapper`). `payload-theme` sets that to `display: none` (`theme.css` line 1254). `src/app/(payload)/custom.css` shows it again, only when `.modular-dashboard` is on the page. |
| Resize                                | Works                                      | Size menu on hover, x-small to full; the chart went to full width (1268 px at 1440) at once.                                                                                                                                                                                                  |
| Remove                                | Works                                      | 19 widgets to 18.                                                                                                                                                                                                                                                                             |
| Add                                   | Works                                      | "Add Widget" drawer lists all 19 definitions; adding "Open applications" again gave 20 (duplicates are allowed). The drawer shows Payload's placeholder thumbnails.                                                                                                                           |
| Move                                  | Works with mouse events                    | dnd-kit's `MouseSensor`: Published courses and Upcoming events swapped. Pointer events and the keyboard route did not move anything in the automated run, so keyboard dragging is **not verified**.                                                                                           |
| Save and persist per account          | Works                                      | "Save changes" wrote `payload_preferences` key `dashboard-layout` for the user; after a reload the 18 widgets and the full-width chart were back. "Cancel" discarded unsaved edits.                                                                                                           |
| Reset                                 | Works                                      | "Reset Layout" in the breadcrumb menu restored the 19-widget default.                                                                                                                                                                                                                         |
| Light and dark                        | Works                                      | Same layout and persistence; screenshots in `docs/screenshots/admin-dashboard/`.                                                                                                                                                                                                              |
| 1024 px                               | Works                                      | No horizontal overflow; widgets keep their percentage widths. Payload hides the size button under 768 px.                                                                                                                                                                                     |
| Non-admins                            | Unchanged                                  | `DashboardView` returns the theme's `Dashboard` for anyone who is not an admin.                                                                                                                                                                                                               |

**Caveats.**

- The API is marked experimental: a Payload upgrade can change it. The widgets are plain server components, so the cost of moving back to a fixed view is small.
- Section headings ("Key numbers", "Trends", "Lists") are gone; the engine renders one flat grid. The default layout keeps the same order.
- The widgets keep their server-side cache (`cachedStat`, 60 seconds), so a saved layout does not slow the page.
- Keyboard dragging could not be confirmed in automation. Test it by hand before relying on it for access needs.
