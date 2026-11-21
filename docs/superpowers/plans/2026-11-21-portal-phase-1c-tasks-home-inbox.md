# Portal phase 1c: tasks, Home and Inbox. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every reader one list of the work that waits on them (`needs(user)`), one set of numbers from the same rules (`needsCounts(user)`), counts on the sidebar, an Inbox page (Needs you, then Latest), counts that refresh when work changes, and a Home page that replaces today's `/spaces` page and its shortcuts into `/admin`.

**Architecture:** PR 1c-0 measures today's `/spaces` TTFB on the Mac and writes the number into this plan. PR 1c-1 adds the data core with no screen: `src/portal/needs/` (`needs`, `needsCounts`, one source table), `countReviewQueue` and a shared row read in `src/lib/review-queue.ts`, `countWaitingApplicants` in `src/forms/applicants.ts`, and a prod-clone check script. PR 1c-2 adds the Inbox page, the Inbox nav item, the counts on nav rows, and the live refresh. PR 1c-3 replaces the `/spaces` page with Home. PR 1c-4 moves the two `courseTypeKey` copies that 1b left.

**Tech stack:** Next.js 16.4.6 App Router, React 19.2.6, next-intl 4, Payload 3.91.0 (Postgres), Arc UI (`src/components/arc`), Vitest 4, Playwright 1.58.2, `@axe-core/playwright` (phase 1a PR C).

**Spec:** `docs/superpowers/specs/2026-11-18-portal-design.md`: Phases (Phase 1c), Tasks (`needs(user)` and the bell), Home, Navigation, Architecture (Frame, Routes, Feature folders, Data access rule, Lazy loading rule), Status model (`waitsOn`), Document links, Onboarding (empty states), Tests. The spec wins where they differ, except for the Deviations below.

**Sources read for this plan** (2026-11-21, by reading only; no command ran):

