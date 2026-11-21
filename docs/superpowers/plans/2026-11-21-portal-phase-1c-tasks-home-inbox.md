# Portal phase 1c: tasks, Home and Inbox. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every reader one list of the work that waits on them (`needs(user)`), one set of numbers from the same rules (`needsCounts(user)`), counts on the sidebar, an Inbox page (Needs you, then Latest), counts that refresh when work changes, and a Home page that replaces today's `/spaces` page and its shortcuts into `/admin`.

**Architecture:** PR 1c-0 ships the TTFB probe script from `main` and measures today's `/spaces` TTFB on the Mac. The number goes into this plan by a docs commit (see "TTFB baseline"). PR 1c-1 adds the data core with no screen: `src/portal/needs/` (`needs`, `needsCounts`, one source table, one cached read of the work sets per request), the candidate and row reads that 1b-2a wrote, moved to `src/lib/review-candidates.ts` so both phases use one reader, `countReviewQueue` and the shared rows in `src/lib/review-queue.ts`, `countWaitingApplicants` in `src/forms/applicants.ts`, and a prod-clone check as a gated int test. PR 1c-2 adds the Inbox page, the Inbox nav item, the counts on nav rows (streamed under a Suspense boundary, so they never hold the first byte), and the live refresh. PR 1c-3 replaces the `/spaces` page with Home. PR 1c-4 moves the two `courseTypeKey` copies that 1b left.

**Tech stack:** Next.js 16.4.6 App Router, React 19.2.6, next-intl 4, Payload 3.91.0 (Postgres), Arc UI (`src/components/arc`), Vitest 4, Playwright 1.58.2, `@axe-core/playwright` (phase 1a PR C).

**Spec:** `docs/superpowers/specs/2026-11-18-portal-design.md`: Phases (Phase 1c), Tasks (`needs(user)` and the bell), Home, Navigation, Architecture (Frame, Routes, Feature folders, Data access rule, Lazy loading rule), Status model (`waitsOn`), Document links, Onboarding (empty states), Tests. The spec wins where they differ, except for the Deviations below.

**Sources read for this plan** (2026-11-21, by reading only; no command ran). Round 1 fixes re-read every head below.

