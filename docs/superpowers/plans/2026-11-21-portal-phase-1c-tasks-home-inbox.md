# Portal phase 1c: tasks, Home and Inbox. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every reader one list of the work that waits on them (`needs(user)`), one set of numbers from the same rules (`needsCounts(user)`), counts on the sidebar, an Inbox page (Needs you, then Latest), counts that refresh when work changes, and a Home page that replaces today's `/spaces` page and its shortcuts into `/admin`.

**Architecture:** PR 1c-0 ships the TTFB probe script from `main` and measures today's `/spaces` TTFB on the Mac. The number goes into this plan by a docs commit (see "TTFB baseline"). PR 1c-1 adds the data core with no screen: `src/portal/needs/` (`needs`, `needsCounts`, one source table, one cached read of the work sets per request), the candidate and row reads that 1b-2a wrote, moved to `src/lib/review-candidates.ts` so both phases use one reader, `countReviewQueue` and the shared rows in `src/lib/review-queue.ts`, `countWaitingApplicants` in `src/forms/applicants.ts`, and a prod-clone check as a gated int test. PR 1c-2 adds the Inbox page, the Inbox nav item, the counts on nav rows (streamed under a Suspense boundary, so they never hold the first byte), and the live refresh. PR 1c-3 replaces the `/spaces` page with Home. PR 1c-4 moves the two `courseTypeKey` copies that 1b left.

**Tech stack:** Next.js 16.4.6 App Router, React 19.2.6, next-intl 4, Payload 3.91.0 (Postgres), Arc UI (`src/components/arc`), Vitest 4, Playwright 1.58.2, `@axe-core/playwright` (phase 1a PR C).

**Spec:** `docs/superpowers/specs/2026-11-18-portal-design.md`: Phases (Phase 1c), Tasks (`needs(user)` and the bell), Home, Navigation, Architecture (Frame, Routes, Feature folders, Data access rule, Lazy loading rule), Status model (`waitsOn`), Document links, Onboarding (empty states), Tests. The spec wins where they differ, except for the Deviations below.

**Sources read for this plan** (2026-11-21, by reading only; no command ran). Round 2 fixes re-read every head below.