| Source | Ref | SHA |
| --- | --- | --- |
| `main` | `origin/main` | `57248c77` |
| Phase 1b plan (PR #52) | `origin/docs/portal-phase-1b-plan` | `1b3937fe` |
| Phase 1b PR 1b-1 code (no PR open yet) | `origin/portal/phase-1b-status` | `77582cec` |
| Phase 1a PR C (#53) | `origin/portal/phase-1a-shell` | `72d8b22f` |
| ADR 0012 (PR #54, not merged) | `origin/docs/adr-ui-sdk-wrappers` | `bbac10c8` |
| Next.js docs | `/home/salah/cilas/node_modules/next/dist/docs/` (16.4.6) | n/a |

Not built anywhere at these SHAs: PR 1b-2a (`src/portal/lists/*`), PR 1b-2b (the list screens, the Articles and Courses nav items, `courseTypeKey`, L0 ScrollArea, L0b fold trigger). The 1b plan and PR C still move. The section "Premises to re-check when 1b lands" lists every assumption this plan makes about code that is not on `main`.

**Status.** Nothing is built. Every "Expected" line is a prediction.

---

## What each reader sees

- **1c-0:** nothing. A number in this plan.
- **1c-1:** nothing. The admin dashboard's "Reviews waiting" tile reads the same queue as before (the check script proves it).
- **1c-2:** an Inbox item in the sidebar and the bottom bar, with a count. An Inbox page. Counts on Articles and Courses for fellows and students (when 1b-2b has landed). Counts change with no reload when work changes.
- **1c-3:** Home in place of today's `/spaces` page. The shortcut list into `/admin` is gone. Admins reach `/admin` from **Open dashboard**.
- **1c-4:** nothing (a refactor of two public pages).

## PRs

| PR | Branch | Base | Tasks | Screen | Ends when |
| --- | --- | --- | --- | --- | --- |
| 1c-0. TTFB baseline | `portal/phase-1c-ttfb` | `main` | T1 to T3 | none | `scripts/ttfb-probe.mjs` runs on the Mac, and the baseline table below holds numbers |
| 1c-1. Needs core | `portal/phase-1c-needs` | `main` after 1b-1 merges. Until then `portal/phase-1b-status`, and the PR targets `main` once 1b-1 is in | N1 to N7 | none | `needs` int tests, the needs-vs-queue check on the prod clone |
| 1c-2. Inbox, counts, live refresh | `portal/phase-1c-inbox` | `portal/phase-1a-shell` (PR C) with 1c-1 merged in; rebased on `main` once PR C and 1c-1 merge | I1 to I7 | yes | `portal-home` (Inbox describe), the 1c assertions in `portal-shell`, `work-refresh.dom.test.tsx` |
| 1c-3. Home | `portal/phase-1c-home` | `portal/phase-1c-inbox`; rebased on `main` once 1c-2 merges | H1 to H6 | yes | `portal-home` (Home describe), Home TTFB gate |
| 1c-4. `courseTypeKey` callers | `portal/phase-1c-course-type` | `main` after 1b-2b merges | K1 | none | the two pages' existing tests |

**Dependency graph.**

```
main ──┬── 1c-0 (independent; must finish before H5)
       ├── 1b-1 ── 1c-1 ──┐
       ├── PR C ──────────┴── 1c-2 ── 1c-3
       └── 1b-2b ── 1c-4 (independent of the rest)
1b-2b ┄┄ 1c-2 (soft: counts on Articles and Courses; see Order with 1b-2b)
```

- 1c-0 and 1c-1 are independent of each other and of PR C. 1c-0 must finish before H5 (the Home gate reads its number).
- 1c-1 needs 1b-1 only (`waitsOn`, `KEY_WHERE`, `statusInputOf`, `documentHref`, `mayAuthor`, `mayTeach`). It needs nothing of PR C, 1b-2a or 1b-2b.
- 1c-2 needs PR C (the shell, `portalNav`, `NAV_BY_ROLE`, `PortalEmptyState`) and 1c-1.
- 1c-3 needs 1c-2 (the Needs you list and the Latest list it renders) and the 1c-0 number.
- 1c-4 needs only 1b-2b (`courseTypeKey`).

**Landing order:** 1c-0, 1c-1, then 1c-2, then 1c-3. 1c-4 lands any time after 1b-2b. Phase 1b's merge order is not changed by this plan. 1c-2 and 1c-3 change an interaction, so they wait for the operator's review before merge (playbook rule).

**Files each PR may touch.** A builder who needs a file outside its list stops and reports.

- **1c-0:** `scripts/ttfb-probe.mjs`, `scripts/ttfb-accounts.ts` (new), this plan file (the baseline table only).
- **1c-1:** `src/portal/needs/*` (new), `src/lib/review-queue.ts`, `src/lib/review-queue.int.test.ts` (new), `src/lib/review-candidates.ts` and its int test (new), `src/forms/applicants.ts`, `src/forms/applicants.int.test.ts` (extend, or new if absent), `testing/needs.fixture.ts` (new), `scripts/needs-check.ts` (new). If 1b-2a has landed: `src/portal/lists/rows.ts` (N2, migrate its candidate step).
- **1c-2:** `src/portal/needs/` (view parts: `need-list.tsx`, `latest-list.tsx`, `work-refresh.tsx`, their tests, CSS module), `src/portal/inbox/` (new), `src/app/(frontend)/[locale]/(portal)/spaces/inbox/page.tsx` (new), `src/app/(frontend)/[locale]/(portal)/spaces/layout.tsx`, `src/portal/nav/{portal-nav.ts,portal-nav.unit.test.ts,nav-icons.ts,rows.tsx,portal-shell.tsx,shell.module.css,sidebar.browser.test.tsx,more-sheet.tsx}`, `messages/{en,ar}.json` (`Portal.nav`, `Portal.needs`, `Portal.inbox`, `Portal.latest`), `testing/portal-e2e.test-utils.ts`, `testing/portal.fixture.ts` (only `needsWorld`, see I1), `e2e/portal-shell.e2e.test.ts`, `e2e/portal-home.e2e.test.ts`, `e2e/portal-home.empty.e2e.test.ts` (new).
- **1c-3:** `src/portal/home/*` (new), `src/lib/reader-courses.ts` and its int test (new), `src/app/(frontend)/[locale]/(portal)/spaces/(home)/page.tsx`, `(home)/loading.tsx`, `messages/{en,ar}.json` (`Portal.home`; delete `SpaceShortcuts` and the `Spaces` keys only the old page used), `src/components/space/space.module.css` (delete the shortcut rules), `e2e/portal-home.e2e.test.ts`, `e2e/portal-home.empty.e2e.test.ts`, `e2e/portal-spaces-off.e2e.test.ts` (`:188`), `e2e/portal-shell.e2e.test.ts` (`:500`).
- **1c-4:** `src/components/bridge/bridge-year.tsx`, `src/components/article/article-page.tsx`.

### Order with 1b-2b

1b-2b and 1c-2 both change `src/portal/nav/portal-nav.ts`, `rows.tsx`, `sidebar.tsx`, `shell.module.css`, `NAV_BY_ROLE` and `messages/*.json`. Two orders are possible. Each has a rule.

- **1b-2b first (preferred).** 1c-2 rebases on it. I3 adds the `articles` and `courses` rows to `COUNT_OF` (I3) and renders the count chip in the row that 1b-2b leaves (with L0's `ScrollArea` and L0b's `FoldProvider`).
- **1c-2 first.** 1c-2 ships the Inbox count only. `COUNT_OF` has no `articles` or `courses` row. 1b-2b then adds those two rows in its L1 commit and gives its two items their counts. Send this as a request to the 1b-2b builder (see "Requests to phase 1b"). The 1b plan's Deviation 11 ("Nav counts are `null` in 1b") then ends inside 1b-2b.

## Premises to re-check when 1b lands

Each premise names the file and symbol, the SHA read, who uses it, the exact check, and the fallback. The builder of the named PR runs the check on its base (`HEAD` below) before the first task that uses it. A check that fails: stop, write what differs in the PR, and use the fallback.

- **P1. 1b-1 status exports.** `src/lib/review-status.ts` exports `StatusKey`, `STATUS_KEYS`, `waitsOn`, `statusOf`, `statusInputOf`, `KEY_SELECT`, `NOT_LIVE`, `LIVE_COPY`, `KEY_WHERE` (`77582cec`). Used by 1c-1.
  - Check: `git grep -cE "^export (const|type) (StatusKey|STATUS_KEYS|waitsOn|statusOf|statusInputOf|KEY_SELECT|NOT_LIVE|LIVE_COPY|KEY_WHERE)\b" HEAD -- src/lib/review-status.ts` prints `HEAD:src/lib/review-status.ts:9`.
  - Fallback: none. 1c-1 cannot start without 1b-1.
- **P2. `KEY_WHERE` rows.** A row `{ on, where }` for each key whose `waitsOn` is not null: `submitted`, `changes_requested` (`on: 'main'`), `published_edits`, `published_removal`, `published_edits_returned` (`on: 'version'`) (`77582cec`, `review-status.ts:191-218`). Used by 1c-1.
  - Check: `git grep -n "every key that waits on someone has a KEY_WHERE row" HEAD -- src/lib/review-status.unit.test.ts` finds one test, and `pnpm exec vitest run --project node src/lib/review-status.unit.test.ts` passes (Mac).
  - Fallback: none. A waiting key with no row cannot be counted with no field compare.
- **P3. Keys-only rows.** `statusOf(statusInputOf({ collection, main, latest, read: 'keys' }))` does not throw for the five waiting keys, because none needs a field compare (`77582cec`; 1b plan S2 Step 3, "a copy at `submitted` with `read: 'keys'` reads `published_edits`"). Used by 1c-1 N2.
  - Check: `git grep -n "read: 'keys'" HEAD -- src/lib/review-status.unit.test.ts` finds that case.
  - Fallback: `keyRows` reads `statusSelect(collection)` rows with `read: 'full'`. Slower, same keys.
- **P4. `documentHref`.** `documentHref({ collection, id, viewer, waiting, locale })` returns `/admin/collections/{collection}/{id}` (`77582cec`, `src/lib/document-href.ts`). Used by 1c-1.
  - Check: `git grep -n "export const documentHref" HEAD -- src/lib/document-href.ts`.
  - Fallback: none.
- **P5. Access helpers.** `mayAuthor` and `mayTeach` in `src/access.ts` (`77582cec`, `:174`, `:243`). `ownsViaAuthors`, `ownsViaFellows`, `isAdminUser`, `adminViewOf`, `personOf` are on `main` (`57248c77`, `src/access.ts:49-124`). Used by 1c-1.
  - Check: `git grep -cE "export const (mayAuthor|mayTeach|ownsViaAuthors|ownsViaFellows)\b" HEAD -- src/access.ts` prints `HEAD:src/access.ts:4`.
  - Fallback: none.
- **P6. Reviewed collections.** `ReviewedCollection` and `REVIEWED_FIELDS` in `src/lib/reviewed-fields.ts` (`77582cec`); `REVIEWED` in `src/lib/reviewed-collections.ts` lists articles, courses and publications (`57248c77`). Used by 1c-1.
  - Check: `git grep -n "export type ReviewedCollection" HEAD -- src/lib/reviewed-fields.ts`.
  - Fallback: none.
- **P7. 1b-2a not built.** `src/portal/lists/rows.ts` does not exist (1b plan at `1b3937fe`; no `portal/phase-1b-list-data` branch on 2026-11-21). Used by 1c-1 N2.
  - Check: `git ls-tree HEAD src/portal/lists/rows.ts` prints nothing.
  - Fallback: it exists. N2 moves its candidate step onto `candidateIds` in the same PR.
- **P8. `portalNav` shape.** `portalNav(user)` takes one argument and returns `PortalNavItem[]` with `key: 'home' | 'openDashboard'`, `count: number | null`, `external`, `group`; `PortalNavIcon` is `'home' | 'dashboard' | 'profile'` (`72d8b22f`, `src/portal/nav/portal-nav.ts`). Used by 1c-2 I2.
  - Check: `git grep -nE "export const portalNav = \(user|key: 'home' \| 'openDashboard'" HEAD -- src/portal/nav/portal-nav.ts` prints 2 lines.
  - Fallback: 1b-2b changed it. Read its shape, keep its keys, add `inbox` the same way.
- **P9. Nav rows have no count.** `NavItemRow` (`src/portal/nav/rows.tsx:18-53`) renders no count and sets `data-portal-item` and `data-group` (`72d8b22f`). Used by 1c-2 I3.
  - Check: `git grep -n "data-group" HEAD -- src/portal/nav/rows.tsx` finds it, and `git grep -n "item.count" HEAD -- src/portal/nav/` finds nothing.
  - Fallback: a count already renders (1b-2b). Reuse it and add only the accessible name rule.
- **P10. `unreadCount`.** `SpaceRow` calls `unreadCount(unread, locale, …)` from `@/lib/unread-count` for the shown and spoken count (`72d8b22f`, `rows.tsx:10`, `:68-105`). Used by 1c-2 I3, 1c-3 H2.
  - Check: `git grep -n "export" HEAD -- src/lib/unread-count.ts` shows `unreadCount`.
  - Fallback: write the 9+ rule once in `src/portal/nav/count.ts` and say so.
- **P11. Shared e2e helpers.** `NAV_BY_ROLE`, `navHref`, `ROUTE_SHAPES`, `LIST_SHAPES`, `shapeOf`, `axeOver`, `PHONE`, `openMore` in `testing/portal-e2e.test-utils.ts` (`72d8b22f`, commit `a2133962`). Used by 1c-2, 1c-3.
  - Check: `git grep -cE "^export const (NAV_BY_ROLE|navHref|ROUTE_SHAPES|LIST_SHAPES|shapeOf|axeOver|PHONE|openMore)\b" HEAD -- testing/portal-e2e.test-utils.ts` prints `…:8`.
  - Fallback: move what is missing from `e2e/portal-shell.e2e.test.ts` in a commit of its own.
- **P12. External empty-state action.** `PortalEmptyState` takes `action: { label; href; external? }` (`72d8b22f`, commit `5e2ae9b5`). Used by 1c-2, 1c-3.
  - Check: `git grep -n "external?: boolean" HEAD -- src/portal/feedback/empty-state.tsx`.
  - Fallback: add it in I4, with its dom test.
- **P13. Shell call.** `PortalShell({ nav, spaces, folded, accountId, children })`, and `(portal)/spaces/layout.tsx` calls `portalNav(user)` and `mySpaces` (`72d8b22f`). 1b-2b L0b adds `FoldProvider`. Used by 1c-2 I2.
  - Check: `git grep -n "nav={portalNav(user)}" HEAD -- "src/app/(frontend)/[locale]/(portal)/spaces/layout.tsx"`, and `git grep -ln FoldProvider HEAD -- src/portal/nav` (present or not, say which).
  - Fallback: 1b-2b changed the call. Add the counts argument to the call it left.
- **P14. Old page and its tests.** `(home)/page.tsx` holds `shortcutsFor`, reads `spacesOff(payload)` (`src/lib/spaces.ts:70`) and the `SpaceShortcuts` messages; `e2e/portal-spaces-off.e2e.test.ts:188` and `e2e/portal-shell.e2e.test.ts:500` select `section[aria-labelledby="spaces-shortcuts"]` (`72d8b22f`). Used by 1c-3.
  - Check: `git grep -n "spaces-shortcuts" HEAD -- e2e src` prints the page and the two e2e lines.
  - Fallback: retarget whatever selects the shortcuts section.
- **P15. List nav items.** The Articles and Courses nav items have keys `articles` and `courses` (1b plan L1 at `1b3937fe`; not built). Used by 1c-2 I2, 1c-3 H2.
  - Check: `git grep -nE "key: '(articles|courses)'" HEAD -- src/portal/nav/portal-nav.ts`.
  - Fallback: not there. 1c-2 ships the Inbox count only (Order with 1b-2b), and the fellow's next-session empty tile has no button.
- **P16. `courseTypeKey`.** In `src/fields/course-type.ts` (1b plan L4 and P16; not built). Used by 1c-4.
  - Check: `git grep -n "export const courseTypeKey" HEAD -- src/fields/course-type.ts`.
  - Fallback: not there. 1c-4 waits.
- **P17. `verify.sh` modes and lock.** Usage `[--e2e-only] [--no-tests] [--tests-only] [--int-only] [--keep] <branch> <sha> [specs|-g pat]` (1b plan Global Constraints, read 2026-11-21). No TTFB mode and no production-build mode. Used by 1c-0, H5, every **[verify]** step.
  - Check (Mac): `~/cilas-verify/verify.sh --help`, and `grep -nE "flock|lock" ~/cilas-verify/verify.sh` for the lock to hold during T2, T3 and H5.
  - Fallback: it has a mode that serves a production build. Use it in T2 and say so.
- **P18. Empty database runs.** `verify.sh` can run one e2e spec on `cilas_empty` (`--db empty`, the 1b plan's "Runner need (L6)"). Used by I6, H4.
  - Check (Mac): `grep -n -- "--db" ~/cilas-verify/verify.sh`.
  - Fallback: add `--db empty` as the 1b plan says, before I6.
- **P19. One notification stream.** `subscribeNotifications(listener)` keeps a set of listeners on one `EventSource` (`57248c77`, `src/lib/realtime/stream-client.ts:88-100`). Used by I5.
  - Check: `git grep -n "listeners.add(listener)" HEAD -- src/lib/realtime/stream-client.ts`.
  - Fallback: none. Stop: a second subscriber must not open a second stream.
- **P20. `catchError`.** `catchError` from `next/error` gives a per-card error boundary with `retry()` (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/catchError.md`, Next 16.4.6). Used by I4, H2.
  - Check (Mac worktree): `ls node_modules/next/dist/docs/01-app/03-api-reference/04-functions/catchError.md`, and `grep -rn "catchError" node_modules/next/error.d.ts node_modules/next/dist/api/error.d.ts`.
  - Fallback: a client error boundary whose **Retry** calls `router.refresh()`.
- **P21. ADR 0012.** Not merged (`bbac10c8`). No 1c task imports `@ui-sdk/*` or adds to `src/components/sdk/`, so its state changes nothing.
  - Check: `git ls-tree origin/main docs/adr/0012-ui-sdk-wrappers.md`.
  - Fallback: none needed.

## Global Constraints

**Run location (from the 1b plan, still in force).** Read the 1b plan's Global Constraints, "Run location". Builders work on the user's Mac, each in its own git worktree. Light commands (oxlint, `pnpm exec tsgo --noEmit`, one unit or dom test file, `pnpm audit:access`) run in the Mac worktree. Heavy jobs (int tests, browser tests, Playwright, `next build`, a server, the full suite) run only through `~/cilas-verify/verify.sh` (**[verify]**). The Mac is shared with the 1b builders: queue through `verify.sh`'s lock (P17), never start a second server beside it, never touch the user's stash or another agent's processes. Nothing in this plan runs on the Linux server, except reading and `git`.

**From the 1b plan, still in force** (read these sections there; they are not copied): "New in 1b", the items **Access rules**, **One role table**, **Owner lists filter by owner**, **Which row is which**, **Latest versions** (keep the newest `updatedAt` per parent), **Data access** (every read names `depth`, `select`, `pagination: false` or a `limit`), **Int test setup** (`mockNetwork(resendInbox().handler, ...localServices)`; read by your own ids, never by table counts), **English**, **Arabic digits**. From the phase 1a plan (by section name): Spec values; Code and tests (Libraries first, Tests, Matrix, Describes, Locators, `spaces_mode`, Copy, Components, Lazy UI); Commits and PRs; Deviation 19 (matrix exemptions) as a pattern; "No streaming boundary above the check".

**New in 1c.**

- **No schema change.** The spec's Migrations table lists nothing for 1c. `needs` derives from documents. No task runs `payload migrate:create`. A task that finds it needs a field stops and reports. (Had one been needed: generate it on the branch, rename the SQL by hand, apply it only on a throwaway copy that the seed guard accepts, never `cilas_dev`, and list it in the ledger under "For the morning".)
- **Projection reads.** `countReviewQueue` and the review rows read with `overrideAccess: true` (as `getReviewQueue` does, `src/lib/review-queue.ts:31`). Every portal caller checks `isAdminUser(user)` first and returns zero rows for any other reader. `countWaitingApplicants` reads `form-submissions` with `overrideAccess: true` inside `src/forms/applicants.ts`, the one projection (spec, Data access rule). Every other read is gated (`user`, `overrideAccess: false`).
- **Version reads count parents, not rows.** Two versions saved in one millisecond can both be `latest` (1b plan, Latest versions). So no count uses `payload.countVersions`. A version count reads `findVersions` with `select: { parent: true }`, `depth: 0`, `pagination: false`, and counts distinct parent ids.
- **Links to work and posts are plain `<a>`.** Every `needs()` href in 1c is an `/admin` URL (`documentHref` gives the admin URL until phase 2; `/admin/applicants` before phase 3). `localePrefix` is `'always'` (`src/i18n/routing.ts:11`), so next-intl `Link` would make `/admin/...` into `/en/admin/...`. Latest rows link to posts and other site pages, and a soft navigation from outside `(rooms)` to a post shows the dialog over an empty page (operator rule, 2026-11-21). So Needs you rows and Latest rows render `<a href>`. A stored notification link is locale-free; it gets the reader's locale as the bell does (spec, Document links).
- **One request, one read.** `needs(user)` and `needsCounts(user)` are wrapped in React `cache` (spec, Tasks, Data). The layout calls only `needsCounts`. Home and Inbox call `needs`. No `unstable_cache`, no `cacheTag`: the spec asks for the cost before any cache (N7).
- **UI parts order** (ADR 0012, operator rule): the Arc component in `src/components/arc` (never re-run `shadcn add` for an installed one), then the free Arc registry, then a ui-sdk wrapper in `src/components/sdk/`, then Radix already used, then our own code. No 1c part needs ui-sdk. Inner scroll regions use Arc `ScrollArea` (`src/components/arc/scroll-area`). Home and Inbox scroll with the document, so they add no inner scroller.
- **Lazy loading.** Home and Inbox are first-render content and render on the server. No 1c UI shows only after an action, so no `preloadable` is new. The work-refresh listener is a small client part in the shell and loads eagerly.
- **Copy** goes in `messages/{en,ar}.json` under `Portal`, ICU plurals, digits through `{count, number, digits}`, gender-neutral Arabic (D8). The strings are the spec's (Onboarding, Home, Tasks), except where a Deviation gives the 1c string.

**Per-PR order** (the 1b plan's, unchanged). 1. Tasks, each with its targeted tests. 2. Reviews (each PR's last task). 3. Fixes with tests. 4. **[verify]** the full suite once (`verify.sh <branch> <sha>`); a failure the base also has is one line in the PR. 5. `pnpm exec tsgo --noEmit`, `pnpm audit:access`, and `git status --short scripts/access-audit.snapshot.json` prints nothing (no 1c task changes an access rule). 6. Open the PR per `worker.md`, title `type(scope): subject (portal phase 1c, PR <n>)`.

**Verification boxes (playbook).** Each PR section ends with three boxes: **unit** (the named tests), **live** (a scenario on the real surface, run on the Mac, with a pass predicate), **perf** (metric, probe, trunk baseline measured first, the failing number). A PR is verified only when all three are checked.

## Check open source first

The user's rule: before a new tool or module, compare existing tools. Verdicts:

| Module | Candidates | Verdict | Evidence |
| --- | --- | --- | --- |
| TTFB probe (T1) | k6 (grafana/k6, AGPL-3.0, very active, Go binary, `http_req_waiting` is TTFB, `p(75)` built in); autocannon (mcollina/autocannon, MIT, active, Node); hey (rakyll/hey, Apache-2.0, last release 2020); `curl -w '%{time_starttransfer}'` (installed on macOS) in a 40-line Node script | build the script on curl | k6 measures the right thing, but it needs `brew install` on a shared Mac and a JS DSL for 35 sequential requests per role. autocannon reports latency to the full response under concurrency, not TTFB, and concurrency adds queueing to the number (Explain the Number). hey is not maintained. curl's `time_starttransfer` is TTFB per request, with no install. The script adds only the cookie, the warm-up and the percentile |
| Percentile | `simple-statistics` (MIT, not installed); 3 lines (nearest rank) | build | Nearest rank on 30 sorted samples is one index; a dependency for it does not earn its place |
| Debounce for the live refresh (I5) | `lodash.debounce` (not a dependency); `use-debounce` (MIT, not installed); a `setTimeout` in the effect | build | One timer, cleared on unmount, 6 lines. The cleanup must also cancel on unmount, which a hook library does too, but adds a dependency for one call site |
| Applicant count (N4) | Payload `count` (installed); one SQL `GROUP BY` through `payload.db.pool` (as `claimDigest`, `src/lib/space-digest.ts:170`); a `find` with `select: { choices: … }` and a reduce | adopt Payload `find` + reduce | `payload.count` counts submissions, not choices (spec). The `select` read stays inside Payload's typed API and the access projection. SQL is the fallback if N7 measures the read above 100 ms p75 on the prod clone |
| Card error boundary (H2) | Next `catchError` (`next/error`, installed, with `retry()`); `react-error-boundary` (MIT, not installed) | adopt `catchError` | Built in, and it clears on navigation and lets `notFound()` and `redirect()` through (P20) |
| Count chip and its spoken text | `unreadCount` (`src/lib/unread-count.ts`, PR C) | adopt | The space rows already use it for "9+" and "more than 9" (P10) |
| Cards, badges, skeletons | Arc `card`, `badge`, `skeleton`, `avatar` (installed) | adopt | Installed. Never added again |
| Empty states | `PortalEmptyState` (PR C) | adopt | Phase 1a Deviation 10 rejected Arc's `empty-state` |
| Checklist | Arc `onboarding-checklist` (installed) | not in 1c | The checklist is phase 6 (M2) |

## Deviations from the spec

The operator may veto any line.

1. **Test paths.** Spec names `needs` and `portal-home`. The repo puts tests beside their subject. Map: `needs` is `src/portal/needs/needs.int.test.ts`, `src/portal/needs/sources.unit.test.ts`, `src/lib/review-queue.int.test.ts`, `src/forms/applicants.int.test.ts` (the count cases), `src/portal/needs/work-refresh.dom.test.tsx`, and the live-refresh test in `e2e/portal-home.e2e.test.ts`. `portal-home` is `e2e/portal-home.e2e.test.ts` and `e2e/portal-home.empty.e2e.test.ts`.
2. **The Inbox nav item ships with the Inbox page, in 1c-2.** The spec's own rule says so ("A nav item ... ships in the phase that ships that page"), and `portal-shell` expects 200 for every `NAV_BY_ROLE` href. Not a change to the spec; recorded because the brief sketched them apart.
3. **`countWaitingApplicants` returns `{ total }` only.** Spec: `{ total, byCourse }`. `byCourse` has no reader until phase 3 (the "View list" link on course rows and the board chips). Phase 3 adds it with its first reader (Surplus rule in `AGENTS.md`).
4. **No To review or Applicants count in 1c.** The spec's sidebar counts for those items ship with the items (phases 2 and 3). In 1c `countReviewQueue` and `countWaitingApplicants` feed only the admin's Inbox total and the Home card.
5. **The `applicants` row's href is `/admin/applicants`** until phase 3 (spec table). An admin with no waiting choice gets no row.
6. **Live refresh: which events refresh.** Spec: a notification of kind `submitted`, `approved`, `changes_requested`, `rejected`, `removed`, `application` or `withdrawn`. Plan: (a) only `created` events refresh; `updated` (a read mark) and `deleted` events change no work. (b) `withdrawn` is not a kind until M3 (phase 2); `WORK_KINDS` is typed against `NotificationKind`, so phase 2 adds it in the same PR as M3, as a type error would force. (c) An event whose `doc` is absent (too big for one database message, `site-notifications.tsx:133`) refreshes, because its kind is unknown. (d) The stream's `sync` (a reconnect after a gap) refreshes once, because events in the gap are lost. All four go through the one 1 s debounce.
7. **Space unread counts stay as phase 1a Deviation 15 left them.** 1a Deviation 15 says "Phase 1c brings live counts". The spec's 1c scope brings live *work* counts only: the refresh fires on work kinds, and a new post creates no notification of those kinds. A work refresh reruns the layout, so the space counts are fresh after it, but nothing refreshes on a new post. Answer: no live space unread counts in 1c. Open question Q4.
8. **Greeting.** Spec: "Greeting with the first name. While the checklist shows: ...". 1c has no checklist (phase 6), so the greeting is one line: "Hello, {name}." with the first word of the linked person's name in the page locale. An account with no person (only admins) gets "Hello." with no name. Open question Q1.
9. **Next session source.** Spec: "`nextMeeting` from `src/lib/meetings.ts` over the reader's courses", and 1d ships "the gated read of the reader's own sessions". 1c needs a source now. Plan: `readerCourseIds(payload, user)` in `src/lib/reader-courses.ts`: the courses whose `fellows` hold the reader's person (gated `find`) and the courses of the reader's `accepted` enrollments (gated `find` of `enrollments`, `person` equals the reader's person). Then one gated `find` of `sessions` for those courses and `nextMeeting` over their meetings. Phase 1d reuses `readerCourseIds` for the calendar (one rule, one place). An admin with neither gets "No sessions yet" and no button (spec, until 1d).
10. **Next session link with spaces off.** Spec: "a link to the space". With spaces off no space page loads. Plan: the link goes to the public course page (`/{locale}/study/{slug}`). Open question Q2.
11. **Inbox Latest paging is a link.** Spec: "the 30 newest notification rows ... with **Show more**". Plan: as 1b Deviation 7, **Show more** is a link, `?latest=2` loads 60 rows, with a `focus` parameter that moves focus to the first new row and calls `announce()`. Cap: 10 pages (300 rows); past the cap a line says "Only the newest 300 show." A click on a Latest row marks it read, as the bell does (`site-notifications.tsx:168`). Open question Q3.
12. **Home "Latest" and Inbox "Latest" rows are server-rendered.** The bell stays the live list. Home and Inbox Latest change on a work refresh (Deviation 6) or a load, not on every notification. Open question Q4 covers the same choice for space counts.
13. **Admin rows' `owner`.** Spec: `owner: { id, name }`. The queue reads owner names, not one owner id: an article can have several authors. Plan: `owners: string[]` (names, joined in the view as `getReviewQueue` does today, `review-queue.ts:19-22`), empty on the reader's own rows.

## Ends when

The spec's Phase 1c line, by clause.

1. Task 1 measures today's `/spaces` TTFB at p75 per role on the prod clone and writes the number in the plan: T1 to T3 (the baseline table below).
2. `needs` passes: N3 to N6 (int and unit), I5 (`work-refresh.dom.test.tsx`), I6 (the live-refresh e2e).
3. `portal-home` passes: I6 (Inbox), H4 (Home), each with its empty-seed spec.
4. The total of `needs(admin)` matches the admin queue on the prod clone: N6 (`scripts/needs-check.ts`, pass predicate there).
5. Home TTFB at p75 per role is no slower than the task 1 number, and under 800 ms when that number is under 800 ms: H5.

Scope check, from the spec's Phase 1c Scope line: `needs()` on `waitsOn` (N3, N5); `needsCounts()` (N5); `countWaitingApplicants` (N4); `countReviewQueue` (N2); the sidebar counts (I3); the Inbox nav item (I2); live refresh (I5); Home without the checklist (H1 to H3); Inbox (I4); Home replaces today's `/spaces` page and its shortcuts into `/admin` (H3).

## TTFB baseline (filled by PR 1c-0)

T3 writes the numbers here, in a commit to this file on the 1c-0 branch. Raw samples go in a PR comment, linked from the PR body.

| Role (account id) | Ref and SHA | `/en/spaces` TTFB p50 | p75 | p95 | Full response p75 | Samples | Date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| admin (_id_) | `main` _sha_ | | | | | 30 | |
| fellow (_id_) | `main` _sha_ | | | | | 30 | |
| student (_id_) | `main` _sha_ | | | | | 30 | |
| admin, fellow, student | PR C head _sha_ (context only) | | | | | 30 each | |

**The gate number is the `main` row of each role.** That is "today's `/spaces`" as the spec says. If PR C has merged when T2 runs, `main` holds the shell, and the PR C row is not needed. If PR C has not merged, the PR C row shows what the shell alone adds; it does not gate.

**What the number covers.** `(home)/loading.tsx` streams the page under the layout, so the first byte waits for the root layout and `(portal)/spaces/layout.tsx` (`currentReader`, `mySpaces`, and from 1c-2 `needsCounts`), not for the page's cards. So TTFB measures the layout. The full-response time (`time_total`, the whole streamed HTML) shows the cards. Both are recorded. Only TTFB gates (spec). A full-response p75 above 2x its baseline is written in the PR as a finding for the operator.

---

## PR 1c-0. TTFB baseline (`portal/phase-1c-ttfb`)

From `main`. No app code. Runs on the Mac only. Reviews: code-review of the two scripts.

### Task T1: The probe script

**Skills:** tdd (the percentile function).

**Files:** Create `scripts/ttfb-probe.mjs`.

**Interfaces:**

- Produces: `node scripts/ttfb-probe.mjs --base http://localhost:<port> --path /en/spaces --cookies <file> --warmup 5 --samples 30` where `<file>` is JSON `{ "<role>": "<payload-token cookie value>" }`. For each role, in order: 5 warm-up requests (not recorded), then 30 sequential requests (concurrency 1), each `curl -s -o /dev/null -w '%{http_code} %{time_starttransfer} %{time_total}' -H 'Cookie: payload-token=…'` through `node:child_process` `execFileSync`. A status other than 200 exits 1 with the role and status (a redirect to login means the cookie failed). Prints one JSON line per role: `{ role, samples: [[ttfb, total], …], p50, p75, p95, totalP75 }` in milliseconds, rounded to 1 ms.
- `p(sorted, q)` is nearest rank: `sorted[Math.ceil(q * sorted.length) - 1]`. With 30 samples, p75 is the 23rd value.

- [ ] **Step 1:** In the script, a self-check under `--self-test`: `p([1..30], 0.75)` is `23`, `p([5], 0.75)` is `5`. Run `node scripts/ttfb-probe.mjs --self-test`: FAIL (no code), then PASS. Commit.

### Task T2: Accounts and the production build on a throwaway copy

**Skills:** payload.

**Files:** Create `scripts/ttfb-accounts.ts`.

**Interfaces:**

- Produces: `pnpm exec tsx scripts/ttfb-accounts.ts` refuses to run unless `DATABASE_URL` names `cilas_ttfb` (exit 1, "ttfb-accounts runs only on the throwaway copy cilas_ttfb"). It picks three accounts by a fixed rule and prints their ids only (no email):
  - admin: the account with an admin role and the smallest id (every admin reads the same queue);
  - fellow: the fellow account whose person is in the most courses' `fellows` (ties: smallest id);
  - student: the `member` account whose person has the most `accepted` enrollments (ties: smallest id).
  It sets one random password on the three (`payload.update`, `overrideAccess: true`, on the copy only), logs each in with `payload.login`, and writes `{ admin, fellow, student }` cookie values to a file in the scratchpad. A sign-in through the real login keeps the session rules of the app (Payload sessions are on by default).

- [ ] **Step 1: The copy.** On the Mac, inside `verify.sh`'s lock (P17): `createdb -T cilas_dev cilas_ttfb` (a template copy; nothing writes `cilas_dev`). Check the copy's name passes no seed guard by accident: `ttfb-accounts.ts` has its own name check, and no seed runs.
- [ ] **Step 2: Accounts.** `DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_ttfb pnpm exec tsx scripts/ttfb-accounts.ts --out <scratch>/ttfb-cookies.json`. Expected: three ids printed; the file holds three non-empty values.
- [ ] **Step 3: Production build.** In a fresh Mac worktree at the ref under test: `next build`, then `pnpm start` on a free local port, with the Mac worktree's env and `DATABASE_URL` pointed at `cilas_ttfb`. Never `next dev`: dev compiles on request, so its TTFB measures the compiler. If `verify.sh` has a mode that serves a production build (P17), use it. Commit the script.

### Task T3: Measure and write the number

**Skills:** none beyond the above (benchmark-checklist from pstack applies to the number).

- [ ] **Step 1:** `node scripts/ttfb-probe.mjs --base http://localhost:<port> --path /en/spaces --cookies <scratch>/ttfb-cookies.json --warmup 5 --samples 30` on `main`. If PR C has not merged, build PR C's head and run again (the "context only" row). Nothing else heavy runs on the Mac during a run: check that `verify.sh`'s lock is held by this run only.
- [ ] **Step 2: Explain the number.** For each role, a p95 above 3x its p50 means noise or a cold path: rerun once and record both runs. Write in the PR what bounds the number (inferred from the layout's reads: `currentReader`, `mySpaces`).
- [ ] **Step 3:** Fill the baseline table. Keep `cilas_ttfb` for H5 (same data, same accounts); drop it after H5 (`dropdb cilas_ttfb`). Commit the table. Open `chore(portal): TTFB probe and the /spaces baseline (portal phase 1c, PR 0)`.

**Verification.**

- [ ] unit: `--self-test` passes.
- [ ] live: three roles each give 30 samples with status 200 against a production build on `cilas_ttfb`. Pass predicate: the table has a p75 for each role, and the PR comment holds the raw samples.
- [ ] perf: this PR is the baseline. Its number is the trunk baseline for H5.

---

## PR 1c-1. Needs core (`portal/phase-1c-needs`)

From `portal/phase-1b-status` while 1b-1 is open (P1 to P6). No screen, no message key. Reviews: code-review, then security-review.

### Task N1: The source table and the row shape

**Skills:** tdd, design-an-interface (only if the builder finds a second real shape for `NeedSource`).

**Files:** Create `src/portal/needs/sources.ts`, `src/portal/needs/sources.unit.test.ts`.

**Interfaces:**

- Consumes: `StatusKey`, `STATUS_KEYS`, `waitsOn`, `KEY_WHERE` (P1, P2); `ReviewedCollection` (P6); `isAdminUser`, `mayAuthor`, `mayTeach` (P5).
- Produces:
  - `type NeedKind = 'review' | 'edit_review' | 'removal_review' | 'applicants' | 'changes_requested'` (spec).
  - `type NeedRow = { kind: NeedKind; verbKey: \`needs.${string}\`; href: string; label: string | null; count: number; owners: string[]; collection: ReviewedCollection | null }` (Deviation 13; `label` null when no locale has a title, the view then writes "Untitled article" or "Untitled course"; `collection` null on the `applicants` row).
  - `type NeedSource = 'reviewQueue' | 'applicants' | 'ownArticles' | 'ownCourses'`.
  - `SOURCES_OF(user): NeedSource[]`: admin `['reviewQueue', 'applicants']`; else `ownArticles` when `mayAuthor(user)`, plus `ownCourses` when `mayTeach(user)`. One table. A reader with no role gets `[]`.
  - `KIND_OF_KEY: Partial<Record<StatusKey, NeedKind>>`: `submitted` `review`, `published_edits` `edit_review`, `published_removal` `removal_review`, `changes_requested` and `published_edits_returned` `changes_requested`.
  - `waitingKeys(side: 'owner' | 'admin'): StatusKey[]`: `STATUS_KEYS.filter((k) => waitsOn(k) === side)`. No key list is written by hand.
  - `VERB_OF: Record<NeedKind, \`needs.${string}\`>`: `needs.review`, `needs.editReview`, `needs.removalReview`, `needs.applicants`, `needs.changesRequested` (spec verbs).
- [ ] **Step 1: Failing tests** (`pnpm exec vitest run --project node src/portal/needs/sources.unit.test.ts`): "SOURCES_OF($role) is $sources" (admin, fellow with person, student with person, member with no person, no role); "every waiting key has a need kind" (each key in `waitingKeys('owner')` and `waitingKeys('admin')` has `KIND_OF_KEY`, and each has a `KEY_WHERE` row); "no key that waits on nobody has a need kind". Run: FAIL.
- [ ] **Step 2: Implement.** Run: PASS. Commit.

### Task N2: Candidates, the review rows and `countReviewQueue`

**Skills:** tdd, payload.

**Files:** Create `src/lib/review-candidates.ts`, `src/lib/review-candidates.int.test.ts`, `src/lib/review-queue.int.test.ts`, `testing/needs.fixture.ts`. Modify `src/lib/review-queue.ts`. If P7 fails: modify `src/portal/lists/rows.ts`.

**Interfaces:**

- Consumes: `KEY_WHERE`, `KEY_SELECT`, `statusInputOf`, `statusOf`, `waitsOn` (P1 to P3); `REVIEWED` (`src/lib/reviewed-collections.ts`); `relId` (`src/lib/relation.ts`).
- Produces (`src/lib/review-candidates.ts`, server only, no portal import):
  - `candidateIds(payload, { collection, keys, base, user, overrideAccess }): Promise<number[]>`. For each key in `keys`, its `KEY_WHERE` row. Main rows: one `find` with `and: [base, { or: [main rows' where] }]`, `select: { id: true }`, `depth: 0`, `pagination: false`. Version rows: one `findVersions` with `or` of the version rows' where, `select: { parent: true }`, `depth: 0`, `pagination: false`, distinct parents; then one `find` with `and: [base, { id: { in: parents } }]`, `select: { id: true }` (a parent outside `base` drops out, 1b plan, Owner lists filter by owner). Returns the union, sorted. `base` is `{}` on the admin path. Gated (`user`, `overrideAccess: false`) on owner paths; `overrideAccess: true` only on the admin path, which the caller guards.
  - `keyRows(payload, { collection, ids, user, overrideAccess }): Promise<Array<{ id; key: StatusKey; main; latest }>>`: for `ids`, the main rows (`select: { ...KEY_SELECT, [owners]: true }`, `depth: 0`, `locale: 'all'`) and the latest versions (`select: { parent: true, version: KEY_SELECT }`, newest `updatedAt` per parent), then `statusOf(statusInputOf({ …, read: 'keys' }))` (P3). Owner names come from one `find` of `people` (`id in` the owner ids, `select: { name: true }`, `depth: 0`, `locale` the reader's), so no populate.
- Produces (`src/lib/review-queue.ts`):
  - `adminReviewRows(payload): Promise<Array<{ collection; kind: QueueKind; id; key: StatusKey; title: { en: string | null; ar: string | null }; owners: string[]; since: string }>>`: for each `REVIEWED` collection, `candidateIds` with `keys: waitingKeys('admin')`, `base: {}`, `overrideAccess: true`, then `keyRows`, kept where `waitsOn(key) === 'admin'`. `since` is the latest version's `updatedAt` (the submit write), else the main row's. Oldest first.
  - `getReviewQueue(payload)` maps `adminReviewRows` to today's `QueueItem` (same fields; `removal` is `key === 'published_removal'`; `title` in English first, as today reads `title` with no locale). Its callers (`src/components/admin/review-queue.tsx`, `src/components/admin/dashboard/quick-actions.tsx`) do not change.
  - `countReviewQueue(payload): Promise<number>`: `candidateIds` per collection with the admin keys, summed. No `keyRows`: every candidate of an admin key waits on the admin by construction (`KEY_WHERE` rows are exact for these keys, P2). N6 proves the total equals `adminReviewRows(...).length` on the prod clone.
- Produces (`testing/needs.fixture.ts`): `needsWorld(payload, track, world)`, rows written with no `user` and `overrideAccess: true` and the `draft` flag of the real move (as the 1b fixture, 1b plan L3 Step 1): per collection one document of each waiting key (`submitted` never published, `published_edits`, `published_removal`, `changes_requested`, `published_edits_returned`), one `rejected`, one `published_edits_declined`, one `published` with an equal copy, owned by `world.accounts.student` (articles) and `world.accounts.fellow` (courses); one never-published article whose latest version is `submitted`; one publication at `submitted`. Two applicants: one course application with two course choices (one decision `null`, one `pending`), one programme application, and one course choice `accepted`. Returns every id.

- [ ] **Step 1: Failing int tests** **[verify]** (`src/lib/review-queue.int.test.ts`, Int test setup):
  - "adminReviewRows holds one row per waiting document": the ids equal the fixture's `submitted`, `published_edits`, `published_removal` documents of all three collections, and the never-published `submitted` article once.
  - "getReviewQueue keeps its shape": each item has `kind`, `id`, `title`, `removal`, `by`, `since`, `href` as today; `removal` is true only for `published_removal`.
  - "the candidates of the admin keys are the waiting rows": per collection, `candidateIds` with the admin keys and `base: { id: { in: fixtureIds } }` gives exactly the fixture's waiting ids, the same set that `adminReviewRows` holds for those ids. `countReviewQueue` is the sum of the same `candidateIds` calls with `base: {}`, so this test pins its rule. The database is shared, so no test compares whole-table counts (1b plan, Int test setup); N6 compares the totals on the prod clone.
  - Run: FAIL (functions missing).
- [ ] **Step 2: Implement** `candidateIds`, `keyRows`, `adminReviewRows`, `countReviewQueue`, and move `getReviewQueue` onto `adminReviewRows`. Delete the old two queries and `namesOf`. If P7 failed (1b-2a landed), move its main and copy candidate reads onto `candidateIds` in one commit, and its tests must still pass. Run **[verify]**: PASS; `src/lib/publishing.int.test.ts` and any test of `src/components/admin/review-queue.tsx` still pass. Commit.
- [ ] **Step 3: Owner path int test** **[verify]** (`src/lib/review-candidates.int.test.ts`): "an owner's candidates are their own waiting rows only" (student: the fixture's two owner-waiting articles; another member: none; a co-author removed in the copy: no `published_edits_returned` candidate for them, 1b U4). PASS. Commit.

### Task N3: The owner sources

**Skills:** tdd, payload.

**Files:** Create `src/portal/needs/owner-rows.ts`. Modify `src/portal/needs/needs.int.test.ts` (new in this task).

**Interfaces:**

- Consumes: `candidateIds`, `keyRows` (N2); `ownsViaAuthors`, `ownsViaFellows`, `personOf` (P5); `documentHref` (P4); `waitingKeys`, `KIND_OF_KEY`, `VERB_OF` (N1).
- Produces: `ownRows(payload, user, collection: 'articles' | 'courses', locale): Promise<NeedRow[]>`. No person: `[]` with no query. Else `candidateIds` with `keys: waitingKeys('owner')`, `base: ownsVia…(user)`, gated, then `keyRows`, then one row each: `kind` from `KIND_OF_KEY`, `href: documentHref({ collection, id, viewer: 'owner', waiting: false, locale })`, `label`: the latest version's title in `locale`, else the other locale, else null (1b Deviation 8), `count: 1`, `owners: []`. `ownCount(payload, user, collection): Promise<number>`: `candidateIds(...).length`, no `keyRows`.
- [ ] **Step 1: Failing int tests** **[verify]**: "a student's needs hold their changes_requested and returned-edits articles"; "a declined article is not in needs(owner)" (spec); "declined edits and a kept removal are not in needs(owner)"; "a member with no person has no rows and runs no query" (synthetic user, as `src/lib/publishing.int.test.ts:402`); "a publication with changes requested is not in needs(owner)" (spec, D16). FAIL, implement, PASS. Commit.

### Task N4: `countWaitingApplicants`

**Skills:** tdd, payload.

**Files:** Modify `src/forms/applicants.ts`, `src/forms/applicants.int.test.ts` (add a describe; create the file if absent).

**Interfaces:**

- Consumes: `applicantViewer` (`src/forms/applicants.ts:12`).
- Produces: `countWaitingApplicants(payload, user): Promise<{ total: number }>` (Deviation 3). `applicantViewer(user)` null gives `{ total: 0 }` with no query. The course ids come from the same read rule as `applicantsFor` (`:39-52`): every course for an admin, `fellows contains person` for a fellow, `select: { id: true }`, `depth: 0`, `pagination: false`, `overrideAccess: true`. Move that rule into one local function `viewerCourses(payload, viewer, select)` that both `applicantsFor` and the count call, so the board and the count cannot drift. Then one `find` of `form-submissions` (`'choices.course' in ids`, `select: { choices: { course: true, decision: true } }`, `depth: 0`, `pagination: false`, `overrideAccess: true`) and a reduce: one per choice whose course is in `ids` and whose `decision` is null or `pending`. A programme application counts 0 (spec).
- [ ] **Step 1: Failing int tests** **[verify]** (spec, Tasks, Tests): "counts 2 for one applicant with two waiting course choices"; "counts 0 for a programme application"; "counts a null decision as waiting"; "an accepted choice does not count"; "a fellow counts only the courses they teach"; "a student counts 0 and runs no query". FAIL, implement, PASS; the existing `applicants` int spec still passes. Commit.

### Task N5: `needs(user)` and `needsCounts(user)`

**Skills:** tdd.

**Files:** Create `src/portal/needs/needs.ts`. Modify `src/portal/needs/needs.int.test.ts`.

**Interfaces:**

- Consumes: N1 to N4; `cache` (`react`).
- Produces:
  - `type NeedsResult = { rows: NeedRow[]; failed: NeedSource[] }`.
  - `needs = cache(async (user: User, locale: Locale): Promise<NeedsResult>)`. Each source of `SOURCES_OF(user)` runs in `Promise.allSettled`. `reviewQueue`: `isAdminUser(user)` checked again here (a projection, spec Data access rule), then `adminReviewRows` mapped to rows (`href` from `documentHref({ collection, id, viewer: 'admin', waiting: true, locale })`, `owners` the names). `applicants`: one row when `total > 0`: `{ kind: 'applicants', verbKey: 'needs.applicants', href: '/admin/applicants', label: null, count: total, owners: [], collection: null }` (Deviation 5). A rejected source logs the error with the source name and lands in `failed` (spec, Errors). Rows sort: the admin's review rows oldest first, then the applicants row; an owner's rows by the latest version's `updatedAt`, oldest first.
  - `type NeedsCounts = { total: number | null; by: Partial<Record<NeedSource, number | null>> }`.
  - `needsCounts = cache(async (user: User): Promise<NeedsCounts>)`: the same sources through their count functions (`countReviewQueue`, `countWaitingApplicants(...).total`, `ownCount`). A failed source is `null` in `by`, and then `total` is `null` (spec: "the count then shows no number, not a wrong one").
  - `needsTotal(result: NeedsResult): number | null`: the sum of `count`, or null when `failed` is not empty. Home and the Inbox page read it, so the Home count and the sidebar number agree by the same rule.
- [ ] **Step 1: Failing int tests** **[verify]** (spec, Tasks, Tests, on `needsWorld`, compared by the fixture's ids where the shared DB holds other rows):
  - "the total of needs(admin) equals the review queue plus the pending course choices, and the rows equal the queue plus 1" (spec). `needs`, `getReviewQueue` and `countWaitingApplicants` run in one `Promise.all`, so a write by another test file between the reads is unlikely. A failure prints the ids that differ, so a race shows as an id from another file's fixture.
  - "needsCounts(user) equals the total of needs(user) for each role" (admin, fellow, student).
  - "a source that fails leaves the others" (pass a `payload` whose `count` on `form-submissions` throws through a thin proxy object in the test; no mock library): `failed` is `['applicants']`, the review rows remain, `needsTotal` is null, `needsCounts(...).total` is null.
  - FAIL, implement, PASS. Commit.

### Task N6: The prod-clone check

**Skills:** payload.

**Files:** Create `scripts/needs-check.ts`.

**Interfaces:**

- Produces: `pnpm exec tsx scripts/needs-check.ts` (Mac, read only, against the local prod clone `cilas_dev`; it writes nothing and refuses a `DATABASE_URL` that is not `@localhost:5433/`). It computes:
  1. `oracleQueue`: a frozen copy of trunk's `getReviewQueue` algorithm (`src/lib/review-queue.ts` at `57248c77`, lines 30-56: per collection the main `find` with `review.status: submitted` and the `findVersions` with `latest` and `version.review.status: submitted`, joined by id), written inline in the script with that SHA in a comment. It does not import `src/lib/review-queue.ts`.
  2. `oracleChoices`: from `applicantsFor(payload, { kind: 'admin' }, 'en')`, the number of choices whose `decision` is `pending`.
  3. `needs(admin)` for the admin of T2's rule (smallest admin id): `needsTotal` and the row ids per collection.
  It prints the three numbers and two id lists: in the oracle and not in `needs`, in `needs` and not in the oracle. It exits 1 on any difference.
- **Pass predicate:** `needsTotal(needs(admin)) === oracleQueue.length + oracleChoices`, and both id lists are empty. A difference is not fixed by changing the check: each id goes in the PR with its `statusOf` key, and the builder decides with the reviewer whether trunk's queue or `waitsOn` is right (for example a live document whose main row says `submitted`; the old queue lists it, `KEY_WHERE.submitted` needs `NOT_LIVE`).
- Note: the admin dashboard tile "Applications waiting" counts submissions with status `new`, programmes included (`src/components/admin/dashboard/widgets/applications.tsx`). It is not the oracle: the spec counts pending course choices. The PR writes both numbers so the operator sees why they differ.

- [ ] **Step 1:** Run on the Mac against `cilas_dev`. Pass predicate above. Paste the output in a PR comment. Commit the script.

### Task N7: Cost per role, review, full suite, open PR 1c-1

**Skills:** code-review, then security-review.

- [ ] **Step 1: Cost before any cache** (spec, Tasks, Tests). In `scripts/needs-check.ts --cost`: for the three accounts of T2's rule (on `cilas_dev`, read only, through `payload.findByID` of the user, no sign-in), call each source's row and count function 20 times after 3 warm-up calls, and print p50 and p75 per role and source in ms. Write the table in the PR.
- [ ] **Step 2: code-review** against the base, with the spec's Tasks section as the issue.
- [ ] **Step 3: security-review.** Write in the PR: `adminReviewRows` and `countReviewQueue` read with `overrideAccess: true` and every caller checks `isAdminUser` first (`needs`, `needsCounts`, the admin pages that call `getReviewQueue` today); owner reads are gated and add the ownership `where`; `countWaitingApplicants` reads `form-submissions` only inside `src/forms/applicants.ts` and returns a number only; no new endpoint; `rg -l "@/portal/" src/lib src/components src/forms src/i18n` prints nothing.
- [ ] **Step 4:** Fix. **[verify]** the full suite. Per-PR step 5. Open `feat(portal): needs(user), needsCounts(user) and the shared review rows (portal phase 1c, PR 1)`. Blast Radius: the admin review queue page and the dashboard tile read the new `adminReviewRows`; N6 shows they list the same ids on the prod clone.

**Verification.**

- [ ] unit: `sources.unit.test.ts`; int: `review-queue.int.test.ts`, `review-candidates.int.test.ts`, `needs.int.test.ts`, the `applicants` count cases.
- [ ] live: N6 on the prod clone. Pass predicate: equal totals and empty id lists. Also open `/admin` as the admin on the Mac dev server and see that the "Reviews waiting" tile equals `oracleQueue.length`.
- [ ] perf: metric p75 ms per source and role (N7 Step 1). Trunk baseline first: the same script times the oracle queue (trunk `getReviewQueue`) on the same run. Fails when `adminReviewRows` p75 is more than 1.5x the oracle's p75, or any count function's p75 is above 150 ms.

---

## PR 1c-2. Inbox, counts and live refresh (`portal/phase-1c-inbox`)

From `portal/phase-1a-shell` (PR C) with 1c-1 merged in (P8 to P13). Read "Order with 1b-2b" first. Reviews: ux-auditor and better-interface on the Inbox page and the sidebar counts, then break-ui; code-review, then security-review.

### Task I1: Fixture for the portal e2e

**Skills:** tdd.

**Files:** Modify `testing/portal.fixture.ts` (add `needsWorld` to `PortalWorld` through a new export only; existing exports do not change), `testing/portal-e2e.test-utils.ts` (add `/spaces/inbox` to a shape table; add `inbox` to `NAV_BY_ROLE` for every role, in nav order, after `home`).

**Interfaces:**

- Consumes: `needsWorld` (N2), `portalWorld` (PR C).
- Produces: `portalNeedsWorld(payload, track)`: `portalWorld` plus `needsWorld` owned by its accounts, so the e2e admin sees a known review set on top of whatever `cilas_dev` holds. The e2e therefore asserts "the Home count equals the sidebar number" and the rows of the fixture's ids, never a fixed total.
- [ ] **Step 1:** `testing/portal.fixture.int.test.ts` gains "portalNeedsWorld gives the student two owner rows" **[verify]**. FAIL, write, PASS. Commit.

### Task I2: The Inbox nav item and the counts argument

**Skills:** tdd, modern-web-guidance (first), arc.

**Files:** Modify `src/portal/nav/portal-nav.ts`, `portal-nav.unit.test.ts`, `nav-icons.ts`, `src/app/(frontend)/[locale]/(portal)/spaces/layout.tsx`, `messages/{en,ar}.json` (`Portal.nav.inbox`).

**Interfaces:**

- Consumes: `needsCounts`, `NeedsCounts` (N5).
- Produces: `PortalNavItem.key` adds `'inbox'`; `PortalNavIcon` adds `'inbox'` (lucide `Inbox`). `portalNav(user, counts: NeedsCounts | null)`. One table, `COUNT_OF: Partial<Record<PortalNavItem['key'], (c: NeedsCounts) => number | null>>`: `inbox` gives `c.total`; when P15 holds, `articles` gives `c.by.ownArticles ?? null` and `courses` gives `c.by.ownCourses ?? null` for owners (admin: none, spec). Order: Home, Inbox, then the rest as before. The layout calls `needsCounts(user)` beside `mySpaces` in its `Promise.all`; a throw gives `null` and a log line (spec, Navigation, Errors: the nav renders with no counts).
- [ ] **Step 1: Failing tests** (`pnpm exec vitest run --project node src/portal/nav/portal-nav.unit.test.ts`): "Inbox is the second top item for $role"; "Inbox's count is the total"; "counts null gives no number on any item"; with P15, "an admin's Articles and Courses show no count". FAIL, implement, PASS. Commit.

### Task I3: Count chips on nav rows

**Skills:** modern-web-guidance (first), arc, better-accessibility, better-typography, tdd.

**Files:** Modify `src/portal/nav/rows.tsx`, `shell.module.css`, `sidebar.browser.test.tsx`, `more-sheet.tsx` (the More sheet's rows), `messages/{en,ar}.json` (`Portal.nav.count`).

**Interfaces:**

- Consumes: `unreadCount` (P10).
- Produces: `NavItemRow` renders `item.count` when it is a number above 0: a muted chip (`tabular-nums`, `dir="ltr"`, `aria-hidden`), and visually hidden text so the link's name is "Inbox, 3 tasks" (`Portal.nav.count`, ICU plural, `{count, number, digits}`; "9+" reads "more than 9", the rule `SpaceRow` uses). Folded, the chip shows beside the icon and the hidden name is the same (spec, Frame). A count of 0 shows nothing. The bottom bar and the More sheet render the same row, so the phone gets the same name. Colours: the existing muted tokens (`--text-muted` on the L0 tint, 4.5:1 in phase 1a B1's table); no new token.
- [ ] **Step 1: Failing browser test** **[verify]** (`sidebar.browser.test.tsx`): "a nav item with 3 tasks is named Inbox, 3 tasks, folded and unfolded"; "12 shows 9+ and reads more than 9"; "0 shows no chip"; "Arabic digits in the chip and the name" (`ar`). FAIL, implement, PASS. Commit.

### Task I4: Needs you list, Latest list and the Inbox page

**Skills:** modern-web-guidance (first), arc, better-layout, better-typography, better-accessibility, better-writing then humanizer, tdd.

**Files:** Create `src/portal/needs/need-list.tsx`, `src/portal/needs/latest-list.tsx`, `src/portal/needs/latest.ts`, `src/portal/needs/needs.module.css`, `src/portal/needs/need-list.dom.test.tsx`, `src/portal/inbox/inbox-page.tsx`, `src/app/(frontend)/[locale]/(portal)/spaces/inbox/page.tsx`. Modify `messages/{en,ar}.json` (`Portal.needs`, `Portal.latest`, `Portal.inbox`).

**Interfaces:**

- Consumes: `needs`, `needsTotal`, `NeedRow` (N5); `PortalEmptyState` (P12); `announce` (PR C); `catchError` (P20); `noteText` and the kind glyphs of `src/components/site-notifications.tsx` (export them if they are module-local, so Latest and the bell say the same words).
- Produces:
  - `NeedList({ rows, group }: { rows: NeedRow[]; group: boolean })` (server). Each row is one `<a href>` (Global Constraints, links): the verb (`t(row.verbKey, { count })`), the label in `<bdi dir="auto">` (or "Untitled article" / "Untitled course"), the owner names on admin rows. `group` true (Home with more than 5 rows) collapses rows to one per kind with the sum of `count` and the kind's verb with the number; a grouped `review`, `edit_review` or `removal_review` row links to `/admin/reviews`, a grouped `changes_requested` row to `/{locale}/spaces/articles?show=needsYou` when the group holds an article and to `/{locale}/spaces/courses?show=needsYou` otherwise (1b list filter), `applicants` stays its own row (spec, Tasks, "Where the two lists show"). The list is a `<ul>` under an `<h2>` with the count.
  - `latestRows(payload, user, { limit, locale })` in `latest.ts`: gated `find` of `notifications` (`recipient` equals `user.id`, `sort: '-createdAt'`, `limit`, `depth: 0`, `select` the fields the bell reads, `read_at` included). `LatestList({ rows, more })`: each row a plain `<a>` to the stored link with the reader's locale added (as the bell); an unread dot with hidden text "Unread"; a click marks it read through the bell's existing save action (a small client island, `MarkRead`, eager: it is part of first-render rows).
  - `/spaces/inbox`: all roles (spec, Routes). `<h1>` "Inbox". Section Needs you (`NeedList`, `group: false`), then section Latest (30 rows, Deviation 11, **Show more** link `?latest=n&focus=latest`). Empty texts (spec, Onboarding): "Nothing needs you now." and "Nothing new yet. Replies, reviews and decisions show here." A failed source shows "Some tasks could not load. Reload." above the rows of the others (spec, Errors). Each section sits in a `catchError` boundary: "This could not load." with **Retry**.
- [ ] **Step 1: Failing dom tests**: "a row is one link named by its verb and label"; "an admin row names the owners"; "grouped rows sum count per kind and keep applicants apart"; "a grouped changes_requested row with an article links to the Articles list"; "an untitled row says Untitled article". FAIL, implement, PASS. Commit.
- [ ] **Step 2: Show more focus.** As 1b L5's `NewRowsFocus` (read it on the base; reuse it if 1b-2b landed, else write the same small part here and say so): focus the first new row, `announce("{n} more rows.")`, take `focus` out of the URL. Dom test "Show more moves focus to the first new row". Commit.

### Task I5: Live refresh

**Skills:** modern-web-guidance (first), tdd.

**Files:** Create `src/portal/needs/work-refresh.tsx`, `src/portal/needs/work-refresh.dom.test.tsx`. Modify `src/portal/nav/portal-shell.tsx` (mount it once).

**Interfaces:**

- Consumes: `subscribeNotifications` (P19); `NotificationKind` (`src/lib/notification-kinds.ts`); `useRouter` (`next/navigation`).
- Produces: `WORK_KINDS: ReadonlySet<NotificationKind>` = `submitted`, `approved`, `changes_requested`, `rejected`, `removed`, `application` (Deviation 6b). `refreshes(event: ClientNotificationEvent): boolean`: `event.op === 'created'` and (`!event.doc` or `WORK_KINDS.has(event.doc.kind)`). `WorkRefresh()` (client, renders `null`): subscribes once; an event where `refreshes` is true, or a `sync`, starts or restarts a 1 s timer; the timer calls `router.refresh()`. Unmount clears the timer and unsubscribes. `router.refresh()` keeps client state (`use-router.md:46`).
- [ ] **Step 1: Failing dom tests** (fake timers are a test tool, not a sleep): "a submitted event refreshes once after 1 s"; "three events in 1 s refresh once"; "an updated or deleted event does not refresh"; "a comment event does not refresh"; "an event with no doc refreshes"; "a sync refreshes"; "unmount cancels a pending refresh". FAIL, implement, PASS. Commit.

### Task I6: `portal-home` e2e, Inbox describe

**Skills:** tdd, better-accessibility.

**Files:** Create `e2e/portal-home.e2e.test.ts`, `e2e/portal-home.empty.e2e.test.ts`. Modify `e2e/portal-shell.e2e.test.ts` (the 1c nav assertions read `NAV_BY_ROLE`).

- [ ] **Step 1: Tests** (matrix: role, locale, width; Deviation 19 exemptions as 1a), `describe('inbox')`:
  - "Inbox shows Needs you, then Latest" (the fixture's rows for the role, in order; each row link's `href` starts with `/admin/`; Latest holds the fixture's notification).
  - "the sidebar Inbox number equals the Needs you count on Inbox" (at 1440 the sidebar, at 390 the bottom bar item's name).
  - "Show more loads 30 more and moves focus" (a fixture with 35 notifications for the student).
  - "a Latest row opens its link and marks it read" (plain navigation; the bell's unread count drops by 1).
  - "an owner submits in a second session and the admin's Inbox number changes with no reload" (spec): admin on `/spaces/inbox`; a second browser context, the student, submits an article through the REST write `/admin` sends (`submit-for-review.tsx:62-67`); within 5 s the admin's Inbox name reads one more; `page.evaluate(() => performance.getEntriesByType('navigation').length)` is still 1 (no reload).
  - axe: `axeOver` with the shell's known table gives `{}` on `/spaces/inbox`.
  - `portal-home.empty.e2e.test.ts` on `cilas_empty` (P18), each role: no console error, one `h1`, "Nothing needs you now.", the Latest empty text.
- [ ] **Step 2: Run** **[verify]** (`verify.sh --e2e-only <branch> <sha> e2e/portal-home.e2e.test.ts e2e/portal-shell.e2e.test.ts`, then the empty spec with `--db empty`). Expected: all pass. Commit.

### Task I7: Reviews, full suite, open PR 1c-2

**Skills:** ux-auditor, better-interface (full), then break-ui; code-review, then security-review.

- [ ] **Step 1:** ux-auditor and better-interface on `/spaces/inbox` and the sidebar counts, at 1440 and 390, English and Arabic.
- [ ] **Step 2:** break-ui: a 120-character Arabic title with no space, an English title on an Arabic page, 0, 1, 9, 10 and 120 tasks, a reader with no person, a failed source, 300 notifications.
- [ ] **Step 3:** code-review, then security-review (the layout now runs `needsCounts` on every portal page; the admin check before every projection read; no new endpoint; `MarkRead` uses the existing save path and its access).
- [ ] **Step 4:** Fix. **[verify]** the full suite. Open `feat(portal): Inbox, nav counts and live refresh (portal phase 1c, PR 2)`. Operator review before merge.

**Verification.**

- [ ] unit: `portal-nav.unit.test.ts`, `need-list.dom.test.tsx`, `work-refresh.dom.test.tsx`, `sidebar.browser.test.tsx`.
- [ ] live: on the Mac, with agent-browser headless: the second-session submit scenario of I6. Pass predicate: the admin's Inbox name changes by +1 within 5 s and the navigation entry count stays 1.
- [ ] perf: metric TTFB p75 per role of `/en/spaces/articles` (a portal page that is not Home; the layout now adds `needsCounts`). Probe: `scripts/ttfb-probe.mjs` on `cilas_ttfb`, production build. Trunk baseline first: the same page on this PR's base, same session. Fails when the branch p75 is more than 1.25x the base p75 for any role, or above 800 ms when the base is under 800 ms. If 1b-2b has not landed (no Articles page), measure `/en/spaces/inbox` against `/en/spaces` on the base.

---

## PR 1c-3. Home (`portal/phase-1c-home`)

From `portal/phase-1c-inbox`. Reviews: ux-auditor and better-interface on Home, then break-ui; code-review, then security-review.

### Task H1: `readerCourseIds` and the next session

**Skills:** tdd, payload.

**Files:** Create `src/lib/reader-courses.ts`, `src/lib/reader-courses.int.test.ts`, `src/portal/home/next-session.ts`.

**Interfaces:**

- Consumes: `personOf` (P5); `meetingsOf`, `nextMeeting` (`src/lib/meetings.ts:59, 124`); `cairoDay` (`src/lib/cairo-day.ts`).
- Produces: `readerCourseIds(payload, user): Promise<number[]>` (Deviation 9): gated `find` of `courses` (`fellows contains person`, `select: { id: true }`, `depth: 0`, `pagination: false`) and gated `find` of `enrollments` (`person equals person`, `status equals accepted`, `select: { course: true }`, `depth: 0`, `pagination: false`), the union. No person: `[]`. `nextSession(payload, user, locale): Promise<{ course: { id; slug; title; cover: string | null }; session: { title; date; start_time } ; href: string } | null>`: one gated `find` of `sessions` for those ids (`select: { course: true, title: true, meetings: true, cancelled: true }`), `nextMeeting` from `cairoDay(new Date())`, then the course row (gated, `select` title, slug, cover). `href` is the course space when spaces are on and the reader can read it, else `/{locale}/study/{slug}` (Deviation 10).
- [ ] **Step 1: Failing int tests** **[verify]**: "a student's courses are their accepted enrollments"; "a fellow's courses are the ones they teach"; "a pending enrollment gives no course"; "nextSession skips a cancelled meeting and a past one"; "no course gives null". FAIL, implement, PASS. Commit.

### Task H2: Home cards

**Skills:** modern-web-guidance (first), arc, better-layout, better-typography, better-colors (the cover overlay), better-accessibility, better-writing then humanizer, tdd.

**Files:** Create `src/portal/home/{greeting.tsx,needs-card.tsx,next-session-card.tsx,spaces-card.tsx,latest-card.tsx,card-boundary.tsx,home.module.css,home-cards.dom.test.tsx}`. Modify `messages/{en,ar}.json` (`Portal.home`).

**Interfaces:**

- Consumes: `needs`, `needsTotal` (N5); `NeedList`, `LatestList`, `latestRows` (I4); `nextSession` (H1); `mySpaces`, `COMMUNITY_COVER` (`src/lib/spaces-data.ts`); `spacesOff` (P14); `spaceLabel` (PR C); `unreadCount` (P10); `PortalEmptyState` (P12); `catchError` (P20); Arc `badge`, `card`, `skeleton`.
- Produces, top to bottom (spec, Home; no checklist):
  1. `Greeting` (`<h1>`, Deviation 8).
  2. `NeedsCard`: `<h2>` "Needs you" with the total (`needsTotal`; no number when null); `NeedList` with `group: rows.length > 5`; empty: "Nothing needs you now." with no button; a failed source: "Some tasks could not load. Reload."
  3. `NextSessionCard`: the course cover under a dark overlay (text 4.5:1 on the overlay in both themes, checked with the phase 1a contrast table), the session title, the time in Cairo (`Intl.DateTimeFormat`, `timeZone: 'Africa/Cairo'`, the reader's locale and digits), the link. None: "No sessions yet" and one action: student **Browse spaces** (`/{locale}/spaces/community`; with spaces off **See open courses**, the public courses page), fellow **Open your courses** (`/{locale}/spaces/courses` when P15 holds, else no button), admin no button (until 1d).
  4. `SpacesCard`: hidden when spaces are off (spec). One tile per space on fixed 232px tracks (`grid-template-columns: repeat(auto-fill, 232px)`), the red unread count from `unreadCount`. Tiles link with `next/link` (space pages, not posts). Student with no space: **See open courses** (spec, Onboarding).
  5. `LatestCard`: 5 rows (`latestRows` with `limit: 5`), a link "Open Inbox"; empty: "Nothing new yet. Replies, reviews and decisions show here."
  Each card is an async server component inside `<Suspense>` with an Arc `Skeleton` fallback and a `CardBoundary` (`catchError`): "This could not load." with **Retry** (spec, Errors). Counts use `tabular-nums`.
- [ ] **Step 1: Failing dom tests** (cards rendered with data props through a thin view split: each card has an async loader and a pure view; the test renders the view): "Needs you groups at 6 rows"; "the card count is the total"; "a null total shows no number"; "the next session shows Cairo time in Arabic digits"; "no session gives the role's action"; "spaces off hides Your spaces". FAIL, implement, PASS. Commit.

### Task H3: Replace the `/spaces` page

**Skills:** modern-web-guidance (first), tdd.

**Files:** Modify `src/app/(frontend)/[locale]/(portal)/spaces/(home)/page.tsx` (rewrite), `(home)/loading.tsx`, `messages/{en,ar}.json` (delete `SpaceShortcuts`; delete `Spaces` keys only the old page used, found with `rg`), `src/components/space/space.module.css` (delete `.shortcuts`, `.shortcut*` and other rules only the old page used, found with `rg`).

**Interfaces:**

- Produces: the page composes the five cards in `src/portal/home/` and nothing else (spec, Feature folders). `shortcutsFor`, the `SpaceShortcuts` namespace and the shortcut CSS go. The 1b carry-over "call `adminCreateHref` in `shortcutsFor`" disappears with `shortcutsFor` (spec, Navigation: "The `/spaces` shortcuts into `/admin` are removed in phase 1c"). The spaces-off read (`spacesOff`) stays only to hide Your spaces and pick the next-session link; the page no longer branches on it otherwise (spec, Frame: "Phase 1c deletes the page with that read"). `loading.tsx` renders the greeting row and card skeletons, so the first paint has the page's frame.
- [ ] **Step 1:** `rg -n "SpaceShortcuts|spaces-shortcuts|shortcutsFor" src messages e2e` prints only the two e2e lines (P14) before H4. Commit.

### Task H4: `portal-home` e2e, Home describe, and the retargeted 1a tests

**Skills:** tdd, better-accessibility.

**Files:** Modify `e2e/portal-home.e2e.test.ts`, `e2e/portal-home.empty.e2e.test.ts`, `e2e/portal-spaces-off.e2e.test.ts` (`:188`), `e2e/portal-shell.e2e.test.ts` (`:500`).

- [ ] **Step 1: Tests**, `describe('home')`, matrix as I6, plus 320px for the shell rule (1a Deviation 16):
  - "Home shows the greeting, Needs you, the next session, the spaces and Latest" (per role, the fixture's rows).
  - "the Home count equals the sidebar Inbox number" (spec).
  - "a Needs you row and a Latest row are plain links" (`a[href]` with no client router: clicking a Latest post row loads the full post page, no `dialog`, as 1a A4).
  - "more than 5 rows group by kind" (the admin with the fixture's 3 collections of waiting rows).
  - "a failed card shows Retry and the others stay": not reachable through the UI with real data; covered by H2's dom test (Deviation 19 pattern, stated in the commit).
  - `portal-spaces-off.e2e.test.ts:188`: "spaces off: /spaces loads with no space" now asserts Home's `h1`, the Needs you section, and no "Your spaces" section, in place of the shortcuts section.
  - `portal-shell.e2e.test.ts:500`: the "focused row near the bottom is not covered" test tabs to the last link of the Latest card (or of Needs you when Latest is empty) in place of the last shortcut.
  - Empty seed, each role: no console error, one `h1`, each empty card shows its empty text (spec, Home, Tests).
  - axe on `/spaces`: `axeOver` gives `{}`.
- [ ] **Step 2: Run** **[verify]**: `portal-home`, `portal-home.empty` (`--db empty`), `portal-shell`, `portal-spaces-off`. Expected: all pass. Commit.

### Task H5: The Home TTFB gate

**Skills:** none beyond the probe (benchmark-checklist applies).

- [ ] **Step 1:** On the Mac, `cilas_ttfb` (T3 kept it) and the same three accounts, production build of this PR's head: `node scripts/ttfb-probe.mjs … --path /en/spaces`. Then, in the same session, the base `main` again (a same-session trunk number, so Mac load drift shows). Write both in the PR.
- [ ] **Step 2: Pass predicate**, per role: Home TTFB p75 is no slower than the baseline table's `main` p75, and under 800 ms when that number is under 800 ms (spec). "No slower" allows the run's noise: the PR states the same-session trunk p75 beside it, and a branch p75 above the table number but within 5% of the same-session trunk p75 is reported to the operator, not passed silently.
- [ ] **Step 3:** If it fails: profile which layout read grows (`needsCounts` per source, from N7's script), fix that read (for example the SQL fallback for N4), and rerun. No cache is added without the operator's yes (spec: measure before any cache). Drop `cilas_ttfb` after the last run.

### Task H6: Reviews, full suite, open PR 1c-3

**Skills:** ux-auditor, better-interface (full), then break-ui; code-review, then security-review.

- [ ] **Step 1:** ux-auditor and better-interface on Home and Inbox together (spec, Phase 1c Review), 1440, 390 and 320px, both languages, light and dark.
- [ ] **Step 2:** break-ui: a 60-character Arabic first name, no person, 0 and 120 unread spaces, 40 spaces, a course with no cover, a session at 23:30 Cairo, 6 and 60 Needs you rows, a failed card.
- [ ] **Step 3:** code-review, then security-review (Home reads are gated; no `/admin` shortcut remains; `rg -n "/admin/" "src/app/(frontend)/[locale]/(portal)" src/portal` lists only `documentHref` results, `/admin/applicants`, `/admin/reviews` and **Open dashboard**).
- [ ] **Step 4:** Fix. **[verify]** the full suite. Open `feat(portal): Home replaces the spaces page (portal phase 1c, PR 3)`. Operator review before merge.

**Verification.**

- [ ] unit: `home-cards.dom.test.tsx`, `reader-courses.int.test.ts`.
- [ ] live: on the Mac with agent-browser headless, as the student of `cilas_ttfb`: Home shows a next session tile whose time matches the course page's session time, and a click on a Latest post row loads the full post page. Pass predicate: same date and time text; URL is the post path and no `dialog` is in the tree.
- [ ] perf: H5. Metric TTFB p75 per role of `/en/spaces`, production build, `cilas_ttfb`. Trunk baseline: the 1c-0 table, plus the same-session trunk run. Fails as H5 Step 2 says.

---

## PR 1c-4. `courseTypeKey` callers (`portal/phase-1c-course-type`)

From `main` after 1b-2b merges (P16). No screen change. Review: code-review.

### Task K1: Two callers

**Skills:** tdd.

**Files:** Modify `src/components/bridge/bridge-year.tsx:91`, `src/components/article/article-page.tsx:137` (line numbers at `57248c77`; find the copy with `rg -n "Study.filters.types|course_type" <file>`).

- [ ] **Step 1:** Each file calls `courseTypeKey(type)` in place of its own key string. `rg -n "filters\.types\.\$\{" src --glob '!src/fields/course-type.ts'` prints nothing after. Run the files' existing tests (find them with `rg -l "bridge-year|article-page" src e2e`): PASS. Open `refactor(courses): one course type key (portal phase 1c, PR 4)`.

**Verification.**

- [ ] unit: the existing tests of both components pass.
- [ ] live: on the Mac dev server, an article page that names a course and a bridge-year page show the same course type words as on `main`, in English and Arabic. Pass predicate: equal text.
- [ ] perf: no runtime change (a string helper). No perf box beyond "no new request".

---

## Review Focus

The inputs the spec implies and no clause tests, most likely first.

1. **The old queue and `waitsOn` disagree on a real row.** For example a live document whose main row holds `review.status: submitted` (the old queue lists it; `KEY_WHERE.submitted` needs `NOT_LIVE`), or a never-published document whose latest version is `submitted` but whose main row is not. N6 prints such ids; the PR decides each.
2. **An admin who is also an owner.** The spec gives admins only the queue and the applicants row. An admin's own article at `changes_requested` gets no Needs you row. N1 table test pins it; Q5 asks the operator.
3. **A failed source.** The total shows no number, the other rows stay, the card says "Some tasks could not load". N5, I4, H2.
4. **Two tabs.** A refresh in one tab does not reach the other; each tab has its own stream and debounce. The I6 second-session test covers another account, not another tab of the same account.
5. **Worst-case rows and counts:** a 120-character Arabic title, 120 tasks, a reader with no person, 40 spaces at 320px. I7, H6.
6. **A soft navigation from Home to a post.** Every post link on Home is a plain `<a>` (H4).

## Decision log (structural)

Each problem, then its fix.

- P1. The review queue (`review-queue.ts:30-56`) and `waitsOn` are two rules for "what waits on an admin": the queue reads raw `review.status`, `KEY_WHERE` adds `NOT_LIVE` and `LIVE_COPY`. A count from one and a list from the other can disagree. Fix: `adminReviewRows` on `KEY_WHERE` and `statusOf` is the one source; `getReviewQueue`, `countReviewQueue` and `needs(admin)` read it (N2). The old algorithm survives only as the frozen oracle in `scripts/needs-check.ts` (N6), so the check is independent of the code it checks.
- P2. Candidate reads ("main rows by `KEY_WHERE`, version rows by `KEY_WHERE`, parents filtered by the base `where`") would be written in `needs` and again in the 1b list loader. Fix: `candidateIds` in `src/lib/review-candidates.ts` (N2); whichever of 1c-1 and 1b-2a lands second moves the other onto it (P7, Requests to phase 1b).
- P3. `needs` and `needsCounts` could each list which sources a role has. Fix: `SOURCES_OF(user)` (N1), read by both.
- P4. Which status keys are work could be written by hand in `needs`. Fix: `waitingKeys(side)` derives them from `waitsOn` over `STATUS_KEYS`; `KIND_OF_KEY` is checked by a test against it (N1).
- P5. The courses a viewer may see applicants for are read inside `applicantsFor` only. Fix: `viewerCourses` in `src/forms/applicants.ts`, read by `applicantsFor` and `countWaitingApplicants` (N4).
- P6. The Home count and the sidebar number come from two functions. Fix: both sum `count` (spec), `needsTotal` is the one sum for rows, and the e2e checks both agree (I6, H4).
- P7. Nav counts could be wired item by item in the layout. Fix: `COUNT_OF` in `portal-nav.ts` maps a key to its number; a later item adds one row (I2).
- P8. A live refresh rule could live inside the bell. Fix: `WorkRefresh` and `refreshes(event)` in `src/portal/needs/` (I5); the bell stays the Latest list.
- P9. "The reader's courses" is needed by Home now and the calendar in 1d. Fix: `readerCourseIds` in `src/lib/reader-courses.ts` (H1), which 1d reuses.
- P10. The old `/spaces` page held its own shortcut list, its spaces-off branch and its CSS. Fix: delete them with the page (H3, Subtract Before You Add); Home composes cards from `src/portal/home/`.

Done means: a new kind of work adds one `KEY_WHERE` row (1b) and one `KIND_OF_KEY` row, and the source table test fails until it does; a new nav item with a count adds one `COUNT_OF` row. `src/lib/**` and `src/forms/**` import nothing from `src/portal/**`.

## Carry-overs from phase 1b

- `src/components/bridge/bridge-year.tsx:91` and `src/components/article/article-page.tsx:137` (`courseTypeKey`): PR 1c-4, after 1b-2b ships `courseTypeKey`.
- `adminCreateHref` in the Home shortcuts: disappears. Home has no shortcut list (H3). The other `/admin/.../create` strings (`src/components/admin/dashboard/quick-actions.tsx:15-19`) are admin dashboard code that the spec does not move; they stay.
- Phase 1b Deviation 11 ("Nav counts are `null` in 1b"): ends in 1c-2 or in 1b-2b (Order with 1b-2b).

## Carry-overs to later phases

- Phase 2: add `withdrawn` to `WORK_KINDS` with M3 (Deviation 6b). `documentHref` gives portal URLs, so Needs you rows of owners and admins move off `/admin` with no change in `needs`. Grouped review rows link to `/spaces/review`.
- Phase 3: `countWaitingApplicants` adds `byCourse` (Deviation 3); the `applicants` row links to `/spaces/applicants`.
- Phase 1d: the admin's next-session action **Open the calendar**; the calendar reads `readerCourseIds`.
- Phase 6: the checklist and the greeting's step sentence.

## Requests to phase 1b

Send these to the 1b builders. None blocks 1b.

1. **1b-2a:** build the work-set candidates on `candidateIds` (`src/lib/review-candidates.ts`) if 1c-1 has landed. If 1b-2a lands first, 1c-1 N2 moves `rows.ts` onto it.
2. **1b-2b, if it lands after 1c-2:** add `articles: (c) => c.by.ownArticles ?? null` and `courses: (c) => c.by.ownCourses ?? null` to `COUNT_OF` for owners in its L1 commit, and add `{ key: 'inbox', … }` after `home` when it rewrites `NAV_BY_ROLE`.

## Open questions (product calls)

Each has a default, so no build waits.

- **Q1. Greeting with no checklist.** Default: "Hello, {first name}." from the linked person's name; "Hello." with no person (Deviation 8).
- **Q2. Next session link with spaces off.** Default: the public course page (Deviation 10).
- **Q3. Does opening an Inbox Latest row mark it read?** Default: yes, as the bell does (Deviation 11).
- **Q4. Live space unread counts and live Latest rows.** Default: not in 1c (Deviation 7, 12). The layout refreshes on work kinds only. A later phase may refresh on post events.
- **Q5. An admin's own returned work.** The spec gives admins no owner rows. Default: follow the spec; an admin's own `changes_requested` article shows in the Articles list's groups, not in Needs you.
- **Q6. Inbox Latest page size.** The spec says 30 is "a default the owner may change". Default: 30, with a 300-row cap (Deviation 11).

## Could not verify from this server

- `verify.sh`'s modes, lock and `--db empty` (P17, P18): the Mac was not read.
- Whether Payload sessions are on for `users` (T2 relies on the real login, so either way works).
- Next 16.4.6 `catchError` at run time (P20): docs read, not run.
- Every "Expected" line: no command ran.