| Source | Ref | SHA |
| --- | --- | --- |
| `main` | `origin/main` | `57248c77` |
| Phase 1b plan (PR #52) | `origin/docs/portal-phase-1b-plan` | `23fb570c` |
| Phase 1b PR 1b-1 code (no PR open yet) | `origin/portal/phase-1b-status` | `0c039fd3` |
| Phase 1b PR 1b-2a code (no PR open yet) | `origin/portal/phase-1b-list-data` | `b9c2080e` (its merge base with 1b-1 is `bd31bf98`, an older 1b-1 head) |
| Phase 1a PR C (#53) | `origin/portal/phase-1a-shell` | `72d8b22f` |
| ADR 0012 (PR #54, not merged) | `origin/docs/adr-ui-sdk-wrappers` | `bbac10c8` |
| Next.js docs | `/home/salah/cilas/node_modules/next/dist/docs/` (16.4.6) | n/a |

Not built anywhere at these SHAs: PR 1b-2b (the list screens, the Articles and Courses nav items, `courseTypeKey`, L0 ScrollArea, L0b fold trigger). PR 1b-2a is built and pushed (`src/portal/lists/rows.ts`, `testing/portal-lists.fixture.ts`), but it does not yet hold the 1b-1 head. The 1b plan, 1b-1, 1b-2a and PR C still move. The section "Premises to re-check when 1b lands" lists every assumption this plan makes about code that is not on `main`. A line number cited with a ref is true at that ref only; each premise check is a grep, so it still works after a line moves.

**Status.** Nothing is built. Every "Expected" line is a prediction.

---

## What each reader sees

- **1c-0:** nothing. A script, and a number in this plan.
- **1c-1:** nothing. The admin dashboard's "Reviews waiting" tile reads `countReviewQueue`, the same rule as the portal (the prod-clone check proves it lists the same ids as before).
- **1c-2:** an Inbox item in the sidebar and the bottom bar, with a count that arrives a moment after the page (streamed). An Inbox page. Counts on Articles and Courses for fellows and students (when 1b-2b has landed). Counts change with no reload when work changes.
- **1c-3:** Home in place of today's `/spaces` page. The shortcut list into `/admin` is gone. Admins reach `/admin` from **Open dashboard**.
- **1c-4:** nothing (a refactor of two public pages).

## PRs

| PR | Branch | Base | Tasks | Screen | Ends when |
| --- | --- | --- | --- | --- | --- |
| 1c-0. TTFB baseline | `portal/phase-1c-ttfb` | `main` | T1 to T3 | none | `scripts/ttfb-probe.mjs` runs on the Mac; the numbers are in this plan's baseline table (docs commit) and in the ledger |
| 1c-1. Needs core | `portal/phase-1c-needs` | `portal/phase-1b-list-data` (1b-2a) once it holds the 1b-1 head (P25); the PR targets `main` once 1b-1 and 1b-2a are in | N1 to N7 | none | `needs` int tests, the needs-vs-queue check on the prod clone |
| 1c-2. Inbox, counts, live refresh | `portal/phase-1c-inbox` | `portal/phase-1a-shell` (PR C) with 1c-1 merged in; rebased on `main` once PR C and 1c-1 merge | I1 to I7 | yes | `portal-home` (Inbox describe), the 1c assertions in `portal-shell`, `work-refresh.dom.test.tsx`, the perf gate (G) |
| 1c-3. Home | `portal/phase-1c-home` | `portal/phase-1c-inbox`; rebased on `main` once 1c-2 merges | H1 to H6 | yes | `portal-home` (Home describe), the perf gate (G) |
| 1c-4. `courseTypeKey` callers | `portal/phase-1c-course-type` | `main` after 1b-2b merges | K1 | none | the two pages' existing tests |

**Dependency graph.**

```
main ──┬── 1c-0 (independent; must finish before the 1c-2 perf box)
       ├── 1b-1 ── 1b-2a ── 1c-1 ──┐
       ├── PR C ───────────────────┴── 1c-2 ── 1c-3
       └── 1b-2b ── 1c-4 (independent of the rest)
1b-2b ┄┄ 1c-2 (soft: counts on Articles and Courses; see Order with 1b-2b)
```

- 1c-0 and 1c-1 are independent of each other and of PR C. 1c-0 must finish before the 1c-2 perf box (the gate (G) reads its number).
- 1c-1 needs 1b-1 (`waitsOn`, `KEY_WHERE`, `statusInputOf`, `documentHref`, `mayAuthor`, `mayTeach`) and 1b-2a (its candidate and row reads, which N2 moves to `src/lib/review-candidates.ts`, and its fixture writers). It needs nothing of PR C or 1b-2b.
- 1c-2 needs PR C (the shell, the cached `currentReader`, `portalNav`, `NAV_BY_ROLE`, `PortalEmptyState`) and 1c-1.
- 1c-3 needs 1c-2 (the Needs you list and the Latest list it renders) and the 1c-0 number.
- 1c-4 needs only 1b-2b (`courseTypeKey`).

**Landing order:** 1c-0, 1c-1 (after 1b-2a), then 1c-2, then 1c-3. 1c-4 lands any time after 1b-2b. Phase 1b's merge order is not changed by this plan. 1c-2 and 1c-3 change an interaction, so they wait for the operator's review before merge (playbook rule).

**Files each PR may touch.** A builder who needs a file outside its list stops and reports.

- **1c-0:** `scripts/ttfb-probe.mjs`, `scripts/ttfb-accounts.ts` (new). The plan file is not on `main`; the number reaches it by the rule in "TTFB baseline", not through this PR.
- **1c-1:** `src/portal/needs/*` (new), `src/lib/review-candidates.ts` and `src/lib/review-candidates.int.test.ts` (new), `src/portal/lists/rows.ts` (N2 Step 1: its candidate and row reads move out; no behaviour change), `src/lib/review-queue.ts`, `src/lib/review-queue.int.test.ts` (new), `src/components/admin/dashboard/quick-actions.tsx` (the tile calls `countReviewQueue`, one line), `src/forms/applicants.ts`, `src/forms/applicants.int.test.ts` (add a describe), `testing/needs.fixture.ts` (new; it calls `testing/portal-lists.fixture.ts`, which it does not change), `scripts/needs-check.int.test.ts` (new).
- **1c-2:** `src/portal/needs/` (view parts: `need-list.tsx`, `latest-list.tsx`, `latest.ts`, `mark-read.tsx`, `work-refresh.tsx`, their tests, CSS module), `src/portal/inbox/` (new), `src/app/(frontend)/[locale]/(portal)/spaces/inbox/page.tsx` (new), `src/app/(frontend)/[locale]/(portal)/spaces/layout.tsx`, `src/portal/nav/{portal-nav.ts,portal-nav.unit.test.ts,nav-counts.tsx (new),nav-counts.dom.test.tsx (new),nav-icons.ts,rows.tsx,portal-shell.tsx,sidebar.tsx,shell.module.css,sidebar.browser.test.tsx,more-sheet.tsx,bottom-bar.tsx}`, `src/lib/notification-glyphs.tsx` (new: the bell's glyph map, no `'use client'`), `src/components/site-notifications.tsx` (imports the glyph map from the new file; no behaviour change), `src/lib/notifications-client.ts` (`markRead` takes an optional `keepalive`; the bell's calls do not change), `messages/{en,ar}.json` (`Portal.nav`, `Portal.needs`, `Portal.inbox`, `Portal.latest`), `testing/portal-e2e.test-utils.ts`, `testing/portal.fixture.ts` (only `portalNeedsWorld`, see I1), `testing/portal-lists.fixture.ts` (export `makeAccount` only), `playwright.config.ts` (only if P23 fails), `e2e/portal-shell.e2e.test.ts`, `e2e/portal-home.e2e.test.ts`, `e2e/portal-home.empty.e2e.test.ts` (new).
- **1c-3:** `src/portal/home/*` (new), `src/lib/reader-courses.ts` and its int test (new), `src/app/(frontend)/[locale]/(portal)/spaces/(home)/page.tsx`, `(home)/loading.tsx`, `messages/{en,ar}.json` (`Portal.home`; delete `SpaceShortcuts` and the `Spaces` keys only the old page used), `src/components/space/space.module.css` (delete the shortcut rules), `e2e/portal-home.e2e.test.ts`, `e2e/portal-home.empty.e2e.test.ts`, `e2e/portal-spaces-off.e2e.test.ts` (`:188`), `e2e/portal-shell.e2e.test.ts` (`:500`).
- **1c-4:** `src/components/bridge/bridge-year.tsx`, `src/components/article/article-page.tsx`.

### Order with 1b-2b

1b-2b and 1c-2 both change `src/portal/nav/portal-nav.ts`, `rows.tsx`, `sidebar.tsx`, `portal-shell.tsx`, `shell.module.css`, `NAV_BY_ROLE` and `messages/*.json`. Two orders are possible. Each has a rule.

- **1b-2b first (preferred).** 1c-2 rebases on it. I2 adds the `articles` and `courses` rows to `COUNT_OF` (in `src/portal/nav/nav-counts.tsx`), and I3 renders the count chip in the row that 1b-2b leaves (with L0's `ScrollArea` and L0b's `FoldProvider`).
- **1c-2 first.** 1c-2 ships the Inbox count only. `COUNT_OF` has no `articles` or `courses` row. 1b-2b then adds those two rows to `COUNT_OF` in its L1 commit, and its two items get their counts with no other change. Send this as a request to the 1b-2b builder (see "Requests to phase 1b"). The 1b plan's Deviation 11 ("Nav counts are `null` in 1b") then ends inside 1b-2b.

## Premises to re-check when 1b lands

Each premise names the file and symbol, the SHA read, who uses it, the exact check, and the fallback. The builder of the named PR runs the check on its base (`HEAD` below) before the first task that uses it. A check that fails: stop, write what differs in the PR, and use the fallback.

- **P1. 1b-1 status exports.** `src/lib/review-status.ts` exports `StatusKey`, `STATUS_KEYS`, `waitsOn`, `statusOf`, `statusInputOf`, `KEY_SELECT`, `NOT_LIVE`, `LIVE_COPY`, `KEY_WHERE` (`0c039fd3`; also true at 1b-2a `b9c2080e`). Used by 1c-1.
  - Check: `git grep -cE "^export (const|type) (StatusKey|STATUS_KEYS|waitsOn|statusOf|statusInputOf|KEY_SELECT|NOT_LIVE|LIVE_COPY|KEY_WHERE)\b" HEAD -- src/lib/review-status.ts` prints `HEAD:src/lib/review-status.ts:9`.
  - Fallback: none. 1c-1 cannot start without 1b-1.
- **P2. `KEY_WHERE` rows.** A row `{ on, where }` for each key whose `waitsOn` is not null: `submitted`, `changes_requested` (`on: 'main'`), `published_edits`, `published_removal`, `published_edits_returned` (`on: 'version'`) (`0c039fd3`, `review-status.ts:186-213`). 1b-1 pins that each row finds exactly the rows `statusOf` gives its key, for the states real moves make (`review-status.int.test.ts:283`, "KEY_WHERE finds the rows of its keys"). Used by 1c-1.
  - Check: `git grep -n "every key that waits on someone has a KEY_WHERE row" HEAD -- src/lib/review-status.unit.test.ts` finds one test, and `pnpm exec vitest run --project node src/lib/review-status.unit.test.ts` passes (Mac).
  - Fallback: none. A waiting key with no row cannot be counted with no field compare.
- **P3. Keys-only rows.** `statusOf` with `read: 'keys'` throws only when it must compare fields (`0c039fd3`, `review-status.ts:113-116`): a live row whose copy is not at `submitted` or `changes_requested`. Only `published_edits` is proved with keys in a unit test (`review-status.unit.test.ts:300-313` at `0c039fd3`). 1c does not rely on more: `keyedRows` (N2, moved from 1b-2a's `readEntries`) reads the full reviewed fields for every live row with a draft copy, so no key read throws. Used by 1c-1 N2.
  - Check: `git grep -n "read: 'full'" HEAD -- src/lib/review-candidates.ts` finds the full read after N2 Step 1.
  - Fallback: none needed.
- **P4. `documentHref`.** `documentHref({ collection, id, viewer, waiting, locale })` returns `/admin/collections/{collection}/{id}` (`0c039fd3`, `src/lib/document-href.ts:10`). Used by 1c-1.
  - Check: `git grep -n "export const documentHref" HEAD -- src/lib/document-href.ts`.
  - Fallback: none.
- **P5. Access helpers.** `mayAuthor` and `mayTeach` in `src/access.ts` (`0c039fd3`). `ownsViaAuthors`, `ownsViaFellows`, `isAdminUser`, `adminViewOf`, `personOf` are on `main` (`57248c77`, `src/access.ts:49-124`). Used by 1c-1.
  - Check: `git grep -cE "export const (mayAuthor|mayTeach|ownsViaAuthors|ownsViaFellows)\b" HEAD -- src/access.ts` prints `HEAD:src/access.ts:4`.
  - Fallback: none.
- **P6. Reviewed collections.** `ReviewedCollection` and `REVIEWED_FIELDS` in `src/lib/reviewed-fields.ts` (`0c039fd3`); `REVIEWED` in `src/lib/reviewed-collections.ts` lists articles, courses and publications (`57248c77`). Used by 1c-1.
  - Check: `git grep -n "export type ReviewedCollection" HEAD -- src/lib/reviewed-fields.ts`.
  - Fallback: none.
- **P7. 1b-2a reads to move.** `src/portal/lists/rows.ts` holds the module-local `workCandidates` (`b9c2080e`, `:226`), `withoutParentStatus` (`:215`), `readEntries` (`:170-206`), `readMains`, `readLatest` and `newestPerParent` (`:137-168`). At `b9c2080e` the version candidate read leaves out `parent._status` (as an owner it made Payload add the parent's read access to each branch: 1368 joins in one query), and each parent then passes a main read under the base `where`, which knows whether it is live. N2 Step 1 moves them to `src/lib/review-candidates.ts`. Used by 1c-1 N2.
  - Check: `git grep -nE "^const (workCandidates|withoutParentStatus|readEntries|readMains|readLatest|newestPerParent) =" HEAD -- src/portal/lists/rows.ts` prints 6 lines.
  - Fallback: 1b-2a already moved them (the grep prints fewer lines and `src/lib/review-candidates.ts` exists). Use what it moved, add only what N2 needs, and say so in the PR.
- **P8. `portalNav` shape.** `portalNav(user)` takes one argument and returns `PortalNavItem[]` with `key: 'home' | 'openDashboard'`, `count: number | null` (always `null`), `external`, `group`; `PortalNavIcon` is `'home' | 'dashboard' | 'profile'` (`72d8b22f`, `src/portal/nav/portal-nav.ts`). 1c keeps the one-argument signature (I2). Used by 1c-2 I2.
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
- **P13. Shell call.** `PortalShell({ nav, spaces, folded, accountId, children })` is a server component, and `(portal)/spaces/layout.tsx` awaits `currentReader`, then `mySpaces` in a `Promise.all`, and calls `portalNav(user)` (`72d8b22f`, `layout.tsx:21-45`). `Sidebar`, `BottomBar`, `MoreSheet` and `rows.tsx` are client modules (`'use client'` on line 1). 1b-2b L0b adds `FoldProvider`. Used by 1c-2 I2, I3.
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
- **P17. `verify.sh` modes and lock.** Usage `[--e2e-only] [--no-tests] [--tests-only] [--int-only] [--keep] <branch> <sha> [specs|-g pat]` (1b plan Global Constraints, read 2026-11-21). Exit 2 means busy (the lock is held). No TTFB mode and no production-build mode. Known defect (ledger, "For the morning"): `--int-only <branch> <sha> <file>` ignores the file and runs the whole int suite (about 6 min) on `cilas_dev`. Used by 1c-0, N6, N7, I7, H5, every **[verify]** step.
  - Check (Mac): `~/cilas-verify/verify.sh --help`; `grep -nE "flock|LOCK|lock" ~/cilas-verify/verify.sh` prints the lock file path (call it `<lock>`); `grep -n "DATABASE_URL" ~/cilas-verify/verify.sh` shows whether a caller's `DATABASE_URL` reaches the tests. Write the three results in the PR.
  - Lock command: every Mac step that this plan marks "inside the lock" runs as `flock <lock> <command>`, so it waits for `verify.sh` runs and they wait for it. If `verify.sh` locks in another way (for example `mkdir`), use that way and say so in the PR.
  - Int runs: while the `--int-only` defect stands, a task's **[verify]** int steps do not each start a run. Write the tests task by task, then run them as one `verify.sh --int-only` at the end of each group: N1 to N3, N4 and N5, I1, H1. A FAIL names the test; fix it and run the group again. When the defect is fixed, run one file per step.
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
- **P22. `sync` fires only after a gap.** The stream calls `sync` on a reconnect, not on the first connect (`connectedBefore`, `src/lib/realtime/stream-client.ts:63-64`), and on the server's `resync` event (`:66`) (`57248c77`). So a page load adds no refresh. Used by I5.
  - Check: `git grep -n "if (connectedBefore) each" HEAD -- src/lib/realtime/stream-client.ts`.
  - Fallback: `WorkRefresh` ignores the first `sync` after it subscribes.
- **P21. ADR 0012.** Not merged (`bbac10c8`). No 1c task imports `@ui-sdk/*` or adds to `src/components/sdk/`, so its state changes nothing.
  - Check: `git ls-tree origin/main docs/adr/0012-ui-sdk-wrappers.md`.
  - Fallback: none needed.
- **P23. Empty-seed specs stay off the normal run.** `playwright.config.ts` has `testIgnore: 'production.e2e.test.ts'` only (`main` `57248c77`, PR C `72d8b22f`, 1b-1 `0c039fd3`, 1b-2a `b9c2080e`, all `:34`). The 1b plan (L6, `23fb570c`) adds "`testIgnore` adds `*.empty.e2e.test.ts` unless the path of `DATABASE_URL` is `/${EMPTY_DATABASE}`; on `cilas_empty`, only `*.empty.e2e.test.ts` runs", in 1b-2b. Used by 1c-2 I6, 1c-3 H4.
  - Check: `git grep -n "empty.e2e" HEAD -- playwright.config.ts` finds the rule.
  - Fallback: 1b-2b has not landed. 1c-2 adds the same rule in its I6 commit, written as the 1b plan's L6 writes it (it reads `EMPTY_DATABASE` from `seed/empty-url.ts`), so the later merge with 1b-2b has one obvious side. Add `playwright.config.ts` to the I6 commit and say so in the PR.
- **P24. `server-only` in the check's runner.** `src/forms/applicants.ts:1` is `import 'server-only'` (`57248c77`). Plain `tsx` cannot load it: no `server-only` package is installed; the vitest `node` project aliases it to `next/dist/compiled/server-only/empty.js` (`vitest.config.mts:41`). So the prod-clone check (N6) and its cost run (N7) are vitest int files in the `node` project, not `tsx` scripts. The node project includes `**/*.{int,unit}.test.{ts,tsx}`, so `scripts/needs-check.int.test.ts` is found. Used by 1c-1 N6, N7.
  - Check: `git grep -n "server-only" HEAD -- vitest.config.mts` prints the alias line.
  - Fallback: none. Stop: the check needs the alias.
- **P25. 1b-2a holds the 1b-1 head.** On 2026-11-21 it does not: `git merge-base origin/portal/phase-1b-list-data origin/portal/phase-1b-status` is `bd31bf98`, and 1b-1 has five later commits (`8f33c75c` to `0c039fd3`). Used by 1c-1 (its base).
  - Check: `git merge-base --is-ancestor origin/portal/phase-1b-status origin/portal/phase-1b-list-data && echo ok` prints `ok`.
  - Fallback: branch 1c-1 from `portal/phase-1b-list-data` and merge `origin/portal/phase-1b-status` into it as the first commit (a merge commit on the 1c-1 branch only; never push to a 1b branch). A conflict in a 1b file: stop and report it to the 1b orchestrator, as a request.
- **P26. Portal fixture writers.** `testing/portal.fixture.ts` exports `PortalWorld` (`:63`), `portalWorld` (`:259`) and `notifyOf(payload, account, link)` (`:375`; it writes a `comment` notification with `overrideAccess: true`) (`72d8b22f`). `testing/portal-lists.fixture.ts` exports `trustedWrites(payload, track)` (`:77`: `create`, `edit`, `submit`, `decide`, `unpublish` for articles and courses), the module-local `makeAccount` (`:28`) and `listWorld(payload, track, world)` (`:142`: one student-owned article for every `STATUS_KEYS` key, among them `draft`, and some courses) (`b9c2080e`). Used by 1c-1 N2, 1c-2 I1.
  - Check: `git grep -nE "^export (const|type) (PortalWorld|portalWorld|notifyOf)\b" HEAD -- testing/portal.fixture.ts` prints 3 lines, and `git grep -nE "^export const (trustedWrites|listWorld)\b" HEAD -- testing/portal-lists.fixture.ts` prints 2.
  - Fallback: a writer moved or changed its shape. Use the new one; do not copy its body into `testing/needs.fixture.ts`.
- **P27. Empty seed.** `pnpm db:seed:empty` (`package.json:18`), `EMPTY_DATABASE = 'cilas_empty'` (`seed/empty-url.ts:1`) and `EMPTY_ACCOUNTS` (`seed/empty.ts`, read by `seed/empty-run.ts:36`) are on `main` (`57248c77`, PR D). Used by 1c-2 I6, 1c-3 H4.
  - Check: `git grep -n "export const EMPTY_ACCOUNTS" HEAD -- seed/empty.ts` and `git grep -n "EMPTY_DATABASE = 'cilas_empty'" HEAD -- seed/empty-url.ts`.
  - Fallback: none. The empty-seed specs need them.
- **P28. One reader object per request.** `currentReader` is wrapped in React `cache` with no argument on PR C (`72d8b22f`, `src/lib/reader.ts:16`; on `main` `57248c77` it is not). So the layout and the page of one request get the same `User` object, and a `cache` keyed on that object hits for both. Next documents `cache` as per request: "Multiple components can then call the function within the same request while sharing one result" (`01-app/01-getting-started/06-fetching-data.md`, "Reusing data with `React.cache`", 16.4.6). Used by 1c-2 (the layout), 1c-3 (Home).
  - Check: `git grep -n "export const currentReader = cache(" HEAD -- src/lib/reader.ts`.
  - Fallback: wrap `currentReader` in `cache` in 1c-2's first commit, as PR C does, and list `src/lib/reader.ts` in the PR.
- **P29. Admin paths.** The admin views `/admin/applicants` and `/admin/reviews` exist (`src/payload.config.ts:180`, `:194`, `57248c77`). N5 and I4 link to them. Used by 1c-1, 1c-2.
  - Check: `git grep -nE "path: '/(reviews|applicants)'" HEAD -- src/payload.config.ts` prints 2 lines.
  - Fallback: a view moved. Use its new path in `needs` and `NeedList`, and say so.

## Global Constraints

**Run location (from the 1b plan, still in force).** Read the 1b plan's Global Constraints, "Run location". Builders work on the user's Mac, each in its own git worktree. Light commands (oxlint, `pnpm exec tsgo --noEmit`, one unit or dom test file, `pnpm audit:access`) run in the Mac worktree. Heavy jobs (int tests, browser tests, Playwright, `next build`, a server, the full suite) run only through `~/cilas-verify/verify.sh` (**[verify]**). The Mac is shared with the 1b builders: queue through `verify.sh`'s lock (P17), never start a second server beside it, never touch the user's stash or another agent's processes. Nothing in this plan runs on the Linux server, except reading and `git`. The Mac is T3 environment `1a4d95da-5225-4111-8b47-95722338b848`, project `ccbd0b98-2d40-4378-9e39-049224e0f44a`. A Mac delegate makes its own git worktree.

**From the 1b plan, still in force** (read these sections there; they are not copied): "New in 1b", the items **Access rules**, **One role table**, **Owner lists filter by owner**, **Which row is which**, **Latest versions** (keep the newest `updatedAt` per parent), **Data access** (every read names `depth`, `select`, `pagination: false` or a `limit`), **Int test setup** (`mockNetwork(resendInbox().handler, ...localServices)`; read by your own ids, never by table counts), **English**, **Arabic digits**. From the phase 1a plan (by section name): Spec values; Code and tests (Libraries first, Tests, Matrix, Describes, Locators, `spaces_mode`, Copy, Components, Lazy UI); Commits and PRs; Deviation 19 (matrix exemptions) as a pattern; "No streaming boundary above the check".

**New in 1c.**

- **No schema change.** The spec's Migrations table lists nothing for 1c. `needs` derives from documents. No task runs `payload migrate:create`. A task that finds it needs a field stops and reports. (Had one been needed: generate it on the branch, rename the SQL by hand, apply it only on a throwaway copy that the seed guard accepts, never `cilas_dev`, and list it in the ledger under "For the morning".)
- **Projection reads.** `countReviewQueue` and the review rows read with `overrideAccess: true` (as `getReviewQueue` does, `src/lib/review-queue.ts:31`). Every portal caller checks `isAdminUser(user)` first and returns zero rows for any other reader. `countWaitingApplicants` reads `form-submissions` with `overrideAccess: true` inside `src/forms/applicants.ts`, the one projection (spec, Data access rule). Every other read is gated (`user`, `overrideAccess: false`).
- **Version reads count parents, not rows.** Two versions saved in one millisecond can both be `latest` (1b plan, Latest versions). So no count uses `payload.countVersions`. A version count reads `findVersions` with `select: { parent: true }`, `depth: 0`, `pagination: false`, and counts distinct parent ids.
- **Links to work and posts are plain `<a>`.** Every `needs()` href in 1c is an `/admin` URL (`documentHref` gives the admin URL until phase 2; `/admin/applicants` before phase 3). `localePrefix` is `'always'` (`src/i18n/routing.ts:11`), so next-intl `Link` would make `/admin/...` into `/en/admin/...`. Latest rows link to posts and other site pages, and a soft navigation from outside `(rooms)` to a post shows the dialog over an empty page (operator rule, 2026-11-21). So Needs you rows and Latest rows render `<a href>`. A Latest row uses the stored `link` exactly as stored, as the bell does today: the bell sets `href: n.link ?? undefined` (`src/components/site-notifications.tsx:109`, `57248c77`) and its toast opens `item.href` unchanged (`:148-150`). Stored links are mixed (`/admin/applicants?application=…` from `src/forms/notify-application.ts:42`, `/spaces/...`, `/en/spaces/...`), and the next-intl proxy (`src/proxy.ts:8`, `localePrefix: 'always'`) sends a portal path with no locale to its prefixed form. So 1c adds no locale logic to links.
- **One request, one read.** The candidate reads of every source run once per request, in `workOf(user)`, which is wrapped in React `cache` (spec, Tasks, Data). `needsCounts(user)` is the sizes of those sets. `needs(user, locale)` reads the rows of the same sets. Both are wrapped in `cache` too. The key is the `User` object, and PR C's `currentReader` is cached with no argument (P28), so the layout and the page of one request pass the same object and share each entry. So on Home and Inbox the layout's count and the page's rows come from one candidate read, and the rows step adds only the details read. The layout calls only `needsCounts` (spec, Lazy loading rule). React `cache` does not memoize outside a server render, so no unit test can count the reads; the structure proves it (P28, and `workOf` is the only caller of the candidate reads, checked in code review), and N5 tests the pure functions (`workSetsOf`, `countsOf`, `rowsOf`). No `unstable_cache`, no `cacheTag`: the spec asks for the cost before any cache (N7).
- **Counts never hold the first byte.** The layout does not await `needsCounts`. It passes the promise, with `.catch` that logs and resolves to `null`, to `PortalShell`, which puts it in a small client context (`NavCountsProvider`). Each nav row renders its chip in `<Suspense fallback={null}>`, and the chip reads the promise with `use()` (Next, `06-fetching-data.md`, the `use` example and "provide it through context"). So the shell and the page stream first, and the numbers follow in the same response. A `null` (a failed count) renders no number (spec, Navigation, Errors). `router.refresh()` runs in a transition, so a chip that already shows a number keeps it until the new number is ready (I3 tests it). This boundary wraps only the chip, never the layout's `children`, so phase 1a's rule "No streaming boundary above the check" still holds.
- **Perf gate (G).** One predicate for every PR that touches the portal layout or Home (1c-2, 1c-3). Probe: `scripts/ttfb-probe.mjs` (T1), production build, `cilas_ttfb`, the three accounts of T2 with fresh cookies, inside the lock (P17). Routes: `/en/spaces` (Home), plus each route the PR adds (1c-2: `/en/spaces/inbox`). Run order in one session: this PR's base, then this PR's head. Validity: the run counts only when the base's p75 for each role is within 10% of the baseline table's `main` p75 for that role; else the Mac is not in the baseline state: rerun later, at most twice, then report the PR as blocked on the Mac (not failed). **Pass**, for every role and every route: head TTFB p75 is at most the baseline table's `main` p75 for that role, and, when that number is under 800 ms, head p75 is under 800 ms. **Fail** otherwise. A fail is fixed in the PR that caused it (profile the layout reads, N7's per-source numbers); no cache without the operator's yes. Full-response p75 is recorded beside it; above 2x the base's full-response p75 it is a finding for the operator, not a fail.
- **Review predicate.** A review step (ux-auditor, better-interface, break-ui, code-review, security-review) passes when no finding rated Critical or High stays open: each is fixed with a test, or the PR lists it with the operator's decision. Medium and Low findings are fixed or listed in the PR. Each report goes in a PR comment with the head SHA, linked from the PR body.
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
6. **Live refresh: which events refresh.** Spec: a notification of kind `submitted`, `approved`, `changes_requested`, `rejected`, `removed`, `application` or `withdrawn`. Plan: (a) only `created` events refresh; `updated` (a read mark) and `deleted` events change no work. (b) `withdrawn` is not a kind until M3 (phase 2). `REFRESHES_WORK` is a `Record<NotificationKind, boolean>`, so adding the kind `withdrawn` to the registry is a type error until phase 2 sets its row (I5). (c) An event whose `doc` is absent (too big for one database message, `site-notifications.tsx:133`) refreshes, because its kind is unknown. (d) The stream's `sync` (a reconnect after a gap) refreshes once, because events in the gap are lost. All four go through the one 1 s debounce.
7. **Space unread counts stay as phase 1a Deviation 15 left them.** 1a Deviation 15 says "Phase 1c brings live counts". The spec's 1c scope brings live *work* counts only: the refresh fires on work kinds, and a new post creates no notification of those kinds. A work refresh reruns the layout, so the space counts are fresh after it, but nothing refreshes on a new post. Answer: no live space unread counts in 1c. Open question Q4.
8. **Greeting.** Spec: "Greeting with the first name. While the checklist shows: ...". 1c has no checklist (phase 6), so the greeting is one line: "Hello, {name}." with the first word of the linked person's name in the page locale. An account with no person (only admins) gets "Hello." with no name. Open question Q1.
9. **Next session source.** Spec: "`nextMeeting` from `src/lib/meetings.ts` over the reader's courses", and 1d ships "the gated read of the reader's own sessions". 1c needs a source now. Plan: `readerCourseIds(payload, user)` in `src/lib/reader-courses.ts`: the courses whose `fellows` hold the reader's person (gated `find`) and the courses of the reader's `accepted` enrollments (gated `find` of `enrollments`, `person` equals the reader's person). Then one gated `find` of `sessions` for those courses and `nextMeeting` over their meetings. Phase 1d reuses `readerCourseIds` for the calendar (one rule, one place). An admin with neither gets "No sessions yet" and no button (spec, until 1d).
10. **Next session link with spaces off.** Spec: "a link to the space". With spaces off no space page loads. Plan: the link goes to the public course page (`/{locale}/study/{slug}`). Open question Q2.
11. **Inbox Latest paging is a link.** Spec: "the 30 newest notification rows ... with **Show more**". Plan: as 1b Deviation 7, **Show more** is a link, `?latest=2` loads 60 rows, with a `focus` parameter that moves focus to the first new row and calls `announce()`. Cap: 10 pages (300 rows); past the cap a line says "Only the newest 300 show." A click on a Latest row marks it read, as the bell does (`site-notifications.tsx:168`). Open question Q3.
12. **Home "Latest" and Inbox "Latest" rows are server-rendered.** The bell stays the live list. Home and Inbox Latest change on a work refresh (Deviation 6) or a load, not on every notification. Open question Q4 covers the same choice for space counts.
13. **Admin rows' `owner`.** Spec: `owner: { id, name }`. The queue reads owner names, not one owner id: an article can have several authors. Plan: `owners: string[]` (names, joined in the view as `getReviewQueue` does today, `review-queue.ts:19-22`), empty on the reader's own rows.
14. **Nav counts stream, and `portalNav(user)` keeps one argument.** Spec: `portalNav(user)` returns items whose `count` is a number or `null`, from `needsCounts(user)` that the layout calls. Plan: `portalNav(user)` is unchanged and its items keep `count: null`. The numbers come from the `needsCounts` promise through `NavCountsProvider` and `COUNT_OF` (I2, I3), so the first byte does not wait for them (perf gate (G), operator decision 2026-11-21). The spec's own error rule ("the nav renders with no counts") already allows a nav with no number for a moment.
15. **`needs(user, locale)`.** Spec: `needs(user)`. The rows carry a label in the reader's locale and owner names in that locale, so the locale is an argument. `needsCounts(user)` keeps the spec's one argument.
16. **Counts are distinct ids from `find` and `findVersions`, not `payload.count`.** Spec: `needsCounts` "uses `count` queries". Two versions saved in one millisecond can both be `latest` (Global Constraints, Version reads count parents), so a version count reads parent ids and counts distinct ones. The `where` of each read is still the `KEY_WHERE` row of the key (spec: "built from one table"). The candidate read is the one 1b-2a wrote (N2).
17. **The review queue reads with `overrideAccess: true`.** Spec, Tasks, Access: "Gated read for documents", with `src/forms/applicants.ts` as the one projection. `getReviewQueue` already reads with `overrideAccess: true` and no user (`src/lib/review-queue.ts:31`), because its admin callers (`quick-actions.tsx:36`, the review queue view) pass no user. 1c keeps that for `adminReviewRows` and `countReviewQueue`, and every portal caller checks `isAdminUser(user)` first (N5 tests a non-admin gets no admin row and no `overrideAccess` read).
18. **A second admin's numbers are stale until a refresh.** Spec: the shell refreshes on a notification of a work kind. A decision notifies the owner, not the other admins (`notify` goes to owners), so admin B's Inbox number and rows keep a row that admin A decided until B loads a page, a soft navigation re-renders the page (the layout's count stays), or B gets another work event. Default: accept it in 1c, with no polling (Open question Q7). I6 pins the bound: after a reload B's number is right.
19. **The baseline number reaches this plan by a docs commit.** Spec: "Task 1 ... writes the number in the plan". The plan file lives on `docs/portal-phase-1c-plan`, not on `main`, and 1c-0 branches from `main`. So 1c-0 ships only the scripts, and the number goes into this file by a docs commit on the plan branch while the plan PR is open (or a one-line docs PR after it merges), and into the ledger. "Task 1" is PR 1c-0's T3 (T1 writes the probe).

## Ends when

The spec's Phase 1c line, by clause.

1. Task 1 measures today's `/spaces` TTFB at p75 per role on the prod clone and writes the number in the plan: T1 to T3, and the docs commit of Deviation 19 (the baseline table below).
2. `needs` passes: N3 to N6 (int and unit), I5 (`work-refresh.dom.test.tsx`), I6 (the live-refresh e2e).
3. `portal-home` passes: I6 (Inbox), H4 (Home), each with its empty-seed spec.
4. The total of `needs(admin)` matches the admin queue on the prod clone: N6 (`scripts/needs-check.int.test.ts`, pass predicate there).
5. Home TTFB at p75 per role is no slower than the task 1 number, and under 800 ms when that number is under 800 ms: the perf gate (G) in Global Constraints, run in 1c-2 (I7, the layout gains the counts) and in 1c-3 (H5, Home).

Scope check, from the spec's Phase 1c Scope line: `needs()` on `waitsOn` (N3, N5); `needsCounts()` (N5); `countWaitingApplicants` (N4); `countReviewQueue` (N2); the sidebar counts (I3); the Inbox nav item (I2); live refresh (I5); Home without the checklist (H1 to H3); Inbox (I4); Home replaces today's `/spaces` page and its shortcuts into `/admin` (H3).

## TTFB baseline (filled from PR 1c-0)

**How the number gets here** (operator decision, 2026-11-21). PR 1c-0 branches from `main` and ships only the scripts; this file is not on `main`. After T3, the 1c-0 builder (or the orchestrator) fills the table below by a docs commit on `docs/portal-phase-1c-plan` while the plan PR is open: `docs(plan): phase 1c TTFB baseline`. If the plan PR has merged by then, the same table edit goes in a one-line docs PR from `main`. The same numbers go in the ledger (`/home/salah/cilas-portal-run/LEDGER.md`, phase 1c row). The perf gate (G) reads the table from this file on `main` once the plan PR has merged, and from the ledger before that. Raw samples go in a 1c-0 PR comment, linked from its PR body.

| Role (account id) | Ref and SHA | `/en/spaces` TTFB p50 | p75 | p95 | Full response p75 | Samples | Date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| admin (_id_) | `main` _sha_ | | | | | 30 | |
| fellow (_id_) | `main` _sha_ | | | | | 30 | |
| student (_id_) | `main` _sha_ | | | | | 30 | |
| admin, fellow, student | PR C head _sha_ (context only) | | | | | 30 each | |

**The gate number is the `main` row of each role.** That is "today's `/spaces`" as the spec says. If PR C has merged when T2 runs, `main` holds the shell, and the PR C row is not needed. If PR C has not merged, the PR C row shows what the shell alone adds; it does not gate. But 1c-2 and 1c-3 build on PR C, so the shell's cost is inside their head numbers. So T3 compares the PR C row with the predicate of the perf gate (G) at once: if the PR C p75 of any role is above its `main` p75 (or at 800 ms or more when `main` is under 800 ms), T3 reports it to the operator before 1c-2 starts, because 1c cannot pass the gate without shell work (Open question Q8). Default until the operator answers: the gate stays the `main` row.

**What the number covers.** `(home)/loading.tsx` streams the page under the layout, so the first byte waits for the root layout and `(portal)/spaces/layout.tsx` (`currentReader`, `mySpaces`), not for the page's cards. From 1c-2 the layout also starts `needsCounts`, but it does not await it (Global Constraints, counts never hold the first byte). So TTFB measures the layout. The full-response time (`time_total`, the whole streamed HTML) shows the cards and the streamed counts. Both are recorded. Only TTFB gates (spec).

---

## PR 1c-0. TTFB baseline (`portal/phase-1c-ttfb`)

From `main`. No app code. Runs on the Mac only. Reviews: code-review of the two scripts.

### Task T1: The probe script

**Skills:** tdd (the percentile function).

**Files:** Create `scripts/ttfb-probe.mjs`.

**Interfaces:**

- Produces: `node scripts/ttfb-probe.mjs --base http://localhost:<port> --path /en/spaces --cookies <file> --warmup 5 --samples 30` where `<file>` is JSON `{ "<role>": "<payload-token cookie value>" }`. For each role, in order: 5 warm-up requests (not recorded), then 30 sequential requests (concurrency 1), each `curl -s -o /dev/null -w '%{http_code} %{time_starttransfer} %{time_total}' -H 'Cookie: payload-token=…'` through `node:child_process` `execFileSync`. A status other than 200 exits 1 with the role and status (a redirect to login means the cookie failed). The first recorded sample per role also saves the body (`-o <scratch>/ttfb-<role>.html`) and exits 1 when it holds no `data-page="spaces"` (the spaces frame on `main` and the shell on PR C both carry it), so a 200 from an error page or an empty page cannot pass. Prints one JSON line per role: `{ role, samples: [[ttfb, total], …], p50, p75, p95, totalP75 }` in milliseconds, rounded to 1 ms.
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
  It picks only accounts with `activated_at` set. It sets one random password on the three (`payload.update`, `overrideAccess: true`, on the copy only), logs each in with `payload.login`, and writes `{ admin, fellow, student }` cookie values to a file in the scratchpad. What these writes trigger (read at `57248c77`): the password update runs `ensurePerson` and `syncFellowRoleOnLink` (both return at once: the account has a person or is an admin, and the write sends no `person`) and `announceAcceptance` (returns at once: it acts only on a first sign-in of an invited account, `src/lib/invitation.ts:69-87`); the login runs `markActivated`, which writes nothing for an account that has `activated_at` (`invitation.ts:40-60`). So no notification row and no mail. As a second guard, the script exits 1 when `RESEND_API_KEY`, `VAPID_PRIVATE_KEY` or any `TYPESENSE_` key is set in its env, and the server of Step 3 starts with the same keys unset. Cookies expire (Payload's default token life is 2 h): run this script again before each probe run (T3, I7 perf, H5).

- [ ] **Step 1: The copy.** On the Mac, inside `verify.sh`'s lock (P17): `createdb -T cilas_dev cilas_ttfb` (a template copy; nothing writes `cilas_dev`). `createdb -T` fails while another session is connected to `cilas_dev`; then use `createdb cilas_ttfb && pg_dump -Fc cilas_dev | pg_restore --no-owner -d cilas_ttfb`. `ttfb-accounts.ts` has its own name check, and no seed runs.
- [ ] **Step 2: Accounts.** `DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_ttfb pnpm exec tsx scripts/ttfb-accounts.ts --out <scratch>/ttfb-cookies.json`. Expected: three ids printed; the file holds three non-empty values.
- [ ] **Step 3: Production build.** In a fresh Mac worktree at the ref under test: `next build`, then `pnpm start` on a free local port, with the Mac worktree's env, `DATABASE_URL` pointed at `cilas_ttfb`, and the mail, push and search keys unset, while `verify.sh`'s lock is held (P17). Never `next dev`: dev compiles on request, so its TTFB measures the compiler. If `verify.sh` has a mode that serves a production build (P17), use it. Commit the script.

### Task T3: Measure and write the number

**Skills:** none beyond the above (benchmark-checklist from pstack applies to the number).

- [ ] **Step 1:** `node scripts/ttfb-probe.mjs --base http://localhost:<port> --path /en/spaces --cookies <scratch>/ttfb-cookies.json --warmup 5 --samples 30` on `main`. If PR C has not merged, build PR C's head and run again (the "context only" row). Nothing else heavy runs on the Mac during a run: check that `verify.sh`'s lock is held by this run only.
- [ ] **Step 2: Explain the number.** For each role, a p95 above 3x its p50 means noise or a cold path: rerun once and record both runs. Write in the PR what bounds the number (inferred from the layout's reads: `currentReader`, `mySpaces`).
- [ ] **Step 3:** Write the numbers in a PR comment (raw samples) and in the PR body (the table rows). Open `chore(portal): TTFB probe and the /spaces baseline (portal phase 1c, PR 0)`. Then fill the baseline table in this plan by the docs commit that "TTFB baseline" names, and add the rows to the ledger. Keep `cilas_ttfb` for the perf gate (G) in 1c-2 and 1c-3 (same data, same accounts); drop it after H5 (`dropdb cilas_ttfb`).

**Verification.**

- [ ] unit: `--self-test` passes.
- [ ] live: three roles each give 30 samples with status 200 against a production build on `cilas_ttfb`. Pass predicate: the plan's baseline table (docs commit) and the ledger have a p75 for each role, and the PR comment holds the raw samples.
- [ ] perf: this PR is the baseline. Its number is the trunk baseline for the perf gate (G).

---

## PR 1c-1. Needs core (`portal/phase-1c-needs`)

From `portal/phase-1b-list-data` (1b-2a) once it holds the 1b-1 head (P25; else the merge fallback there). Checks P1 to P7, P24 to P26 first. No screen, no message key. Reviews: code-review, then security-review.

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

### Task N2: One candidate reader, the review rows and `countReviewQueue`

**Skills:** tdd, payload, codebase-design (the moved module's interface).

**Files:** Create `src/lib/review-candidates.ts`, `src/lib/review-candidates.int.test.ts`, `src/lib/review-queue.int.test.ts`, `testing/needs.fixture.ts`. Modify `src/portal/lists/rows.ts` (Step 1), `src/lib/review-queue.ts`, `src/components/admin/dashboard/quick-actions.tsx` (one line, Step 3).

**Interfaces:**

- Consumes: `KEY_WHERE`, `KEY_SELECT`, `statusSelect`, `statusInputOf`, `statusOf`, `waitsOn`, `LIVE_COPY` (P1, P2); `REVIEWED` (`src/lib/reviewed-collections.ts`); `relId` (`src/lib/relation.ts`); 1b-2a's reads in `rows.ts` (P7).
- Produces (`src/lib/review-candidates.ts`, server only, imports nothing from `src/portal`). One reader for 1b's lists and 1c's needs (Decision log P2):
  - `type ReadAccess = { user: User; overrideAccess: false } | { overrideAccess: true }`. The only `overrideAccess: true` caller is the admin queue (Deviation 17).
  - `candidateIds(payload, { collection, keys, base, access }): Promise<number[]>`: 1b-2a's `workCandidates` (`rows.ts:226` at `b9c2080e`) with `withoutParentStatus` (`:215`), moved, with its rule unchanged: the main rows of the keys whose `KEY_WHERE` row is `on: 'main'` (one `find`, `and: [base, { or }]`, `select: { id: true }`), and the parents of the version rows (one `findVersions` with `or` of the version rows, or `LIVE_COPY` when a key has no row, each with `parent._status` left out), both in one `Promise.all`, `depth: 0`, `pagination: false`. One addition (code review L-6): when `base` is not empty, the version parents pass one more `find` with `and: [base, { id: { in: parents } }]`, `select: { id: true }`, so a count of the candidates holds only rows inside `base` (1b plan, Owner lists filter by owner); in 1b-2a that check happens later, in `readEntries`, which a count does not run. With an empty `base` (the admin queue) that `find` is skipped, and no `and` holds an empty `{}`: a version candidate of a parent that is not live is still a document that waits on the same side (`statusOf` reads its latest version, and a copy at `submitted` reads `submitted`), so the admin set does not change. Distinct ids, sorted.
  - `keyedRows(payload, { collection, ids, base, access, select, locale }): Promise<Map<number, { id; main; latest; key: StatusKey }>>`: 1b-2a's `readEntries` with `readMains`, `readLatest` and `newestPerParent` (`rows.ts:137-206` at `b9c2080e`), moved. It reads `KEY_SELECT` plus the caller's `select`, keeps the newest `updatedAt` per parent, and reads the full reviewed fields (`statusSelect`) only for a live row with a draft copy, so `statusOf` never throws (P3). `rows.ts` passes `{ tier: true, cover_image: true }` as today; 1c passes the owner field (`authors` or `fellows`).
  - `rows.ts` keeps its own `Ctx` and calls the two functions. No other change in `rows.ts`.
- Produces (`src/lib/review-queue.ts`). One rule for the admin queue (spec review M-1): the queue is the set `candidateIds` gives for `waitingKeys('admin')` with an empty `base`, per `REVIEWED` collection.
  - `adminQueueIds(payload): Promise<Record<ReviewedCollection, number[]>>`: that set, the three collections in one `Promise.all`, `access: { overrideAccess: true }`.
  - `countReviewQueue(payload): Promise<number>`: the sum of the sizes of `adminQueueIds`. The dashboard tile calls it (Step 3).
  - `adminReviewRows(payload, ids: Record<ReviewedCollection, number[]>, locale): Promise<Array<{ collection; kind: QueueKind; id; key: StatusKey; title: { en: string | null; ar: string | null }; owners: string[]; since: string }>>`: `keyedRows` for exactly those ids, then one `find` of `people` for the owner names (`id in`, `select: { name: true }`, `depth: 0`, `locale`). It does not read candidates again: callers pass the set from `adminQueueIds`, so the count and the rows of one request come from one read (`workOf`, N5). Each row's `key` comes from `statusOf`. An id whose key does not wait on the admin is a `KEY_WHERE` drift: it is left out, and one `payload.logger.warn` names the collection, the id and the key. Nothing else filters. `since` is the latest version's `updatedAt` (the submit write), else the main row's. Oldest first.
  - `getReviewQueue(payload)` is `adminReviewRows(payload, await adminQueueIds(payload), 'en')` mapped to today's `QueueItem` (same fields; `removal` is `key === 'published_removal'`; `title` in English first, as today reads `title` with no locale). Its caller `src/components/admin/review-queue.tsx` does not change.
- Produces (`testing/needs.fixture.ts`): `needsWorld(payload, track, world)`. It calls `listWorld(payload, track, world)` (P26), which gives one student-owned article for every status key (among them `draft`, `submitted`, `published_edits`, `published_removal`, `changes_requested`, `published_edits_returned`, `rejected`, `published_edits_declined`, `published_removal_kept`, `published`), and adds only what 1c needs, through `trustedWrites` (P26) and no copy of its bodies: the course keys `listWorld` does not make (`submitted`, `changes_requested`, `published_removal`, owned by `world.accounts.fellow`), one publication at `submitted` (a `payload.create` and the submit write, `overrideAccess: true`, as the 1b fixture writes), and the applicants rows: one course application with two course choices (one decision `null`, one `pending`), one programme application, and one course choice `accepted`. Returns every id, by collection and key.

- [ ] **Step 1: Move the reads** (P7). Move `workCandidates` (with `withoutParentStatus`) and `readEntries` (with `readMains`, `readLatest`, `newestPerParent`) from `rows.ts` to `src/lib/review-candidates.ts` as `candidateIds` and `keyedRows`, with the interfaces above, and add the base filter on version parents. `rows.ts` calls them. Run **[verify]** `src/portal/lists/rows.int.test.ts` (with the next group, P17): PASS, unchanged. Commit `refactor(review): one candidate reader for lists and needs`.
- [ ] **Step 2: Failing int tests** **[verify]** (`src/lib/review-queue.int.test.ts`, Int test setup; read by the fixture's ids, never by table counts):
  - "adminReviewRows holds one row per waiting document": with `ids` limited to the fixture's ids (`adminQueueIds` intersected with them), the rows' ids equal the fixture's `submitted`, `published_edits`, `published_removal` documents of the three collections, each once.
  - "getReviewQueue keeps its shape": each item has `kind`, `id`, `title`, `removal`, `by`, `since`, `href` as today; `removal` is true only for `published_removal`.
  - "the admin queue set is the admin rows, for every state" (spec review M-1): for each fixture document, in every collection, it is in `adminQueueIds` if and only if it is in `adminReviewRows` for that set. The fixture holds every admin key and the near misses: a live document with a copy at `changes_requested` (`published_edits_returned`), declined edits, a kept removal, a `rejected` one, a `published` one with an equal copy, and a `draft` one. No drift warning is logged (spy on `payload.logger.warn` through a thin proxy of `payload`, no mock library).
  - Run: FAIL (functions missing).
- [ ] **Step 3: Implement** `adminQueueIds`, `countReviewQueue`, `adminReviewRows`, and move `getReviewQueue` onto them. Delete the old two queries and `namesOf`. `quick-actions.tsx:36` calls `countReviewQueue(payload)` in place of `(await getReviewQueue(payload)).length` (code review L-7: the tile reads the same rule). Run **[verify]**: PASS; `src/lib/publishing.int.test.ts` and any test of `src/components/admin/review-queue.tsx` still pass. Commit.
- [ ] **Step 4: Owner path int test** **[verify]** (`src/lib/review-candidates.int.test.ts`): "an owner's candidates are their own waiting rows only" (student: the fixture's two owner-waiting articles; another member: none; a co-author removed in the copy: no `published_edits_returned` candidate for them, 1b U4); "a version parent outside base is not a candidate" (the base filter of Step 1). PASS. Commit.

### Task N3: The owner sources

**Skills:** tdd, payload.

**Files:** Create `src/portal/needs/owner-rows.ts`. Modify `src/portal/needs/needs.int.test.ts` (new in this task).

**Interfaces:**

- Consumes: `candidateIds`, `keyedRows` (N2); `ownsViaAuthors`, `ownsViaFellows`, `personOf` (P5); `documentHref` (P4); `waitingKeys`, `KIND_OF_KEY`, `VERB_OF` (N1).
- Produces: `ownIds(payload, user, collection: 'articles' | 'courses'): Promise<number[]>`: no person gives `[]` with no query; else `candidateIds` with `keys: waitingKeys('owner')`, `base: ownsVia…(user)`, `access: { user, overrideAccess: false }`. `ownRows(payload, user, collection, ids, locale): Promise<NeedRow[]>`: `keyedRows` for `ids` (same `base` and access), then one row each: `kind` from `KIND_OF_KEY`, `href: documentHref({ collection, id, viewer: 'owner', waiting: false, locale })`, `label`: the latest version's title in `locale`, else the other locale, else null (1b Deviation 8), `count: 1`, `owners: []`. The same drift rule as N2: an id whose key does not wait on the owner is left out and logged.
- [ ] **Step 1: Failing int tests** **[verify]**: "a student's needs hold their changes_requested and returned-edits articles"; "a declined article is not in needs(owner)" (spec); "declined edits and a kept removal are not in needs(owner)"; "a member with no person has no rows and runs no query" (a synthetic user, as `src/lib/publishing.int.test.ts:399`, and a thin proxy of `payload` that counts `find` calls: 0); "a publication with changes requested is not in needs(owner)" (spec, D16). FAIL, implement, PASS. Commit.

### Task N4: `countWaitingApplicants`

**Skills:** tdd, payload.

**Files:** Modify `src/forms/applicants.ts`, `src/forms/applicants.int.test.ts` (add a describe).

**Interfaces:**

- Consumes: `applicantViewer` (`src/forms/applicants.ts:12`).
- Produces: `countWaitingApplicants(payload, user): Promise<{ total: number }>` (Deviation 3). `applicantViewer(user)` null gives `{ total: 0 }` with no query. Share the rule, not the read (code review L-5): `applicantsFor` reads courses with `depth: 1`, `populate` and `locale` (`:39-52`), so a shared read would serve neither. Move only the `where` into one local function `viewerCoursesWhere(viewer): Where | undefined` (`fellows contains person` for a fellow, none for an admin) that both `applicantsFor` and the count use. The count reads course ids with that `where`, `select: { id: true }`, `depth: 0`, `pagination: false`, `overrideAccess: true`. A fellow with no course gives `{ total: 0 }` and no submissions read (`ids.length === 0`). An admin keeps reading with an empty `ids` list, because a programme application has no course, but the count of course choices is then 0 with no submissions read. Then one `find` of `form-submissions` narrowed in the database (code review M-7): `where: { and: [{ 'choices.course': { in: ids } }, { or: [{ 'choices.decision': { equals: 'pending' } }, { 'choices.decision': { exists: false } }] }] }`, `select: { choices: { course: true, decision: true } }`, `depth: 0`, `pagination: false`, `overrideAccess: true`. The `where` only narrows: an array field matches when any one choice matches, so the reduce stays the rule: one per choice whose course is in `ids` and whose `decision` is null or `pending`. A programme application counts 0 (spec). If N7 measures this read above half of its 150 ms line, the grouped SQL through the pool (as `claimDigest`, `src/lib/space-digest.ts:170`) replaces it in 1c-1, with the same tests.
- [ ] **Step 1: Failing int tests** **[verify]** (spec, Tasks, Tests; read by the fixture's course ids): "counts 2 for one applicant with two waiting course choices"; "counts 0 for a programme application"; "counts a null decision as waiting"; "an accepted choice does not count"; "a submission whose choices are all decided is not read" (the narrowing); "a fellow counts only the courses they teach"; "a student counts 0 and runs no query". FAIL, implement, PASS; the existing `applicants` int specs (`applicants.int.test.ts`, `applicants-data.int.test.ts`) still pass. Commit.

### Task N5: `needs(user, locale)` and `needsCounts(user)`

**Skills:** tdd.

**Files:** Create `src/portal/needs/needs.ts`. Modify `src/portal/needs/needs.int.test.ts`.

**Interfaces:**

- Consumes: N1 to N4; `cache` (`react`).
- Produces (pure functions, which the tests call):
  - `type WorkSets = { reviewQueue?: Record<ReviewedCollection, number[]>; applicants?: number; ownArticles?: number[]; ownCourses?: number[]; failed: NeedSource[] }`.
  - `workSetsOf(payload, user): Promise<WorkSets>`: each source of `SOURCES_OF(user)` in `Promise.allSettled`. `reviewQueue`: `isAdminUser(user)` is checked again here, before `adminQueueIds` (a projection read, Deviation 17); a non-admin never reaches it. `applicants`: `countWaitingApplicants(payload, user).total`. `ownArticles`, `ownCourses`: `ownIds`. A rejected source logs the error with the source name and lands in `failed` (spec, Errors).
  - `type NeedsCounts = { total: number | null; by: Partial<Record<NeedSource, number | null>> }`. `countsOf(sets): NeedsCounts`: the sizes (the applicants number as is). A failed source is `null` in `by`, and then `total` is `null` (spec: "the count then shows no number, not a wrong one").
  - `type NeedsResult = { rows: NeedRow[]; failed: NeedSource[] }`. `rowsOf(payload, user, sets, locale): Promise<NeedsResult>`: `adminReviewRows(payload, sets.reviewQueue, locale)` mapped to rows (`href` from `documentHref({ collection, id, viewer: 'admin', waiting: true, locale })`, `owners` the names); the applicants row when `sets.applicants > 0`: `{ kind: 'applicants', verbKey: 'needs.applicants', href: '/admin/applicants', label: null, count: sets.applicants, owners: [], collection: null }` (Deviation 5, P29); `ownRows` for each owner set. A rows step that throws adds its source to `failed`. Rows sort: the admin's review rows oldest first, then the applicants row; an owner's rows by the latest version's `updatedAt`, oldest first.
  - `needsTotal(result): number | null`: the sum of `count`, or null when `failed` is not empty. Home and the Inbox page read it.
  - `needsOf(payload, user, locale)`: `rowsOf(payload, user, await workSetsOf(payload, user), locale)`.
- Produces (cached, which the layout and the pages call; one read per request, Global Constraints):
  - `workOf = cache(async (user: User) => workSetsOf(await getPayload({ config }), user))`.
  - `needsCounts = cache(async (user: User) => countsOf(await workOf(user)))`.
  - `needs = cache(async (user: User, locale: Locale) => rowsOf(await getPayload({ config }), user, await workOf(user), locale))`.
- [ ] **Step 1: Failing int tests** **[verify]** (spec, Tasks, Tests, on `needsWorld`; the database is shared, so each assert reads the fixture's ids or one `WorkSets` value, never two table reads):
  - "the rows of needs(admin) hold every fixture document that waits on the admin, plus one applicants row" (rows with a fixture id equal the fixture's admin-waiting ids; one row of kind `applicants`). The spec's whole-table equality (total of `needs(admin)` equals `getReviewQueue().length` plus the pending course choices) runs on the frozen prod clone in N6, where no other test writes (code review M-5).
  - "countsOf and rowsOf of one WorkSets agree for each role" (admin, fellow, student): `countsOf(sets).total === needsTotal(await rowsOf(payload, user, sets, locale))`, and `by.ownArticles` equals the article rows. This is the spec's "needsCounts(user) equals the total of needs(user)", on one read, so a write by another test file cannot make it flake.
  - "a non-admin never reads the admin queue" (code review M-4, spec review L-3): for the student, the fellow and a member with no person, `workSetsOf` holds no `reviewQueue`, `rowsOf` holds none of the fixture's admin-waiting ids, and a thin proxy of `payload` records no `find` or `findVersions` call with `overrideAccess: true`. A user whose `roles` array holds a string that is not a role (for example `'Admin'`) gets the same result (the rule is `isAdminUser`, not a string compare in `needs`).
  - "a source that fails leaves the others" (a thin proxy of `payload` whose `find` on `form-submissions` throws; no mock library): `failed` is `['applicants']`, the review rows remain, `needsTotal` is null, `countsOf(...).total` is null.
  - FAIL, implement, PASS. Commit.

### Task N6: The prod-clone check

**Skills:** payload.

**Files:** Create `scripts/needs-check.int.test.ts`.

**Interfaces:**

- Produces: a vitest int file in the `node` project (P24: `server-only` resolves there, not under `tsx`). It is gated as `src/lib/community-search.int.test.ts:16` gates its disposable search: `describe.skipIf(!onNeedsCopy)`, where `onNeedsCopy` is true only when `DATABASE_URL` ends in `@localhost:5433/cilas_needs`. So the full suite on `cilas_dev` skips it, and it never runs on `cilas_dev`. It reads only and writes nothing. `cilas_needs` is a frozen copy of the Mac's local prod clone, made as T2 Step 1 makes `cilas_ttfb` (the 1b builders' int tests write to `cilas_dev` while it runs). Drop `cilas_needs` after N7. It computes:
  1. `oracleQueue`: a frozen copy of trunk's `getReviewQueue` algorithm (`src/lib/review-queue.ts` at `57248c77`, lines 30-56: per collection the main `find` with `review.status: submitted` and the `findVersions` with `latest` and `version.review.status: submitted`, joined by id), written inline in the file with that SHA in a comment. It does not import `src/lib/review-queue.ts`.
  2. `oracleChoices`: from `applicantsFor(payload, { kind: 'admin' }, 'en')`, the number of entries in each application's `choices` whose `decision` is `pending`. Programme applications are left out: `applicantsFor` gives a programme its own `pending` decision (`src/forms/applicants.ts:167-173`), and the spec counts course choices only.
  3. For the admin of T2's rule (smallest admin id, read with `payload.findByID`, no sign-in): one `sets = await workSetsOf(payload, admin)`, then `needsTotal(await rowsOf(payload, admin, sets, 'en'))`, the row ids per collection, and `countsOf(sets).total`.
  It prints the clone's source (the dump file name and its date, from `ls -l` of the dump the Mac restored), the four numbers, and two id lists: in the oracle and not in `needs`, in `needs` and not in the oracle.
- **Pass predicate** (each an `expect`, so a difference fails the test): `oracleQueue.length > 0` and `oracleChoices > 0` (a check with nothing to compare proves nothing, spec review M-2; when the clone truly has none, the run fails and the PR says so, and the operator decides); `needsTotal === oracleQueue.length + oracleChoices`; `countsOf(sets).total === needsTotal` (the count and the rows of one read agree on real data, so no drift warning); both id lists are empty. A difference is not fixed by changing the check: each id goes in the PR with its `statusOf` key, and the builder decides with the reviewer whether trunk's queue or `waitsOn` is right (for example a live document whose main row says `submitted`; the old queue lists it, `KEY_WHERE.submitted` needs `NOT_LIVE`).
- Note: the admin dashboard tile "Applications waiting" counts submissions with status `new`, programmes included (`src/components/admin/dashboard/widgets/applications.tsx`). It is not the oracle: the spec counts pending course choices. The PR writes both numbers so the operator sees why they differ.

- [ ] **Step 1:** On the Mac, in the 1c-1 worktree, inside the lock (P17), with the mail and search keys unset: `flock <lock> env DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_needs pnpm exec vitest run --project node scripts/needs-check.int.test.ts`. Do not use `verify.sh --int-only` for it: that mode ignores the file and would run the whole int suite against `cilas_needs` (P17). If P17 shows `verify.sh` runs one file and keeps the caller's `DATABASE_URL`, `verify.sh --int-only <branch> <sha> scripts/needs-check.int.test.ts` with that `DATABASE_URL` is the same command. Expected: 1 test file, PASS. Paste the output in a PR comment. Commit the file.

### Task N7: Cost per role, review, full suite, open PR 1c-1

**Skills:** code-review, then security-review.

- [ ] **Step 1: Cost before any cache** (spec, Tasks, Tests). A second `describe` in `scripts/needs-check.int.test.ts`, gated the same way and also on `NEEDS_COST=1`: for the three accounts of T2's rule (read with `payload.findByID`, no sign-in), call each source's set read (`adminQueueIds`, `countWaitingApplicants`, `ownIds`) and rows read (`adminReviewRows`, `ownRows`), and `workSetsOf` and `rowsOf` as a whole, 20 times after 3 warm-up calls, and the trunk oracle queue the same way. Print p50 and p75 per role and function in ms, nearest rank (T1's rule). Command: Step 1 of N6 with `NEEDS_COST=1` added. Write the table in the PR.
- [ ] **Step 2: code-review** against the base, with the spec's Tasks section as the issue. It checks that `workOf` is the only caller of the candidate reads in `src/portal/needs/` (the one-read rule).
- [ ] **Step 3: security-review.** Write in the PR: `adminQueueIds` and `adminReviewRows` read with `overrideAccess: true` and every caller checks `isAdminUser` first (`workSetsOf`, the admin pages that call `getReviewQueue` and `countReviewQueue`); owner reads are gated and add the ownership `where`; `countWaitingApplicants` reads `form-submissions` only inside `src/forms/applicants.ts` and returns a number only; no new endpoint; `rg -l "@/portal/" src/lib src/components src/forms src/i18n` prints nothing.
- [ ] **Step 4:** Fix. **[verify]** the full suite. Per-PR step 5. Open `feat(portal): needs(user), needsCounts(user) and one candidate reader (portal phase 1c, PR 1)`. Blast Radius: the admin review queue page and the dashboard tile read the new rows and count; N6 shows they list the same ids as trunk on the prod clone; `rows.ts` calls the moved reads and its tests pass unchanged.

**Verification.**

- [ ] unit: `sources.unit.test.ts`; int: `review-queue.int.test.ts`, `review-candidates.int.test.ts`, `needs.int.test.ts`, the `applicants` count cases, `rows.int.test.ts` unchanged.
- [ ] live: N6 on the prod clone. Pass predicate: the N6 predicate (non-empty oracle, equal totals, empty id lists). Also open `/admin` as the admin on the Mac dev server and see that the "Reviews waiting" tile equals `oracleQueue.length`.
- [ ] perf: metric p75 ms per function and role (N7 Step 1). Trunk baseline first: the oracle queue (trunk `getReviewQueue`) timed in the same run. Fails when `adminQueueIds` plus `adminReviewRows` p75 is more than 1.5x the oracle's p75, or when `workSetsOf` p75 (what every portal page streams) is above 150 ms for any role.

---

## PR 1c-2. Inbox, counts and live refresh (`portal/phase-1c-inbox`)

From `portal/phase-1a-shell` (PR C) with 1c-1 merged in. Checks P8 to P13, P19, P22, P23, P26 to P29 first. Read "Order with 1b-2b" first. Reviews: ux-auditor and better-interface on the Inbox page and the sidebar counts, then break-ui; code-review, then security-review (review predicate, Global Constraints).

### Task I1: Fixture for the portal e2e

**Skills:** tdd.

**Files:** Modify `testing/portal.fixture.ts` (add `portalNeedsWorld` through a new export only; existing exports do not change), `testing/portal-lists.fixture.ts` (export `makeAccount` only), `testing/portal-e2e.test-utils.ts` (add `/spaces/inbox` to a shape table; add `inbox` to `NAV_BY_ROLE` for every role, in nav order, after `home`).

**Interfaces:**

- Consumes: `needsWorld` (N2), `portalWorld`, `notifyOf` (P26).
- Produces: `portalNeedsWorld(payload, track)`: `portalWorld` plus `needsWorld` owned by its accounts, so the e2e admin sees a known review set on top of whatever `cilas_dev` holds. The e2e therefore asserts "the Home count equals the sidebar number" and the rows of the fixture's ids, never a fixed total. It also writes, through `notifyOf` (P26), one notification for each role whose `link` is a post of the fixture's space (for the Latest rows), and 34 more for the student, each awaited in turn so `createdAt` grows (35 in all, for **Show more**). The second-session test submits `listWorld`'s student-owned `draft` article (P26), so the fixture needs no new article for it. `PortalWorld` has one admin (`accounts.admin`, PR C `testing/portal.fixture.ts:63`), so `portalNeedsWorld` adds `secondAdmin`, an account with `['admin']` and the fixture's password, for the stale-count test. `testing/portal-lists.fixture.ts:28` has a `makeAccount` that is not exported: export it there in one line (1b-2a's file; say so in the PR) rather than write a second copy.
- [ ] **Step 1:** `testing/portal.fixture.int.test.ts` gains "portalNeedsWorld gives the student two owner rows and 35 notifications" **[verify]** (with the I-group run, P17). FAIL, write, PASS. Commit.

### Task I2: The Inbox nav item and the streamed counts

**Skills:** tdd, modern-web-guidance (first), arc.

**Files:** Modify `src/portal/nav/portal-nav.ts`, `portal-nav.unit.test.ts`, `nav-icons.ts`, `portal-shell.tsx`, `src/app/(frontend)/[locale]/(portal)/spaces/layout.tsx`, `messages/{en,ar}.json` (`Portal.nav.inbox`). Create `src/portal/nav/nav-counts.tsx`, `src/portal/nav/nav-counts.dom.test.tsx`.

**Interfaces:**

- Consumes: `needsCounts`, `NeedsCounts` (N5); `currentReader` cached (P28).
- Produces:
  - `PortalNavItem.key` adds `'inbox'`; `PortalNavIcon` adds `'inbox'` (lucide `Inbox`). `portalNav(user)` keeps one argument (spec; Deviation 14); its items keep `count: null`. Order: Home, Inbox, then the rest as before.
  - `src/portal/nav/nav-counts.tsx` (`'use client'`): `COUNT_OF: Partial<Record<PortalNavItem['key'], (c: NeedsCounts) => number | null>>`, one table: `inbox` gives `c.total`; when P15 holds, `articles` gives `c.by.ownArticles ?? null` and `courses` gives `c.by.ownCourses ?? null` for owners (admin: no row, spec). `NavCountsProvider({ counts, children })` holds `counts: Promise<NeedsCounts | null>` in a context. `useNavCount(key): number | null` reads the context with `use()` and applies `COUNT_OF[key]`; no context or a `null` value gives `null`.
  - The layout: `const counts = needsCounts(user).catch((err) => { payload.logger.error({ err }, 'portal nav: the counts did not load'); return null })`, with no `await`, passed to `PortalShell` as `counts`. `PortalShell` wraps its output in `NavCountsProvider`. The layout's `Promise.all` does not change (Global Constraints, counts never hold the first byte).
- [ ] **Step 1: Failing tests.** `pnpm exec vitest run --project node src/portal/nav/portal-nav.unit.test.ts`: "Inbox is the second top item for $role"; "portalNav takes one argument and every item's count is null". `pnpm exec vitest run --project dom src/portal/nav/nav-counts.dom.test.tsx`: "useNavCount('inbox') is the total"; "a null counts value gives null on every item"; "a rejected promise never reaches use()" (the layout's `.catch`: the provider gets `null`); with P15, "an admin's Articles and Courses give null". FAIL, implement, PASS. Commit.
- [ ] **Step 2: The first byte does not wait.** `rg -n "await needsCounts" "src/app/(frontend)/[locale]/(portal)"` prints nothing. Write the command and its empty output in the commit message.

### Task I3: Count chips on nav rows

**Skills:** modern-web-guidance (first), arc, better-accessibility, better-typography, tdd.

**Files:** Modify `src/portal/nav/rows.tsx`, `sidebar.tsx`, `shell.module.css`, `sidebar.browser.test.tsx`, `more-sheet.tsx` (the More sheet's rows), `bottom-bar.tsx`, `messages/{en,ar}.json` (`Portal.nav.count`).

**Interfaces:**

- Consumes: `useNavCount` (I2); `unreadCount` (P10).
- Produces: `NavItemRow` renders `<Suspense fallback={null}><NavCount itemKey={item.key} /></Suspense>` after its label. `NavCount` calls `useNavCount`; a number above 0 renders a muted chip (`data-nav-count`, `tabular-nums`, `dir="ltr"`, `aria-hidden`) and visually hidden text, so the link's name is "Inbox, 3 tasks" (`Portal.nav.count`, ICU plural, `{count, number, digits}`; "9+" reads "more than 9", the rule `SpaceRow` uses). Before the promise settles, and for `null` or 0, it renders nothing, so the name is "Inbox". Folded, the chip shows beside the icon and the hidden name is the same (spec, Frame). The bottom bar and the More sheet render the same row, so the phone gets the same name. Colours: the existing muted tokens (`--text-muted` on the L0 tint, 4.5:1 in phase 1a B1's table); no new token.
- [ ] **Step 1: Failing browser test** **[verify]** (`sidebar.browser.test.tsx`; each assert waits for the settled name with `expect.poll` or `findByRole`, because the count streams): "a nav item with 3 tasks is named Inbox, 3 tasks, folded and unfolded"; "12 shows 9+ and reads more than 9"; "0 shows no chip"; "Arabic digits in the chip and the name" (`ar`); "a pending count shows the item with no chip" (a promise that does not settle); "a new counts promise in a transition keeps the old number until it settles" (render with 3, then `startTransition` to a new pending promise: the name stays "Inbox, 3 tasks"; settle it with 4: "Inbox, 4 tasks"). FAIL, implement, PASS. Commit.

### Task I4: Needs you list, Latest list and the Inbox page

**Skills:** modern-web-guidance (first), arc, better-layout, better-typography, better-accessibility, better-writing then humanizer, tdd.

**Files:** Create `src/portal/needs/need-list.tsx`, `src/portal/needs/latest-list.tsx`, `src/portal/needs/latest.ts`, `src/portal/needs/mark-read.tsx`, `src/portal/needs/needs.module.css`, `src/portal/needs/need-list.dom.test.tsx`, `src/portal/needs/latest-list.dom.test.tsx`, `src/lib/notification-glyphs.tsx`, `src/portal/inbox/inbox-page.tsx`, `src/app/(frontend)/[locale]/(portal)/spaces/inbox/page.tsx`. Modify `src/components/site-notifications.tsx` (import the glyph map), `src/lib/notifications-client.ts` (`markRead` option), `messages/{en,ar}.json` (`Portal.needs`, `Portal.latest`, `Portal.inbox`).

**Interfaces:**

- Consumes: `needs`, `needsTotal`, `NeedRow` (N5); `currentReader` (P28); `PortalEmptyState` (P12); `announce` (PR C); `catchError` (P20); `noteText` and `markRead` from `src/lib/notifications-client.ts` (`:32-66` at `57248c77`; already exported; the module has no `'use client'` and nothing at module scope touches `window`, so a server component may import `noteText`); `NOTIFICATION_KINDS`, `isNotificationKind` (`src/lib/notification-kinds.ts`).
- Produces:
  - `src/lib/notification-glyphs.tsx` (no `'use client'`, lucide icons only): `NOTIFICATION_GLYPHS: Record<NotificationIcon, ReactNode>`, the map that is module-local in the bell today (`site-notifications.tsx:47`, a `'use client'` file, so a server component cannot read it). The bell imports it in place of its own `GLYPHS`; no other bell change.
  - `markRead(id, read, { keepalive }?: { keepalive?: boolean })` in `notifications-client.ts`: passes `keepalive` to `fetch`, so a PATCH sent as a plain `<a>` navigates is not cut off (code review M-6). The bell's calls pass no option and do not change.
  - `NeedList({ rows, group }: { rows: NeedRow[]; group: boolean })` (server). Each row is one `<a href>` (Global Constraints, links): the verb (`t(row.verbKey, { count })`), the label in `<bdi dir="auto">` (or "Untitled article" / "Untitled course"), the owner names on admin rows. `group` true (Home with more than 5 rows) collapses rows to one per kind with the sum of `count` and the kind's verb with the number; a grouped `review`, `edit_review` or `removal_review` row links to `/admin/reviews` (P29), a grouped `changes_requested` row to `/{locale}/spaces/articles?show=needsYou` when the group holds an article and to `/{locale}/spaces/courses?show=needsYou` otherwise (1b list filter; while P15 fails those pages do not exist, so the link is `/admin/collections/articles` or `/admin/collections/courses`), `applicants` stays its own row (spec, Tasks, "Where the two lists show"). The list is a `<ul>` under an `<h2>` with the count.
  - `latestRows(payload, user, { limit, locale })` in `latest.ts`: gated `find` of `notifications` (`recipient` equals `user.id`, `sort: '-createdAt'`, `limit`, `depth: 0`, `select` the fields the bell reads, `read_at` included). `LatestList({ rows, more })` (server): each row a plain `<a>` whose `href` is the stored `link`, unchanged (Global Constraints, links; the bell does the same at `site-notifications.tsx:109`); a row with no `link` is text, not a link. The text is `noteText` with the kind's name, and the glyph from `NOTIFICATION_GLYPHS`. An unread row has a dot with hidden text "Unread". `MarkRead` (`mark-read.tsx`, a small eager client island inside each unread row; it is part of first-render rows) calls `markRead(id, true, { keepalive: true })` on the link's `click`, and lets the navigation go on.
  - `/spaces/inbox`: all roles (spec, Routes). `<h1>` "Inbox". Section Needs you (`NeedList`, `group: false`), then section Latest (30 rows, Deviation 11, **Show more** link `?latest=n&focus=latest`). Empty texts (spec, Onboarding): "Nothing needs you now." and "Nothing new yet. Replies, reviews and decisions show here." A failed source shows "Some tasks could not load. Reload." above the rows of the others (spec, Errors). Each section sits in a `catchError` boundary: "This could not load." with **Retry**. The page reads `needs(user, locale)` with the `user` of `currentReader()`, so it shares the layout's read (one read per request).
- [ ] **Step 1: Failing dom tests**: "a row is one link named by its verb and label"; "an admin row names the owners"; "grouped rows sum count per kind and keep applicants apart"; "a grouped changes_requested row with an article links to the Articles list"; "an untitled row says Untitled article"; `latest-list.dom.test.tsx`: "a Latest row links to its stored link unchanged" (an `/admin/applicants?application=4` link and an `/en/spaces/x` link keep their `href`), "a row with no link is not a link", "a known kind uses the bell's words and glyph". FAIL, implement, PASS. The bell's `src/components/notification-feed.browser.test.tsx` still passes (**[verify]**, with the I-group run). Commit.
- [ ] **Step 2: Show more focus.** As 1b L5's `NewRowsFocus` (read it on the base; reuse it if 1b-2b landed, else write the same small part here and say so): focus the first new row, `announce("{n} more rows.")`, take `focus` out of the URL. Dom test "Show more moves focus to the first new row". Commit.

### Task I5: Live refresh

**Skills:** modern-web-guidance (first), tdd.

**Files:** Create `src/portal/needs/work-refresh.tsx`, `src/portal/needs/work-refresh.dom.test.tsx`. Modify `src/portal/nav/portal-shell.tsx` (mount it once).

**Interfaces:**

- Consumes: `subscribeNotifications` (P19); `NotificationKind`, `isNotificationKind` (`src/lib/notification-kinds.ts:57`); `useRouter` (`next/navigation`).
- Produces: `REFRESHES_WORK: Record<NotificationKind, boolean>`: true for `submitted`, `approved`, `changes_requested`, `rejected`, `removed`, `application`; false for every other kind (Deviation 6b; a new kind is a type error until its row is set). `refreshes(event: ClientNotificationEvent): boolean`: `event.op === 'created'` and (`!event.doc`, or `isNotificationKind(event.doc.kind) && REFRESHES_WORK[event.doc.kind]`) (`doc.kind` is a `string`, `src/lib/realtime/events.ts:9`, so it is checked first; code review L-1). `WorkRefresh()` (client, renders `null`): subscribes once; an event where `refreshes` is true, or a `sync`, starts or restarts a 1 s timer; the timer calls `router.refresh()`. Unmount clears the timer and unsubscribes. `router.refresh()` keeps client state (`use-router.md:46`).
- [ ] **Step 1: Failing dom tests** (fake timers are a test tool, not a sleep): "a submitted event refreshes once after 1 s"; "three events in 1 s refresh once"; "an updated or deleted event does not refresh"; "a comment event does not refresh"; "an unknown kind does not refresh"; "an event with no doc refreshes"; "a sync refreshes"; "unmount cancels a pending refresh". FAIL, implement, PASS. Commit.

### Task I6: `portal-home` e2e, Inbox describe

**Skills:** tdd, better-accessibility.

**Files:** Create `e2e/portal-home.e2e.test.ts`, `e2e/portal-home.empty.e2e.test.ts`. Modify `e2e/portal-shell.e2e.test.ts` (the 1c nav assertions read `NAV_BY_ROLE`), and `playwright.config.ts` only if P23 fails (its fallback).

- [ ] **Step 1: Tests** (matrix: role, locale, width; phase 1a Deviation 19 exemptions), `describe('inbox')`. Every count assert waits for the settled name (`expect.poll`), because counts stream:
  - "Inbox shows Needs you, then Latest" (the fixture's rows for the role, in order; each Needs you row link's `href` starts with `/admin/`; Latest holds the fixture's notification, and its `href` equals the stored `link`).
  - "the sidebar Inbox number equals the Needs you count on Inbox" (at 1440 the sidebar, at 390 the bottom bar item's name).
  - "Show more loads 30 more and moves focus" (the student's 35 notifications, I1).
  - "a Latest row opens its link and marks it read": click an unread row (plain navigation). Pass predicate: on the page it opens, the bell's unread count is one less than before the click, polled for 5 s (the PATCH went with `keepalive`).
  - "an owner submits in a second session and the admin's Inbox number changes with no reload" (spec): admin on `/spaces/inbox`; a second browser context, the student, submits `listWorld`'s `draft` article (I1) through the REST write `/admin` sends (`submit-for-review.tsx:62-67`); before the submit the test sets `window.noReloadMark = true` on the admin's page and starts polling the admin's Inbox name every 100 ms. Pass: within 5 s the name reads one more; no poll saw the name with no number once it had one (a refresh does not blank the chip, I3); `page.evaluate(() => window.noReloadMark)` is still `true` (a reload would clear it). After the test it deletes the `submitted` notification rows the submit wrote, by their `link` (the e2e server runs with `RESEND_API_KEY`, `VAPID_PRIVATE_KEY` and the `TYPESENSE_` keys unset, as T2 does, so no mail or push leaves the Mac).
  - "a second admin's number is right after a reload" (Deviation 18): admin A (`accounts.admin`) and admin B (`secondAdmin`, I1) on `/spaces/inbox`; A approves a fixture submission through the REST write the admin sends; B reloads. Pass: B's Inbox name is one less than before. The test states that B's number before the reload may be stale.
  - "a keyboard walk reaches every part of Inbox" (spec, Accessibility baseline, keyboard-only walk): from the top, Tab only. The stops hold, as a subsequence in this order (other shell stops may sit between): the skip link, the Inbox nav item, the first Needs you row, the first Latest row, **Show more** when it shows. No stop repeats before the last (no trap), and each stop's `outline-style` is not `none`.
  - "Inbox at 200% zoom has no horizontal scroll" (the 200% check the operator asked for Home and Inbox): viewport 640x400 with `deviceScaleFactor: 2` (1280x800 at 200%). Pass: `document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth`, and the two section headings and the first row of each section are visible.
  - axe: `axeOver` with the shell's known table gives `{}` on `/spaces/inbox`.
  - `portal-home.empty.e2e.test.ts` on `cilas_empty` (P18, P27; P23 keeps it off the normal run), each role with `EMPTY_ACCOUNTS`: no console error, one `h1`, "Nothing needs you now.", the Latest empty text, and an Inbox nav item with no number.
- [ ] **Step 2: Run** **[verify]** (`verify.sh --e2e-only <branch> <sha> e2e/portal-home.e2e.test.ts e2e/portal-shell.e2e.test.ts`, then the empty spec with `--db empty`). Expected: all pass, and a normal run lists no `*.empty.e2e.test.ts` spec. Commit.

### Task I7: Reviews, full suite, open PR 1c-2

**Skills:** ux-auditor, better-interface (full), then break-ui; code-review, then security-review.

- [ ] **Step 1:** ux-auditor and better-interface on `/spaces/inbox` and the sidebar counts, at 1440 and 390, English and Arabic. Review predicate (Global Constraints).
- [ ] **Step 2:** break-ui: a 120-character Arabic title with no space, an English title on an Arabic page, 0, 1, 9, 10 and 120 tasks, a reader with no person, a failed source, 300 notifications, a count that settles 3 s late. Review predicate.
- [ ] **Step 3:** code-review, then security-review (the layout now starts `needsCounts` on every portal page; the admin check before every projection read; no new endpoint; `MarkRead` uses the existing save path and its access; Latest links are stored values rendered as `href`, so check that only `notifications` rows the reader owns are read). Review predicate.
- [ ] **Step 4: Perf gate (G)** on `/en/spaces` and `/en/spaces/inbox`, base then head, as Global Constraints says. Write both tables in the PR.
- [ ] **Step 5:** Fix. **[verify]** the full suite. Open `feat(portal): Inbox, nav counts and live refresh (portal phase 1c, PR 2)`. Operator review before merge.

**Verification.**

- [ ] unit: `portal-nav.unit.test.ts`, `nav-counts.dom.test.tsx`, `need-list.dom.test.tsx`, `latest-list.dom.test.tsx`, `work-refresh.dom.test.tsx`, `sidebar.browser.test.tsx`.
- [ ] live: on the Mac, with agent-browser headless: the second-session submit scenario of I6. Pass predicate: the admin's Inbox name changes by +1 within 5 s, no poll saw it lose its number, and a `window` marker set before the submit is still there. Also: the probe's saved first-sample body of the perf run (`<scratch>/ttfb-<role>.html`) holds a `data-nav-count` element for the admin (the counts arrived in the same response).
- [ ] perf: the perf gate (G) of Global Constraints, I7 Step 4. Metric TTFB p75 per role on `/en/spaces` and `/en/spaces/inbox`. Trunk baseline: the 1c-0 table's `main` row, with this PR's base run first in the same session for validity. Fails as (G) says: any role's head p75 above that `main` p75, or at 800 ms or more when that number is under 800 ms.

---

## PR 1c-3. Home (`portal/phase-1c-home`)

From `portal/phase-1c-inbox`. Reviews: ux-auditor and better-interface on Home, then break-ui; code-review, then security-review (review predicate, Global Constraints).

### Task H1: `readerCourseIds` and the next session

**Skills:** tdd, payload.

**Files:** Create `src/lib/reader-courses.ts`, `src/lib/reader-courses.int.test.ts`, `src/portal/home/next-session.ts`.

**Interfaces:**

- Consumes: `personOf` (P5); `meetingsOf`, `nextMeeting` (`src/lib/meetings.ts:59, 124`); `cairoDay` (`src/lib/cairo-day.ts`).
- Produces: `readerCourseIds(payload, user): Promise<number[]>` (Deviation 9): gated `find` of `courses` (`fellows contains person`, `select: { id: true }`, `depth: 0`, `pagination: false`) and gated `find` of `enrollments` (`person equals person`, `status equals accepted`, `select: { course: true }`, `depth: 0`, `pagination: false`), the union. No person: `[]`. `nextSession(payload, user, locale): Promise<{ course: { id; slug; title; cover: string | null }; session: { title; date; start_time } ; href: string } | null>`: one gated `find` of `sessions` for those ids (`select: { course: true, title: true, meetings: true, cancelled: true }`). `meetingsOf` numbers sessions per course (`src/lib/meetings.ts:59`), so group the sessions by course, call `meetingsOf` and `nextMeeting(…, cairoDay(new Date()))` per course, and take the earliest result. A meeting carries its session's number, not its title: map it back to the session through the same order (`sessionsInOrder`) to get the title (code review L-2). Then the course row (gated, `select` `title`, `slug`, `cover_image`; the field is `cover_image`, `src/collections/Courses.ts:175`). `href` is the course space when spaces are on and the reader can read it, else `/{locale}/study/{slug}` (Deviation 10).
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
  - "a failed card shows Retry and the others stay": not reachable through the UI with real data; covered by H2's dom test (phase 1a Deviation 19 pattern, stated in the commit).
  - "a keyboard walk reaches every part of Home" (spec, Accessibility baseline): from the top, Tab only. The stops hold, as a subsequence in this order: the skip link, the first Needs you row, the next-session link (or its action), the first space tile when Your spaces shows, the first Latest row, **Open Inbox**. No trap; each stop's `outline-style` is not `none`.
  - "Home at 200% zoom has no horizontal scroll and no lost content" (spec: Home at 320px and at 200% zoom, WCAG 1.4.10): viewport 640x400 with `deviceScaleFactor: 2`. Pass: `document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth`, and each card's heading is visible after `scrollIntoViewIfNeeded`.
  - Every count assert waits for the settled name (`expect.poll`), because the sidebar counts stream (I3).
  - `portal-spaces-off.e2e.test.ts:188`: "spaces off: /spaces loads with no space" now asserts Home's `h1`, the Needs you section, and no "Your spaces" section, in place of the shortcuts section.
  - `portal-shell.e2e.test.ts:500`: the "focused row near the bottom is not covered" test tabs to the last link of the Latest card (or of Needs you when Latest is empty) in place of the last shortcut.
  - Empty seed, each role: no console error, one `h1`, each empty card shows its empty text (spec, Home, Tests).
  - axe on `/spaces`: `axeOver` gives `{}`.
- [ ] **Step 2: Run** **[verify]**: `portal-home`, `portal-home.empty` (`--db empty`), `portal-shell`, `portal-spaces-off`. Expected: all pass. Commit.

### Task H5: The Home TTFB gate

**Skills:** none beyond the probe (benchmark-checklist applies).

- [ ] **Step 1:** Run the perf gate (G) of Global Constraints on `/en/spaces`: on the Mac, `cilas_ttfb` (T3 kept it), the same three accounts with fresh cookies (T2), production builds, inside the lock; this PR's base first, then its head. Write both tables in the PR.
- [ ] **Step 2: Pass predicate:** the one in (G). No other rule applies: there is no noise allowance beyond (G)'s validity check.
- [ ] **Step 3:** If it fails: profile which read grows (the layout's reads, and the Home cards only if TTFB moved, since cards stream below `loading.tsx`), using N7's per-function numbers. Fix that read (for example the SQL fallback for N4) and rerun. No cache is added without the operator's yes (spec: measure before any cache). Drop `cilas_ttfb` after the last run.

### Task H6: Reviews, full suite, open PR 1c-3

**Skills:** ux-auditor, better-interface (full), then break-ui; code-review, then security-review.

- [ ] **Step 1:** ux-auditor and better-interface on Home (spec, Phase 1c Review), 1440, 390 and 320px, both languages, light and dark. Inbox had its review at the 1c-2 head (I7); review it again here only if `git diff --name-only <1c-2 head>..HEAD` lists a file Inbox renders (`src/portal/needs/need-list.tsx`, `latest-list.tsx`, `src/portal/inbox/*`, the nav). So each page has one review at the head that last changed it. Review predicate.
- [ ] **Step 2:** break-ui: a 60-character Arabic first name, no person, 0 and 120 unread spaces, 40 spaces, a course with no cover, a session at 23:30 Cairo, 6 and 60 Needs you rows, a failed card. Review predicate.
- [ ] **Step 3:** code-review, then security-review, review predicate (Home reads are gated; no `/admin` shortcut remains; `rg -n "/admin/" "src/app/(frontend)/[locale]/(portal)" src/portal` lists only `documentHref` results, `/admin/applicants`, `/admin/reviews` and **Open dashboard**).
- [ ] **Step 4:** Fix. **[verify]** the full suite. Open `feat(portal): Home replaces the spaces page (portal phase 1c, PR 3)`. Operator review before merge.

**Verification.**

- [ ] unit: `home-cards.dom.test.tsx`, `reader-courses.int.test.ts`.
- [ ] live: on the Mac with agent-browser headless, as the student of `cilas_ttfb`: Home shows a next session tile whose time matches the course page's session time, and a click on a Latest post row loads the full post page. Pass predicate: same date and time text; URL is the post path and no `dialog` is in the tree.
- [ ] perf: the perf gate (G), H5. Metric TTFB p75 per role of `/en/spaces`, production build, `cilas_ttfb`. Trunk baseline: the 1c-0 table's `main` row, with this PR's base run first in the same session for validity. Fails as (G) says.

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

- P1. The review queue (`review-queue.ts:30-56`) and `waitsOn` are two rules for "what waits on an admin": the queue reads raw `review.status`, `KEY_WHERE` adds `NOT_LIVE` and `LIVE_COPY`. A count from one and a list from the other can disagree. Fix: one set, `adminQueueIds` (the `KEY_WHERE` candidates of the admin keys); `countReviewQueue` is its size, and `adminReviewRows` reads the rows of exactly that set, so `getReviewQueue`, `countReviewQueue`, the dashboard tile and `needs(admin)` share one rule (N2). A row whose `statusOf` key disagrees is logged as drift, and N2's int test and N6 fail on it. The old algorithm survives only as the frozen oracle in `scripts/needs-check.int.test.ts` (N6), so the check is independent of the code it checks.
- P2. Candidate reads ("main rows by `KEY_WHERE`, version rows by `KEY_WHERE`, parents filtered by the base `where`") are already written in 1b-2a's `rows.ts` (`workCandidates`, `readEntries`), and 1c would write them again. Fix: N2 Step 1 moves them to `src/lib/review-candidates.ts` as `candidateIds` and `keyedRows`; `rows.ts` and `needs` both call them (P7, Requests to phase 1b). The 1c fixture calls 1b-2a's `trustedWrites` and `listWorld` and adds only what 1c needs (P26).
- P3. `needs` and `needsCounts` could each list which sources a role has. Fix: `SOURCES_OF(user)` (N1), read by both.
- P4. Which status keys are work could be written by hand in `needs`. Fix: `waitingKeys(side)` derives them from `waitsOn` over `STATUS_KEYS`; `KIND_OF_KEY` is checked by a test against it (N1).
- P5. The courses a viewer may see applicants for are read inside `applicantsFor` only. Fix: `viewerCoursesWhere` in `src/forms/applicants.ts`, used by `applicantsFor` and `countWaitingApplicants` (N4). The rule is shared, not the read, because the two reads need different `depth` and `select`.
- P6. The Home count and the sidebar number come from two functions, and each would read the candidates on its own. Fix: `workOf(user)` reads the sets once per request (React `cache`, keyed on the one `User` object of P28); `needsCounts` is `countsOf` of the sets and `needs` is `rowsOf` of the same sets; `needsTotal` is the one sum for rows; N5 tests that `countsOf` and `rowsOf` of one value agree, and the e2e checks both numbers agree (I6, H4).
- P7. Nav counts could be wired item by item in the layout, and an awaited count would hold the first byte of every portal page. Fix: `COUNT_OF` in `src/portal/nav/nav-counts.tsx` maps a key to its number, and the layout passes the `needsCounts` promise unawaited through `NavCountsProvider`; a later item adds one row (I2, I3). `portalNav(user)` stays a pure list of items.
- P8. A live refresh rule could live inside the bell. Fix: `WorkRefresh` and `refreshes(event)` in `src/portal/needs/` (I5); the bell stays the Latest list.
- P9. "The reader's courses" is needed by Home now and the calendar in 1d. Fix: `readerCourseIds` in `src/lib/reader-courses.ts` (H1), which 1d reuses.
- P10. The old `/spaces` page held its own shortcut list, its spaces-off branch and its CSS. Fix: delete them with the page (H3, Subtract Before You Add); Home composes cards from `src/portal/home/`.
- P11. The bell's glyph map is local to a `'use client'` file, so the server-rendered Latest rows would need a copy. Fix: `src/lib/notification-glyphs.tsx`, read by the bell and `LatestList` (I4). `noteText` already lives in `src/lib/notifications-client.ts` and both read it.
- P12. A Latest row could build its link with locale logic of its own, unlike the bell. Fix: both render the stored `link` unchanged (Global Constraints, links).

Done means: a new kind of work adds one `KEY_WHERE` row (1b) and one `KIND_OF_KEY` row, and the source table test fails until it does; a new nav item with a count adds one `COUNT_OF` row. `src/lib/**` and `src/forms/**` import nothing from `src/portal/**`.

## Carry-overs from phase 1b

- `src/components/bridge/bridge-year.tsx:91` and `src/components/article/article-page.tsx:137` (`courseTypeKey`): PR 1c-4, after 1b-2b ships `courseTypeKey`.
- `adminCreateHref` in the Home shortcuts: disappears. Home has no shortcut list (H3). The other `/admin/.../create` strings (`src/components/admin/dashboard/quick-actions.tsx:15-19`) are admin dashboard code that the spec does not move; they stay.
- Phase 1b Deviation 11 ("Nav counts are `null` in 1b"): ends in 1c-2 or in 1b-2b (Order with 1b-2b).

## Carry-overs to later phases

- Phase 2: set `withdrawn: true` in `REFRESHES_WORK` with M3 (Deviation 6b). `documentHref` gives portal URLs, so Needs you rows of owners and admins move off `/admin` with no change in `needs`. Grouped review rows link to `/spaces/review`.
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
- Formatting: `pnpm format:check` (oxfmt) did not run here (no `node_modules` on this server). The first Mac task runs `pnpm exec oxfmt docs/superpowers/plans/2026-11-21-portal-phase-1c-tasks-home-inbox.md` if the check flags this file.