| Source | Ref | SHA |
| --- | --- | --- |
| `main` | `origin/main` | `57248c77` |
| Phase 1b plan (PR #52) | `origin/docs/portal-phase-1b-plan` | `23fb570c` |
| Phase 1b PR 1b-1 code (no PR open yet) | `origin/portal/phase-1b-status` | `c5a65fd6` (drops `parent._status` from `KEY_WHERE` and `LIVE_COPY`, adds `liveParentIds`; P30) |
| Phase 1b PR 1b-2a code (no PR open yet) | `origin/portal/phase-1b-list-data` | `b160b637` (its merge base with 1b-1 is `bd31bf98`, an older 1b-1 head) |
| Phase 1a PR C (#53) | `origin/portal/phase-1a-shell` | `72d8b22f` |
| ADR 0012 (PR #54, not merged) | `origin/docs/adr-ui-sdk-wrappers` | `bbac10c8` |
| Next.js docs | `/home/salah/cilas/node_modules/next/dist/docs/` (16.4.6) | n/a |

Not built anywhere at these SHAs: PR 1b-2b (the list screens, the Articles and Courses nav items, `courseTypeKey`, L0 ScrollArea, L0b fold trigger). PR 1b-2a is built and pushed (`src/portal/lists/rows.ts`, `testing/portal-lists.fixture.ts`), but it does not yet hold the 1b-1 head. The 1b plan, 1b-1, 1b-2a and PR C still move. The section "Premises to re-check when 1b lands" lists every assumption this plan makes about code that is not on `main`. A line number cited with a ref is true at that ref only; each premise check is a grep, so it still works after a line moves.

**Status.** Nothing is built. Every "Expected" line is a prediction.

---

## What each reader sees

- **1c-0:** nothing. A script, and a number in this plan.
- **1c-1:** no new screen. Two admin screens change their rule (Deviation 21): the admin review queue page (`src/components/admin/review-queue.tsx`, through `getReviewQueue`) and the dashboard's "Reviews waiting" tile (`countReviewQueue`) list the documents that `waitsOn` says wait on an admin, not the rows of trunk's two raw queries. N6 lists every id where the two rules differ on the prod clone, and the PR names each one for the operator.
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
- **1c-1:** `src/portal/needs/*` (new), `src/lib/review-candidates.ts` and `src/lib/review-candidates.int.test.ts` (new), `src/portal/lists/rows.ts` (N2 Step 1: its candidate and row reads move out; no behaviour change), `src/lib/review-queue.ts`, `src/lib/review-queue.int.test.ts` (new), `src/components/admin/dashboard/quick-actions.tsx` (the tile calls `countReviewQueue`, one line), `src/forms/applicants.ts`, `src/forms/applicants.int.test.ts` (add a describe), `testing/needs.fixture.ts` (new; it calls `testing/portal-lists.fixture.ts`), `testing/portal-lists.fixture.ts` (only the `bulk` option, when P35 fails), `scripts/needs-check.int.test.ts` (new).
- **1c-2:** `src/portal/needs/` (view parts: `need-list.tsx`, `latest-list.tsx`, `latest.ts`, `read-link.tsx`, `work-refresh.tsx`, their tests, CSS module), `src/portal/inbox/` (new), `src/app/(frontend)/[locale]/(portal)/spaces/inbox/page.tsx` and `loading.tsx` (new), `src/app/(frontend)/[locale]/(portal)/spaces/layout.tsx`, `src/portal/nav/{portal-nav.ts,portal-nav.unit.test.ts,nav-counts.tsx (new),nav-counts.dom.test.tsx (new),nav-icons.ts,rows.tsx,portal-shell.tsx,sidebar.tsx,shell.module.css,sidebar.browser.test.tsx,more-sheet.tsx,bottom-bar.tsx}`, `src/components/notification-glyphs.tsx` (new: the bell's glyph map, no `'use client'`, beside the bell it serves; code review L-3), `src/components/site-notifications.tsx` (imports the glyph map from the new file; no behaviour change), `src/lib/notifications-client.ts` (`markRead` takes an optional `keepalive`; the bell's calls do not change), `messages/{en,ar}.json` (`Portal.nav`, `Portal.needs`, `Portal.inbox`, `Portal.latest`), `testing/portal-e2e.test-utils.ts`, `testing/portal.fixture.ts` (only `portalNeedsWorld`, see I1), `testing/portal-lists.fixture.ts` (export `makeAccount` only), `playwright.config.ts` (only if P23 fails), `e2e/portal-shell.e2e.test.ts`, `e2e/portal-home.e2e.test.ts`, `e2e/portal-home.empty.e2e.test.ts` (new).
- **1c-3:** `src/portal/home/*` (new), `src/lib/reader-courses.ts` and its int test (new), `src/app/(frontend)/[locale]/(portal)/spaces/(home)/page.tsx`, `(home)/loading.tsx`, `messages/{en,ar}.json` (`Portal.home`; delete `SpaceShortcuts` and the `Spaces` keys only the old page used), `src/components/space/space.module.css` (delete the shortcut rules), `e2e/portal-home.e2e.test.ts`, `e2e/portal-home.empty.e2e.test.ts`, `e2e/portal-spaces-off.e2e.test.ts` (`:188`), `e2e/portal-shell.e2e.test.ts` (`:500`).
- **1c-4:** `src/components/bridge/bridge-year.tsx`, `src/components/article/article-page.tsx`, and any other file whose course type key K1 Step 1 finds (`CourseView.tsx` at `57248c77`).

### Order with 1b-2b

1b-2b and 1c-2 both change `src/portal/nav/portal-nav.ts`, `rows.tsx`, `sidebar.tsx`, `portal-shell.tsx`, `shell.module.css`, `NAV_BY_ROLE` and `messages/*.json`. Two orders are possible. Each has a rule.

- **1b-2b first (preferred).** 1c-2 rebases on it. I2 adds the `articles` and `courses` rows to `COUNT_OF` (in `src/portal/nav/nav-counts.tsx`), and I3 renders the count chip in the row that 1b-2b leaves (with L0's `ScrollArea` and L0b's `FoldProvider`).
- **1c-2 first.** 1c-2 ships the Inbox count only. `COUNT_OF` has no `articles` or `courses` row. 1b-2b then adds those two rows to `COUNT_OF` in its L1 commit, and its two items get their counts with no other change. Send this as a request to the 1b-2b builder (see "Requests to phase 1b"). The 1b plan's Deviation 11 ("Nav counts are `null` in 1b") then ends inside 1b-2b.

## Premises to re-check when 1b lands

Each premise names the file and symbol, the SHA read, who uses it, the exact check, and the fallback. The builder of the named PR runs the check on its base (`HEAD` below) before the first task that uses it. A check that fails: stop, write what differs in the PR, and use the fallback.

- **P1. 1b-1 status exports.** `src/lib/review-status.ts` exports `StatusKey`, `STATUS_KEYS`, `waitsOn`, `statusOf`, `statusInputOf`, `KEY_SELECT`, `NOT_LIVE`, `LIVE_COPY`, `KEY_WHERE`, `liveParentIds` (`c5a65fd6`). Used by 1c-1.
  - Check: `git grep -cE "^export (const|type) (StatusKey|STATUS_KEYS|waitsOn|statusOf|statusInputOf|KEY_SELECT|NOT_LIVE|LIVE_COPY|KEY_WHERE|liveParentIds)\b" HEAD -- src/lib/review-status.ts` prints `HEAD:src/lib/review-status.ts:10`.
  - Fallback: none. 1c-1 cannot start without 1b-1.
- **P2. `KEY_WHERE` rows.** A row `{ on, where }` for each key whose `waitsOn` is not null: `submitted`, `changes_requested` (`on: 'main'`), `published_edits`, `published_removal`, `published_edits_returned` (`on: 'version'`) (`c5a65fd6`, `review-status.ts`, `KEY_WHERE`). No row holds a `parent.*` path (1b-1 unit test "holds no parent path, which joins the parent read access for an owner"), so a `version` row also finds versions of a parent that is not live, and a caller keeps the live parents with `liveParentIds` (P30). 1b-1 pins that each row finds exactly the rows `statusOf` gives its key, for the states real moves make (`review-status.int.test.ts`, "KEY_WHERE finds the rows of its keys"). Used by 1c-1.
  - Check: `git grep -n "every key that waits on someone has a KEY_WHERE row\|holds no parent path" HEAD -- src/lib/review-status.unit.test.ts` finds two tests, and `pnpm exec vitest run --project node src/lib/review-status.unit.test.ts` passes (Mac).
  - Fallback: none. A waiting key with no row cannot be counted with no field compare.
- **P3. Keys-only rows.** `statusOf` with `read: 'keys'` throws only when it must compare fields (`c5a65fd6`, `review-status.ts`, `unsent`): a live row whose copy is not at `submitted` or `changes_requested`. Every waiting key (`submitted`, `changes_requested`, `published_edits`, `published_removal`, `published_edits_returned`) is decided with no field compare: a live row's copy at `submitted` or `changes_requested` returns before `unsent` runs. So the work sets (N2 `waitingSet`) read keys only (`read: 'keys'`), and a candidate whose keys read throws is a dropped id, not a crash. The 1b lists keep the full read (`read: 'full'`, 1b-2a's behaviour). Used by 1c-1 N2.
  - Check: `git show HEAD:src/lib/review-status.ts | grep -n "case 'submitted'\|case 'changes_requested'\|statusOf compares fields only on full rows"` prints the two cases before the throw.
  - Fallback: a waiting key needs a compare. Then `waitingSet` uses `read: 'full'` for that key, and N7 measures the cost.
- **P4. `documentHref`.** `documentHref({ collection, id, viewer, waiting, locale })` returns `/admin/collections/{collection}/{id}` (`c5a65fd6`, `src/lib/document-href.ts:10`). Used by 1c-1.
  - Check: `git grep -n "export const documentHref" HEAD -- src/lib/document-href.ts`.
  - Fallback: none.
- **P5. Access helpers.** `mayAuthor` and `mayTeach` in `src/access.ts` (`c5a65fd6`). `ownsViaAuthors`, `ownsViaFellows`, `isAdminUser`, `adminViewOf`, `personOf` are on `main` (`57248c77`, `src/access.ts:49-124`). Used by 1c-1.
  - Check: `git grep -cE "export const (mayAuthor|mayTeach|ownsViaAuthors|ownsViaFellows)\b" HEAD -- src/access.ts` prints `HEAD:src/access.ts:4`.
  - Fallback: none.
- **P6. Reviewed collections.** `ReviewedCollection` and `REVIEWED_FIELDS` in `src/lib/reviewed-fields.ts` (`c5a65fd6`); `REVIEWED` in `src/lib/reviewed-collections.ts` lists articles, courses and publications (`57248c77`). Used by 1c-1.
  - Check: `git grep -n "export type ReviewedCollection" HEAD -- src/lib/reviewed-fields.ts`.
  - Fallback: none.
- **P7. 1b-2a reads to move.** `src/portal/lists/rows.ts` holds the module-local `workCandidates` (`b160b637`, `:226`), `withoutParentStatus` (`:215`), `readEntries` (`:170`), `readMains` (`:147`), `readLatest` (`:156`) and `newestPerParent` (`:137`). At `b160b637` the version candidate read strips `parent._status` with `withoutParentStatus` (as an owner it made Payload add the parent's read access to each branch: 1368 joins in one query), and `readEntries` then reads each parent under the base `where`. At 1b-1 `c5a65fd6` `KEY_WHERE` and `LIVE_COPY` hold no parent path, and `liveParentIds` (P30) is the one read that keeps the live parents under the caller's `where`. So once 1b-2a holds `c5a65fd6` (P25), `withoutParentStatus` has nothing to strip. N2 Step 1 moves the reads to `src/lib/review-candidates.ts` on a base that holds `c5a65fd6`, deletes `withoutParentStatus` if it is still there, and calls `liveParentIds`. Used by 1c-1 N2.
  - Check: `git grep -nE "^const (workCandidates|withoutParentStatus|readEntries|readMains|readLatest|newestPerParent) =" HEAD -- src/portal/lists/rows.ts` prints 6 lines (5 when 1b-2a already deleted `withoutParentStatus`), and `git grep -n "liveParentIds" HEAD -- src/portal/lists/rows.ts` says whether 1b-2a already calls it.
  - Fallback: 1b-2a already moved them (the grep prints fewer lines and `src/lib/review-candidates.ts` exists). Use what it moved, add only what N2 needs, and say so in the PR.
- **P8. `portalNav` shape.** `portalNav(user)` takes one argument and returns `PortalNavItem[]` with `key: 'home' | 'openDashboard'`, `count: number | null` (always `null`, and no code reads it: `git grep -n "item.count\|\.count\b" origin/portal/phase-1a-shell -- src/portal` finds only the space rows' own `styles.count`), `external`, `group`; `PortalNavIcon` is `'home' | 'dashboard' | 'profile'` (`72d8b22f`, `src/portal/nav/portal-nav.ts`). 1c keeps the one-argument signature and deletes `count` (I2, Deviation 14). Used by 1c-2 I2.
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
  - Lock command: every Mac step that this plan marks "inside the lock" holds the lock that `verify.sh` takes, in the way `verify.sh` takes it, so it waits for `verify.sh` runs and they wait for it. Stock macOS has no `flock` binary: also run `command -v flock`. If `verify.sh` uses `flock` and the binary is there, the form is `flock <lock> <command>`. If it locks another way (for example `mkdir <lock>` with a trap), take the lock the same way around the command. Write the form used in the PR.
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
- **P23. Empty-seed specs stay off the normal run.** `playwright.config.ts` has `testIgnore: 'production.e2e.test.ts'` only (`main` `57248c77`, PR C `72d8b22f`, 1b-1 `c5a65fd6`, 1b-2a `b160b637`, all `:34`). The 1b plan (L6, `23fb570c`) adds "`testIgnore` adds `*.empty.e2e.test.ts` unless the path of `DATABASE_URL` is `/${EMPTY_DATABASE}`; on `cilas_empty`, only `*.empty.e2e.test.ts` runs", in 1b-2b. Used by 1c-2 I6, 1c-3 H4.
  - Check: `git grep -n "empty.e2e" HEAD -- playwright.config.ts` finds the rule.
  - Fallback: 1b-2b has not landed. 1c-2 adds the same rule in its I6 commit, written as the 1b plan's L6 writes it (it reads `EMPTY_DATABASE` from `seed/empty-url.ts`), so the later merge with 1b-2b has one obvious side. Add `playwright.config.ts` to the I6 commit and say so in the PR.
- **P24. `server-only` in the check's runner.** `src/forms/applicants.ts:1` is `import 'server-only'` (`57248c77`). Plain `tsx` cannot load it: no `server-only` package is installed; the vitest `node` project aliases it to `next/dist/compiled/server-only/empty.js` (`vitest.config.mts:41`). So the prod-clone check (N6) and its cost run (N7) are vitest int files in the `node` project, not `tsx` scripts. The node project includes `**/*.{int,unit}.test.{ts,tsx}`, so `scripts/needs-check.int.test.ts` is found. Used by 1c-1 N6, N7.
  - Check: `git grep -n "server-only" HEAD -- vitest.config.mts` prints the alias line.
  - Fallback: none. Stop: the check needs the alias.
- **P25. 1b-2a holds the 1b-1 head.** On 2026-11-21 it does not: `git merge-base origin/portal/phase-1b-list-data origin/portal/phase-1b-status` is `bd31bf98`, and 1b-1 has six later commits (`8f33c75c` to `c5a65fd6`). The newest one, `c5a65fd6`, changes the rule N2 builds on (P2, P30). Used by 1c-1 (its base).
  - Check: `git merge-base --is-ancestor origin/portal/phase-1b-status origin/portal/phase-1b-list-data && echo ok` prints `ok`.
  - Fallback: branch 1c-1 from `portal/phase-1b-list-data` and merge `origin/portal/phase-1b-status` into it as the first commit (a merge commit on the 1c-1 branch only; never push to a 1b branch). A conflict in a 1b file: stop and report it to the 1b orchestrator, as a request.
- **P26. Portal fixture writers.** `testing/portal.fixture.ts` exports `PortalWorld` (`:63`), `portalWorld` (`:259`) and `notifyOf(payload, account, link)` (`:375`; it writes a `comment` notification with `overrideAccess: true`) (`72d8b22f`; at 1b-2a `b160b637` the same three exports sit at `:63`, `:169`, `:312`, so 1c-1 does not need PR C for them). `testing/portal-lists.fixture.ts` exports `trustedWrites(payload, track)` (`:77`: `create`, `edit`, `submit`, `decide`, `unpublish` for articles and courses), the module-local `makeAccount` (`:28`) and `listWorld(payload, track, world)` (`:142`: 60 published `bulk` articles first (`:167-168`), one student-owned article for every `STATUS_KEYS` key, among them `draft`, and courses owned by a new `list-teacher` fellow (`:231`), not by `world.accounts.fellow`) (`b160b637`). Used by 1c-1 N2, 1c-2 I1.
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
- **P30. `liveParentIds`.** `liveParentIds(payload, { collection, ids, user, where })` returns the ids, out of `ids`, whose main row is live, in one main read under `where` (the caller's gated `where`); `user: null` reads with `overrideAccess: true` (`c5a65fd6`, `src/lib/review-status.ts`). An empty `where` is left out of its `and`. Used by 1c-1 N2 (`candidateIds`).
  - Check: `git grep -n "export const liveParentIds" HEAD -- src/lib/review-status.ts`, and `git show HEAD:src/lib/review-status.ts | grep -n "where ? \[where\] : \[\]"` prints one line.
  - Fallback: none. 1c-1 starts on a base that holds `c5a65fd6` (P25).
- **P31. Empty string turns a key off.** `src/env.ts` calls `process.loadEnvFile` for `.env.development.local` (only when `NODE_ENV` is `development`), `.env.local` (not under `test`) and `.env`; `loadEnvFile` fills only variables that are not set, so an unset key comes back from `.env`. `createEnv` has `emptyStringAsUndefined: true`, so a key set to `''` reads as off (`57248c77`, `src/env.ts:8-20`, `:149`; precedent `seed/empty-run.ts:7`). With `RESEND_API_KEY` off, `email` is `undefined` (`src/payload.config.ts:138-144`) and Payload 3.91.0 uses `consoleEmailAdapter` (`name: 'console'`) and logs "No email adapter provided. Email will be written to console." at init (`node_modules/payload/dist/index.js:392-398`). With either VAPID key off, `pushConfig()` is `null` (`src/lib/push/config.ts:17-24`). Used by every mail-off step (Global Constraints, Mail off).
  - Check: `git grep -n "emptyStringAsUndefined: true" HEAD -- src/env.ts` and `git grep -n "email: env.RESEND_API_KEY" HEAD -- src/payload.config.ts` each print one line.
  - Fallback: none. Stop: no Mac step writes on a prod clone until the guard holds.
- **P32. `verify.sh`'s e2e server has mail off.** I6's submit and approve tests write on `cilas_dev` (a prod clone with real admin addresses) through the server that `verify.sh` runs, and the test process cannot see that server's env. Used by 1c-2 I6 and the 1c-2 live box.
  - Check (Mac): `grep -nE "RESEND_API_KEY|VAPID_|TYPESENSE_|R2_ENDPOINT|pnpm (start|dev)|next (start|dev)" ~/cilas-verify/verify.sh` shows how the server starts and with which keys; and the server log of one `verify.sh --e2e-only` run holds Payload's line "No email adapter provided. Email will be written to console.". Write both in the PR.
  - Fallback: hard stop. Neither I6 Step 2 nor the 1c-2 live box runs until `verify.sh` starts its server with the Mail off keys set to the empty string (a change to `~/cilas-verify/verify.sh`, outside the repo; write the diff in the PR and the ledger) and its log holds that line.
- **P33. `notifications-client` is server-safe.** `src/lib/notifications-client.ts` and `src/lib/realtime/stream-client.ts` have no `'use client'` and no top-level `window` or `document` (`57248c77`), so a server component may import `noteText` (I4).
  - Check: `git grep -nE "use client|^window|^document" HEAD -- src/lib/notifications-client.ts src/lib/realtime/stream-client.ts` prints nothing.
  - Fallback: move `noteText` to a module with no client code, and import it from there in the bell and in `LatestList`.
- **P34. Notification reads and words.** `Notifications` read access is `ownNotifications` (`recipient` equals `req.user.id`, `src/collections/Notifications.ts:13-15`, `:39`), which `latestRows` relies on with `overrideAccess: false`. The bell's words come from `useTranslations('Notifications')` and `t(\`kinds.${k}\`)` (`src/components/site-notifications.tsx:88`, `:96`), so the Latest rows read the same namespace with `getTranslations('Notifications')` (`57248c77`). Used by 1c-2 I4.
  - Check: `git grep -n "read: ownNotifications" HEAD -- src/collections/Notifications.ts` and `git grep -n "useTranslations('Notifications')" HEAD -- src/components/site-notifications.tsx` each print one line.
  - Fallback: use the rule and namespace the bell uses on the base, and say so.
- **P35. `listWorld` without the bulk rows.** `listWorld(payload, track, world, { bulk })` takes a `bulk` count (Requests to phase 1b, item 1). At `b160b637` it does not: it always writes 60 published `bulk` articles (`testing/portal-lists.fixture.ts:167-168`), which only 1b's paging tests need. Used by 1c-1 N2, 1c-2 I1.
  - Check: `git grep -n "bulk = 60\|bulk?: number" HEAD -- testing/portal-lists.fixture.ts` finds the option.
  - Fallback: 1c-1 adds the option in its first fixture commit, `{ bulk = 60 }: { bulk?: number } = {}`, so every 1b caller keeps 60 and `needsWorld` passes `{ bulk: 0 }`. One change in 1b-2a's file; list it in the PR and tell the 1b orchestrator.
- **P36. A prod dump on the Mac.** `~/Backups/cilas/` holds the production dumps the local clone was made from, beside the local `cilas_dev-<date>-<step>.dump` backups (user memory: the local dumps are named `cilas_dev-*`; a prod dump is plain SQL from `pg_dump --no-owner --no-privileges` in `postgres:17-alpine`, restored with `docker exec -i cilas-db-1 psql`; the Mac has no host pg tools). Format, name and date are not known from here. Used by 1c-0 T2, 1c-1 N6 (Global Constraints, Prod clone restore).
  - Check (Mac): `ls -lt ~/Backups/cilas/ | grep -v ' cilas_dev-'` lists at least one file; for the newest, `head -c 5 <file>` prints `PGDMP` (custom format) or SQL text (plain); `docker exec cilas-db-1 psql --version` prints the container's version. Write the file name, size, date and format in the PR.
  - Fallback: no prod dump on the Mac. Stop and report to the orchestrator. A new prod dump is the operator's call (production DB route in the user memory); never use `cilas_dev` or a `cilas_dev-*` dump in its place.

## Global Constraints

**Run location (from the 1b plan, still in force).** Read the 1b plan's Global Constraints, "Run location". Builders work on the user's Mac, each in its own git worktree. Light commands (oxlint, `pnpm exec tsgo --noEmit`, one unit or dom test file, `pnpm audit:access`) run in the Mac worktree. Heavy jobs (int tests, browser tests, Playwright, `next build`, a server, the full suite) run only through `~/cilas-verify/verify.sh` (**[verify]**). Two named exceptions run beside it, under its lock (P17): the TTFB runs (T2, T3, the perf gate (G)), which need a production server `verify.sh` does not start, and the prod-clone check and its cost run (N6, N7), which need `DATABASE_URL` set to `cilas_needs` and one file, which `verify.sh --int-only` cannot give today. Both use a database restored from a prod dump (Prod clone restore (R)) and run with mail off (Mail off (M)). The Mac is shared with the 1b builders: queue through `verify.sh`'s lock (P17), never start a second server beside it, never touch the user's stash or another agent's processes. Nothing in this plan runs on the Linux server, except reading and `git`. The Mac is T3 environment `1a4d95da-5225-4111-8b47-95722338b848`, project `ccbd0b98-2d40-4378-9e39-049224e0f44a`. A Mac delegate makes its own git worktree.

**From the 1b plan, still in force** (read these sections there; they are not copied): "New in 1b", the items **Access rules**, **One role table**, **Owner lists filter by owner**, **Which row is which**, **Latest versions** (keep the newest `updatedAt` per parent), **Data access** (every read names `depth`, `select`, `pagination: false` or a `limit`), **Int test setup** (`mockNetwork(resendInbox().handler, ...localServices)`; read by your own ids, never by table counts), **English**, **Arabic digits**. From the phase 1a plan (by section name): Spec values; Code and tests (Libraries first, Tests, Matrix, Describes, Locators, `spaces_mode`, Copy, Components, Lazy UI); Commits and PRs; Deviation 19 (matrix exemptions) as a pattern; "No streaming boundary above the check".

**New in 1c.**

- **Prod clone restore (R).** `cilas_ttfb` (T2) and `cilas_needs` (N6) are restored on the Mac from the newest production dump (P36), never copied from `cilas_dev`. `cilas_dev` is a prod clone plus fixture rows and leftovers (ledger: "check-seo 10 errors from local probe rows (probe-*, scratch-fan4-*, review-course-*) left in the Mac cilas_dev"; the 1b and 1c int and e2e runs write to it). Steps, inside the lock (P17), with `<db>` the copy's name:
  1. Find the dump: `ls -lt ~/Backups/cilas/ | grep -v ' cilas_dev-'`. Take the newest file. Print `ls -l <dump>` (name, size, date) and `head -c 5 <dump>` (`PGDMP` is the custom format, SQL text is plain). The name and date go in the PR, in the baseline table's Date column ("dump `<name>`, `<date>`") and in the ledger. No such file: stop (P36 fallback).
  2. Create and fill, with the container's tools (the Mac has no host pg tools): `docker exec cilas-db-1 createdb -U cilas <db>`, then for plain SQL `sed '/^SET transaction_timeout/d' <dump> | docker exec -i cilas-db-1 psql -U cilas -d <db> -v ON_ERROR_STOP=1 -q` (the dump is from Postgres 17, the container is 16), or for the custom format `docker exec -i cilas-db-1 pg_restore -U cilas --no-owner --no-privileges -d <db> < <dump>`.
  3. Schema: in a Mac worktree at `main`, `env DATABASE_URL=postgres://cilas:dev@localhost:5433/<db> pnpm payload migrate:status`. A pending migration (the dump is older than `main`): `pnpm db:migrate` with the same `DATABASE_URL`, on the copy only, and write it in the PR. No ref under test adds a migration at the SHAs read (`git diff --stat origin/main...<ref> -- src/migrations` is empty for PR C, 1b-1 and 1b-2a). A builder whose ref adds one migrates the copy for that ref after the `main` runs of the session, never before them.
  4. Residue check (it fails the step). For each table of a collection with a `slug` field (`Articles`, `Courses`, `Cycles`, `Events`, `Newsletters`, `People`, `Places`, `Programmes`, `Publications` at `57248c77`; take the table names from `docker exec cilas-db-1 psql -U cilas -d <db> -c '\dt'`): `docker exec cilas-db-1 psql -U cilas -d <db> -tAc "select count(*) from <table> where slug ~ '^(probe-|scratch-|review-course-|portal-e2e-)'"` prints `0`; and `docker exec cilas-db-1 psql -U cilas -d <db> -tAc "select count(*) from users where email like '%@cilas.test' or email like '%.invalid'"` prints `0` (fixture emails end in `@cilas.test`, `testing/payload.fixture.ts:11`). Any other number: drop the copy (`docker exec cilas-db-1 dropdb -U cilas <db>`) and stop; the dump is not a clean prod dump. Paste the counts in the PR.
- **Mail off (M).** Every Mac step that writes on a prod-clone database runs with mail, push and search writes off, and proves it before its first write. The steps: T2 Step 2 and each later run of `scripts/ttfb-accounts.ts` (a password update and a login on `cilas_ttfb`); every production server of T2 Step 3, T3, I7 Step 4 and H5 (a page render can run hooks); I6's submit and approve tests and the 1c-2 live box, which write on `cilas_dev` through `verify.sh`'s server (P32). N6 and N7 write nothing; the test guard below covers them.
  - Keys: set to the empty string, never unset (P31: an unset key comes back from `.env`). `OFF=(RESEND_API_KEY= VAPID_PUBLIC_KEY= VAPID_PRIVATE_KEY= TYPESENSE_API_KEY= TYPESENSE_PRIVATE_WRITE_KEY= TYPESENSE_PRIVATE_SEARCH_KEY= R2_ENDPOINT=<local> R2_PUBLIC_URL=<local>)`, where `<local>` are the RustFS values in the Mac's `.env.development.local` (`scripts/clone-r2-local.mjs` writes them; a production server does not load that file, and `.env` holds the production bucket, `testing/local-env.ts`). Every such command runs as `env "${OFF[@]}" <command>` (zsh array, user memory).
  - Script guard: `scripts/ttfb-accounts.ts` checks, after `getPayload` and before its first write, that `payload.email.name === 'console'`, `pushConfig() === null` (`src/lib/push/config.ts`) and `isLocalUrl(env.R2_ENDPOINT)` (`testing/local-env.ts`). A failed check exits 1 and names the check. `--check-off` runs only these checks and writes nothing.
  - Server guard: a server step counts only when the server's own log, captured from its start, holds Payload's line "No email adapter provided. Email will be written to console." (P31). A check in another process proves only that process, so `env "${OFF[@]}" NODE_ENV=production pnpm exec tsx scripts/ttfb-accounts.ts --check-off` also runs in the server's worktree (same cwd, same `NODE_ENV`, same `OFF`): `src/env.ts` loads other files per `NODE_ENV` (P31). Both pass, or stop the server and fix the env.
  - Test guard (N6, N7): vitest's `testEnv()` sets `RESEND_API_KEY` to a test key (`testing/local-env.ts`), and the file calls `mockNetwork(...localServices)` with no Resend handler. MSW runs with `onUnhandledRequest: 'error'` and fails the test on any request that no handler answers (`testing/msw-node.test-utils.ts:9`, `testing/README.md:52`). So a mail or search call fails the run; it does not leave the Mac.
- **No schema change.** The spec's Migrations table lists nothing for 1c. `needs` derives from documents. No task runs `payload migrate:create`. A task that finds it needs a field stops and reports. (Had one been needed: generate it on the branch, rename the SQL by hand, apply it only on a throwaway copy that the seed guard accepts, never `cilas_dev`, and list it in the ledger under "For the morning".)
- **Projection reads.** `countReviewQueue` and the review rows read with `overrideAccess: true` (as `getReviewQueue` does, `src/lib/review-queue.ts:31`). Every portal caller checks `isAdminUser(user)` first and returns zero rows for any other reader. `countWaitingApplicants` reads `form-submissions` with `overrideAccess: true` inside `src/forms/applicants.ts`, the one projection (spec, Data access rule). Every other read is gated (`user`, `overrideAccess: false`).
- **Version reads count parents, not rows.** Two versions saved in one millisecond can both be `latest` (1b plan, Latest versions). So no count uses `payload.countVersions`. A version count reads `findVersions` with `select: { parent: true }`, `depth: 0`, `pagination: false`, and counts distinct parent ids.
- **Links to work and posts are plain `<a>`.** Every `needs()` href in 1c is an `/admin` URL (`documentHref` gives the admin URL until phase 2; `/admin/applicants` before phase 3). `localePrefix` is `'always'` (`src/i18n/routing.ts:11`), so next-intl `Link` would make `/admin/...` into `/en/admin/...`. Latest rows link to posts and other site pages, and a soft navigation from outside `(rooms)` to a post shows the dialog over an empty page (operator rule, 2026-11-21). So Needs you rows and Latest rows render `<a href>`. A Latest row uses the stored `link` exactly as stored, as the bell does today: the bell sets `href: n.link ?? undefined` (`src/components/site-notifications.tsx:109`, `57248c77`) and its toast opens `item.href` unchanged (`:148-150`). Stored links are mixed (`/admin/applicants?application=…` from `src/forms/notify-application.ts:42`, `/spaces/...`, `/en/spaces/...`), and the next-intl proxy (`src/proxy.ts:8`, `localePrefix: 'always'`) sends a portal path with no locale to its prefixed form. So 1c adds no locale logic to links.
- **One request, one read.** The work sets of every source are read once per request, in `workOf(user)`, which is wrapped in React `cache` (spec, Tasks, Data). A work set is the ids that wait on the reader, each with its key, read keys only (N2 `waitingSet`). `needsCounts(user)` is the sizes of those sets. `needs(user, locale)` makes one row per id of the same sets, with the set's key, and reads only the display fields (titles, owner names, dates). So the count and the rows cannot differ: they are one set (spec review M-1, code review M-1). Both are wrapped in `cache` too. The key is the `User` object, and PR C's `currentReader` is cached with no argument (P28), so the layout and the page of one request pass the same object and share each entry. So on Home and Inbox the layout's count and the page's rows come from one set read, and the rows step adds only the details read. The layout calls only `needsCounts` (spec, Lazy loading rule). React `cache` does not memoize outside a server render (the non-server build of React 19.2.6 is a call-through: `node_modules/react/cjs/react.development.js:917-921`), so no unit test can count the reads across the layout and the page; the structure proves it (P28, and `workSetsOf` is the only caller of the set reads, checked by the static check of N7 Step 2), and N5 tests the pure functions (`workSetsOf`, `countsOf`, `rowsOf`). No `unstable_cache`, no `cacheTag`: the spec asks for the cost before any cache (N7).
- **Counts never hold the first byte.** The layout does not await `needsCounts`. It creates the promise right after `currentReader` resolves and before its `Promise.all` (`payload` and `user` exist there, PR C `layout.tsx:21-45`), so the count reads overlap `mySpaces` (spec review L-6). It passes the promise, with `.catch` that logs and resolves to `null`, to `PortalShell`, which puts it in a small client context (`NavCountsProvider`). Each nav row renders its chip in `<Suspense fallback={null}>`, and the chip reads the promise with `use()` (Next, `06-fetching-data.md`, the `use` example and "provide it through context"). So the shell and the page stream first, and the numbers follow in the same response. A `null` (a failed count) renders no number (spec, Navigation, Errors). `router.refresh()` runs in a transition, so a chip that already shows a number keeps it until the new number is ready (I3 tests it). This boundary wraps only the chip, never the layout's `children`, so phase 1a's rule "No streaming boundary above the check" still holds.
- **Perf gate (G)** (operator decision, 2026-11-21; Deviation 20). One predicate for every PR that touches the portal layout or a portal route (1c-2, 1c-3). Probe: `scripts/ttfb-probe.mjs` (T1), production builds, `cilas_ttfb`, the three accounts of T2 with fresh cookies, Mail off (M), all runs of one session inside one hold of the lock (P17).
  - Routes: `/en/spaces` (Home: the spec's gate), and each route the PR adds (1c-2: `/en/spaces/inbox`). Inbox has no `main` equivalent; it is held to Home's bound as a guard that the layout stays fast, not as a spec number (spec review L-2).
  - Session, in this order: (1) a production build of `main` at the baseline table's SHA, probed twice back to back (runs A and B, 30 samples each, on `/en/spaces`); (2) this PR's head, probed once (run C) on each route.
  - Validity: for each role, the p75 of A and of B are each within 10% of the table's `main` p75 for that role. Else the Mac is not in the baseline state: run the session again later, at most twice, then report the PR as blocked on the Mac (not failed). The `main` runs use `main`, not the PR's base: the base holds PR C and earlier 1c PRs, so their cost belongs to the predicate.
  - Numbers, per role: `S` is the lower of the A and B p75; `m` is the run-to-run spread, `(higher - lower) / lower` of the A and B p75, capped at 0.10. So `S x (1 + m)` is the slower `main` run of this session, and never more than 10% above the faster one.
  - **Pass**, for every role and route: head p75 is at most `S x (1 + m)`, and, when the table's `main` p75 for that role is under 800 ms, head p75 is under 800 ms (the spec's 800 ms rule).
  - **Near miss**: head p75 is above `S x (1 + m)` and at most `S x (1 + 2m)`, and the 800 ms rule holds. Probe the head once more in the same session (run C2). C2 decides: pass when C2 meets the Pass line, else fail.
  - **Fail**: head p75 above `S x (1 + 2m)`, the 800 ms rule broken, or C2 not passing. A fail is fixed in the PR that caused it (profile the layout reads, N7's per-source numbers); no cache without the operator's yes.
  - Record per role: the table's p75, A, B, `S`, `m`, C (and C2), the verdict. Full-response p75 is recorded beside it; above 2x the `main` full-response p75 it is a finding for the operator, not a fail.
- **Review predicate.** A review step (ux-auditor, better-interface, break-ui, code-review, security-review) passes when no finding rated Critical or High stays open: each is fixed with a test, or the PR lists it with the operator's decision. Medium and Low findings are fixed or listed in the PR. Each report goes in a PR comment with the head SHA, linked from the PR body.
- **UI parts order** (ADR 0012, operator rule): the Arc component in `src/components/arc` (never re-run `shadcn add` for an installed one), then the free Arc registry, then a ui-sdk wrapper in `src/components/sdk/`, then Radix already used, then our own code. No 1c part needs ui-sdk. Inner scroll regions use Arc `ScrollArea` (`src/components/arc/scroll-area`). Home and Inbox scroll with the document, so they add no inner scroller.
- **Lazy loading.** Home and Inbox are first-render content and render on the server. No 1c UI shows only after an action, so no `preloadable` is new. The work-refresh listener, `NavCountsProvider` and the count chips are small client parts in the shell and load eagerly.
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
| Applicant count (N4) | Payload `count` (installed); one SQL `GROUP BY` through `payload.db.pool` (as `claimDigest`, `src/lib/space-digest.ts:170`); a `find` with `select: { choices: … }` and a reduce | adopt Payload `find` + reduce | `payload.count` counts submissions, not choices (spec). The `select` read stays inside Payload's typed API and the access projection. SQL is the fallback if N7 measures `countWaitingApplicants` above 100 ms p75 for any role on the prod clone (N4) |
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
4. **No To review or Applicants count in 1c.** The spec's sidebar counts for those items ship with the items (phases 2 and 3). In 1c `countWaitingApplicants` feeds only the admin's Inbox total and the Home card, and the admin queue set feeds those and the admin dashboard's "Reviews waiting" tile (`countReviewQueue`, N2).
5. **The `applicants` row's href is `/admin/applicants`** until phase 3 (spec table). An admin with no waiting choice gets no row.
6. **Live refresh: which events refresh.** Spec: a notification of kind `submitted`, `approved`, `changes_requested`, `rejected`, `removed`, `application` or `withdrawn`. Plan: (a) only `created` events refresh; `updated` (a read mark) and `deleted` events change no work. (b) `withdrawn` is not a kind until M3 (phase 2). `REFRESHES_WORK` is a `Record<NotificationKind, boolean>`, so adding the kind `withdrawn` to the registry is a type error until phase 2 sets its row (I5). (c) An event whose `doc` is absent (too big for one database message, `site-notifications.tsx:133`) refreshes, because its kind is unknown. (d) The stream's `sync` (a reconnect after a gap) refreshes once, because events in the gap are lost. All four go through the one 1 s debounce.
7. **Space unread counts stay as phase 1a Deviation 15 left them.** 1a Deviation 15 says "Phase 1c brings live counts". The spec's 1c scope brings live *work* counts only: the refresh fires on work kinds, and a new post creates no notification of those kinds. A work refresh reruns the layout, so the space counts are fresh after it, but nothing refreshes on a new post. Answer: no live space unread counts in 1c. Open question Q4.
8. **Greeting.** Spec: "Greeting with the first name. While the checklist shows: ...". 1c has no checklist (phase 6), so the greeting is one line: "Hello, {name}." with the first word of the linked person's name in the page locale. An account with no person (only admins) gets "Hello." with no name. Open question Q1.
9. **Next session source.** Spec: "`nextMeeting` from `src/lib/meetings.ts` over the reader's courses", and 1d ships "the gated read of the reader's own sessions". 1c needs a source now. Plan: `readerCourseIds(payload, user)` in `src/lib/reader-courses.ts`: the courses whose `fellows` hold the reader's person (gated `find`) and the courses of the reader's `accepted` enrollments (gated `find` of `enrollments`, `person` equals the reader's person). Then one gated `find` of `sessions` for those courses and `nextMeeting` over their meetings. Phase 1d reuses `readerCourseIds` for the calendar (one rule, one place). An admin with neither gets "No sessions yet" and no button (spec, until 1d).
10. **Next session link with spaces off.** Spec: "a link to the space". With spaces off no space page loads. Plan: the link goes to the public course page (`/{locale}/study/{slug}`). Open question Q2.
11. **Inbox Latest paging is a link.** Spec: "the 30 newest notification rows ... with **Show more**". Plan: as 1b Deviation 7, **Show more** is a link, `?latest=2` loads 60 rows, with a `focus` parameter that moves focus to the first new row and calls `announce()`. `latest` is an integer from 1 to 10; any other value reads as 1 (I4). Cap: 10 pages (300 rows); past the cap a line says "Only the newest 300 show." A click on a Latest row marks it read, as the bell does (`site-notifications.tsx:168`). Open question Q3.
12. **Home "Latest" and Inbox "Latest" rows are server-rendered.** The bell stays the live list. Home and Inbox Latest change on a work refresh (Deviation 6) or a load, not on every notification. Open question Q4 covers the same choice for space counts.
13. **Admin rows' `owner`.** Spec: `owner: { id, name }`. The queue reads owner names, not one owner id: an article can have several authors. Plan: `owners: string[]` (names, joined in the view as `getReviewQueue` does today, `review-queue.ts:19-22`), empty on the reader's own rows.
14. **Nav counts stream, `portalNav(user)` keeps one argument, and `PortalNavItem.count` goes.** Spec: `portalNav(user)` returns items whose `count` is a number or `null`, from `needsCounts(user)` that the layout calls. Plan: `portalNav(user)` keeps its one argument, and I2 deletes the field `count` from `PortalNavItem`: it is always `null` and no code reads it (P8), so it is dead code (`AGENTS.md`, Surplus) and a second place for count knowledge. The numbers come from the `needsCounts` promise through `NavCountsProvider` and `COUNT_OF` (I2, I3), so the first byte does not wait for them (perf gate (G), operator decision 2026-11-21). The spec's own error rule ("the nav renders with no counts") already allows a nav with no number for a moment.
15. **`needs(user, locale)`.** Spec: `needs(user)`. The rows carry a label in the reader's locale and owner names in that locale, so the locale is an argument. `needsCounts(user)` keeps the spec's one argument.
16. **Counts are the sizes of keys-only sets, not `payload.count`.** Spec: `needsCounts` "uses `count` queries". Two versions saved in one millisecond can both be `latest` (Global Constraints, Version reads count parents), so a version count reads parent ids and counts distinct ones. And a count must equal the rows (code review M-1), so the count is the size of the set the rows are made from: the candidates (`find` and `findVersions` on the `KEY_WHERE` row of each key, spec: "built from one table"), their live parents (`liveParentIds`), then one keys-only read of their keys (N2 `waitingSet`). The candidate read is the one 1b-2a wrote, on 1b-1's `c5a65fd6` rule. N7 measures the cost of the keys read.
17. **The review queue reads with `overrideAccess: true`.** Spec, Tasks, Access: "Gated read for documents", with `src/forms/applicants.ts` as the one projection. `getReviewQueue` already reads with `overrideAccess: true` and no user (`src/lib/review-queue.ts:31`), because its admin callers (`quick-actions.tsx:36`, the review queue view) pass no user. 1c keeps that for `adminReviewRows` and `countReviewQueue`, and every portal caller checks `isAdminUser(user)` first (N5 tests a non-admin gets no admin row and no `overrideAccess` read).
18. **A second admin's numbers are stale until a refresh.** Spec: the shell refreshes on a notification of a work kind. A decision notifies the owner, not the other admins (`notify` goes to owners), so admin B's Inbox number and rows keep a row that admin A decided until B loads a page, a soft navigation re-renders the page (the layout's count stays), or B gets another work event. Default: accept it in 1c, with no polling (Open question Q7). I6 pins the bound: after a reload B's number is right.
19. **The baseline number reaches this plan by a docs commit.** Spec: "Task 1 ... writes the number in the plan". The plan file lives on `docs/portal-phase-1c-plan`, not on `main`, and 1c-0 branches from `main`. So 1c-0 ships only the scripts, and the number goes into the ledger first, then into this file by a docs commit on the plan branch while the plan PR is open (or a one-line docs PR from `main` after it merges). "Task 1" is PR 1c-0's T3 (T1 writes the probe).
20. **The TTFB gate compares with the same session's `main` runs, with a measured margin.** Spec: Home TTFB p75 "no slower than the task 1 number". Two runs of one build on one Mac differ, and a 30-sample p75 of a build with the same cost is above another session's p75 about half the time (code review M-2, spec review M-1). Plan (operator decision, 2026-11-21): head p75 at most `S x (1 + m)`, where `S` and `m` come from two `main` runs in the same session and `m` is capped at 10%; a near miss (up to `S x (1 + 2m)`) reruns once, and the second run decides; the 800 ms rule stays as the spec says. The task 1 table stays the record, the validity anchor (each `main` run within 10% of it) and the anchor of the 800 ms rule (perf gate (G)).
21. **`getReviewQueue` and `countReviewQueue` read the `KEY_WHERE` set, not trunk's two queries.** Spec, Tasks, Counts: "`countReviewQueue` counts the distinct document ids of the two queries in `getReviewQueue` (`review-queue.ts:44-52`)". Plan: the admin queue is one set, `adminQueue` (N2: the `KEY_WHERE` candidates of the admin keys, kept when their key waits on the admin), and `getReviewQueue`, `countReviewQueue`, the dashboard tile and `needs(admin)` all read it. Reason: trunk's queries read raw `review.status`, so a count from them and a Needs you list from `waitsOn` can disagree on real rows (Review Focus 1). Effect: the admin review queue page and the "Reviews waiting" tile may list a different set than today. Trunk's algorithm stays as the frozen oracle in N6, which prints each id the two rules disagree on with its `statusOf` key; the 1c-1 PR lists every such id in its Blast Radius, and the operator may veto before merge.

## Ends when

The spec's Phase 1c line, by clause.

1. Task 1 measures today's `/spaces` TTFB at p75 per role on the prod clone and writes the number in the plan: T1 to T3, and the docs commit of Deviation 19 (the baseline table below).
2. `needs` passes: N3 to N6 (int and unit), I5 (`work-refresh.dom.test.tsx`), I6 (the live-refresh e2e).
3. `portal-home` passes: I6 (Inbox), H4 (Home), each with its empty-seed spec.
4. The total of `needs(admin)` matches the admin queue on the prod clone: N6 (`scripts/needs-check.int.test.ts`, pass predicate there).
5. Home TTFB at p75 per role is no slower than the task 1 number, and under 800 ms when that number is under 800 ms: the perf gate (G) in Global Constraints (with the same-session margin of Deviation 20), run in 1c-2 (I7, the layout gains the counts) and in 1c-3 (H5, Home).

Scope check, from the spec's Phase 1c Scope line: `needs()` on `waitsOn` (N3, N5); `needsCounts()` (N5); `countWaitingApplicants` (N4); `countReviewQueue` (N2); the sidebar counts (I3); the Inbox nav item (I2); live refresh (I5); Home without the checklist (H1 to H3); Inbox (I4); Home replaces today's `/spaces` page and its shortcuts into `/admin` (H3).

## TTFB baseline (filled from PR 1c-0)

**How the number gets here** (operator decision, 2026-11-21). PR 1c-0 branches from `main` and ships only the scripts; this file is not on `main`. The 1c orchestrator opens the plan PR from `docs/portal-phase-1c-plan` after the plan review loop, and it stays open until this table is filled, unless the operator merges it first (spec review L-1, code review L-6). After T3, the 1c-0 builder writes the rows in the ledger (`/home/salah/cilas-portal-run/LEDGER.md`, phase 1c row) first. Then the 1c-0 builder (or the orchestrator) fills the table below by a docs commit on `docs/portal-phase-1c-plan`: `docs(plan): phase 1c TTFB baseline`. If the plan PR has merged by then, the same table edit goes in a one-line docs PR from `main`. The perf gate (G) reads the table from this file on `main` once the plan PR has merged, and from the ledger before that. Raw samples go in a 1c-0 PR comment, linked from its PR body.

| Role (account id) | Ref and SHA | `/en/spaces` TTFB p50 | p75 (run A) | p75 (run B) | m | p95 | Full response p75 | Samples | Date and dump |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| admin (_id_) | `main` _sha_ | | | | | | | 30 + 30 | |
| fellow (_id_) | `main` _sha_ | | | | | | | 30 + 30 | |
| student (_id_) | `main` _sha_ | | | | | | | 30 + 30 | |
| admin, fellow, student | PR C head _sha_ (context only) | | | | | | | 30 each | |

The gate's table number for a role is its run A p75. Run B gives the first `m`, so the operator sees the Mac's run-to-run spread with the number.

**The gate number is the `main` row of each role.** That is "today's `/spaces`" as the spec says. If PR C has merged when T2 runs, `main` holds the shell, and the PR C row is not needed. If PR C has not merged, the PR C row shows what the shell alone adds; it does not gate. But 1c-2 and 1c-3 build on PR C, so the shell's cost is inside their head numbers. So T3 compares the PR C row with the predicate of the perf gate (G) at once, with A and B of this session as the `main` runs: if the PR C row fails (G) for any role, 1c cannot pass the gate without shell work (Open question Q8). Then the 1c-0 builder posts the numbers to the ledger, phase 1c row, as a question for the operator, and the 1c orchestrator holds 1c-2's I7 Step 4 until the operator answers (spec review L-4). I1 to I6 go on. Default until the answer: the gate stays the `main` row.

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
  It picks only accounts with `activated_at` set. Before its first write it runs the script guard of Mail off (M) (`payload.email.name === 'console'`, `pushConfig() === null`, local `R2_ENDPOINT`) and exits 1 on a failed check; `--check-off` runs only the guard. It sets one random password on the three (`payload.update`, `overrideAccess: true`, on the copy only), logs each in with `payload.login`, and writes `{ admin, fellow, student }` cookie values to a file in the scratchpad. What these writes trigger (read at `57248c77`): the password update runs `ensurePerson` and `syncFellowRoleOnLink` (both return at once: the account has a person or is an admin, and the write sends no `person`) and `announceAcceptance` (returns at once: it acts only on a first sign-in of an invited account, `src/lib/invitation.ts:69-87`); the login runs `markActivated`, which writes nothing for an account that has `activated_at` (`invitation.ts:40-60`). So no notification row and no mail; the guard makes sure of it. Cookies expire (Payload's default token life is 2 h): run this script again before each probe run (T3, I7 perf, H5), each time with `env "${OFF[@]}"`.

- [ ] **Step 1: The copy.** On the Mac, inside `verify.sh`'s lock (P17): restore `cilas_ttfb` from the newest prod dump by the four steps of Prod clone restore (R): find the dump (P36), create and fill with the container's tools, migrate the copy if `main` has a pending migration, and the residue check, which must print `0` for every table and for the test emails. Never copy `cilas_dev`. Write the dump name, size, date and format, and the residue counts, in the PR. `ttfb-accounts.ts` has its own name check, and no seed runs.
- [ ] **Step 2: Accounts.** `env "${OFF[@]}" DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_ttfb pnpm exec tsx scripts/ttfb-accounts.ts --out <scratch>/ttfb-cookies.json` (Mail off (M)). Expected: the guard line ("mail, push and storage are off"), three ids; the file holds three non-empty values. A test first: the same command with `RESEND_API_KEY=re_x` in place of the empty value exits 1 and names the mail check before any write (a reviewer reruns it).
- [ ] **Step 3: Production build.** In a fresh Mac worktree at the ref under test: `next build`, then `env "${OFF[@]}" NODE_ENV=production DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_ttfb pnpm start -p <port> > <scratch>/server-<ref>.log 2>&1` on a free local port, while `verify.sh`'s lock is held (P17). Server guard (Mail off (M)): after the first request, `grep -c "No email adapter provided" <scratch>/server-<ref>.log` prints at least `1`, and `env "${OFF[@]}" NODE_ENV=production DATABASE_URL=… pnpm exec tsx scripts/ttfb-accounts.ts --check-off` in the same worktree exits 0. Else stop the server and fix the env. Never `next dev`: dev compiles on request, so its TTFB measures the compiler. If `verify.sh` has a mode that serves a production build (P17), use it with the same keys and the same log check. Commit the script.

### Task T3: Measure and write the number

**Skills:** none beyond the above (benchmark-checklist from pstack applies to the number).

- [ ] **Step 1:** `node scripts/ttfb-probe.mjs --base http://localhost:<port> --path /en/spaces --cookies <scratch>/ttfb-cookies.json --warmup 5 --samples 30` on `main`, twice back to back (runs A and B; the table takes A's p75 and the `m` of A and B, as (G) defines it). If PR C has not merged, build PR C's head and run once more (the "context only" row). Nothing else heavy runs on the Mac during a run: check that `verify.sh`'s lock is held by this run only.
- [ ] **Step 2: Explain the number.** For each role, a p95 above 3x its p50 means noise or a cold path: rerun once and record both runs. Write in the PR what bounds the number (inferred from the layout's reads: `currentReader`, `mySpaces`).
- [ ] **Step 3:** Write the numbers in a PR comment (raw samples) and in the PR body (the table rows, the dump name and date). Open `chore(portal): TTFB probe and the /spaces baseline (portal phase 1c, PR 0)`. Then add the rows to the ledger, and fill the baseline table in this plan by the docs commit that "TTFB baseline" names. Keep `cilas_ttfb` for the perf gate (G) in 1c-2 and 1c-3 (same data, same accounts); drop it after H5 (`docker exec cilas-db-1 dropdb -U cilas cilas_ttfb`).

**Verification.**

- [ ] unit: `--self-test` passes.
- [ ] live: three roles each give 30 samples per run with status 200 against a production build on `cilas_ttfb`, restored from a prod dump with a zero residue check. Pass predicate: the ledger and the plan's baseline table (docs commit) have run A and run B p75 and `m` for each role with the dump name and date, the server log holds Payload's console-mail line, and the PR comment holds the raw samples.
- [ ] perf: this PR is the baseline. Its number is the trunk baseline for the perf gate (G).

---

## PR 1c-1. Needs core (`portal/phase-1c-needs`)

From `portal/phase-1b-list-data` (1b-2a) once it holds the 1b-1 head `c5a65fd6` or newer (P25; else the merge fallback there). Checks P1 to P7, P24 to P26, P30 and P35 first. No screen, no message key. Reviews: code-review, then security-review.

### Task N1: The source table and the row shape

**Skills:** tdd, design-an-interface (only if the builder finds a second real shape for `NeedSource`).

**Files:** Create `src/portal/needs/sources.ts`, `src/portal/needs/sources.unit.test.ts`, `src/lib/review-candidates.ts` (only `waitingKeys` in this task; N2 adds the reads).

**Interfaces:**

- Consumes: `StatusKey`, `STATUS_KEYS`, `waitsOn`, `KEY_WHERE` (P1, P2); `ReviewedCollection` (P6); `isAdminUser`, `mayAuthor`, `mayTeach` (P5).
- Produces:
  - `type NeedKind = 'review' | 'edit_review' | 'removal_review' | 'applicants' | 'changes_requested'` (spec).
  - `type NeedRow = { kind: NeedKind; verbKey: \`needs.${string}\`; href: string; label: string | null; count: number; owners: string[]; collection: ReviewedCollection | null }` (Deviation 13; `label` null when no locale has a title, the view then writes "Untitled article" or "Untitled course"; `collection` null on the `applicants` row).
  - `type NeedSource = 'reviewQueue' | 'applicants' | 'ownArticles' | 'ownCourses'`.
  - `SOURCES_OF(user): NeedSource[]`: admin `['reviewQueue', 'applicants']`; else `ownArticles` when `mayAuthor(user)`, plus `ownCourses` when `mayTeach(user)`. One table. A reader with no role gets `[]`.
  - `KIND_OF_KEY: Partial<Record<StatusKey, NeedKind>>`: `submitted` `review`, `published_edits` `edit_review`, `published_removal` `removal_review`, `changes_requested` and `published_edits_returned` `changes_requested`.
  - `waitingKeys(side: 'owner' | 'admin'): StatusKey[]` in `src/lib/review-candidates.ts` (so `src/lib` reads it and imports nothing from `src/portal`): `STATUS_KEYS.filter((k) => waitsOn(k) === side)`. No key list is written by hand.
  - `VERB_OF: Record<NeedKind, \`needs.${string}\`>`: `needs.review`, `needs.editReview`, `needs.removalReview`, `needs.applicants`, `needs.changesRequested` (spec verbs).
- [ ] **Step 1: Failing tests** (`pnpm exec vitest run --project node src/portal/needs/sources.unit.test.ts`): "SOURCES_OF($role) is $sources" (admin, fellow with person, student with person, member with no person, no role); "every waiting key has a need kind" (each key in `waitingKeys('owner')` and `waitingKeys('admin')` has `KIND_OF_KEY`, and each has a `KEY_WHERE` row); "no key that waits on nobody has a need kind". Run: FAIL.
- [ ] **Step 2: Implement.** Run: PASS. Commit.

### Task N2: One candidate reader, one admin set, the review rows and `countReviewQueue`

**Skills:** tdd, payload, codebase-design (the moved module's interface).

**Files:** Create `src/lib/review-candidates.int.test.ts`, `src/lib/review-queue.int.test.ts`, `testing/needs.fixture.ts`. Modify `src/lib/review-candidates.ts` (N1 made it), `src/portal/lists/rows.ts` (Step 1), `src/lib/review-queue.ts`, `src/components/admin/dashboard/quick-actions.tsx` (one line, Step 3), and `testing/portal-lists.fixture.ts` only for the `bulk` option when P35 fails.

**Interfaces:**

- Consumes: `KEY_WHERE`, `KEY_SELECT`, `statusSelect`, `statusInputOf`, `statusOf`, `waitsOn`, `LIVE_COPY`, `liveParentIds` (P1, P2, P30); `REVIEWED` (`src/lib/reviewed-collections.ts`, which names each collection's owner field); `relId` (`src/lib/relation.ts`); 1b-2a's reads in `rows.ts` (P7).
- Produces (`src/lib/review-candidates.ts`, server only, imports nothing from `src/portal`). One reader for 1b's lists and 1c's needs (Decision log P2):
  - `type ReadAccess = { user: User; overrideAccess: false } | { overrideAccess: true }`. The only `overrideAccess: true` caller is the admin queue (Deviation 17).
  - `candidateIds(payload, { collection, keys, base, access }): Promise<number[]>`: 1b-2a's `workCandidates` (`rows.ts:226` at `b160b637`), moved, on the 1b-1 `c5a65fd6` rule. The main rows of the keys whose `KEY_WHERE` row is `on: 'main'` (one `find`, `and: [base, { or }]`, `select: { id: true }`), and the parents of the version rows (one `findVersions` with `or` of the version rows, or `LIVE_COPY` when a key has no row, `select: { parent: true }`; no row holds a `parent.*` term, P2, so `withoutParentStatus` is deleted), both in one `Promise.all`, `depth: 0`, `pagination: false`. Then `liveParentIds(payload, { collection, ids: versionParents, user, where: base })` (P30; `user` null for `overrideAccess: true`) keeps the version parents that are live and inside `base`, in one read. That is the one base check of the version side (code review M-4); with no version parent it runs no read. An absent `base` (the admin queue) is left out of every `and`, so no `and` holds an empty `{}`. A version of a parent that is not live is dropped for the admin too: `statusOf` reads such a document from its main row (`review-status.ts`, the `doc._status !== 'published'` branch), and the main side finds it if its main row waits. Distinct ids, sorted.
  - `keyedRows(payload, { collection, ids, base, access, select, read }): Promise<Map<number, { id; main; latest; key: StatusKey | null }>>`: 1b-2a's `readEntries` with `readMains`, `readLatest` and `newestPerParent` (`rows.ts:137-206` at `b160b637`), moved. It reads `KEY_SELECT` plus the caller's `select` with `locale: 'all'` (both titles come from this read; there is no `locale` argument) and keeps the newest `updatedAt` per parent. Its main read keeps `base` in its `and` (absent `base` left out): that is the data read, not a second base query. `read: 'full'` is 1b-2a's behaviour (`rows.ts` passes it with `{ tier: true, cover_image: true }`): the full reviewed fields (`statusSelect`) for every live row with a draft copy, so `statusOf` never throws. `read: 'keys'` runs no second read (P3); a row whose keys read throws gets `key: null`.
  - `waitingSet(payload, { collection, side, base, access }): Promise<{ keys: Map<number, StatusKey>; dropped: number[] }>`: `candidateIds` for `waitingKeys(side)`, then `keyedRows` with `select: {}` and `read: 'keys'`. An id joins `keys` when `waitsOn(key) === side`; every other candidate (a `null` key, or a key that does not wait on `side`) goes in `dropped`. This is the one set of a source: its count is `keys.size`, and its rows are made from `keys`, one row per id with that key (code review M-1, spec review M-1). `dropped` is a `KEY_WHERE` drift: the caller logs it once (`payload.logger.warn`, the collection and the ids), and N2's tests and N6 fail when it is not empty.
  - `rows.ts` keeps its own `Ctx` and calls `candidateIds` and `keyedRows(..., read: 'full')`. No other change in `rows.ts`.
- Produces (`src/lib/review-queue.ts`). One rule for the admin queue (Deviation 21):
  - `adminQueue(payload): Promise<{ sets: Record<ReviewedCollection, Map<number, StatusKey>>; dropped: Record<ReviewedCollection, number[]> }>`: `waitingSet` for `side: 'admin'`, no `base`, `access: { overrideAccess: true }`, for the three `REVIEWED` collections in one `Promise.all`.
  - `countReviewQueue(payload): Promise<number>`: the sum of the sizes of `adminQueue(payload).sets`. The dashboard tile calls it (Step 3).
  - `adminReviewRows(payload, sets: Record<ReviewedCollection, Map<number, StatusKey>>, locale): Promise<Array<{ collection; kind: QueueKind; id; key: StatusKey; title: { en: string | null; ar: string | null }; owners: string[]; since: string }>>`: exactly one row per id of `sets`, with the set's key. It reads only display fields: `keyedRows` with `select` the title and the collection's owner field (`REVIEWED`), `read: 'keys'` (its key is not used), then one `find` of `people` for the owner names (`id in`, `select: { name: true }`, `depth: 0`, `locale`). It does not read candidates and does not filter: an id whose details read finds nothing (deleted between the two reads) still gets its row, with null titles and no owners. So the count and the rows of one `sets` value are equal by construction. `since` is the latest version's `updatedAt` (the submit write), else the main row's. Oldest first.
  - `getReviewQueue(payload)` is `adminReviewRows(payload, (await adminQueue(payload)).sets, 'en')` mapped to today's `QueueItem` (same fields; `removal` is `key === 'published_removal'`; `title` in English first, as today reads `title` with no locale). Its caller `src/components/admin/review-queue.tsx` does not change.
- Produces (`testing/needs.fixture.ts`): `needsWorld(payload, track, world)`. It calls `listWorld(payload, track, world, { bulk: 0 })` (P26, P35: the 60 `bulk` rows serve only 1b's paging tests), which gives one student-owned article for every status key (among them `draft`, `submitted`, `published_edits`, `published_removal`, `changes_requested`, `published_edits_returned`, `rejected`, `published_edits_declined`, `published_removal_kept`, `published`) and courses owned by its `list-teacher` fellow. It adds only what 1c needs, through `trustedWrites` (P26) and no copy of its bodies:
  - the course keys `listWorld` does not make, `changes_requested` and `published_removal`, owned by `world.accounts.fellow` (`fellows: [world.accounts.fellow.person]`), the e2e fellow, so that fellow has owner rows in e2e (code review H-3; `listWorld`'s teacher stays the second fellow of the int tests);
  - one publication at `submitted` (a `payload.create` and the submit write, `overrideAccess: true`, as the 1b fixture writes);
  - the taken-down near miss (code review M-1): a published article of the student with edits submitted (`published_edits`), then taken down with `trustedWrites` `unpublish`;
  - the applicants rows: one course application with two course choices (one decision `null`, one `pending`), one programme application, and one course choice `accepted`.
  It returns every id, by collection and key. Each int file calls it once, in `beforeAll`, never per test (code review M-6): the files run in parallel on one database within vitest's 120 s `hookTimeout` (`vitest.config.mts`).

- [ ] **Step 1: Move the reads** (P7, on a base that holds `c5a65fd6`). Move `workCandidates` and `readEntries` (with `readMains`, `readLatest`, `newestPerParent`) from `rows.ts` to `src/lib/review-candidates.ts` as `candidateIds` and `keyedRows`, with the interfaces above. Delete `withoutParentStatus` if it is still there, and use `liveParentIds` for the version parents. `rows.ts` calls them with `read: 'full'`. Run **[verify]** `src/portal/lists/rows.int.test.ts` (with the next group, P17): PASS, unchanged. Commit `refactor(review): one candidate reader for lists and needs`.
- [ ] **Step 2: Failing int tests** **[verify]** (`src/lib/review-queue.int.test.ts`, Int test setup; read by the fixture's ids, never by table counts):
  - "the admin set holds exactly the documents that wait on the admin, for every state" (spec review M-1): for each fixture document, in every collection, it is in `adminQueue(payload).sets` if and only if `waitsOn` of its key, read with `statusInputOf(..., read: 'full')` in the test, is `'admin'`. The fixture holds every admin key and the near misses: a live document with a copy at `changes_requested` (`published_edits_returned`), declined edits, a kept removal, a `rejected` one, a `published` one with an equal copy, a `draft` one, and the taken-down article. No fixture id is in `dropped`.
  - "adminReviewRows makes one row per id of the set": for one `sets` value, the rows' ids equal the set's ids and each row's `key` is the set's key; `countReviewQueue` read from the same value (the sum of sizes) equals the number of rows.
  - "getReviewQueue keeps its shape": each item has `kind`, `id`, `title`, `removal`, `by`, `since`, `href` as today; `removal` is true only for `published_removal`.
  - Run: FAIL (functions missing).
- [ ] **Step 3: Implement** `waitingSet`, `adminQueue`, `countReviewQueue`, `adminReviewRows`, and move `getReviewQueue` onto them. Delete the old two queries and `namesOf`. `quick-actions.tsx:36` calls `countReviewQueue(payload)` in place of `(await getReviewQueue(payload)).length` (code review L-7: the tile reads the same rule). Run **[verify]**: PASS; `src/lib/publishing.int.test.ts` and any test of `src/components/admin/review-queue.tsx` still pass. Commit.
- [ ] **Step 4: Owner path int test** **[verify]** (`src/lib/review-candidates.int.test.ts`): "an owner's set is their own waiting rows only" (student: the fixture's two owner-waiting articles; the world fellow: the two courses `needsWorld` gives them; another member: none; a co-author removed in the copy: no `published_edits_returned` candidate for them, 1b U4); "a version parent outside base is not a candidate" (the `liveParentIds` read with `where: base`); "a version parent that is not live is not a candidate" (the taken-down article). PASS. Commit.

### Task N3: The owner sources

**Skills:** tdd, payload.

**Files:** Create `src/portal/needs/owner-rows.ts`. Modify `src/portal/needs/needs.int.test.ts` (new in this task).

**Interfaces:**

- Consumes: `waitingSet`, `keyedRows` (N2); `ownsViaAuthors`, `ownsViaFellows`, `personOf` (P5); `documentHref` (P4); `KIND_OF_KEY`, `VERB_OF` (N1).
- Produces: `ownSet(payload, user, collection: 'articles' | 'courses'): Promise<{ keys: Map<number, StatusKey>; dropped: number[] }>`: no person gives an empty set with no query; else `waitingSet` with `side: 'owner'`, `base: ownsVia…(user)`, `access: { user, overrideAccess: false }`. `ownRows(payload, user, collection, keys, locale): Promise<NeedRow[]>`: one row per id of `keys`, with the set's key: a details read (`keyedRows` for those ids, same `base` and access, `select` the title, `read: 'keys'`), then `kind` from `KIND_OF_KEY`, `href: documentHref({ collection, id, viewer: 'owner', waiting: false, locale })`, `label`: the latest version's title in `locale`, else the other locale, else null (1b Deviation 8), `count: 1`, `owners: []`. It does not filter, as `adminReviewRows`.
- [ ] **Step 1: Failing int tests** **[verify]**: "a student's needs hold their changes_requested and returned-edits articles"; "the world fellow's needs hold their changes_requested course" (`needsWorld`'s course; the fellow's set is not empty); "a declined article is not in needs(owner)" (spec); "declined edits and a kept removal are not in needs(owner)"; "a member with no person has no rows and runs no query" (a synthetic user, as `src/lib/publishing.int.test.ts:399`, and a thin proxy of `payload` that counts `find` calls: 0); "a publication with changes requested is not in needs(owner)" (spec, D16). FAIL, implement, PASS. Commit.

### Task N4: `countWaitingApplicants`

**Skills:** tdd, payload.

**Files:** Modify `src/forms/applicants.ts`, `src/forms/applicants.int.test.ts` (add a describe).

**Interfaces:**

- Consumes: `applicantViewer` (`src/forms/applicants.ts:12`).
- Produces: `countWaitingApplicants(payload, user): Promise<{ total: number }>` (Deviation 3). `applicantViewer(user)` null gives `{ total: 0 }` with no query. Share the rule, not the read (code review L-5): `applicantsFor` reads courses with `depth: 1`, `populate` and `locale` (`:39-52`), so a shared read would serve neither. Move only the `where` into one local function `viewerCoursesWhere(viewer): Where | undefined` (`fellows contains person` for a fellow, none for an admin) that both `applicantsFor` and the count use. The count reads course ids with that `where`, `select: { id: true }`, `depth: 0`, `pagination: false`, `overrideAccess: true`: for an admin every course id, for a fellow the courses they teach. Then the `ids.length === 0` guard returns `{ total: 0 }` with no submissions read, for either role (code review L-2). Else one `find` of `form-submissions` narrowed in the database (code review M-7): `where: { and: [{ 'choices.course': { in: ids } }, { or: [{ 'choices.decision': { equals: 'pending' } }, { 'choices.decision': { exists: false } }] }] }`, `select: { choices: { course: true, decision: true } }`, `depth: 0`, `pagination: false`, `overrideAccess: true`. The `where` only narrows: an array field matches when any one choice matches, so the reduce stays the rule: one per choice whose course is in `ids` and whose `decision` is null or `pending`. A programme application counts 0 (spec). If N7 measures `countWaitingApplicants` p75 above 100 ms for any role (the line in "Check open source first"), the grouped SQL through the pool (as `claimDigest`, `src/lib/space-digest.ts:170`) replaces it in 1c-1, with the same tests.
- [ ] **Step 1: Failing int tests** **[verify]** (spec, Tasks, Tests; read by the fixture's course ids): "counts 2 for one applicant with two waiting course choices"; "counts 0 for a programme application"; "counts a null decision as waiting"; "an accepted choice does not count"; "a submission whose choices are all decided is not read" (the narrowing); "a fellow counts only the courses they teach"; "a student counts 0 and runs no query". FAIL, implement, PASS; the existing `applicants` int specs (`applicants.int.test.ts`, `applicants-data.int.test.ts`) still pass. Commit.

### Task N5: `needs(user, locale)` and `needsCounts(user)`

**Skills:** tdd.

**Files:** Create `src/portal/needs/needs.ts`. Modify `src/portal/needs/needs.int.test.ts`.

**Interfaces:**

- Consumes: N1 to N4; `cache` (`react`).
- Produces (pure functions, which the tests call):
  - `type WorkSets = { reviewQueue?: Record<ReviewedCollection, Map<number, StatusKey>>; applicants?: number; ownArticles?: Map<number, StatusKey>; ownCourses?: Map<number, StatusKey>; dropped: Array<{ collection: ReviewedCollection; id: number }>; failed: NeedSource[] }`.
  - `workSetsOf(payload, user): Promise<WorkSets>`: each source of `SOURCES_OF(user)` in `Promise.allSettled`. `reviewQueue`: `isAdminUser(user)` is checked again here, before `adminQueue` (a projection read, Deviation 17); a non-admin never reaches it. `applicants`: `countWaitingApplicants(payload, user).total`. `ownArticles`, `ownCourses`: `ownSet`. Each source's `dropped` ids go in `dropped`, and a non-empty `dropped` is logged once (`payload.logger.warn`). A rejected source logs the error with the source name and lands in `failed` (spec, Errors).
  - `type NeedsCounts = { total: number | null; by: Partial<Record<NeedSource, number | null>> }`. `countsOf(sets): NeedsCounts`: the sizes (the applicants number as is). A failed source is `null` in `by`, and then `total` is `null` (spec: "the count then shows no number, not a wrong one").
  - `type NeedsResult = { rows: NeedRow[]; failed: NeedSource[] }`. `rowsOf(payload, user, sets, locale): Promise<NeedsResult>`: `adminReviewRows(payload, sets.reviewQueue, locale)` mapped to rows (`href` from `documentHref({ collection, id, viewer: 'admin', waiting: true, locale })`, `owners` the names); the applicants row when `sets.applicants > 0`: `{ kind: 'applicants', verbKey: 'needs.applicants', href: '/admin/applicants', label: null, count: sets.applicants, owners: [], collection: null }` (Deviation 5, P29); `ownRows` for each owner set. A rows step that throws adds its source to `failed`. Rows sort: the admin's review rows oldest first, then the applicants row; an owner's rows by the latest version's `updatedAt`, oldest first.
  - `needsTotal(result): number | null`: the sum of `count`, or null when `failed` is not empty. Home and the Inbox page read it.
  - `needsOf(payload, user, locale)`: `rowsOf(payload, user, await workSetsOf(payload, user), locale)`.
- Produces (cached, which the layout and the pages call; one read per request, Global Constraints):
  - `workOf = cache(async (user: User) => workSetsOf(await getPayload({ config }), user))`.
  - `needsCounts = cache(async (user: User) => countsOf(await workOf(user)))`.
  - `needs = cache(async (user: User, locale: Locale) => rowsOf(await getPayload({ config }), user, await workOf(user), locale))`.
- [ ] **Step 1: Failing int tests** **[verify]** (spec, Tasks, Tests, on `needsWorld`, one call per file in `beforeAll`; the database is shared, so each assert reads the fixture's ids or one `WorkSets` value, never two table reads):
  - "the rows of needs(admin) hold every fixture document that waits on the admin, plus one applicants row" (the spec's row relation, on the fixture's ids; spec review M-3): `expect(fixtureRows.length).toBe(fixtureAdminIds.length + 1)`, where `fixtureRows` are the rows whose id is a fixture id plus the one row of kind `applicants`, and their ids equal the fixture's admin-waiting ids. The spec's whole-table relations (the total of `needs(admin)` equals `getReviewQueue().length` plus the pending course choices, and the rows equal `getReviewQueue().length` plus 1) run on the frozen prod clone in N6, where no other test writes (code review M-5).
  - "countsOf and rowsOf of one WorkSets agree for each role" (admin, fellow, student): `countsOf(sets).total === needsTotal(await rowsOf(payload, user, sets, locale))`, and `by.ownArticles` equals the article rows. This is the spec's "needsCounts(user) equals the total of needs(user)", on one read, so a write by another test file cannot make it flake. The fellow's and the student's totals are each at least 1 (the fixture gives them owner rows), so the equality is never 0 equals 0 (code review H-3).
  - "a non-admin never reads the admin queue" (code review M-4, spec review L-3): for the student, the fellow and a member with no person, `workSetsOf` holds no `reviewQueue`, `rowsOf` holds none of the fixture's admin-waiting ids, and a thin proxy of `payload` records no `find` or `findVersions` call with `overrideAccess: true`. A user whose `roles` array holds a string that is not a role (for example `'Admin'`) gets the same result (the rule is `isAdminUser`, not a string compare in `needs`).
  - "rowsOf reads no work set" (the part a unit test can prove): with empty sets it runs no read at all; with the fixture's sets, a thin proxy of `payload` records no `find` whose `select` is `{ id: true }` and no `findVersions` at all except the details read of `keyedRows` (`where` on `parent in` the set's ids). So the page's rows add only the details read to the layout's one set read.
  - "no fixture id is dropped": `workSetsOf` for each role holds no fixture id in `dropped`.
  - "a source that fails leaves the others" (a thin proxy of `payload` whose `find` on `form-submissions` throws; no mock library): `failed` is `['applicants']`, the review rows remain, `needsTotal` is null, `countsOf(...).total` is null.
  - FAIL, implement, PASS. Commit.

### Task N6: The prod-clone check

**Skills:** payload.

**Files:** Create `scripts/needs-check.int.test.ts`.

**Interfaces:**

- Produces: a vitest int file in the `node` project (P24: `server-only` resolves there, not under `tsx`). It is gated as `src/lib/community-search.int.test.ts:16` gates its disposable search: `describe.skipIf(!onNeedsCopy)`, where `onNeedsCopy` is true only when `DATABASE_URL` ends in `@localhost:5433/cilas_needs`. So the full suite on `cilas_dev` skips it, and it never runs on `cilas_dev`. It reads only and writes nothing, and calls `mockNetwork(...localServices)` with no Resend handler (the test guard of Mail off (M)). `cilas_needs` is restored from the newest prod dump by Prod clone restore (R), never copied from `cilas_dev` (spec review H-1, code review L-9). Drop it after N7 (`docker exec cilas-db-1 dropdb -U cilas cilas_needs`). It computes:
  1. `oracleQueue`: a frozen copy of trunk's `getReviewQueue` algorithm (`src/lib/review-queue.ts` at `57248c77`, lines 30-56: per collection the main `find` with `review.status: submitted` and the `findVersions` with `latest` and `version.review.status: submitted`, joined by id), written inline in the file with that SHA in a comment. It does not import `src/lib/review-queue.ts`.
  2. `oracleChoices`: from `applicantsFor(payload, { kind: 'admin' }, 'en')`, the number of entries in each application's `choices` whose `decision` is `pending`. Programme applications are left out: `applicantsFor` gives a programme its own `pending` decision (`src/forms/applicants.ts:167-173`), and the spec counts course choices only.
  3. For the admin of T2's rule (smallest admin id, read with `payload.findByID`, no sign-in): one `sets = await workSetsOf(payload, admin)`, then `result = await rowsOf(payload, admin, sets, 'en')`, `needsTotal(result)`, the row ids per collection, and `countsOf(sets).total`.
  It prints the dump's name and date (from the restore step, passed as `NEEDS_DUMP=<name> <date>` and printed), the four numbers, `sets.dropped`, and two id lists: in the oracle and not in `needs`, in `needs` and not in the oracle, each id with its collection, its `statusOf` key (full read) and its `createdAt`.
- **Pass predicate** (each an `expect`, so a difference fails the test): `oracleQueue.length > 0` and `oracleChoices > 0` (a check with nothing to compare proves nothing; when the clone truly has none, the run fails and the PR says so, and the operator decides); `needsTotal(result) === oracleQueue.length + oracleChoices`; `result.rows.length === oracleQueue.length + 1` (the spec's row relation, spec review M-3: the one applicants row exists because `oracleChoices > 0`); `countsOf(sets).total === needsTotal(result)`; `sets.dropped` is empty (code review M-1); both id lists are empty. A difference is not fixed by changing the check: each id goes in the PR with its `statusOf` key, and the builder decides with the reviewer whether trunk's queue or `waitsOn` is right (for example a live document whose main row says `submitted`; the old queue lists it, `KEY_WHERE.submitted` needs `NOT_LIVE`). That list is Deviation 21's evidence for the operator.
- Note: the admin dashboard tile "Applications waiting" counts submissions with status `new`, programmes included (`src/components/admin/dashboard/widgets/applications.tsx`). It is not the oracle: the spec counts pending course choices. The PR writes both numbers so the operator sees why they differ.

- [ ] **Step 1: The copy.** Inside the lock, restore `cilas_needs` by Prod clone restore (R) (the same dump as `cilas_ttfb` when T2 already ran; else the newest one). The residue check prints `0` everywhere.
- [ ] **Step 2: The env** (code review M-3). `vitest.setup.ts:12-18` stops unless `DATABASE_URL` holds `@localhost:5433/`, and `requireLocalStorage` stops unless `R2_ENDPOINT` and `R2_PUBLIC_URL` are local; `testEnv()` takes the `R2_*` set from `.env.development.local` in the cwd when the shell exports no `R2_ENDPOINT` (`testing/local-env.ts`). That file is untracked, so copy it into the 1c-1 worktree from the Mac's main checkout (`/Users/salah/Developer/cilas/.env.development.local`) unless P17 shows `verify.sh` already does. Do not export `R2_ENDPOINT` here: then `testEnv()` reads every `R2_*` key from the shell. `testEnv()` sets `RESEND_API_KEY` to a test key. Set the push and search keys to the empty string: `TEST_OFF=(VAPID_PUBLIC_KEY= VAPID_PRIVATE_KEY= TYPESENSE_API_KEY= TYPESENSE_PRIVATE_WRITE_KEY= TYPESENSE_PRIVATE_SEARCH_KEY=)`.
- [ ] **Step 3: Run.** On the Mac, in the 1c-1 worktree, under the lock in the form P17 found: `env "${TEST_OFF[@]}" DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_needs NEEDS_DUMP="<name> <date>" pnpm exec vitest run --project node scripts/needs-check.int.test.ts` (for example `flock <lock> env …` when `flock` is the form). Do not use `verify.sh --int-only` for it: that mode ignores the file and would run the whole int suite against `cilas_needs` (P17). If P17 shows `verify.sh` runs one file and keeps the caller's `DATABASE_URL`, `verify.sh --int-only <branch> <sha> scripts/needs-check.int.test.ts` with that env is the same command. Expected: 1 test file, PASS. Paste the output in a PR comment. Commit the file.

### Task N7: Cost per role, review, full suite, open PR 1c-1

**Skills:** code-review, then security-review.

- [ ] **Step 1: Cost before any cache** (spec, Tasks, Tests). A second `describe` in `scripts/needs-check.int.test.ts`, gated the same way and also on `NEEDS_COST=1`, with one `it` per role, each `{ timeout: 600_000 }` (vitest's default is 120 s, `vitest.config.mts`): for the three accounts of T2's rule (read with `payload.findByID`, no sign-in), call each source's set read (`adminQueue`, `countWaitingApplicants`, `ownSet`) and rows read (`adminReviewRows`, `ownRows`), and `workSetsOf` and `rowsOf` as a whole, 20 times after 3 warm-up calls, and the trunk oracle queue the same way in the admin's `it`. Print p50 and p75 per role and function in ms, nearest rank (T1's rule). Command: N6 Step 3 with `NEEDS_COST=1` added. Write the table in the PR.
- [ ] **Step 2: code-review** against the base, with the spec's Tasks section as the issue. Static check of the one-read rule (spec review L-7), pasted in the PR: `rg -n "waitingSet\(|adminQueue\(|ownSet\(|countWaitingApplicants\(" src --glob '!**/*.test.*'` lists only the functions' own definitions, `workSetsOf`, `countReviewQueue`, `getReviewQueue` and the tile's call of `countReviewQueue`.
- [ ] **Step 3: security-review.** Write in the PR: `adminQueue` and `adminReviewRows` read with `overrideAccess: true` and every caller checks `isAdminUser` first (`workSetsOf`, the admin pages that call `getReviewQueue` and `countReviewQueue`); owner reads are gated and add the ownership `where`, and `liveParentIds` reads under it; `countWaitingApplicants` reads `form-submissions` only inside `src/forms/applicants.ts` and returns a number only; no new endpoint; `rg -l "@/portal/" src/lib src/components src/forms src/i18n` prints nothing.
- [ ] **Step 4:** Fix. **[verify]** the full suite. Per-PR step 5. Open `feat(portal): needs(user), needsCounts(user) and one candidate reader (portal phase 1c, PR 1)`. Blast Radius (Deviation 21): the admin review queue page and the dashboard tile read the new set; N6 lists every id where they differ from trunk on the prod clone, with its key, and the PR repeats that list; `rows.ts` calls the moved reads and its tests pass unchanged.

**Verification.**

- [ ] unit: `sources.unit.test.ts`; int: `review-queue.int.test.ts`, `review-candidates.int.test.ts`, `needs.int.test.ts`, the `applicants` count cases, `rows.int.test.ts` unchanged.
- [ ] live: N6 on the prod clone. Pass predicate: the N6 predicate (non-empty oracle, equal totals, rows equal the oracle queue plus 1, no dropped id, empty id lists) on a copy restored from a prod dump with a zero residue check. Also open `/admin` as the admin on the Mac dev server and see that the "Reviews waiting" tile equals `oracleQueue.length` (reads only).
- [ ] perf: metric p75 ms per function and role (N7 Step 1). Trunk baseline first: the oracle queue (trunk `getReviewQueue`) timed in the same run. Fails when `adminQueue` plus `adminReviewRows` p75 is more than 1.5x the oracle's p75, or when `workSetsOf` p75 (what every portal page streams, now with the keys read) is above 150 ms for any role.

---

## PR 1c-2. Inbox, counts and live refresh (`portal/phase-1c-inbox`)

From `portal/phase-1a-shell` (PR C) with 1c-1 merged in. Checks P8 to P13, P19, P22, P23, P26 to P29, P31 to P34 first, and P32 before I6 Step 2. Read "Order with 1b-2b" first. Reviews: ux-auditor and better-interface on the Inbox page and the sidebar counts, then break-ui; code-review, then security-review (review predicate, Global Constraints).

### Task I1: Fixture for the portal e2e

**Skills:** tdd.

**Files:** Modify `testing/portal.fixture.ts` (add `portalNeedsWorld` through a new export only; existing exports do not change), `testing/portal-lists.fixture.ts` (export `makeAccount` only), `testing/portal-e2e.test-utils.ts` (add `/spaces/inbox` to a shape table; add `inbox` to `NAV_BY_ROLE` for every role, in nav order, after `home`).

**Interfaces:**

- Consumes: `needsWorld` (N2), `portalWorld`, `notifyOf` (P26).
- Produces: `portalNeedsWorld(payload, track)`: `portalWorld` plus `needsWorld` owned by its accounts (the courses `needsWorld` adds have `world.accounts.fellow` as their fellow, N2), so the e2e admin sees a known review set on top of whatever `cilas_dev` holds, and the e2e fellow and student have owner rows (code review H-3). The e2e therefore asserts "the Home count equals the sidebar number" and the rows of the fixture's ids, never a fixed total. It also writes, through `notifyOf` (P26), one notification for each role whose `link` is a post of the fixture's space (for the Latest rows), and 34 more for the student, each awaited in turn so `createdAt` grows (35 in all, for **Show more**). The second-session test submits `listWorld`'s student-owned `draft` article (P26), so the fixture needs no new article for it. `PortalWorld` has one admin (`accounts.admin`, PR C `testing/portal.fixture.ts:63`), so `portalNeedsWorld` adds `secondAdmin`, an account with `['admin']` and the fixture's password, for the stale-count test. `testing/portal-lists.fixture.ts:28` has a `makeAccount` that is not exported: export it there in one line (1b-2a's file; say so in the PR) rather than write a second copy.
- [ ] **Step 1:** `testing/portal.fixture.int.test.ts` gains "portalNeedsWorld gives the student two owner rows, the fellow at least one, and the student 35 notifications" **[verify]** (with the I-group run, P17; one world per file in `beforeAll`). FAIL, write, PASS. Commit.

### Task I2: The Inbox nav item and the streamed counts

**Skills:** tdd, modern-web-guidance (first), arc.

**Files:** Modify `src/portal/nav/portal-nav.ts`, `portal-nav.unit.test.ts`, `nav-icons.ts`, `portal-shell.tsx`, `sidebar.browser.test.tsx` (its item fixture drops `count`), `src/app/(frontend)/[locale]/(portal)/spaces/layout.tsx`, `messages/{en,ar}.json` (`Portal.nav.inbox`). Create `src/portal/nav/nav-counts.tsx`, `src/portal/nav/nav-counts.dom.test.tsx`.

**Interfaces:**

- Consumes: `needsCounts`, `NeedsCounts` (N5); `currentReader` cached (P28).
- Produces:
  - `PortalNavItem.key` adds `'inbox'`; `PortalNavIcon` adds `'inbox'` (lucide `Inbox`). `portalNav(user)` keeps one argument (spec; Deviation 14). The field `count` goes from `PortalNavItem` and from every item (Deviation 14, P8; if 1b-2b landed first, from its items too). Order: Home, Inbox, then the rest as before.
  - `src/portal/nav/nav-counts.tsx` (`'use client'`): `COUNT_OF: Partial<Record<PortalNavItem['key'], (c: NeedsCounts) => number | null>>`, one table: `inbox` gives `c.total`; when P15 holds, `articles` gives `c.by.ownArticles ?? null` and `courses` gives `c.by.ownCourses ?? null` for owners (admin: no row, spec). `NavCountsProvider({ counts, children })` holds `counts: Promise<NeedsCounts | null>` in a context. `useNavCount(key): number | null` reads the context with `use()` and applies `COUNT_OF[key]`; no context or a `null` value gives `null`.
  - The layout: `const counts = needsCounts(user).catch((err) => { payload.logger.error({ err }, 'portal nav: the counts did not load'); return null })`, with no `await`, written right after `currentReader` resolves and before the `Promise.all`, so the count reads overlap `mySpaces` (spec review L-6). It goes to `PortalShell` as `counts`. `PortalShell` wraps its output in `NavCountsProvider`. The `Promise.all` itself does not change (Global Constraints, counts never hold the first byte).
- [ ] **Step 1: Failing tests.** `pnpm exec vitest run --project node src/portal/nav/portal-nav.unit.test.ts`: "Inbox is the second top item for $role"; "portalNav takes one argument and no item has a count field" (`expect(item).not.toHaveProperty('count')`). `pnpm exec vitest run --project dom src/portal/nav/nav-counts.dom.test.tsx`: "useNavCount('inbox') is the total"; "a null counts value gives null on every item"; "a rejected promise never reaches use()" (the layout's `.catch`: the provider gets `null`); with P15, "an admin's Articles and Courses give null". FAIL, implement, PASS. Commit.
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

**Files:** Create `src/portal/needs/need-list.tsx`, `src/portal/needs/latest-list.tsx`, `src/portal/needs/latest.ts`, `src/portal/needs/read-link.tsx`, `src/portal/needs/read-link.dom.test.tsx`, `src/portal/needs/needs.module.css`, `src/portal/needs/need-list.dom.test.tsx`, `src/portal/needs/latest-list.dom.test.tsx`, `src/components/notification-glyphs.tsx`, `src/portal/inbox/inbox-page.tsx`, `src/app/(frontend)/[locale]/(portal)/spaces/inbox/page.tsx`, `src/app/(frontend)/[locale]/(portal)/spaces/inbox/loading.tsx`. Modify `src/components/site-notifications.tsx` (import the glyph map), `src/lib/notifications-client.ts` (`markRead` option), `messages/{en,ar}.json` (`Portal.needs`, `Portal.latest`, `Portal.inbox`).

**Interfaces:**

- Consumes: `needs`, `needsTotal`, `NeedRow` (N5); `currentReader` (P28); `PortalEmptyState` (P12); `announce` (PR C); `catchError` (P20); `noteText` and `markRead` from `src/lib/notifications-client.ts` (`:32-66` at `57248c77`; already exported; server-safe, P33); the `Notifications` messages (`getTranslations('Notifications')`, `kinds.*`, as the bell, P34); `NOTIFICATION_KINDS`, `isNotificationKind` (`src/lib/notification-kinds.ts`).
- Produces:
  - `src/components/notification-glyphs.tsx` (no `'use client'`, lucide icons only): `NOTIFICATION_GLYPHS: Record<NotificationIcon, ReactNode>`, the map that is module-local in the bell today (`site-notifications.tsx:47`, a `'use client'` file, so a server component cannot read it). The bell imports it in place of its own `GLYPHS`; no other bell change.
  - `markRead(id, read, { keepalive }?: { keepalive?: boolean })` in `notifications-client.ts`: passes `keepalive` to `fetch`, so a PATCH sent as a plain `<a>` navigates is not cut off (code review M-6). The bell's calls pass no option and do not change.
  - `NeedList({ rows, group }: { rows: NeedRow[]; group: boolean })` (server). Each row is one `<a href>` (Global Constraints, links): the verb (`t(row.verbKey, { count })`), the label in `<bdi dir="auto">` (or "Untitled article" / "Untitled course"), the owner names on admin rows. `group` true (Home with more than 5 rows) collapses rows to one per kind with the sum of `count` and the kind's verb with the number; a grouped `review`, `edit_review` or `removal_review` row links to `/admin/reviews` (P29), a grouped `changes_requested` row to `/{locale}/spaces/articles?show=needsYou` when the group holds an article and to `/{locale}/spaces/courses?show=needsYou` otherwise (1b list filter; while P15 fails those pages do not exist, so the link is `/admin/collections/articles` or `/admin/collections/courses`), `applicants` stays its own row (spec, Tasks, "Where the two lists show"). The list is a `<ul>` under an `<h2>` with the count.
  - `latestRows(payload, user, { limit, locale })` in `latest.ts`: gated `find` of `notifications` (`user`, `overrideAccess: false`; read access is the owner's, P34; `recipient` equals `user.id`, `sort: '-createdAt'`, `limit`, `depth: 0`, `select` the fields the bell reads, `read_at` included). Rows are read by `limit` (the newest `30 x n`), not by a cursor. `LatestList({ rows, more })` (server): a read row is a plain `<a>` whose `href` is the stored `link`, unchanged (Global Constraints, links; the bell does the same at `site-notifications.tsx:109`); an unread row is a `ReadLink`; a row with no `link` is text, not a link. The text is `noteText` with the kind's name, and the glyph from `NOTIFICATION_GLYPHS`. An unread row has a dot with hidden text "Unread".
  - `ReadLink({ href, id, children })` (`read-link.tsx`, `'use client'`, a small eager part of first-render rows; code review M-5): it renders the row's `<a href>` itself, with `onClick` and `onAuxClick` (a middle click or a new-tab click fires `auxclick`, not `click`). Each calls `markRead(id, true, { keepalive: true })` and lets the navigation go on (no `preventDefault`). The anchor is plain HTML, so the link still works before hydration; a row opened then stays unread until the bell's next read, which is accepted.
  - `/spaces/inbox`: all roles (spec, Routes). `<h1>` "Inbox". Section Needs you (`NeedList`, `group: false`), then section Latest (30 rows, Deviation 11, **Show more** link `?latest=n&focus=latest`). `latest` parse rule (code review M-7): `n = Number(param)`; when `n` is an integer from 1 to 10 the page reads `30 x n` rows, else (absent, `abc`, `0`, `-1`, `1.5`, `99999`) `n` is 1. `inbox/loading.tsx` (code review H-2) renders the `h1` row and two section skeletons (Arc `Skeleton`), as `(home)/loading.tsx` does for Home: so the page, which awaits `needs(user, locale)`, streams under the layout and the first byte waits only for the layout. The layout's auth check stays above it (phase 1a, "No streaming boundary above the check"). Empty texts (spec, Onboarding): "Nothing needs you now." and "Nothing new yet. Replies, reviews and decisions show here." A failed source shows "Some tasks could not load. Reload." above the rows of the others (spec, Errors). Each section sits in a `catchError` boundary: "This could not load." with **Retry**. The page reads `needs(user, locale)` with the `user` of `currentReader()`, so it shares the layout's read (one read per request).
- [ ] **Step 1: Failing dom tests**: "a row is one link named by its verb and label"; "an admin row names the owners"; "grouped rows sum count per kind and keep applicants apart"; "a grouped changes_requested row with an article links to the Articles list"; "an untitled row says Untitled article"; `latest-list.dom.test.tsx`: "a Latest row links to its stored link unchanged" (an `/admin/applicants?application=4` link and an `/en/spaces/x` link keep their `href`), "a row with no link is not a link", "a known kind uses the bell's words and glyph"; `read-link.dom.test.tsx`: "a click marks the row read with keepalive and keeps the navigation" and "a middle click (auxclick) marks the row read" (a fetch spy through `mockNetwork`, no mock library); `inbox-page` param rule as a unit of the page's parser: "latest=$value reads $rows rows" for `2` (60), `10` (300), `abc`, `0`, `-1`, `1.5`, `99999` (30 each). FAIL, implement, PASS. The bell's `src/components/notification-feed.browser.test.tsx` still passes (**[verify]**, with the I-group run). Commit.
- [ ] **Step 2: Show more focus.** As 1b L5's `NewRowsFocus` (read it on the base; reuse it if 1b-2b landed, else write the same small part here and say so): focus the row at index `30 x (n - 1)` of the new list (the 31st row after the first **Show more**), `announce("{n} more rows.")`, take `focus` out of the URL. Rows are read by `limit`, so a notification that arrives between two loads moves the rows by one and the focused row may be one the reader saw: accepted, the focus still lands at the page boundary. Dom test "Show more moves focus to the 31st row". Commit.

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

- [ ] **Step 1: Tests** (matrix: role, locale, width 1440 and 390; phase 1a Deviation 19 exemptions; the spec asks 320px for the shell and Home, not Inbox, so Inbox runs at 1440 and 390 only, spec review L-5), `describe('inbox')`. Every count assert waits for the settled name (`expect.poll`), because counts stream:
  - "Inbox shows Needs you, then Latest" (the fixture's rows for the role, in order; each Needs you row link's `href` starts with `/admin/`; Latest holds the fixture's notification, and its `href` equals the stored `link`).
  - "the sidebar Inbox number equals the Needs you count on Inbox" (at 1440 the sidebar, at 390 the bottom bar item's name). For the fellow and the student the number is at least 1 (the fixture's owner rows), so the test never compares 0 with 0 (code review H-3).
  - "Show more loads the other 5 rows and moves focus to the 31st" (the student's 35 notifications, I1; code review M-7).
  - "a Latest row opens its link and marks it read": click an unread row (plain navigation). Pass predicate: on the page it opens, the bell's unread count is one less than before the click, polled for 5 s (the PATCH went with `keepalive`).
  - "an owner submits in a second session and the admin's Inbox number changes with no reload" (spec): admin on `/spaces/inbox`; a second browser context, the student, submits `listWorld`'s `draft` article (I1) through the REST write `/admin` sends (`submit-for-review.tsx:62-67`); before the submit the test sets `window.noReloadMark = true` on the admin's page and starts polling the admin's Inbox name every 100 ms. Pass: within 5 s the name reads one more; no poll saw the name with no number once it had one (a refresh does not blank the chip, I3); `page.evaluate(() => window.noReloadMark)` is still `true` (a reload would clear it). After the test it deletes the `submitted` notification rows the submit wrote, by their `link`. The submit runs the real notify, mail and push hooks on `cilas_dev`, a prod clone with real admin addresses: this test and the next one run only when P32 holds (the `verify.sh` server runs with the Mail off (M) keys set to the empty string and its log holds Payload's console-mail line); else stop (code review H-1).
  - "a second admin's number is right after a reload" (Deviation 18): admin A (`accounts.admin`) and admin B (`secondAdmin`, I1) on `/spaces/inbox`; A approves a fixture submission through the REST write the admin sends; B reloads. Pass: B's Inbox name is one less than before. The test states that B's number before the reload may be stale.
  - "a keyboard walk reaches every part of Inbox" (spec, Accessibility baseline, keyboard-only walk): from the top, Tab only. The stops hold, as a subsequence in this order (other shell stops may sit between): the skip link, the Inbox nav item, the first Needs you row, the first Latest row, **Show more** when it shows. No stop repeats before the last (no trap), and each stop's `outline-style` is not `none`.
  - "Inbox at 200% zoom has no horizontal scroll" (the 200% check the operator asked for Home and Inbox): viewport 640x400 with `deviceScaleFactor: 2` (1280x800 at 200%). Pass: `document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth`, and the two section headings and the first row of each section are visible.
  - axe: `axeOver` with the shell's known table gives `{}` on `/spaces/inbox`.
  - `portal-home.empty.e2e.test.ts` on `cilas_empty` (P18, P27; P23 keeps it off the normal run), each role with `EMPTY_ACCOUNTS`: no console error, one `h1`, "Nothing needs you now.", the Latest empty text, and an Inbox nav item with no number.
- [ ] **Step 2: Run** **[verify]** (P32 first: its two checks are in the PR; then `verify.sh --e2e-only <branch> <sha> e2e/portal-home.e2e.test.ts e2e/portal-shell.e2e.test.ts`, then the empty spec with `--db empty`). Expected: all pass, the run's server log holds Payload's console-mail line, and a normal run lists no `*.empty.e2e.test.ts` spec. Commit.

### Task I7: Reviews, full suite, open PR 1c-2

**Skills:** ux-auditor, better-interface (full), then break-ui; code-review, then security-review.

- [ ] **Step 1:** ux-auditor and better-interface on `/spaces/inbox` and the sidebar counts, at 1440 and 390, English and Arabic. Review predicate (Global Constraints).
- [ ] **Step 2:** break-ui: a 120-character Arabic title with no space, an English title on an Arabic page, 0, 1, 9, 10 and 120 tasks, a reader with no person, a failed source, 300 notifications, a count that settles 3 s late. Review predicate.
- [ ] **Step 3:** code-review, then security-review (the layout now starts `needsCounts` on every portal page; the admin check before every projection read; no new endpoint; `ReadLink` uses the existing save path and its access; Latest links are stored values rendered as `href`, so check that only `notifications` rows the reader owns are read). Static check, pasted in the PR (spec review L-7): `rg -n "needs\(" "src/app/(frontend)/[locale]/(portal)/spaces/layout.tsx"` prints nothing (the layout calls only `needsCounts`), and N7 Step 2's `rg` still lists only its named callers. Review predicate.
- [ ] **Step 4: Perf gate (G)** on `/en/spaces` and `/en/spaces/inbox`: the two `main` runs at the table's SHA, then this PR's head (and C2 on a near miss), as Global Constraints says, with Mail off (M). If T3 asked Q8 and the operator has not answered, wait (TTFB baseline). Write the per-role record of (G) in the PR.
- [ ] **Step 5:** Fix. **[verify]** the full suite. Open `feat(portal): Inbox, nav counts and live refresh (portal phase 1c, PR 2)`. Operator review before merge.

**Verification.**

- [ ] unit: `portal-nav.unit.test.ts`, `nav-counts.dom.test.tsx`, `need-list.dom.test.tsx`, `latest-list.dom.test.tsx`, `work-refresh.dom.test.tsx`, `sidebar.browser.test.tsx`.
- [ ] live: on the Mac, with agent-browser headless, against the `verify.sh` server once P32 holds (it writes on `cilas_dev`): the second-session submit scenario of I6. Pass predicate: the admin's Inbox name changes by +1 within 5 s, no poll saw it lose its number, and a `window` marker set before the submit is still there. Also: the probe's saved first-sample body of the perf run (`<scratch>/ttfb-<role>.html`) holds a `data-nav-count` element for the admin (the counts arrived in the same response), and the saved body for `/en/spaces/inbox` holds the `inbox/loading.tsx` skeleton marker (`data-inbox-skeleton`) and the Needs you section later in the same response (the page streamed).
- [ ] perf: the perf gate (G) of Global Constraints, I7 Step 4. Metric TTFB p75 per role on `/en/spaces` and `/en/spaces/inbox`. Trunk baseline: `main` at the table's SHA, run twice first in the same session (validity against the 1c-0 table, and `S` and `m`). Fails as (G) says: a head p75 above `S x (1 + 2m)`, or above `S x (1 + m)` twice, or at 800 ms or more when the table's number is under 800 ms.

---

## PR 1c-3. Home (`portal/phase-1c-home`)

From `portal/phase-1c-inbox`. Reviews: ux-auditor and better-interface on Home, then break-ui; code-review, then security-review (review predicate, Global Constraints).

### Task H1: `readerCourseIds` and the next session

**Skills:** tdd, payload.

**Files:** Create `src/lib/reader-courses.ts`, `src/lib/reader-courses.int.test.ts`, `src/portal/home/next-session.ts`.

**Interfaces:**

- Consumes: `personOf` (P5); `meetingsOf`, `nextMeeting` (`src/lib/meetings.ts:59, 124`); `cairoDay` (`src/lib/cairo-day.ts`).
- Produces: `readerCourseIds(payload, user): Promise<number[]>` (Deviation 9): gated `find` of `courses` (`fellows contains person`, `select: { id: true }`, `depth: 0`, `pagination: false`) and gated `find` of `enrollments` (`person equals person`, `status equals accepted`, `select: { course: true }`, `depth: 0`, `pagination: false`), the union. No person: `[]`. `nextSession(payload, user, locale): Promise<{ course: { id; slug; title; cover: string | null }; session: { title; date; start_time } ; href: string } | null>`: one gated `find` of `sessions` for those ids (`select: { course: true, title: true, position: true, meetings: true, cancelled: true }`; `sessionsInOrder` orders sessions with no meeting by `position`, `src/lib/meetings.ts:45-55`, so without it the session numbers can be wrong; code review L-5). `meetingsOf` numbers sessions per course (`src/lib/meetings.ts:59`), so group the sessions by course, call `meetingsOf` and `nextMeeting(…, cairoDay(new Date()))` per course, and take the earliest result. A meeting carries its session's number, not its title: map it back to the session through the same order (`sessionsInOrder`) to get the title (code review L-2). Then the course row (gated, `select` `title`, `slug`, `cover_image`; the field is `cover_image`, `src/collections/Courses.ts:175`). `href` is the course space when spaces are on and the reader can read it, else `/{locale}/study/{slug}` (Deviation 10).
- [ ] **Step 1: Failing int tests** **[verify]**: "a student's courses are their accepted enrollments"; "a fellow's courses are the ones they teach"; "a pending enrollment gives no course"; "nextSession skips a cancelled meeting and a past one"; "no course gives null". FAIL, implement, PASS. Commit.

### Task H2: Home cards

**Skills:** modern-web-guidance (first), arc, better-layout, better-typography, better-colors (the cover overlay), better-accessibility, better-writing then humanizer, tdd.

**Files:** Create `src/portal/home/{greeting.tsx,needs-card.tsx,next-session-card.tsx,spaces-card.tsx,latest-card.tsx,card-boundary.tsx,home.module.css,home-cards.dom.test.tsx}`. Modify `messages/{en,ar}.json` (`Portal.home`).

**Interfaces:**

- Consumes: `needs`, `needsTotal` (N5), called with the `user` of `currentReader()` (P28) so the cards share the layout's read; `NeedList`, `LatestList`, `latestRows` (I4); `nextSession` (H1); `mySpaces`, `COMMUNITY_COVER` (`src/lib/spaces-data.ts`); `spacesOff` (P14); `spaceLabel` (PR C); `unreadCount` (P10); `PortalEmptyState` (P12); `catchError` (P20); Arc `badge`, `card`, `skeleton`.
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

- [ ] **Step 1:** Run the perf gate (G) of Global Constraints on `/en/spaces`: on the Mac, `cilas_ttfb` (T3 kept it), the same three accounts with fresh cookies (T2), production builds with Mail off (M), inside the lock; the two `main` runs at the table's SHA first, then this PR's head (and C2 on a near miss). Write the per-role record of (G) in the PR.
- [ ] **Step 2: Pass predicate:** the one in (G): head p75 at most `S x (1 + m)`, a near miss up to `S x (1 + 2m)` reruns once and the rerun decides, and the 800 ms rule. The margin `m` is the measured run-to-run spread of this session, capped at 10% (Deviation 20); no other allowance applies.
- [ ] **Step 3:** If it fails: profile which read grows (the layout's reads, and the Home cards only if TTFB moved, since cards stream below `loading.tsx`), using N7's per-function numbers. When TTFB moved while the counts stream, look at pool wait first: the layout starts about 9 reads for an admin on every portal page, they share the `pg` pool with `mySpaces` and the page, and the pool has no `max` set (`src/payload.config.ts:300-306`, default 10; code review L-8). Fix that read (for example the SQL fallback for N4) and rerun. No cache is added without the operator's yes (spec: measure before any cache). Drop `cilas_ttfb` after the last run (`docker exec cilas-db-1 dropdb -U cilas cilas_ttfb`).

### Task H6: Reviews, full suite, open PR 1c-3

**Skills:** ux-auditor, better-interface (full), then break-ui; code-review, then security-review.

- [ ] **Step 1:** ux-auditor and better-interface on Home (spec, Phase 1c Review), 1440, 390 and 320px, both languages, light and dark. Inbox had its review at the 1c-2 head (I7); review it again here only if `git diff --name-only <1c-2 head>..HEAD` lists a file Inbox renders (`src/portal/needs/need-list.tsx`, `latest-list.tsx`, `src/portal/inbox/*`, the nav). So each page has one review at the head that last changed it. Review predicate.
- [ ] **Step 2:** break-ui: a 60-character Arabic first name, no person, 0 and 120 unread spaces, 40 spaces, a course with no cover, a session at 23:30 Cairo, 6 and 60 Needs you rows, a failed card. Review predicate.
- [ ] **Step 3:** code-review, then security-review, review predicate (Home reads are gated; no `/admin` shortcut remains; `rg -n "/admin/" "src/app/(frontend)/[locale]/(portal)" src/portal` lists only `documentHref` results, `/admin/applicants`, `/admin/reviews` and **Open dashboard**).
- [ ] **Step 4:** Fix. **[verify]** the full suite. Open `feat(portal): Home replaces the spaces page (portal phase 1c, PR 3)`. Operator review before merge.

**Verification.**

- [ ] unit: `home-cards.dom.test.tsx`, `reader-courses.int.test.ts`.
- [ ] live: on the Mac with agent-browser headless, as the student of `cilas_ttfb`: Home shows a next session tile whose time matches the course page's session time, and a click on a Latest post row loads the full post page. Pass predicate: same date and time text; URL is the post path and no `dialog` is in the tree.
- [ ] perf: the perf gate (G), H5. Metric TTFB p75 per role of `/en/spaces`, production build, `cilas_ttfb`. Trunk baseline: `main` at the table's SHA, run twice first in the same session (validity against the 1c-0 table, and `S` and `m`). Fails as (G) says.

---

## PR 1c-4. `courseTypeKey` callers (`portal/phase-1c-course-type`)

From `main` after 1b-2b merges (P16). No screen change. Review: code-review.

### Task K1: Two callers

**Skills:** tdd.

**Files:** Modify `src/components/bridge/bridge-year.tsx:91`, `src/components/article/article-page.tsx:137` (line numbers at `57248c77`; find the copy with `rg -n "Study.filters.types|course_type" <file>`).

- [ ] **Step 1:** Each file calls `courseTypeKey(type)` in place of its own key string. Before: `rg -n 'types\.\$\{' src/components/bridge/bridge-year.tsx src/components/article/article-page.tsx` prints the two copies (`` tf(`types.${c.type.toLowerCase()}`) ``, `bridge-year.tsx:91`, `article-page.tsx:137` at `57248c77`; code review L-3: the old pattern matched nothing). After: the same command prints nothing. `src/api/courses.api.ts:133` is moved by 1b-2b itself (1b plan L4 Step 1). `rg -n 'types\.\$\{' src --glob '!src/fields/course-type.ts'` lists the other hits on the base (at `57248c77`: `src/app/(frontend)/[locale]/(site)/study/[slug]/CourseView.tsx:110` and `:685`, `calendar/page.tsx:57` and `:65`, `src/lib/calendar-feed.ts:28`). Each hit whose input is a `CourseType` moves to `courseTypeKey` in this PR too (add its file to the PR's files and say so); a hit that reads another value (a calendar kind) stays, and the PR names it. Run the files' existing tests (find them with `rg -l "bridge-year|article-page" src e2e`): PASS. Open `refactor(courses): one course type key (portal phase 1c, PR 4)`.

**Verification.**

- [ ] unit: the existing tests of both components pass.
- [ ] live: on the Mac dev server, an article page that names a course and a bridge-year page show the same course type words as on `main`, in English and Arabic. Pass predicate: equal text.
- [ ] perf: n/a, with a predicate: `git diff --stat <base>..HEAD` lists only the files of K1 Step 1, and no diff adds or changes a data read (no `payload.`, `fetch` or `find` line in the diff). A string helper has no runtime cost to measure.

---

## Review Focus

The inputs the spec implies and no clause tests, most likely first.

1. **The old queue and `waitsOn` disagree on a real row.** For example a live document whose main row holds `review.status: submitted` (the old queue lists it; `KEY_WHERE.submitted` needs `NOT_LIVE`), or a document taken down while its copy is still `submitted` (the old queue lists it; `liveParentIds` drops it, P30). N6 prints such ids; the PR lists each for the operator (Deviation 21).
2. **An admin who is also an owner.** The spec gives admins only the queue and the applicants row. An admin's own article at `changes_requested` gets no Needs you row. N1 table test pins it; Q5 asks the operator.
3. **A failed source.** The total shows no number, the other rows stay, the card says "Some tasks could not load". N5, I4, H2.
4. **Two tabs.** A refresh in one tab does not reach the other; each tab has its own stream and debounce. The I6 second-session test covers another account, not another tab of the same account.
5. **Stale numbers that no event refreshes** (Deviation 18). A second admin's Inbox keeps a row another admin decided until a load. A soft navigation re-renders the page but not the layout, so the sidebar number can differ from a fresh Needs you list for a moment (code review L-8). The e2e "equal numbers" tests compare after a full load only, never right after a soft navigation that raced a change. I6 pins the bound (a reload gives the right number).
6. **A streamed count that settles late or fails.** The nav shows no number until it settles; a failed count shows none (I2, I3). A refresh keeps a shown number until the new one is ready (I3). break-ui runs a 3 s late count (I7).
7. **Worst-case rows and counts:** a 120-character Arabic title, 120 tasks, a reader with no person, 40 spaces at 320px. I7, H6.
8. **A soft navigation from Home to a post.** Every post link on Home is a plain `<a>` (H4).

## Decision log (structural)

Each problem, then its fix.

- P1. The review queue (`review-queue.ts:30-56`) and `waitsOn` are two rules for "what waits on an admin": the queue reads raw `review.status`, `KEY_WHERE` adds `NOT_LIVE` and the live parent. A count from one and a list from the other can disagree. And a count of candidates with a list of the rows that pass `statusOf` can disagree too (code review M-1). Fix: one set per source, `waitingSet` (the `KEY_WHERE` candidates with live parents, kept when their keys-only key waits on the side, N2). The count is its size, and the rows are one row per id of it, with its key, so they cannot differ. `adminQueue` is that set for the admin; `getReviewQueue`, `countReviewQueue`, the dashboard tile and `needs(admin)` read it (Deviation 21). A candidate whose key does not wait is in `dropped`, and N2's int test and N6 fail when `dropped` is not empty. The old algorithm survives only as the frozen oracle in `scripts/needs-check.int.test.ts` (N6), so the check is independent of the code it checks.
- P2. Candidate reads ("main rows by `KEY_WHERE`, version rows by `KEY_WHERE`, live parents inside the base `where`") are already written in 1b-2a's `rows.ts` (`workCandidates`, `readEntries`) and 1b-1's `liveParentIds`, and 1c would write them again. Fix: N2 Step 1 moves them to `src/lib/review-candidates.ts` as `candidateIds` and `keyedRows` and calls `liveParentIds`; `rows.ts` and `needs` both call them (P7, P30, Requests to phase 1b). The 1c fixture calls 1b-2a's `trustedWrites` and `listWorld` (with `bulk: 0`) and adds only what 1c needs (P26, P35).
- P3. `needs` and `needsCounts` could each list which sources a role has. Fix: `SOURCES_OF(user)` (N1), read by both.
- P4. Which status keys are work could be written by hand in `needs`. Fix: `waitingKeys(side)` derives them from `waitsOn` over `STATUS_KEYS`; `KIND_OF_KEY` is checked by a test against it (N1).
- P5. The courses a viewer may see applicants for are read inside `applicantsFor` only. Fix: `viewerCoursesWhere` in `src/forms/applicants.ts`, used by `applicantsFor` and `countWaitingApplicants` (N4). The rule is shared, not the read, because the two reads need different `depth` and `select`.
- P6. The Home count and the sidebar number come from two functions, and each would read the work sets on its own. Fix: `workOf(user)` reads the sets once per request (React `cache`, keyed on the one `User` object of P28); `needsCounts` is `countsOf` of the sets and `needs` is `rowsOf` of the same sets; `needsTotal` is the one sum for rows; N5 tests that `countsOf` and `rowsOf` of one value agree, and the e2e checks both numbers agree (I6, H4).
- P7. Nav counts could be wired item by item in the layout, and an awaited count would hold the first byte of every portal page. Fix: `COUNT_OF` in `src/portal/nav/nav-counts.tsx` maps a key to its number, and the layout passes the `needsCounts` promise unawaited through `NavCountsProvider`; a later item adds one row (I2, I3). `portalNav(user)` stays a pure list of items.
- P8. A live refresh rule could live inside the bell. Fix: `WorkRefresh` and `refreshes(event)` in `src/portal/needs/` (I5); the bell stays the Latest list.
- P9. "The reader's courses" is needed by Home now and the calendar in 1d. Fix: `readerCourseIds` in `src/lib/reader-courses.ts` (H1), which 1d reuses.
- P10. The old `/spaces` page held its own shortcut list, its spaces-off branch and its CSS. Fix: delete them with the page (H3, Subtract Before You Add); Home composes cards from `src/portal/home/`.
- P11. The bell's glyph map is local to a `'use client'` file, so the server-rendered Latest rows would need a copy. Fix: `src/components/notification-glyphs.tsx`, beside the bell, read by the bell and `LatestList` (I4). `noteText` already lives in `src/lib/notifications-client.ts` and both read it.
- P12. A Latest row could build its link with locale logic of its own, unlike the bell. Fix: both render the stored `link` unchanged (Global Constraints, links).
- P13. Nav counts lived in two places: `PortalNavItem.count` (always `null`) and `COUNT_OF`. Fix: delete the field (I2, Deviation 14); `COUNT_OF` is the one table.
- P14. "Mail is off" was a convention each step had to remember (unset keys, which `.env` fills again). Fix: one rule, Mail off (M): empty keys, one guard in `ttfb-accounts.ts` that every write step runs, and the server's own log line as the proof (P31, P32).

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

1. **1b-2a:** 1c-1 N2 Step 1 moves `workCandidates` and `readEntries` (with `readMains`, `readLatest`, `newestPerParent`) out of `rows.ts` into `src/lib/review-candidates.ts`, deletes `withoutParentStatus` and calls 1b-1's `liveParentIds`; `rows.ts` behaviour does not change. Please rebase 1b-2a on the 1b-1 head `c5a65fd6` or newer (P25), and tell the 1c orchestrator before a change to those functions' rules lands, so N2 moves the newest version. If 1b-2a prefers to do the move itself, it may; 1c-1 then uses it (P7 fallback). Please also give `listWorld` a `bulk` option, `{ bulk = 60 }: { bulk?: number } = {}`, so `needsWorld` can skip the 60 paging rows (P35; 1c-1 adds it if 1b-2a has not). Later, 1c-2 I1 exports `makeAccount` from `testing/portal-lists.fixture.ts` (one line).
2. **1b-2b, if it lands after 1c-2:** add `articles: (c) => c.by.ownArticles ?? null` and `courses: (c) => c.by.ownCourses ?? null` to `COUNT_OF` in `src/portal/nav/nav-counts.tsx` for owners in its L1 commit, and add `{ key: 'inbox', … }` after `home` when it rewrites `NAV_BY_ROLE`. `portalNav(user)` keeps one argument, and its items carry no `count` field (Deviation 14). If 1b-2b lands first, 1c-2 deletes `count: null` from its two items.
3. **1b-2b, either order:** its L6 `testIgnore` rule for `*.empty.e2e.test.ts` (P23) is the one 1c-2 adds if it lands first; keep the same text so the merge has one side.

## Open questions (product calls)

Each has a default, so no build waits.

- **Q1. Greeting with no checklist.** Default: "Hello, {first name}." from the linked person's name; "Hello." with no person (Deviation 8).
- **Q2. Next session link with spaces off.** Default: the public course page (Deviation 10).
- **Q3. Does opening an Inbox Latest row mark it read?** Default: yes, as the bell does (Deviation 11).
- **Q4. Live space unread counts and live Latest rows.** Default: not in 1c (Deviation 7, 12). The layout refreshes on work kinds only. A later phase may refresh on post events.
- **Q5. An admin's own returned work.** The spec gives admins no owner rows. Default: follow the spec; an admin's own `changes_requested` article shows in the Articles list's groups, not in Needs you.
- **Q6. Inbox Latest page size.** The spec says 30 is "a default the owner may change". Default: 30, with a 300-row cap (Deviation 11).
- **Q7. A second admin's stale numbers.** Polling, or a notification to every admin on each decision, would refresh admin B. Default: neither in 1c; a load gives the right number (Deviation 18). Polling needs the operator's yes.
- **Q8. The shell's own TTFB cost.** If T3's PR C row already fails the perf gate (G) against the session's `main` runs, 1c cannot pass without shell work. Owner: the 1c-0 builder posts the numbers to the ledger's phase 1c row as a question at T3; the 1c orchestrator holds 1c-2's I7 Step 4 (not I1 to I6) until the operator answers. Default until then: the gate stays the `main` row, and the operator decides between shell work and accepting the PR C row as "today's page".

## Could not verify from this server

- `verify.sh`'s modes, lock and `--db empty` (P17, P18): the Mac was not read.
- Whether `verify.sh`'s e2e server runs with mail off (P32): a hard stop for I6's write tests and the 1c-2 live box until checked.
- Whether a prod dump is on the Mac, and its name, date and format (P36): `~/Backups/cilas/` was not read. Whether the dump needs migrations to reach `main` (Prod clone restore (R) step 3).
- The table names of the slug collections in the residue check (Prod clone restore (R) step 4): taken from the collection slugs, checked with `\dt` on the Mac.
- Whether Payload sessions are on for `users` (T2 relies on the real login, so either way works).
- Next 16.4.6 `catchError` at run time (P20): docs read, not run.
- Every "Expected" line: no command ran.
- The `verify.sh` lock file path, and whether `verify.sh` passes a caller's `DATABASE_URL` to the tests (P17): the Mac was not read. N6 gives a command that does not depend on either.
- That React `cache` shares one entry between the layout and the page in Next 16.4.6: read in the docs (P28), not run. No unit test can count the reads (Global Constraints, one read).
- That `router.refresh()` keeps a shown chip number until the new promise settles: React's transition rule, tested in I3, not run.
- Whether the prod dump holds at least one submitted document and one pending course choice (N6 fails when not).
- That `liveParentIds` and the keys-only set give the same ids as the full read on real data: 1b-1's int test pins `KEY_WHERE` (P2); N2 and N6 assert `dropped` is empty. Not run.
- Formatting: `pnpm format:check` (oxfmt) did not run here (no `node_modules` on this server). The first Mac task runs `pnpm exec oxfmt docs/superpowers/plans/2026-11-21-portal-phase-1c-tasks-home-inbox.md` if the check flags this file.
