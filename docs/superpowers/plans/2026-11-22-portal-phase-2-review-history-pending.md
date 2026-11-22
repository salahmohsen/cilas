# Portal phase 2: To review, history and the pending provider. Implementation plan

> **For agentic workers:** use the pstack poteto-mode skill and its Feature playbook (`<newest pstack>/skills/poteto-mode/playbooks/feature.md`). Use only pstack/poteto skills; never superpowers or caveman. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins decide on submitted articles, courses and publications in the portal (To review), with a 5 s undo window, a history of every review move and a field diff. Owners open their work in the portal as read-only pages, and withdraw, request removal or discard their changes there. Every email and bell link opens the page that fits the reader's role.

**Architecture:** Six PRs. PR 2-1 changes the review data model with no screen: one row lock for every write to a reviewed document (`lockRow`), the `review-events` collection (M1) and its hook, `reviewHistoryFor`, the `withdrawn` kind (M3), the withdraw and discard moves (D3), and one module of owner moves. PR 2-2 changes how links are built and sent, with no visible link change yet: `documentHref` covers every notice, review emails go one per recipient in that recipient's locale, and the bell adds the reader's locale to a `/spaces` link. PR 2-3 adds the pending provider (a pure state machine and a client provider in the shell) and the **Sign out** flush. PR 2-4 adds the review endpoint `POST /api/{collection}/{id}/review` with its move table, `Origin` check, lock, stale check and idempotent retry, the course `onApprove` (D10) and the tier line (D6). PR 2-5 ships the owner's read-only pages `/spaces/articles/[id]` and `/spaces/courses/[id]`, with the banner, the history and the owner buttons, and switches the owner branch of `documentHref`. PR 2-6 ships To review (nav item, list, pane, diff, actions on the pending provider), switches the admin branch of `documentHref`, and adds the one-off link script.

**Tech stack:** Next.js 16.4.6 App Router, React 19.2.6, next-intl 4, Payload 3.91.0 (Postgres, `push: false`, `src/payload.config.ts`), Arc UI (`src/components/arc`), Vitest 4, Playwright 1.58.2, `@axe-core/playwright`.

**Spec:** `docs/superpowers/specs/2026-11-18-portal-design.md`: Phases (Phase 2 and the target table rows "To review, and an admin's `documentHref`" and "An owner's `documentHref`"), Pending decisions and the undo window, Review and history, Document links, Status model (Discard my changes, `published_unsent`), Tasks (`countReviewQueue`), Navigation, Routes, Feature folders, Data access rule, Lazy loading rule, Accessibility baseline, Design language (Toasts, Undo not confirm, Motion), UI skills, Migrations (M1, M3), Tests, Decisions log (D3, D6, D9, D10, D15, D16), Calls this spec makes that no decision covers. The spec wins where they differ, except for the Deviations below.

**Sources read for this plan** (by reading only; no command ran a build, a server or a test). Line numbers are true at the SHA given. Each premise check is a `git grep` or a type name, so it still works after a line moves.

| Source                           | Ref                                                                                                                      | SHA                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`                           | `origin/main`                                                                                                            | `9abfbe67` (#66, 1c-4), on top of `30c1a60a` (#65, 1d-2), `b107b9be` (#64, 1b-2b), `c3cdd332` (#63, 1d-1), `3cd81cc6` (#62, 1c-1). Phases 0, 1a, 1b, 1c-0, 1c-1, 1c-4, 1d-1 and 1d-2 are on `main` |
| Phase 1c PR 1c-2 (Inbox, counts) | `origin/portal/phase-1c-inbox`                                                                                           | `18b689b6` (in build, no PR merged): `COUNT_OF` in `src/portal/nav/nav-counts.tsx`, `PortalNavItem` with no `count`, `INBOX`, `PortalShell` takes `counts`                                         |
| Phase 1c PR 1c-3 (Home)          | plan on `main`, `docs/superpowers/plans/2026-11-21-portal-phase-1c-tasks-home-inbox.md`                                  | not started                                                                                                                                                                                        |
| Phase 1d PR 1d-3 (Calendar tab)  | `origin/portal/phase-1d-calendar`                                                                                        | `574c0508` (in build): `CALENDAR` in `portal-nav.ts`, `NAV_BY_ROLE` and route-shape rows in `testing/portal-e2e.test-utils.ts`                                                                     |
| Payload                          | `/home/salah/cilas/node_modules/payload` 3.91.0                                                                          | `dist/collections/operations/updateByID.js` (transaction `:24`, `beforeOperation` `:61`, document read `:132`), `restoreVersion.js` (`:26`, `:30`)                                                 |
| Next.js docs                     | `/home/salah/cilas/node_modules/next/dist/docs/` (16.4.6)                                                                | `01-app/03-api-reference/04-functions/refresh.md`, `use-router.md`                                                                                                                                 |
| ADRs                             | `docs/adr/0011-calendar-sessions-replace-schedule-pattern.md`, `0012-ui-sdk-wrappers.md`; `src/components/sdk/README.md` | `9abfbe67`                                                                                                                                                                                         |

**Who decided.** "Plan decision" marks a call of this plan writer. The phase 2 orchestrator may change it in a review round. "Operator rule" marks a rule from the ledger's "Rules for the run" (`/home/salah/cilas-portal-run/LEDGER.md`).

---

## What each reader sees

- **2-1:** nothing new on a page. An owner can withdraw a submission in `/admin` through the existing REST path (the move becomes legal). Admins get a `withdrawn` bell row (and a push, unless they turned the kind off) when an owner withdraws. A new preference row "Withdrawn" in Settings, Notifications, for admins.
- **2-2:** each review email goes to one address, so recipients no longer see each other's addresses. Links still open the admin (no target changes yet).
- **2-3:** nothing visible, except that **Sign out** in the portal waits for pending decisions (none exist until 2-6).
- **2-4:** nothing visible. A new API path that only the To review pane of 2-6 calls. An approved article's bell line names the tier.
- **2-5:** owners open their articles and courses in the portal from the lists, Home, Inbox, the bell and emails. The read-only page has the status banner, the history, and **Withdraw**, **Withdraw changes**, **Request removal** and **Discard my changes** with **Restore them**. **Edit** opens the admin editor.
- **2-6:** admins get **To review** in the sidebar (with its count), the list with the pane, the history, the diff, and decisions with a 5 s undo. Admin links to waiting documents open To review.

## PRs

| PR                    | Branch                           | Base                                       | Tasks        | Screen            | Ends when                                                                                                                                                                                            |
| --------------------- | -------------------------------- | ------------------------------------------ | ------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2-1. Review core      | `portal/phase-2-review-core`     | `origin/main`                              | V0, C1 to C8 | none              | `src/lib/review-events.int.test.ts`, `src/lib/lock-row.int.test.ts`, `src/migrations/portal-phase-2.int.test.ts`, `review.unit.test.ts`, `notification-preferences.unit.test.ts`, the audit snapshot |
| 2-2. Link plumbing    | `portal/phase-2-links`           | `origin/main` after 2-1 merges             | L1 to L5     | none              | `document-href.unit.test.ts`, `src/lib/review-mail.int.test.ts`, `site-notifications` dom test                                                                                                       |
| 2-3. Pending provider | `portal/phase-2-pending`         | `origin/main` after 1c-2 merges (P1)       | P1 to P6     | none (shell only) | `src/portal/pending/machine.unit.test.ts` (the spec's `pending` unit spec), `pending-provider.dom.test.tsx`, `pending-ring.browser.test.tsx`, the shell tests                                        |
| 2-4. Review endpoint  | `portal/phase-2-review-endpoint` | `origin/main` after 2-1 merges             | E1 to E7     | none              | `src/lib/review-endpoint.int.test.ts` (the spec's `review-events` int cases for the endpoint), `review-moves.unit.test.ts`                                                                           |
| 2-5. Owner pages      | `portal/phase-2-owner-pages`     | `origin/main` after 2-2 merges             | O1 to O7     | yes               | `e2e/portal-document.e2e.test.ts`, `document-href.unit.test.ts` (owner rows), the view tests                                                                                                         |
| 2-6. To review        | `portal/phase-2-to-review`       | `origin/main` after 2-3, 2-4 and 2-5 merge | R1 to R10    | yes               | `e2e/portal-review.e2e.test.ts` (the spec's `portal-review` and the `pending` e2e cases), the To review rows of `portal-shell`, `review-diff.unit.test.ts`, the end gate                             |

**Dependency graph.**

```
main ──┬── 2-1 ──┬── 2-2 ──── 2-5 ──┐
       │         └── 2-4 ───────────┼── 2-6
1c-2 ──┴── 2-3 ─────────────────────┘
1c-3, 1d-3 ┄┄ 2-3, 2-6 (soft: shared shell and nav files; see Shared files)
```

- 2-1 needs nothing of phase 2. It branches from `origin/main`.
- 2-2 needs 2-1: both change `notifyReview` in `src/lib/review-hooks.ts` and `src/lib/review-mail.ts`, and the per-recipient email test reads the `withdrawn` rule.
- 2-3 needs no other phase 2 PR. It needs 1c-2 on `main`, because it edits `portal-shell.tsx`, `account-menu.tsx`, `bottom-bar.tsx` and `more-sheet.tsx`, which 1c-2 also changes (P1). It may build in parallel with 2-1, 2-2 and 2-4.
- 2-4 needs 2-1 (`lockRow`, `review-events`, the withdraw move for the race tests). It may build in parallel with 2-2, 2-3 and 2-5.
- 2-5 needs 2-1 (owner moves, `reviewHistoryFor`) and 2-2 (`documentHref` shape, Deviation 3). It needs neither 2-3 nor 2-4: owner moves commit at once (spec, "Discard commits at once"), and they are not review decisions.
- 2-6 needs 2-3 (the provider), 2-4 (the endpoint) and 2-5 (the banner, history and body views in `src/portal/review/`, which 2-5 creates).

**Parallel build.** Up to three builders at a time: 2-1 and 2-3 first; then 2-2 and 2-4 after 2-1 merges; then 2-5 after 2-2; then 2-6 last. A builder may start a dependent PR before its base merges by branching from the base PR's branch, and rebases on `origin/main` once the base merges (the 1d-3 rule). The PR then targets `main`.

**Landing order:** 2-1, then 2-3 (any time after 1c-2), 2-2 and 2-4 in any order, then 2-5, then 2-6. Rebase each PR on `origin/main` before it opens and again before it merges (Shared files).

**Merge (MERGE RULE, ledger Rules).** Each PR squash-merges when READY, one at a time, under `merge.lock`, and waits for the deploy run. READY needs every verification box of the PR ticked (Global Constraints, Verification boxes). 2-1 is the first portal PR with a migration. The deploy of 2-1 applies M3 and M1 to production (Dockerfile `pnpm db:migrate`). Prod is a beta with no real users (memory prod-is-beta), and both migrations only add (a table, an enum value, a nullable column), so a rollback of the app does not need a down migration. The 2-1 merge also changes what every other thread's Mac runs need (Global Constraints, Database per run, and For the operator, item 1).

**Files each PR may touch.** A builder who needs a file outside its list stops and reports.

- **2-1:** `src/lib/lock-row.ts` and `src/lib/lock-row.int.test.ts` (new), `src/forms/application-decision.ts` (`load` calls `lockRow`), `src/lib/review.ts`, `src/lib/review.unit.test.ts`, `src/lib/review-hooks.ts`, `src/lib/notify.ts` (optional `req`), `src/lib/notification-kinds.ts`, `src/lib/notification-preferences.ts`, `src/lib/notification-preferences.unit.test.ts`, `src/collections/ReviewEvents.ts` (new), `src/payload.config.ts` (register the collection), `src/payload-types.ts` (generated), `src/lib/review-history.ts` (new), `src/lib/owner-moves.ts` (new), `src/lib/review-events.int.test.ts` (new), `src/migrations/<ts>_portal_withdrawn_kind.{ts,json}`, `src/migrations/<ts>_portal_review_events.{ts,json}`, `src/migrations/index.ts`, `src/migrations/portal-phase-2.int.test.ts` (new), `scripts/access-audit.snapshot.json` (regenerated), `messages/{en,ar}.json` (the `withdrawn` kind name and its preference label, under the keys the bell and Settings already read: P22), `testing/portal-lists.fixture.ts` (only an export, if C8 needs a writer), and the Mac runner `~/cilas-verify/verify.sh` (V0, outside the repo).
- **2-2:** `src/lib/document-href.ts`, `src/lib/document-href.unit.test.ts`, `src/lib/review-mail.ts`, `src/lib/review-mail.int.test.ts` (new), `src/lib/review-hooks.ts` (`notifyReview` only), `src/lib/review-queue.ts` (`getReviewQueue` `href`), `src/lib/invitation.ts` (one `link`), `src/forms/notify-application.ts` (two `link`s), `src/portal/needs/needs.ts`, `src/portal/needs/owner-rows.ts`, `src/portal/lists/list-row.tsx` (drop the `locale` argument, Deviation 3), `src/components/site-notifications.tsx` (one `href`), its dom test, `src/emails/transactional.ts` (only if P12 fails).
- **2-3:** `src/portal/pending/*` (new: `machine.ts`, `machine.unit.test.ts`, `pending-provider.tsx`, `pending-provider.dom.test.tsx`, `clock.ts`, `undo-ms.ts`, `undo-ms.unit.test.ts`, `pending-ring.tsx`, `pending-ring.module.css`, `pending-ring.browser.test.tsx`, `undo-all-bar.tsx`, `undo-all-bar.dom.test.tsx`, `pending-toast.tsx`, `sign-out.ts`, `pending.module.css`), `src/env.ts` (`NEXT_PUBLIC_PORTAL_UNDO_MS`), `src/portal/nav/portal-shell.tsx` (mount), `src/portal/nav/account-menu.tsx`, `src/portal/nav/bottom-bar.tsx`, `src/portal/nav/more-sheet.tsx` (sign-out flush, `overlay`), `src/portal/nav/more-sheet.browser.test.tsx`, `src/portal/nav/shell.module.css` (the bar's `scroll-padding-block-end`), `messages/{en,ar}.json` (`Portal.pending.*`), `playwright.config.ts` (the test env, only in the `env` of `webServer` and only if P8 needs it).
- **2-4:** `src/lib/review-moves.ts` and `src/lib/review-moves.unit.test.ts` (new), `src/lib/review-endpoint.ts` (new), `src/lib/review-endpoint.int.test.ts` (new), `src/collections/Articles.ts`, `src/collections/Courses.ts`, `src/collections/Publications.ts` (`endpoints`, and the course `onApprove`), `src/lib/review-hooks.ts` (the tier line of `NOTES.approved`), `testing/payload-rest.test-utils.ts` (JSON body and headers), `testing/row-lock.test-utils.ts` (new), `scripts/access-audit.snapshot.json` (only if the audit lists endpoints; P20).
- **2-5:** `src/portal/review/*` (new: `read-document.ts`, `review-banner.tsx`, `review-history.tsx`, `document-body.tsx`, their tests, `review.module.css`), `src/portal/document/*` (new: `document-page.tsx`, `owner-actions.ts`, `owner-buttons.ts`, `owner-buttons.unit.test.ts`, `owner-actions-bar.tsx`, `restore-line.tsx`, their tests, `document.module.css`), `src/app/(frontend)/[locale]/(portal)/spaces/articles/[id]/page.tsx` and `courses/[id]/page.tsx` (new), `src/lib/document-href.ts` (owner branch), `src/lib/document-href.unit.test.ts`, `messages/{en,ar}.json` (`Portal.document.*`, `Portal.history.*`, `Portal.banner.*`), `testing/portal-e2e.test-utils.ts` (route-shape rows), `testing/review.fixture.ts` (new), `e2e/portal-document.e2e.test.ts` (new), `e2e/portal-axe-known.json` (only by the axe rule).
- **2-6:** `src/portal/review/*` (add `review-list.tsx`, `review-pane.tsx`, `review-actions.tsx`, `review-diff-view.tsx`, `review-page.tsx`, `review-rows.ts`, `pane-data.ts`, their tests), `src/lib/review-diff.ts` and `review-diff.unit.test.ts` (new), `package.json` and `pnpm-lock.yaml` (add `diff`, Check open source first), `src/app/(frontend)/[locale]/(portal)/spaces/review/page.tsx`, `review/[collection]/[id]/page.tsx` (new), `src/portal/nav/portal-nav.ts`, `portal-nav.unit.test.ts`, `nav-icons.ts`, `nav-counts.tsx`, `src/lib/document-href.ts` (admin branch), `document-href.unit.test.ts`, `scripts/rewrite-notification-links.ts` and `scripts/rewrite-notification-links.int.test.ts` (new), `messages/{en,ar}.json` (`Portal.review.*`, `Portal.nav.review`), `testing/portal-e2e.test-utils.ts` (`NAV_BY_ROLE`, route shapes), `testing/review.fixture.ts`, `e2e/portal-review.e2e.test.ts` (new), `e2e/portal-shell.e2e.test.ts` (To review rows), `e2e/portal-axe-known.json` (only by the axe rule).

## Shared files

Phase 1c (1c-2 Inbox and counts, in build at `18b689b6`; 1c-3 Home, not started) and phase 1d (1d-3 Calendar tab, in build at `574c0508`) change the same shell files. Phase 2 starts building only after 1c merges (spec, Phase 2 "Depends on"). Each phase 2 edit is the smallest change. **Conflict rule:** rebase on `origin/main` before each PR opens and before it merges; on a conflict in a file below, keep the other phase's lines and re-apply only the phase 2 lines named here; re-run the premise of that file.

| File                                                                          | Who else changes it                                 | What phase 2 changes (smallest edit)                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/portal/nav/portal-nav.ts`                                                | 1c-2 (`INBOX`, no `count`), 1d-3 (`CALENDAR`)       | 2-6: one const `REVIEW` (`key: 'review'`, `labelKey: 'nav.review'`, `group: 'admin'`, `href: '/spaces/review'`, `icon: 'review'`), inserted in `ITEMS_BY_VIEW.admin` before `OPEN_DASHBOARD`; `'review'` joins the `key` and `PortalNavIcon` unions. No `count` field (P1) |
| `src/portal/nav/nav-counts.tsx`                                               | 1c-2 (new file)                                     | 2-6: one `COUNT_OF` row `review: (counts) => counts.by.reviewQueue ?? null` (P1, P2)                                                                                                                                                                                       |
| `src/portal/nav/nav-icons.ts`                                                 | 1c-2, 1d-3 (one icon each)                          | 2-6: one `review` icon (lucide `file-search`, the glyph of the `submitted` kind)                                                                                                                                                                                           |
| `src/portal/nav/portal-shell.tsx`                                             | 1c-2 (counts provider)                              | 2-3: wrap the shell's children in `<PendingProvider>` inside `FoldProvider`, and render `<UndoAllBar />` after `<main>`. No other line                                                                                                                                     |
| `src/portal/nav/account-menu.tsx`, `bottom-bar.tsx`, `more-sheet.tsx`         | 1c-2 (`bottom-bar.tsx` counts), 1c-3 (none planned) | 2-3: `useSignOut()` becomes `usePortalSignOut()` (one import and one call per file); `more-sheet.tsx` calls `useOverlay(open)` once                                                                                                                                        |
| `src/portal/nav/shell.module.css`                                             | 1c-2 (count chip)                                   | 2-3: one rule, `--pending-bar-block-size` added to the existing `scroll-padding-block-end` sum                                                                                                                                                                             |
| `src/components/site-notifications.tsx`                                       | 1c-2 (glyph map moves out)                          | 2-2: `href: n.link ? localizedLink(n.link, locale) : undefined` in `toItem` (one line)                                                                                                                                                                                     |
| Live refresh kinds (1c-2 task I5, file per P3)                                | 1c-2                                                | 2-1: add `'withdrawn'` to the kinds set, if 1c-2 typed it from `NotificationKind` (P3)                                                                                                                                                                                     |
| `src/portal/needs/needs.ts`, `owner-rows.ts`, `src/portal/lists/list-row.tsx` | 1c-2, 1c-3 (callers of `needs`)                     | 2-2: drop the `locale` argument of `documentHref` (Deviation 3). One argument per call                                                                                                                                                                                     |
| `src/lib/review-queue.ts`                                                     | none open                                           | 2-2: `getReviewQueue` `href` from `documentHref` (one line)                                                                                                                                                                                                                |
| `messages/{en,ar}.json`                                                       | 1c-2, 1c-3, 1d-3                                    | New keys only, under `Portal.pending`, `Portal.review`, `Portal.document`, `Portal.history`, `Portal.banner`, `Portal.nav.review`, and the `withdrawn` kind name                                                                                                           |
| `testing/portal-e2e.test-utils.ts`                                            | 1c-2, 1d-3                                          | 2-5, 2-6: route-shape rows and one `NAV_BY_ROLE` row for `review` (admin), by the 1d premise P4/P5 pattern (P13)                                                                                                                                                           |
| `e2e/portal-shell.e2e.test.ts`                                                | 1c-2, 1c-3, 1d-3                                    | 2-6: one `describe('To review item')` block; no edit to other blocks                                                                                                                                                                                                       |
| `e2e/portal-axe-known.json`                                                   | every screen PR                                     | Only by the axe rule (Global Constraints)                                                                                                                                                                                                                                  |
| `src/collections/Articles.ts`, `Courses.ts`, `Publications.ts`                | none open                                           | 2-4: `endpoints` entry and the course `onApprove`; 2-1 adds nothing to them (the review hooks come through `reviewHooks`)                                                                                                                                                  |
| `src/payload.config.ts`, `src/migrations/index.ts`                            | none open                                           | 2-1 only: register `ReviewEvents`; two migration entries                                                                                                                                                                                                                   |

## Premises to re-check before build

Each premise names what this plan assumes, the SHA where it was read, the PR that uses it, and the exact check. The builder runs the check as the first step of the PR that uses it and writes the output in the PR body. A failed check uses the fallback written beside it, never a new design.

- **P1. 1c-2 shape of the nav.** At `18b689b6` (not on `main`): `PortalNavItem` has no `count`; counts come from `COUNT_OF` in `src/portal/nav/nav-counts.tsx`; `PortalShell` takes `counts`. Used by 2-3 (shell files) and 2-6 R1.
  - Check: `git grep -n "export const COUNT_OF" origin/main -- src/portal/nav/nav-counts.tsx`. Prints a line: 1c-2 is on `main`; go. Prints nothing: 2-3 waits (its base rule), and 2-6 R1 also adds `count: null` to `REVIEW` if `git grep -n "count: number | null" origin/main -- src/portal/nav/portal-nav.ts` prints a line.
- **P2. The review count key.** On `main` at `9abfbe67`, `NeedsCounts` is `{ total; by: Partial<Record<NeedSource, number | null>> }` and `countsOf` fills `by.reviewQueue` (`src/portal/needs/needs.ts:62`, `:83`). Used by 2-6 R1.
  - Check: `git grep -n "'reviewQueue'" origin/main -- src/portal/needs/needs.ts` prints the `case` and the loop line.
- **P3. Live refresh kinds.** The spec lists `withdrawn` among the kinds that refresh the shell (Tasks, Data). 1c-2 task I5 builds the refresh; at `18b689b6` no `work-refresh` file exists yet. Used by 2-1 C3.
  - Check: `git grep -nE "'application'" origin/main -- src/portal | grep -v test`. If a kinds set prints, add `'withdrawn'` to it in C3. If it prints nothing (1c-2 not merged when 2-1 builds), send a request to the 1c orchestrator: "add `withdrawn` when it exists in `NOTIFICATION_KINDS`", and 2-6 R1 re-runs the check and adds it.
- **P4. The lock runs inside the operation's transaction.** In Payload 3.91.0, `updateByID` starts the transaction (`updateByID.js:24`), then runs `beforeOperation` (`:61`), then reads the document (`:132`); `restoreVersion` does the same (`restoreVersion.js:26`, `:30`). So a `lockRow` call in `recordDraftSave` holds the lock before the hooks read `originalDoc`. Used by 2-1 C1 (Deviation 1).
  - Check: `grep -n "initTransaction\|buildBeforeOperation\|getLatestCollectionVersion" /home/salah/cilas/node_modules/payload/dist/collections/operations/updateByID.js` prints the three in that order. The C1 int test "a second write waits for the first" proves it at run time.
- **P5. The transaction session.** `load` in `src/forms/application-decision.ts:59-70` reads `payload.db.sessions[String(req.transactionID)].db` and runs `select … for update` through it. Used by 2-1 C1.
  - Check: `git grep -n "for update" origin/main -- src/forms/application-decision.ts` prints one line.
- **P6. Approve publishes the draft copy's fields.** Payload's update reads the latest version as `originalDoc` when drafts are on (`updateByID.js:132`, `getLatestCollectionVersion`), and a partial `data` merges onto it. So the endpoint's approve, which sends only `review`, `tier` and `cycle`, publishes the copy's fields. Used by 2-4 E2.
  - Check: E6 row `endpoint approves a live edit` asserts that a public read returns the copy's title after the commit. If it fails, E2 first reads the latest version with `req` and sends its reviewed fields (`REVIEWED_FIELDS[collection]`) in `data`, and Deviation 9 says so.
- **P7. The enum migration adds a value.** The appended `withdrawn` kind must produce `ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'withdrawn';` in the generated SQL, not a drop and create of the type. Used by 2-1 C6.
  - Check: `grep -n "enum_notifications_kind" src/migrations/<ts>_portal_withdrawn_kind.ts` after `migrate:create`. If the SQL recreates the type, replace `up` with the one `ADD VALUE` line and `down` with a comment that Postgres cannot drop an enum value (down is a no-op), and say so in the PR.
- **P8. `Origin` in the Mac runs.** Playwright refuses port 3000 outside CI and uses `PLAYWRIGHT_BASE_URL` (default `http://localhost:3100`, `playwright.config.ts:23-30`). The endpoint compares `Origin` with the origin of `NEXT_PUBLIC_SERVER_URL` (`src/env.ts:104`). Used by 2-4 E2 and every 2-6 e2e and live run.
  - Check (Mac): `grep -n "NEXT_PUBLIC_SERVER_URL\|PLAYWRIGHT_BASE_URL" ~/cilas-verify/verify.sh`. When the built server's `NEXT_PUBLIC_SERVER_URL` origin differs from the base URL, V0 makes `verify.sh` export `NEXT_PUBLIC_SERVER_URL="$PLAYWRIGHT_BASE_URL"` for the build and the server, and says so in the 2-1 PR.
- **P9. `notify` has no `req`.** `notify(payload, recipients, note)` creates each row with `payload.create` and no `req` (`src/lib/notify.ts:58-88`), so in the endpoint's transaction the bell row would commit even when the decision rolls back, and it would not wait for the lock. The spec says every `notify` call in the handler passes the same `req`. Used by 2-1 C3.
  - Plan decision: `notify` takes an optional fourth argument `req?: PayloadRequest` and passes it to `payload.create`. `notifyReview` passes its `req`. Other callers do not change. Check: `git grep -n "export const notify = async" origin/main -- src/lib/notify.ts`.
- **P10. `CourseView` props.** `CourseView` takes `course: Course` and `sessions: readonly Session[]` (`src/app/(frontend)/[locale]/(site)/study/[slug]/CourseView.tsx:78-91`). Sessions have no review (ADR 0011), so the read-only page passes the course's sessions from a gated read and the course data from the latest version. Used by 2-5 O1.
  - Check: `git grep -n "sessions: readonly Session" origin/main -- 'src/app/(frontend)/[locale]/(site)/study/[slug]/CourseView.tsx'`. Then read how `course-page.tsx` loads the course (its `depth`) and use the same `depth` for the version read.
- **P11. Writes in every locale.** Discard and **Restore them** write the reviewed fields of every locale into the draft copy. The plan assumes `payload.update({ locale: 'all', data })` accepts `{ en, ar }` values for localized fields in Payload 3.91.0. Used by 2-1 C7.
  - Check: C8 test `discard keeps both locales` passes. If Payload refuses `locale: 'all'` on update, C7 writes one `payload.update` per locale with the same `req` (the spec's Duplicate pattern, Lists), and the PR says so.
- **P12. The review email template takes a URL.** `reviewMail(settings, state, title, note, { noun, url })` (`src/lib/review-mail.ts:89`). Used by 2-2 L3.
  - Check: `git grep -n "export const reviewMail" origin/main -- src/emails/transactional.ts`. If the template builds its own link, L3 passes the absolute URL through its existing `url` option and changes nothing in the template.
- **P13. e2e route shapes and `NAV_BY_ROLE`.** 1d-3 at `574c0508` adds route-shape rows and a `NAV_BY_ROLE` row in `testing/portal-e2e.test-utils.ts`. Used by 2-5 O6 and 2-6 R1, R9.
  - Check: `git grep -nE "^export const [A-Z_]+_SHAPES|NAV_BY_ROLE" origin/main -- testing/portal-e2e.test-utils.ts`. Add the phase 2 rows to the table that holds page routes (`PAGE_SHAPES` if 1d made it), else to the last `_SHAPES` table that `shapeOf` reads.
- **P14. Pruned versions.** No reviewed collection sets `versions.maxPerDoc` (`rg -n maxPerDoc src/collections` prints nothing), so Payload keeps its default (100) and an old version can be gone. Used by 2-6 R3.
  - Check: the same `rg`. The diff shows "The earlier version is no longer stored." when `findVersionByID` finds nothing.
- **P15. The version id after a write.** Payload saves the version before `afterChange` (`dist/collections/operations/utilities/update.js`, `saveVersion` call before the `afterChange` loop) and passes no version id to the hook. Used by 2-1 C4.
  - Check: `grep -n "saveVersion\|afterChange" /home/salah/cilas/node_modules/payload/dist/collections/operations/utilities/update.js` prints `saveVersion` above the `afterChange` hooks. C8 row `each row holds its own version` proves it.
- **P16. Arc parts.** The plan uses Arc `Select` (`src/components/arc/select/select.tsx:12`), `Textarea`, `Alert` (`alert.tsx:29`), `Timeline` (`timeline.tsx:23`, `:59`), `ScrollArea` (`scroll-area.tsx:36`), `ExpandableText` (`expandable-text.tsx:10`), `Badge`, `Button`, `PageHeader`, `EmptyState` and the `ToastStack` API (`toast-stack.tsx:38-60`: `toast({ id, type, title, description, action, duration })`, `update`, `dismiss`). Used by 2-3, 2-5, 2-6.
  - Check: before a task uses a part, read its props interface at the file above. `ExpandableText` takes text, not React nodes (`Omit<…, 'children'>`); if it cannot hold rich text, the body uses own code (UI parts order, row "Body clamp").
- **P17. Payload endpoints on a collection.** A collection takes `endpoints: [{ path: '/:id/review', method: 'post', handler }]` and serves it at `/api/{slug}/{id}/review` (`src/collections/Courses.ts:134` adds `deleteEndpoints('courses', …)` this way; `.agents/skills/payload/reference/ENDPOINTS.md`). Used by 2-4 E2.
  - Check: `git grep -n "endpoints:" origin/main -- src/collections/Courses.ts`.
- **P18. The runner can use a migrated copy.** At the time of writing, `verify.sh` has `--db empty` (memory mac-verify-runner) and no option for a migrated copy. Used by every phase 2 int, e2e and live run after C6.
  - Check (Mac): `grep -n -- "--db" ~/cilas-verify/verify.sh`. V0 adds `--db migrated` when it is missing.
- **P19. `documentHref` callers.** On `main` at `9abfbe67`: `src/lib/review-hooks.ts:286`, `src/portal/needs/needs.ts:127`, `src/portal/needs/owner-rows.ts:64`, `src/portal/lists/list-row.tsx:72`. Used by 2-2 L1.
  - Check: `git grep -n "documentHref(" origin/main -- src ':!*.test.*'`. Every caller that prints gets the L1 edit.
- **P20. The access audit and endpoints.** `pnpm audit:access` rows are per collection, field and operation (`scripts/access-audit.snapshot.json`, for example `collection:notifications`). Used by 2-1 C4 and 2-4 E2.
  - Check: `git grep -n '"endpoint' origin/main -- scripts/access-audit.snapshot.json`. Prints nothing: the endpoint adds no audit row, and E2 changes no snapshot. C4 adds the `collection:review-events` rows.
- **P21. `space-preferences` holds the locale.** `src/collections/SpacePreferences.ts` has `account` (relationship to `users`) and `locale`. Used by 2-2 L3.
  - Check: `git grep -nE "name: '(account|locale)'" origin/main -- src/collections/SpacePreferences.ts` prints two lines.
- **P22. Kind names in the bell and Settings.** The bell reads `t('kinds.<kind>')` (`src/components/site-notifications.tsx`, `noteText`), and Settings reads the preference labels from messages. Used by 2-1 C3.
  - Check: `git grep -n "kinds\." origin/main -- src/components/site-notifications.tsx` and `git grep -n "PREFERENCE_KINDS" origin/main -- src/components`. Add the `withdrawn` key to each message namespace that the two print.

## Global Constraints

**From the merged plans, still in force** (read these there; they are not copied). From the 1d plan (`docs/superpowers/plans/2026-11-21-portal-phase-1d-calendar-and-account.md`, Global Constraints): **Run location**, **Int runs**, **Execution rules** (Machine balance, Quota, Merge, Hooks), **Perf runs** (the session, the pass line `L`, the control row, BLOCKING or REPORT-ONLY), **Scratch world script**, **Axe on new pages**, **Verification boxes**, **Copy**, **Per-PR order**. From the 1b plan: **Access rules**, **One role table**, **Data access** (every read names `depth`, `select`, `pagination: false` or a `limit`), **Not found for a role**, **Int test setup** (`mockNetwork(resendInbox().handler, ...localServices)`; read by your own ids, never by table counts), **Arabic digits**. From the 1c plan: **Review predicate** (no Critical or High finding stays open), **Mail off (M)**, **Perf gate (G)**, **Prod clone restore (R)**, P17 (the lock).

**Models (operator rule, ledger "Models").** Builders and fixers: Codex gpt-6.2-sol, reasoning effort high (T3 `delegate_task`, provider codex); after two failed checks, the next try goes to Claude Sonnet. Reviewers: the other vendor from the builder. Mac verify runs: Codex gpt-6.2-sol low or Claude Haiku. Every brief starts with the `worker.md` line and says "Use only pstack/poteto skills; never superpowers or caveman."

**New in phase 2.**

- **Database per run (plan decision; ledger "Migrations").** M1 and M3 change the schema, and `push: false` (`src/payload.config.ts:308-312`) means a database without them has no `review_events` table and no `withdrawn` value. The int suite (`vitest.setup.ts` accepts any database at `localhost:5433`), the `verify.sh` server and Playwright all read `DATABASE_URL`, and the Mac's `.env` points at `cilas_dev`. The ledger forbids a migration on `cilas_dev`. So:
  - V0 (2-1) adds `--db migrated` to `verify.sh`: it drops and makes `cilas_migrated` from a `pg_dump` of `cilas_dev` (not `CREATE DATABASE … TEMPLATE`, which fails while another run is connected to `cilas_dev`), runs `pnpm db:migrate` from the run's worktree with `DATABASE_URL` set to the copy, refuses to run when the name is `cilas_dev` (a guard line before `db:migrate`), and then exports that `DATABASE_URL` for the build, the server, the int suite and Playwright. `process.env` wins over `.env` in all three (`vitest.config.mts:15`, dotenv's no-override default in `playwright.config.ts:3`, Next's env order). The seed guard (`seed/local-database.ts`) does not run in these modes.
  - Every phase 2 int, e2e, live and screen-review run from C6 on uses `--db migrated`. Runs before C6 (V0 to C5 unit steps) use the default.
  - The perf boxes use `cilas_ttfb` (a throwaway restore, Prod clone restore (R)): the session runs `pnpm db:migrate` on it from the head worktree before the head build, and runs the baseline build first, on the unmigrated copy. The new table and value do not slow a read that does not use them.
  - In-suite proof: `src/migrations/portal-phase-2.int.test.ts` uses `scratchPayload()` (`testing/scratch-database.test-utils.ts`), which makes a new database and runs every migration, then checks the table, the index, the foreign key and the enum value (C6).
  - After 2-1 merges, every branch that holds it (every phase 1c, 1d and 3 branch after a rebase) needs a migrated database for int and e2e runs. Until the operator migrates `cilas_dev` or says yes to agents doing it, those runs use `--db migrated`. For the operator, item 1.
- **Mail off (M) for every run that decides.** A review decision sends real mail through `notifyReview` when mail is on. Every `verify.sh` e2e or live run of 2-4, 2-5 and 2-6 repeats the 1c P32 server guard at its own head (the server log holds "No email adapter provided", and `--check-off` exits 0), as 1d does. Int tests capture mail with `resendInbox()` (Int test setup).
- **One lock for every write (Deviation 1).** `recordDraftSave` calls `lockRow(req, collection.slug, id)` for every `update` and `restoreVersion` with an id, so every writer (the review endpoint, the owner moves, `/admin`, REST, GraphQL, MCP) waits for the lock before any hook reads the document. The endpoint still calls `lockRow` itself first, before its step 1 read (spec, "The review endpoint").
- **Same `req` everywhere.** Every `payload.update`, `findVersions`, `find`, `create` and `notify` call in the endpoint, the `review-events` hook and the owner moves passes the request's `req` (spec; `application-decision.ts:52`). A builder who adds a call without `req` in these files fails review.
- **Mail and bell rows before the commit (risk accepted).** `notifyReview` runs in `afterChange`, inside the transaction, so its email goes before the commit (unlike the applicant handler, which mails after `commitTransaction`, `application-decision.ts:513-530`). The lock makes a second decision wait and then get 409, so one email goes per decision. If a later hook throws after the email, the decision rolls back and the email already went. This plan keeps that risk (it exists for every review write today) and names it in Review Focus.
- **Access rules (AGENTS.md).** `review-events`: `read: isAdmin`, `create: nobody`, `update: nobody`, `delete: nobody`, all from `src/access.ts`, never an inline arrow. The hook writes with `overrideAccess: true`. `pnpm audit:access` regenerates the snapshot in 2-1, and the diff adds only the `collection:review-events` rows. No collection or global operation is left at Payload's default.
- **Gated read or projection (spec, Data access rule).** Pages read documents and versions with `user` and `overrideAccess: false`. `review-events` is read only through `reviewHistoryFor` (projection). `getReviewQueue`, `adminQueue` and `adminReviewRows` read with `overrideAccess: true`, so every portal caller checks `isAdminUser(user)` first.
- **Untangle (AGENTS.md).** One move table (`src/lib/review-moves.ts`), one owner-button table (`src/portal/document/owner-buttons.ts`), one status function (`statusOf`), one link function (`documentHref`). The pane, the owner page, the emails and the bell call them. No status word or link is written in a second place.
- **UI parts order (operator rule, ADR 0012).** See "UI parts order" below. App code never imports `@ui-sdk/*`. Inner scroll regions (the To review list and the pane on a wide screen) use Arc `ScrollArea`.
- **Lazy loading (spec, Lazy loading rule).** The To review list, the pane and the owner page render on the server. The pending provider renders on first render (it owns the `pagehide` and `visibilitychange` listeners). The pending toast content is `preloadable` (`src/lib/preloadable.tsx`), preloaded from the decision buttons' `onPointerEnter`, `onFocus` and `onPointerDown`.
- **Skills.** Every task has a **Skills** line. A task that writes HTML, CSS or client JS loads `modern-web-guidance` first. A Payload task loads `payload` (`.agents/skills/payload/SKILL.md`). Every code task loads `tdd`. Load each UI skill only where the task needs it (spec, UI skills).
- **Copy.** New strings go in `messages/{en,ar}.json` under `Portal`, with ICU plurals and `{count, number}` digits, gender-neutral Arabic (D8). The spec's English strings are the source ("Accepting. Email in 5 s", "{n} emails wait", "Paused. Email waits.", "This changed while you reviewed it.", "Not saved.", "Nothing else waits.", "An admin decided this while you withdrew it.", "Your changes were discarded.", "The earlier version is no longer stored.").
- **Per-PR order** (1d's, with phase 2 step 5): 5. `pnpm exec tsgo --noEmit`, `pnpm audit:access`, then `git status --short scripts/access-audit.snapshot.json` prints the snapshot only in 2-1 (and in 2-4 only when P20 fails); in every other PR it prints nothing.
- **Formatting (operator rule).** Never commit or push with `LEFTHOOK=0` or `--no-verify`. In a worktree with no `node_modules`, run `/home/salah/cilas/node_modules/.bin/oxfmt --write <changed files>` before each commit and `oxfmt --check <changed files>` before each push.

## Check open source first

Rule check-open-source-first. Each new module was compared with maintained open-source options (GitHub API, 2026-11-22).

| Need                                   | Candidates                                                                        | Evidence                                                                                                                                                                                                                              | Decision                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paragraph diff for D9                  | `diff` (jsdiff, kpdecker/jsdiff); `fast-diff`; `diff-match-patch`; own LCS        | jsdiff: 9,222 stars, 30 contributors, last push 2026-11-18, 28 open issues, BSD-3-Clause, no runtime deps; `diff@8.0.4` is already in the pnpm store as a transitive package. `fast-diff` and `diff-match-patch` diff characters only | **Adopt** `diff` as a direct dependency, pinned exactly at the version `pnpm add diff --save-exact` resolves (8.x). `diffArrays` diffs the paragraph lists. It runs on the server only (the pane is a server component), so it adds no client JavaScript. The spec asks for changed paragraphs, old above new, not a character diff          |
| State machine for the pending provider | XState (statelyai/xstate); `@xstate/store`; own reducer                           | XState: 30,531 stars, last push 2026-11-22, MIT. The spec's table has 11 legal transitions and one cause set. The provider renders on every portal page for every role                                                                | **Build** a pure reducer (`transition(item, event, now)`) from the spec table. XState would add its runtime to every portal page, including students' pages, for a table this size, and the spec's perf rule says the provider adds no cost to non-admin pages. The reducer has no React and no timers, so the unit spec tests it as a table |
| Row lock                               | Payload (no lock API); drizzle `for update` through the session                   | The repo already locks through the transaction session (`application-decision.ts:59-70`)                                                                                                                                              | **Extract** the existing code into `lockRow` (spec). No library                                                                                                                                                                                                                                                                              |
| Link rewrite script                    | Payload jobs; a migration; a tsx script                                           | The spec forbids deploys running it ("The owner runs it by hand on each database. Deploys never run it.")                                                                                                                             | **Build** a tsx script with a dry run by default (`scripts/rewrite-notification-links.ts`), like the other one-off scripts in `scripts/`                                                                                                                                                                                                     |
| Countdown ring                         | Arc `Countdown` (wall-clock target), Arc `Gauge` (270 degree value ring), own SVG | `Countdown` counts to a fixed moment and cannot pause; `Gauge` springs to a value and is open at the bottom                                                                                                                           | **Own code**, small (UI parts order)                                                                                                                                                                                                                                                                                                         |

## UI parts order

Operator rule: installed Arc (`src/components/arc`) -> free Arc registry -> a ui-sdk wrapper in `src/components/sdk/` -> a Radix primitive the repo already uses -> own code. Read each Arc part's props first (P16).

| Part                                          | PR  | Choice                                                                                                                                                                        | Why not the earlier options                                                                             |
| --------------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Pending ring                                  | 2-3 | Own code: an SVG circle with `stroke-dashoffset` from `remainingMs / UNDO_MS`, a `<button>` around it; under reduced motion, the whole seconds as text, `aria-hidden`, no arc | Arc `Countdown` and `Gauge` do not fit (Check open source first). No free Arc or ui-sdk ring with pause |
| Undo all bar                                  | 2-3 | Own `<section aria-label>` with Arc `Button`                                                                                                                                  | A sticky bar with one count and one button; no Arc block for it                                         |
| Pending toast                                 | 2-3 | Arc `ToastStack` (installed, `SiteToasts`), `toast({ id: key, duration: Infinity, action })`, then `update` and `dismiss` from the provider                                   | The spec: the portal adds no second host                                                                |
| To review list and pane (wide)                | 2-6 | CSS grid; each column an Arc `ScrollArea`                                                                                                                                     | Operator rule: inner scrollers use Arc `ScrollArea`                                                     |
| List rows                                     | 2-6 | The 1b row layout (`src/portal/lists/list-row.tsx` classes in `lists.module.css`), with a pending state                                                                       | One row look across lists (spec, Design language, List rows)                                            |
| Status banner                                 | 2-5 | Arc `Alert`                                                                                                                                                                   | Installed                                                                                               |
| History                                       | 2-5 | Native `<details>` (the spec names it) holding Arc `Timeline`                                                                                                                 | The spec says `<details>`; Arc `Accordion` is a group of panels, and one disclosure is native HTML      |
| Diff                                          | 2-6 | Own server component: per field a `<dl>` row, old value above new, `<del>` and `<ins>` with text labels (not colour only)                                                     | No Arc diff part. Arc `ImageCompare` is for images                                                      |
| Body clamp, **Show more**                     | 2-5 | Arc `ExpandableText` when it takes React nodes; else own CSS (`max-block-size: 320px`, a **Show more** `<button aria-expanded>`)                                              | P16                                                                                                     |
| Selects (**Publish as**, **Cycle**, **Tier**) | 2-6 | Arc `Select`                                                                                                                                                                  | Installed                                                                                               |
| Note field                                    | 2-6 | Arc `Textarea`, error under the field (`aria-invalid`, `aria-describedby`)                                                                                                    | Installed                                                                                               |
| Sticky phone action bar                       | 2-6 | Own CSS (`position: sticky; inset-block-end: 0`) with `scroll-padding-block-end` on the page                                                                                  | Layout, not a component                                                                                 |
| Owner action area and restore line            | 2-5 | Arc `Button` (secondary, quiet, quiet danger levels) and a `role="status"` line                                                                                               | Installed                                                                                               |
| Empty state ("Nothing waits for review")      | 2-6 | `PortalEmptyState` (`src/portal/feedback/empty-state.tsx`)                                                                                                                    | Installed in phase 1a                                                                                   |

No phase 2 part needs a ui-sdk wrapper or a Radix primitive.

## Deviations from the spec

1. **The lock is in the write path, not only in the endpoint and the owner buttons.** The spec puts `lockRow` in the review endpoint and in the owner's **Withdraw** and **Withdraw changes**. REST, GraphQL and `/api/mcp` stay open (spec, Data access rule), and `AUTHOR_MOVES.submitted` becomes `['draft']`, so an owner can withdraw through REST or `/admin` with no lock, and the endpoint's stale check would read a state that is about to change. `recordDraftSave` (the `beforeOperation` hook every reviewed collection has) calls `lockRow` for every `update` and `restoreVersion` with an id (P4). Every writer is then serialized, and the owner moves need no lock code of their own. The endpoint keeps its own `lockRow` call ahead of its step 1 read. Plan decision; AGENTS.md "a call order callers must know: make the API enforce it".
2. **`lockRow` takes a collection slug, not a table name.** `lockRow(req, collection, id)` resolves the table through the adapter (`payload.db.tableNameMap`), so callers do not know table names. The applicant handler passes `'form-submissions'`. Plan decision.
3. **`documentHref` drops `locale`.** In 1b every caller passes `locale` and the function ignores it (`src/lib/document-href.ts:9-16`). The spec stores links as locale-free paths and adds the locale at the edge (email, bell). So `documentHref` returns a locale-free path, and one function `localizedLink(path, locale)` in the same file adds `/{locale}` to a path that starts with `/spaces` and leaves `/admin` paths as they are. The email builder and the bell call it. List rows and Needs you rows render through next-intl `Link`, which adds the locale itself. Plan decision; AGENTS.md "surplus: a parameter for things that never vary".
4. **Application links get their own function.** The spec routes the `application` notice through `documentHref`, with the submission id for an admin and the course id for a fellow. One `id` with two meanings is a hidden link. `applicantsHref({ application } | { course })` in `src/lib/document-href.ts` returns `/admin/applicants?application={id}` or `/admin/applicants?course={id}` until phase 3 changes both. Plan decision.
5. **`PendingApi` gets `flush()`.** **Sign out** must send every pending commit and await it, and stop on a failure (spec, Commit on leave). The spec's `PendingApi` has no call for that. `flush(): Promise<{ ok: boolean }>` sends every item that is pending, paused or failed, and resolves when each is sent, undone (refused) or failed; `ok` is false when one failed. `usePortalSignOut()` in `src/portal/pending/sign-out.ts` awaits it, then runs the existing sign-out. The site header keeps `useSignOut()` (it renders outside the portal, with no provider). Plan decision.
6. **`useOverlay(open)` helper.** The spec has each modal surface call `overlay(true)` and `overlay(false)`. A hook `useOverlay(open: boolean)` calls them from one effect (and `overlay(false)` on unmount), so a surface that unmounts while open never leaves the count above 0. The More sheet uses it in 2-3; later surfaces (the palette, sheets) use it too. Plan decision; AGENTS.md "a call order callers must know".
7. **The `pending` unit spec is a set of files.** The spec's `pending` (unit) is `src/portal/pending/machine.unit.test.ts` (the state machine, the cause set, one commit per item) plus `pending-provider.dom.test.tsx` (timers, overlay, flush, `result`). The `pending` e2e cases (reload, tab switch, **Sign out**, reduced motion) need a decision surface, so they run in `e2e/portal-review.e2e.test.ts` in 2-6. Plan decision.
8. **The spec's `review-events` int spec is two files.** `src/lib/review-events.int.test.ts` (2-1: history, `reviewHistoryFor`, withdraw, Discard and **Restore them**, REST read) and `src/lib/review-endpoint.int.test.ts` (2-4: stale 409, repeat 200, the move table and its 400s, the lock with the owner's withdraw, `Origin`). The per-recipient email case is `src/lib/review-mail.int.test.ts` (2-2). Each PR then ends with its own evidence. Every `describe` starts with `review-events:` so `-g review-events` runs all of them. Plan decision.
9. **(Only if P6 fails.)** The endpoint's approve sends the copy's reviewed fields in `data`. Written here so the PR can cite it.
10. **The end gate is proven in two halves.** Mac runs have mail off (Mail off (M)), so no e2e reads a real email. `reviewEmailUrl(recipient, doc)` in `src/lib/review-mail.ts` is the one builder of the link the email holds. 2-6's int case asserts that the captured email (`resendInbox()`) holds exactly `reviewEmailUrl(owner, doc)`, and the e2e opens `reviewEmailUrl(owner, doc)` as the owner and lands on the portal page. Plan decision.
11. **Publications have no portal page body component.** The pane's body for a publication shows its reviewed fields as label and value rows, because no public component renders one (Open question 1). Plan decision.

## Ends when

Phase 2 ends when all of these hold at the head of 2-6 on `main`:

- [ ] `pending`: `machine.unit.test.ts` and `pending-provider.dom.test.tsx` pass, and the `pending` cases of `portal-review` e2e pass (reload, tab switch, **Sign out**, reduced motion).
- [ ] `review-events`: every `review-events:` describe passes (`review-events.int.test.ts`, `review-endpoint.int.test.ts`, `review-mail.int.test.ts`), with the `google-sign-in` base failure as the only failure (Int runs).
- [ ] `portal-review` e2e passes as admin in English and Arabic at 1440 and 390, with the spec's list: approve with cycle and tier, undo, approve again and let the timer end, ask for changes with a note, the history shows, `/spaces/review/users/1` is not found, the toast text and "6 left." in the accessibility event log, focus visible above the sticky bar on a phone.
- [ ] End gate: an owner's email link opens the portal (Deviation 10, R9).
- [ ] The To review rows of `portal-shell` pass (admin only, per role, 1440 and 390).
- [ ] M1 and M3 are on `main`, applied by the deploy, and `portal-phase-2.int.test.ts` passes.
- [ ] The review set ran per spec: ux-auditor and better-interface on To review and the read-only pages, then break-ui, then security-review of the review endpoint, with no Critical or High finding open.

## Review Focus

1. The lock: every write to a reviewed document takes it first (Deviation 1); a test fails when `lockRow` is a no-op (C8, E6).
2. The endpoint's three steps run after the lock, in order; the move table is the only gate in front of `applyReview`, and `tier`, `cycle` and `note` are read only as the table allows.
3. `Origin`: a missing header is refused too.
4. Mail before commit (Global Constraints): one email per decision under the race tests.
5. `review-events` access: `nobody` for writes through every API; reads through `reviewHistoryFor` only for an owner.
6. The pending provider: one `fetch` per item, `committing` before `fetch`, `keepalive`, body under 64 KB, Strict Mode double mount, bfcache.
7. Focus after a decision, Undo, a refusal and a failure; `aria-busy`; the toast and `announce()` never both say one message.
8. Links: no `/admin` link reaches a non-admin for an article or course after 2-6 (except publications, D16, and `users`).

## Decision log (structural)

Problems first, then each fix above the problems it solves.

- **Fix: one lock in the write path (Deviation 1).** Solves: (a) the endpoint's stale check reads a state that an unlocked REST write changes a moment later; (b) owner moves would each need their own transaction and lock code; (c) a convention ("call `lockRow` before you write") that every future writer must know.
- **Fix: one move table (`review-moves.ts`) used by the endpoint, and one owner-button table.** Solves: (a) `applyReview` lets an admin make any move, so the endpoint needs its own narrower rule; (b) the pane and the owner page would otherwise each decide which buttons show.
- **Fix: owner moves as one server module in 2-1 (`owner-moves.ts`).** Solves: (a) the spec's withdraw and discard int cases need the moves before any page exists; (b) the page's server actions stay thin (parse, call, `refresh()`).
- **Fix: a pure reducer for the pending state.** Solves: (a) the state table needs a test per legal and illegal event with no timers or React; (b) phase 3 reuses the provider and must add no special case: it calls `decide` with its own `key`, `label` and `request` and reads `result`.
- **Fix: `localizedLink` at the edge (Deviation 3).** Solves: (a) stored links must be locale-free; (b) emails need the recipient's locale; (c) the bell needs the reader's locale; (d) list rows already get the locale from next-intl.
- **Fix: shared review views in `src/portal/review/`, built by 2-5.** Solves: the pane (2-6) and the owner page (2-5) show the same banner, history and body.

## Open questions (product calls)

Each has a default, so no build waits.

1. **Publication body in the pane.** No public component renders a publication. Default: the pane lists its reviewed fields (`REVIEWED_FIELDS.publications`) as label and value rows, and "Open the full publication" opens its admin URL (D16).
2. **Request removal: an undo?** The spec gives **Withdraw** as the undo of **Request removal**, and Request removal commits at once and tells the admins. Default: as the spec says; the button area keeps its width, and **Withdraw** takes the place of **Request removal**.
3. **Tier in the approved email.** D6 asks for the tier in the notification. Default: the bell line names the tier; the email text does not change in phase 2.
4. **Owner page for an admin.** An admin who opens `/spaces/articles/[id]` of another person's article. Default: the page renders read-only with the banner and history and no owner buttons; `documentHref` never sends an admin there.
5. **Draft owner page actions.** The spec's phase 2 buttons are Withdraw, Withdraw changes, Request removal and Discard. A draft or a returned item shows only **Edit** (admin editor) in phase 2, and **Submit** stays in the admin editor until phases 4e and 5. Default: as written.
6. **Undo window for publications.** Default: the same 5 s pending item as articles and courses.

## For the operator

1. **After 2-1 merges, migrate the Mac's `cilas_dev`, or say yes to agents doing it.** The ledger forbids agents from applying a migration to `cilas_dev`. Until it holds M1 and M3, every Mac run of a branch that contains 2-1 (all phases, after a rebase) must use `verify.sh --db migrated`. The command: `cd /home/salah/cilas && DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:migrate` on the Mac. The deploy applies both to production.
2. **Migrations M3 and M1** (`src/migrations/<ts>_portal_withdrawn_kind.ts`, `<ts>_portal_review_events.ts`), made with `pnpm db:migrate:create` through `expect`, applied by agents only to throwaway copies (`cilas_migrated`, `cilas_ttfb`, scratch databases). This bends the "ask before applying" memory rule, as the ledger allows.
3. **The one-off link script** `scripts/rewrite-notification-links.ts` (2-6). The owner runs it by hand on each database after 2-6 deploys: first with no flag (dry run, prints the count per old prefix and ten samples), then with `--apply`. Deploys never run it, and no agent runs it on production.
4. **`verify.sh --db migrated`** is a change to the Mac runner (V0), outside the repo; a backup copy `verify.sh.pre-db-migrated` stays beside it.

## PR 2-1. Review core (`portal/phase-2-review-core`)

Base `origin/main`. No screen. Rebase before open and before merge (Shared files).

### Task V0: The runner uses a migrated copy

**Skills:** none (Mac shell script, outside the repo).

**Files:** `~/cilas-verify/verify.sh` on the Mac (backup `~/cilas-verify/verify.sh.pre-db-migrated` first, then write a copy and rename it over, as memory mac-verify-runner says).

- [ ] **Step 1: Premises.** Run the P8 and P18 checks on the Mac. Write the output in the PR body.
- [ ] **Step 2: Add `--db migrated`.** After the run's worktree exists and before the build: `test "$DB_NAME" != cilas_dev || { echo 'refusing: cilas_dev'; exit 1; }` with `DB_NAME=cilas_migrated`; `docker exec cilas-db-1 dropdb -U cilas --if-exists cilas_migrated`; `docker exec cilas-db-1 createdb -U cilas cilas_migrated`; `docker exec cilas-db-1 pg_dump -U cilas cilas_dev | docker exec -i cilas-db-1 psql -U cilas -q -d cilas_migrated`; then in the run worktree `DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_migrated pnpm db:migrate`; then `export DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_migrated` for the build, the server, `vitest` and Playwright. The run folder is `runs/<sha>-migrated` (the `--db empty` pattern). When P8 found a port gap, also export `NEXT_PUBLIC_SERVER_URL="$PLAYWRIGHT_BASE_URL"` for the build and the server in every mode. RESULT.md starts with a line `db: cilas_migrated, migrations: <names from payload_migrations>`.
- [ ] **Step 3: Prove it.** After C6 is pushed: `~/cilas-verify/verify.sh --db migrated --no-tests portal/phase-2-review-core <sha>`. Expected: RESULT.md's first line lists both phase 2 migrations; `docker exec cilas-db-1 psql -U cilas -d cilas_migrated -c '\d review_events'` prints the table; `docker exec cilas-db-1 psql -U cilas -d cilas_dev -c '\d review_events'` prints "Did not find any relation" (cilas_dev unchanged).

### Task C1: `lockRow`, and the lock in the write path

**Skills:** tdd, payload.

**Files:** Create `src/lib/lock-row.ts`, `src/lib/lock-row.int.test.ts`, `testing/row-lock.test-utils.ts`. Modify `src/forms/application-decision.ts` (`load`), `src/lib/review-hooks.ts` (`recordDraftSave`).

**Interfaces:**

- `lockRow(req: PayloadRequest, collection: CollectionSlug, id: number): Promise<void>` (Deviation 2). Body: the session lookup of `load` (`application-decision.ts:59-70`, P5), the table from `req.payload.db.tableNameMap.get(toSnakeCase(collection))` (`@payloadcms/drizzle` `types.d.ts:340`), then ``db.execute(sql`select id from ${sql.identifier(table)} where id = ${id} for update`)``. No session: `throw new APIError('Could not lock the document. Try again.', 500)`. A second call in the same transaction returns at once (Postgres holds the lock already).
- `load(req, id)` in `application-decision.ts` becomes `await lockRow(req, 'form-submissions', id)` then its `findByID`. No other change to that file.
- `recordDraftSave`: in the branch `operation === 'update' && write.id !== undefined`, call `await lockRow(req, collection.slug, Number(write.id))` first, before the `held` check and its `findOne` (P4). Not for `create` (no row yet), not for a bulk update (refused for non-admins; an admin bulk write has no one row), not for `restoreVersion` (its `id` is a version id; an owner's restore is refused by `applyReview`, so only an admin restores, from `/admin`). Fix the text of Deviation 1 and Global Constraints to say "every `update` with an id" if a reviewer reads "and `restoreVersion`".
- `testing/row-lock.test-utils.ts`: `holdRow(payload, collection, id): Promise<{ release(): Promise<void> }>` opens a client from `payload.db.pool`, runs `begin` and `select id from <table> where id = $1 for update`, and `release` runs `commit` and releases the client. `waitForLockWaiters(payload, count, timeoutMs = 5000): Promise<void>` polls `select count(*) from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'` every 25 ms until it reaches `count`, and throws on timeout. These two force the order of concurrent writes: Postgres queues waiters on one row in arrival order, so "hold, start A, wait for 1 waiter, start B, wait for 2 waiters, release" runs A, then B.

- [ ] **Step 1: Failing int test.** `src/lib/lock-row.int.test.ts`, `describe('review-events: lockRow')`:
  - "a draft save on a live article waits for the row lock": publish an article (fixture writer), `holdRow` it, start an owner's draft save (`payload.update` as the author, a new title, `draft: true`), `waitForLockWaiters(payload, 1)` resolves, `release()`, the save resolves. A live draft save writes only the versions table, so without `lockRow` it never waits, and `waitForLockWaiters` times out: the test fails when `lockRow` is a no-op.
  - "lockRow refuses outside a transaction": `createLocalReq({}, payload)` with no transaction; `lockRow` rejects with status 500.
  - **[verify]** `verify.sh --int-only` at the end of the C1 to C3 group (Int runs): FAIL on the first case.
- [ ] **Step 2: Implement.** Extract, call it from `load` and `recordDraftSave`. **[verify]** at the group end: PASS, and every existing int test that calls the applicant decide endpoints still passes (`rg -l "courses/.*/(accept|reject)|/(accept|reject|reopen)'" src testing --glob '*.int.test.ts'`). Commit.

### Task C2: The withdraw and discard moves

**Skills:** tdd, payload.

**Files:** Modify `src/lib/review.ts`, `src/lib/review.unit.test.ts`, `src/lib/review-hooks.ts` (`applyReview`).

**Interfaces:**

- `AUTHOR_MOVES.submitted = ['draft']` (spec, Withdraw).
- `LIVE_AUTHOR_MOVES = { approved: ['submitted'], rejected: ['submitted', 'draft'], changes_requested: ['draft'] }` (spec, Discard my changes).
- `applyReview`: the refusal of an owner's write from `submitted` becomes `if (!trusted && from === 'submitted' && to !== 'draft') throw …` (same message, same 403). Nothing else in the hook changes: a non-live withdraw is a full save (the draft-save rule still throws on a status change in a draft save of a document that is not live), and `nextRequest` already clears `request` on a move to `draft`.
- [ ] **Step 1: Failing unit rows** in `review.unit.test.ts`: `canMove('submitted', 'draft', false)` is true; `canMove('submitted', 'approved', false)` is false; `canMove('changes_requested', 'draft', false, true)` is true; `canMove('changes_requested', 'draft', false, false)` is false; `canMove('rejected', 'draft', false, true)` is true. `pnpm exec vitest run --project node src/lib/review.unit.test.ts`. FAIL.
- [ ] **Step 2: Implement.** PASS. The hook cases run in C8. Commit.

### Task C3: The `withdrawn` kind and an actor-first `notifyReview`

**Skills:** tdd, payload.

**Files:** Modify `src/lib/notification-kinds.ts`, `src/lib/notification-preferences.ts`, `src/lib/notification-preferences.unit.test.ts`, `src/lib/notify.ts`, `src/lib/review-hooks.ts` (`notifyReview`), the glyph map (`src/components/site-notifications.tsx` on `main`, or `src/components/notification-glyphs.tsx` when 1c-2 has moved it; P22), `messages/{en,ar}.json` (P22), the live refresh kinds file (P3).

**Interfaces:**

- `NOTIFICATION_KINDS.withdrawn = { name: 'Withdrawn', tone: 'info', icon: 'undo-2', audience: 'admins' }`, appended last (the order is the order of stored values). Add the `undo-2` lucide glyph to the glyph map.
- `PREFERENCE_ORDER`: `'withdrawn'` right after `'submitted'`. Not in `EMAIL_KINDS` (no email).
- `notify(payload, recipients, note, req?: PayloadRequest)`: passes `req` to `payload.create` (P9). Other callers do not change.
- `notifyReview`, after its two early returns: `const byAdmin = isAdminUser(req.user)`. When `!byAdmin && before === 'submitted' && state === 'draft'`: the audience is the admins, the kind is `withdrawn`, no email, the line is `WITHDRAWN_NOTES(noun, title, removal)` ("Submission withdrawn: “{title}”", or "Removal request withdrawn: “{title}”"), the link is `documentHref({ collection, id, viewer: 'admin', waiting: false, locale })` (2-2 drops `locale`), the actor is the owner's person; then return. The removal branch (`removal && before === 'submitted' && state === 'draft'`, kind `removed` to the owners) runs only when `byAdmin`. Every `notify` call passes `req`.
- Live refresh: add `'withdrawn'` per P3.
- [ ] **Step 1: Failing unit rows** in `notification-preferences.unit.test.ts`: "withdrawn is an admin preference after submitted" (`PREFERENCE_KINDS` index of `withdrawn` is the index of `submitted` plus 1, audience `admins`); "withdrawn sends no email" (`EMAIL_KINDS` does not hold it). FAIL. Implement. PASS. The hook cases run in C8. Commit.

### Task C4: The `review-events` collection and its hook

**Skills:** tdd, payload.

**Files:** Create `src/collections/ReviewEvents.ts`. Modify `src/payload.config.ts` (add it to `collections`), `src/lib/review-hooks.ts` (one more `afterChange` hook), `src/payload-types.ts` (`pnpm payload generate:types`), `scripts/access-audit.snapshot.json` (`pnpm audit:access`).

**Interfaces:**

- `ReviewEvents: CollectionConfig`: `slug: 'review-events'`, `admin: { hidden: true }`, `timestamps: false`, `access: { read: isAdmin, create: nobody, update: nobody, delete: nobody }` (named rules from `src/access.ts`), `indexes: [{ fields: ['collection', 'doc'] }]`. Fields: `collection` (select: `articles`, `courses`, `publications`, required), `doc` (number, required, `index: true`), `version` (number), `from` and `to` (select over `REVIEW_STATES`, required), `request` (select: `changes`, `removal`), `note` (textarea), `actor` (relationship to `users`), `at` (date, required). Payload maps `number` to `numeric` (`@payloadcms/drizzle` `traverseFields.js:543-563`); see Deviation 12.
- `recordReviewEvent(options): CollectionAfterChangeHook`, added to `reviewHooks(...).afterChange` after `notifyReview`. It returns early when `before === state` (`previousDoc?.review?.status ?? 'draft'` vs `doc.review?.status ?? 'draft'`) and on an autosave (`reviewContext(req).autosave`). It reads `version` with `req.payload.findVersions({ collection, where: { parent: { equals: doc.id } }, sort: '-updatedAt', limit: 1, depth: 0, req })` (P15). It writes `note` only when `isAdminUser(req.user)` and `notifyOn(before, state) === 'authors'` or the move is the removal outcome (`state === 'draft'` with `request: removal` from `submitted`), taken from the write's `data.review.review_note` (it reads the operation's incoming data through `req.context`, set by `recordDraftSave` as `context.sentNote = write.data?.review?.review_note ?? null`), else `null`. `request` is the stored request of the row that asked (`state === 'submitted' ? doc : previousDoc`), `actor` is `req.user?.id ?? null`, `at` is `new Date().toISOString()`. It writes with `req.payload.create({ collection: 'review-events', data, overrideAccess: true, req })`.
- [ ] **Step 1: Implement and generate.** `pnpm payload generate:types`, `pnpm audit:access`. Expected: `git diff --stat scripts/access-audit.snapshot.json` shows added lines only, and each added row is `collection:review-events` with `read: isAdmin#…` and `create`, `update`, `delete`: `nobody#c75af6b3`. `pnpm exec tsgo --noEmit`: no error. The behaviour tests run in C8, after C6. Commit.

### Task C5: `reviewHistoryFor`

**Skills:** tdd, payload.

**Files:** Create `src/lib/review-history.ts`.

**Interfaces:**

- `type ReviewHistoryRow = { at: string; from: ReviewState; to: ReviewState; request: ReviewRequest | null; note: string | null; actorName: string | null }`.
- `reviewHistoryFor(payload: Payload, collection: ReviewedCollection, id: number, user: User): Promise<ReviewHistoryRow[]>` (spec, Data access rule): first `payload.findVersions({ collection, where: { parent: { equals: id } }, limit: 1, depth: 0, user, overrideAccess: false })`; no version found: `[]`. Else `payload.find({ collection: 'review-events', where: { and: [{ collection: { equals: collection } }, { doc: { equals: id } }] }, sort: 'at', depth: 0, pagination: false, overrideAccess: true })`, then one `people` read for the actors' names (`users.person` with `depth: 1`, `select: { person: true }`), mapped to rows with no user relation. Oldest first.
- [ ] **Step 1:** Implement. Tests run in C8. Commit.

### Task C6: Migrations M3 and M1

**Skills:** payload.

**Files:** `src/migrations/<ts>_portal_withdrawn_kind.{ts,json}`, `src/migrations/<ts>_portal_review_events.{ts,json}`, `src/migrations/index.ts`, `src/migrations/portal-phase-2.int.test.ts` (new).

- [ ] **Step 1: Make M3.** On the Mac worktree after C3 (memory db-reset-creates-migration): `expect -c 'spawn pnpm db:migrate:create portal_withdrawn_kind; expect { -re {created or renamed} { send "\r"; exp_continue } eof }'`. Run P7 on the generated file. Expected: one `ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'withdrawn';` in `up`.
- [ ] **Step 2: Make M1.** After C4, the same command with `portal_review_events`. Read the SQL. Expected: `CREATE TABLE "review_events"` with `"doc" numeric NOT NULL`, `"version" numeric`, enum types for `collection`, `from`, `to`, `request`, `"actor_id" integer` with a foreign key `ON DELETE set null`, an index on `("collection", "doc")` and one on `"doc"`, and `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "review_events_id" integer` with its foreign key and index (spec, M1). Every name the SQL uses exists in the new `.json` snapshot. `migrate:create` writes files only; it applies nothing.
- [ ] **Step 3: In-suite proof.** `src/migrations/portal-phase-2.int.test.ts`, `describe('review-events: migrations')`, with `scratchPayload()` (which runs every migration on a new database): "the review_events table exists with its index and foreign key" (query `information_schema.columns` and `pg_indexes` for `review_events`, and `pg_constraint` for `confdeltype = 'n'` on `actor_id`); "withdrawn is a value of enum_notifications_kind" (`select unnest(enum_range(null::enum_notifications_kind))::text` holds it). Import nothing that loads the config before `scratchPayload()` (its header comment).
- [ ] **Step 4: Apply to a throwaway copy.** `~/cilas-verify/verify.sh --db migrated --int-only portal/phase-2-review-core <sha>` (V0). Expected: RESULT.md line 1 lists both migrations; `portal-phase-2.int.test.ts` passes. Never run `pnpm db:migrate` against `cilas_dev`. Commit; add both files to "For the operator" in the PR body.

### Task C7: Owner moves

**Skills:** tdd, payload.

**Files:** Create `src/lib/owner-moves.ts`.

**Interfaces:**

```ts
type OwnerMove =
  | { move: 'withdraw' } // submitted -> draft (new, edits, or removal request)
  | { move: 'requestRemoval' } // live: copy -> submitted with request: removal
  | { move: 'discard' } // live: copy takes the live row's reviewed fields
  | { move: 'restore'; from: number } // live: copy takes the reviewed fields of version `from`
type OwnerMoveResult =
  | { ok: true; restoreFrom?: number } // `restoreFrom` on discard: the version id before the discard
  | { ok: false; reason: 'decided' | 'refused' }
ownerMove(payload: Payload, user: User, target: { collection: ReviewedCollection; id: number }, move: OwnerMove): Promise<OwnerMoveResult>
```

- Every write is `payload.update({ collection, id, user, overrideAccess: false, depth: 0, … })`, so `applyReview` and the lock (C1) apply. `withdraw`: `data: { review: { status: 'draft' } }`, `draft: false` on a document that is not live (spec: Submit and Withdraw are full saves), and a draft save on a live one (`recordDraftSave` forces it). `requestRemoval`: `data: { review: { status: 'submitted', request: 'removal' } }`. `discard`: read the main row and the latest version (`find` and `findVersions`, `locale: 'all'`, `depth: 0`, gated), keep `restoreFrom = latest version id`, then write the live row's `REVIEWED_FIELDS[collection]` with `locale: 'all'` (P11) and `review.status` of `draft` when the copy is at `changes_requested` or `rejected`, else the copy's own status. `restore`: read version `from` with `findVersionByID` (gated), write its reviewed fields with `locale: 'all'`, keep the copy's status.
- An `APIError` with status 403 maps to `{ ok: false }`: `reason: 'decided'` when a fresh `statusOf` read of the document says `waitsOn(key) !== 'admin'` and the move was `withdraw` (the lock let an admin decide first; spec, Errors), else `'refused'`. Any other error rethrows.
- [ ] **Step 1:** Implement. Tests run in C8. Commit.

### Task C8: The `review-events` int cases, reviews, full suite, open PR 2-1

**Skills:** tdd, payload; then code-review, then security-review.

**Files:** Create `src/lib/review-events.int.test.ts`. Uses `testing/portal-lists.fixture.ts` writers and `resendInbox()` (Int test setup).

- [ ] **Step 1: The int cases** (all in `describe('review-events: history and owner moves')`, each with its own ids; mail captured by `resendInbox()`):
  1. "six moves give six rows in order": submit, ask for changes with note 1 (admin), submit, ask for changes with note 2, submit, approve. Six rows in order; notes 1 and 2 on rows 2 and 4 and on no other row; six distinct `version` ids, also for two moves in one second (the two admin moves run back to back).
  2. "the owner reads the history; another member reads none": through `reviewHistoryFor`, the owner gets 6 rows; after the approval the item is published and another member gets `[]`.
  3. "a REST read of review-events as a member returns nothing": `rest('GET', 'review-events', { token })` returns no docs (403 or an empty list).
  4. "an autosave and a save that keeps the status write no row".
  5. "withdraw a new submission": `ownerMove(withdraw)` on a never-published submitted article. Key `draft`; admins get one `withdrawn` notification each; no email (`resendInbox()` holds none for this test); `getReviewQueue(payload)` does not list it; one row `submitted -> draft` with `note: null`.
  6. "withdraw changes on a live article": key becomes `published_unsent` (or `published` when the copy equals the live row), `request` null, admins get `withdrawn`, no email.
  7. "withdraw a removal request": the owners get no `removed` notification and no email; the admins get `withdrawn`; the article stays live.
  8. "discard from each copy state": for a live article with a copy at `approved`, `draft`, `changes_requested` and `rejected`: `ownerMove(discard)` succeeds, the public read is unchanged, no email, the key is `published`; the moves from `changes_requested` and `rejected` each write one row, the other two write none.
  9. "discard, then restore them": the key returns to `published_unsent` with the same field values in both locales (P11), and no email.
  10. "an owner's withdraw is refused once an admin decided": approve first (admin, `payload.update`), then `ownerMove(withdraw)` returns `{ ok: false, reason: 'decided' }`.
  11. "submit tells the admins and writes one row with no note" (the owner's move has `note: null`).
- [ ] **Step 2:** **[verify]** `verify.sh --db migrated --int-only portal/phase-2-review-core <sha>`. Pass predicate (Int runs): no test of `lock-row`, `review-events`, `portal-phase-2`, `review-status` or the applicant files is named as failed in RESULT.md.
- [ ] **Step 3: Reviews.** code-review (spec Review and history, Status model Discard, Migrations as the issue), then security-review: `review-events` writes refused for every user through REST and GraphQL (`rest('POST', 'review-events', …)` as an admin returns 403); `reviewHistoryFor` returns `[]` to a non-owner member; the lock never runs outside a transaction; no `notify` call in `review-hooks.ts` lacks `req`.
- [ ] **Step 4:** Fix. **[verify]** the full suite with `--db migrated`. Per-PR step 5. Open `feat(portal): review events, withdraw and one row lock (portal phase 2, PR 1)`. The PR body lists both migrations under "For the operator" and says that every Mac run of a branch with this PR needs `--db migrated` until `cilas_dev` is migrated.

**Verification boxes (2-1).**

- [ ] **unit:** `review.unit.test.ts`, `notification-preferences.unit.test.ts`; int `lock-row.int.test.ts`, `review-events.int.test.ts`, `portal-phase-2.int.test.ts` (all on `--db migrated`).
- [ ] **live:** Scenario on the kept app (`verify.sh --db migrated --keep --no-tests`, Mail off (M) server guard first, a scratch world with one admin, one fellow and one submitted article): the fellow withdraws the article through REST (`curl -X PATCH -b <fellow cookie> -H 'Content-Type: application/json' -d '{"review":{"status":"draft"}}' http://localhost:<port>/api/articles/<id>`). Pass: HTTP 200; the admin's bell (`/en/spaces`, `agent-browser`) shows a "Withdrawn" row; `/admin/reviews` no longer lists the article; `docker exec cilas-db-1 psql -U cilas -d cilas_migrated -c "select \"from\", \"to\", note from review_events where doc = <id>"` prints `submitted | draft |` (null note). `agent-browser close`.
- [ ] **perf:** no route. Metric: statements per review write. The C1 int case shows one added `select … for update` per update; case 4 shows no `review_events` row and no `findVersions` call on an autosave. Pass: both cases green. Recorded in the PR.

## PR 2-2. Link plumbing (`portal/phase-2-links`)

Base `origin/main` after 2-1 merges. No screen. No link target changes in this PR: every `documentHref` result stays an admin URL.

### Task L1: `documentHref` shape and `localizedLink`

**Skills:** tdd.

**Files:** Modify `src/lib/document-href.ts`, `src/lib/document-href.unit.test.ts`, and the callers P19 prints.

**Interfaces:**

```ts
type DocumentTarget = {
  collection: ReviewedCollection | 'users'
  id: number
  viewer: 'owner' | 'admin' | 'fellow'
  waiting: boolean // waitsOn(key) === 'admin'
}
documentHref(target: DocumentTarget): string // a locale-free path (Deviation 3)
applicantsHref(target: { application: number } | { course: number }): string // Deviation 4
localizedLink(path: string, locale: Locale): string // `/{locale}${path}` when path starts with `/spaces`, else path
absoluteLink(path: string, locale: Locale): string // `${NEXT_PUBLIC_SERVER_URL without trailing /}${localizedLink(path, locale)}`
```

- In 2-2: every reviewed target gives `/admin/collections/{collection}/{id}`; `users` gives `/admin/collections/users/{id}`; `applicantsHref` gives today's two admin URLs.
- [ ] **Step 1: Failing unit table** (`pnpm exec vitest run --project node src/lib/document-href.unit.test.ts`): one row per collection (articles, courses, publications, users) x viewer x `waiting`, all admin URLs; `applicantsHref` two rows; `localizedLink` keeps `/admin/...`, prefixes `/spaces/...` for `en` and `ar`; `absoluteLink` has no double slash. FAIL. Implement. Drop `locale` from each caller (P19). `pnpm exec tsgo --noEmit`: no error. PASS. Commit.

### Task L2: Callers that still write their own link

**Skills:** tdd.

**Files:** `src/lib/invitation.ts` (`link:` at `:83`), `src/forms/notify-application.ts` (`:42`, `:64`), `src/lib/review-queue.ts` (`getReviewQueue` `href`, `:147`).

- [ ] **Step 1:** `invitation.ts` uses `documentHref({ collection: 'users', id, viewer: 'admin', waiting: false })`; `notify-application.ts` uses `applicantsHref({ application: doc.id })` and `applicantsHref({ course: course.id })`; `getReviewQueue` uses `documentHref({ collection: row.collection, id: row.id, viewer: 'admin', waiting: true })`. `git grep -n "'/admin/" -- src/lib src/forms | grep -v test | grep -v document-href` prints no notification or email link. Existing tests that assert these links still pass (unit now, int at L5). Commit.

### Task L3: One review email per recipient, in that recipient's locale

**Skills:** tdd, payload.

**Files:** `src/lib/review-mail.ts`, `src/lib/review-hooks.ts` (`notifyReview`).

**Interfaces:**

- `type Recipient = { id: number; email: string; locale: Locale }`. `adminRecipients` and `ownerRecipients` read each user's `space-preferences` row (`account in ids`, `select: { account: true, locale: true }`, `overrideAccess: true`, `req`; P21) and use `routing.defaultLocale` when there is no row or no locale.
- `emailRecipients(req, people, kind)` keeps its filter and returns `Recipient[]` with the locale.
- `reviewEmailUrl(recipient: Recipient, target: Omit<DocumentTarget, 'viewer'> & { viewer: DocumentTarget['viewer'] }): string` = `absoluteLink(documentHref(target), recipient.locale)`. The one builder of an email link (Deviation 10).
- `sendReviewEmail(req, recipient, state, title, note, { noun, url })` sends one message `to: recipient.email`. `notifyReview` loops over `emailRecipients(...)`, one `sendReviewEmail` per recipient, each with `reviewEmailUrl(recipient, …)`. The stored `notifications.link` stays the locale-free `documentHref` path.
- [ ] **Step 1:** Implement. The int case runs in L5. Commit.

### Task L4: The bell adds the reader's locale

**Skills:** tdd, modern-web-guidance (first).

**Files:** `src/components/site-notifications.tsx` (`toItem`), its dom test (`src/components/site-notifications.dom.test.tsx`, create if missing).

- [ ] **Step 1: Failing dom test:** a stored link `/spaces/review/articles/5` renders as `href="/ar/spaces/review/articles/5"` in the Arabic bell; `/admin/collections/users/3` renders unchanged. FAIL. Change `href: n.link ?? undefined` to `href: n.link ? localizedLink(n.link, locale) : undefined` (`locale` is in scope from `useLocale()`). PASS. Commit.

### Task L5: Int case, review, full suite, open PR 2-2

**Skills:** tdd, payload; then code-review.

**Files:** Create `src/lib/review-mail.int.test.ts`.

- [ ] **Step 1: Int cases** (`describe('review-events: one email per recipient')`): "a submit with one Arabic and one English admin sends two emails, each to one address, with a link in that admin's locale" (two admins, one `space-preferences` row with `locale: 'ar'`; `resendInbox()` holds two messages, each `to` has one address, and each body holds `reviewEmailUrl(thatAdmin, …)`; in 2-2 both are admin URLs, so the locale shows only once 2-6 switches the admin branch; the case asserts `reviewEmailUrl` equality, which keeps it true across 2-6); "an approval email holds reviewEmailUrl(owner)" (used by the end gate, Deviation 10).
- [ ] **Step 2:** **[verify]** `verify.sh --db migrated --int-only`: no test of `review-mail`, `review-events`, `invitation`, `notify-application` or `review-queue` named as failed.
- [ ] **Step 3:** code-review (spec Document links as the issue). Fix. **[verify]** the full suite. Per-PR step 5. Open `refactor(portal): one link builder and per-recipient review emails (portal phase 2, PR 2)`.

**Verification boxes (2-2).**

- [ ] **unit:** `document-href.unit.test.ts`, `site-notifications.dom.test.tsx`; int `review-mail.int.test.ts`.
- [ ] **live:** Scenario on the kept app with mail captured, not sent: run the server with the console email adapter (Mail off (M) server env), submit an article as a fellow in a scratch world with two admins (one with `space-preferences.locale = 'ar'`). Pass: the server log shows two review messages, each with one `to` address; no message lists two addresses.
- [ ] **perf:** no route. Metric: mail calls per submit = number of admin recipients (was 1). Pass: the int case counts match the recipients. Recorded in the PR.

## PR 2-3. Pending provider (`portal/phase-2-pending`)

Base `origin/main` after 1c-2 merges (P1). Shell only; no decision surface yet. Phase 3 reuses this provider with no change (spec `PendingApi`, plus `flush`).

### Task P1: The state machine (pure)

**Skills:** tdd.

**Files:** Create `src/portal/pending/machine.ts`, `src/portal/pending/machine.unit.test.ts`.

**Interfaces:**

```ts
export type PendingState = 'pending' | 'paused' | 'committing' | 'sent' | 'failed' | 'undone'
export type PauseCause = 'focus' | 'tap' | 'overlay'
export type PendingRequest = { url: string; body: unknown }
export type PendingItem = {
  key: string
  label: string
  request: PendingRequest
  state: PendingState
  causes: ReadonlySet<PauseCause>
  remainingMs: number // time left when last paused, or at start
  runningSince: number | null // performance.now() when the timer last started; null while paused or done
  status?: number
  result?: unknown
}
export type PendingEvent =
  | { type: 'pause'; cause: PauseCause }
  | { type: 'resume'; cause: PauseCause }
  | { type: 'undo' }
  | { type: 'expire' }
  | { type: 'flush' }
  | { type: 'ok'; status: number; result: unknown }
  | { type: 'refused'; status: 400 | 409 }
  | { type: 'error'; status?: number }
  | { type: 'retry' }
  | { type: 'dismiss' }
export const startItem = (input: { key: string; label: string; request: PendingRequest }, now: number, undoMs: number, overlayOpen: boolean): PendingItem
export const transition = (item: PendingItem, event: PendingEvent, now: number): PendingItem | 'illegal' | 'gone'
export const remaining = (item: PendingItem, now: number): number
export const sends = (before: PendingItem, after: PendingItem) => before.state !== 'committing' && after.state === 'committing'
```

- One table `TRANSITIONS: Record<PendingState, Partial<Record<PendingEvent['type'], …>>>` holds the spec's rows and nothing else. `pause` adds the cause and moves `pending` to `paused` (stores `remainingMs`); `resume` removes the cause and moves to `pending` only when the set is empty (sets `runningSince = now`); `dismiss` from `sent` or `undone` returns `'gone'`. Every other pair returns `'illegal'`. `startItem` starts `paused` with `causes: {overlay}` when `overlayOpen`. `decide` on a key that has an item is the provider's refusal (it never reaches `transition`).
- [ ] **Step 1: Failing unit table** (`pnpm exec vitest run --project node src/portal/pending/machine.unit.test.ts`, `describe('pending: state machine')`): one row per legal row of the spec table (17 rows, with each `pause` cause); one refusal per illegal pair, among them `undo` from `committing` and from `sent`, `retry` from `pending`, `expire` from `paused`, `ok` from `pending`; "resume with one cause left stays paused"; "remaining after pause and resume is the time that was left, read from now" (start at 0, pause at 2000, resume at 9000, `remaining` at 10000 is `UNDO_MS - 3000`); "expire then flush sends once" (`sends` true only for the first). FAIL. Implement. PASS. Commit.

### Task P2: The provider

**Skills:** tdd, modern-web-guidance (first), better-accessibility.

**Files:** Create `src/portal/pending/pending-provider.tsx`, `src/portal/pending/clock.ts`, `src/portal/pending/undo-ms.ts`, `undo-ms.unit.test.ts`, `pending-provider.dom.test.tsx`. Modify `src/env.ts`.

**Interfaces:**

- `PendingApi` as the spec writes it, plus `flush(): Promise<{ ok: boolean }>` (Deviation 5). `usePending(): PendingApi`, `usePendingItem(key): PendingView | null`, `useOverlay(open: boolean): void` (Deviation 6). With no provider, `usePending` throws (a portal-only hook) and `usePendingItem` returns `null`.
- `type Clock = { now(): number; setTimeout(fn, ms): number; clearTimeout(id): void }`; `browserClock` uses `performance.now()`. `PendingProvider({ clock = browserClock, fetcher = fetch, undoMs = undoMsFromEnv(), children })`: tests inject a fake clock and fetcher.
- `undoMsFromEnv()`: `NEXT_PUBLIC_PORTAL_UNDO_MS` parsed as an integer from 500 to 5000, else 5000. `src/env.ts` declares it optional in `client` and `runtimeEnv`. Only test builds set it (1500): `verify.sh` and the Playwright `webServer.env` (P8 note). Production never sets it, and `undo-ms.unit.test.ts` checks "unset gives 5000" and "6000 gives 5000".
- State: a `Map<string, PendingItem>` in a reducer (`useReducer`), one timer per running item, set for `remaining(item, now)`. On a transition where `sends(before, after)`: `fetcher(request.url, { method: 'POST', keepalive: true, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request.body) })`; the body is checked under 64 KB before `decide` accepts it (else `decide` throws, a caller bug). 2xx: `ok` with the parsed JSON (`null` when the body is not JSON); 400 or 409: `refused`; any other status or a network error: `error`.
- `overlay(open)`: a counter. Above 0, every item gets `pause` with `overlay`; back to 0, `resume` with `overlay`.
- Flush triggers: `pagehide`, `visibilitychange` to `hidden`, provider unmount (the cleanup waits one task with `setTimeout(…, 0)` and does nothing when a remount set a `mounted` ref again: React Strict Mode), and `flush()`.
- `pageshow` with `event.persisted`: drop every item and call `router.refresh()` (`next/navigation`, `use-router.md`).
- After `ok` or `refused`, the item shows its result line, then `dismiss` (the caller dismisses through the view; the provider dismisses `sent` after its toast shows, see P4). A refused item calls `router.refresh()` and is never retried.
- [ ] **Step 1: Failing dom tests** (`pnpm exec vitest run --project dom src/portal/pending/pending-provider.dom.test.tsx`, `describe('pending: provider')`, fake clock and fetcher), the spec's unit list: "expire and flush together send one fetch"; "decide, focus, blur: the commit comes after the time that was left"; "a 409 ends in undone with no retry, and refreshes"; "a modal with two items pending: both pause, and both resume with their time left when it closes"; "a dialog over a sheet: items stay paused until the sheet closes" (`overlay(true)` twice, `overlay(false)` once, still paused); "on ok the view holds result"; "decide on a key with an item returns false"; "an item that starts while an overlay is open starts paused"; "Strict Mode remount does not flush" (render in `<StrictMode>`, no fetch); "pageshow persisted drops items and refreshes"; "flush resolves ok false when one commit fails". FAIL. Implement. PASS. Commit.

### Task P3: Mount, Sign out flush, overlay on the More sheet

**Skills:** tdd, modern-web-guidance (first), better-accessibility.

**Files:** Create `src/portal/pending/sign-out.ts`. Modify `src/portal/nav/portal-shell.tsx`, `account-menu.tsx`, `bottom-bar.tsx`, `more-sheet.tsx`, `more-sheet.browser.test.tsx`.

**Interfaces:**

- `usePortalSignOut(): () => Promise<void>`: `const { ok } = await pending.flush()`; when `!ok`, it stops (no sign-out; the failed item shows its error with **Try again** and **Undo**, P4) and shows the toast `Portal.pending.signOutStopped` ("A decision was not saved. Sign out stopped."); else it runs the sign-out of `src/lib/sign-out.ts` (export the inner `signOut` for this; `useSignOut` keeps its behaviour for the site header).
- `PortalShell` renders `<PendingProvider>{…}<UndoAllBar /></PendingProvider>` inside `FoldProvider` (Shared files). The provider renders on first render (spec, Lazy loading rule).
- `MoreSheet` calls `useOverlay(open)`.
- [ ] **Step 1: Failing browser test** in `more-sheet.browser.test.tsx`: "opening the More sheet pauses a pending item" (a provider with a fake clock and one item; open the sheet; the item's view state is `paused`; close; `pending`). FAIL. Implement. PASS. **[verify]** `verify.sh --tests-only portal/phase-2-pending <sha> src/portal/nav` (browser tests). Commit.

### Task P4: Ring, Undo all bar, pending toast

**Skills:** tdd, modern-web-guidance (first), arc, better-accessibility, apple-design (the ring), animate (the ring drain), better-writing then humanizer (copy).

**Files:** Create `src/portal/pending/pending-ring.tsx`, `pending-ring.module.css`, `pending-ring.browser.test.tsx`, `undo-all-bar.tsx`, `undo-all-bar.dom.test.tsx`, `pending-toast.tsx`, `pending.module.css`. Modify `src/portal/nav/shell.module.css`, `messages/{en,ar}.json` (`Portal.pending.*`).

**Interfaces:**

- `PendingRing({ itemKey, label })`: a `<button>` (24x24 min, 44x44 under `(pointer: coarse)`) with an SVG arc whose `stroke-dashoffset` follows `remaining / undoMs` (read each animation frame from the view; no React state per frame). First tap on a touch screen: `pause(key, 'tap')`; second: `undo`. A tap elsewhere or Esc away from the item: `resume(key, 'tap')`. Esc on the ring: `undo`. Accessible name: "{label}. Undo. {n} seconds left." and, paused, ending "Timer paused." Under `prefers-reduced-motion: reduce`: no arc; the whole seconds as text, updated each second, `aria-hidden`.
- `UndoAllBar`: renders only with 2 or more items in `pending` or `paused`. `<section aria-label={t('bar.label')}>` ("Pending decisions"), text "{n} emails wait" plus "Emails go when you leave this page or switch app.", **Undo all**. On first show, `announce(t('bar.announce', { n }))` once ("{n} emails wait. Undo all is available."). After **Undo all**, focus moves to the first item that came back (the caller registers each item's focus target through `PendingApi`; the bar calls the first). Its height sets `--pending-bar-block-size` on the shell (the `scroll-padding-block-end` sum).
- `PendingToast` (`preloadable`): the toast content for an item: "{verb}. Email in {n} s" with **Undo**, `duration: Infinity`, id `pending:{key}`; the provider updates it on `sent` ("Email sent" with `SuccessCheck`, or "Decided"), `failed` ("Not saved." with **Try again** and **Undo**), `refused` (the caller's copy), then dismisses it after the portal's 8 s toast rule. The first pending toast of a session adds "Emails go when you leave this page or switch app." The toast never takes focus and never holds the only path to an action (the pending row and the bar hold them too).
- [ ] **Step 1: Failing tests:** `pending-ring.browser.test.tsx`: "reduced motion shows seconds as text and no arc" (`page.emulateMedia({ reducedMotion: 'reduce' })` equivalent in Vitest browser mode); "Esc on the ring undoes"; "first tap pauses, second tap undoes" (touch pointer); "the name ends Timer paused while paused"; RTL: the ring sits at the inline end. `undo-all-bar.dom.test.tsx`: "hidden with one item"; "two items show the bar and announce once"; "Undo all undoes both and focuses the first". FAIL. Implement. PASS (**[verify]** for the browser file). Commit.

### Task P5: Copy

**Skills:** better-writing, then humanizer.

- [ ] **Step 1:** `Portal.pending` keys in English and Arabic: the line per verb ("Approving. Email in {n} s", "Asking for changes. Email in {n} s", "Declining. Email in {n} s", "Removing. Email in {n} s", "Keeping it. Email in {n} s"), "Paused. Email waits.", "Not saved.", "Try again", "Undo", "Undo all", "{n, plural, one {# email waits} other {# emails wait}}", "Emails go when you leave this page or switch app.", the ring names, "Email sent", "Email failed", "Decided", the sign-out stop line. ICU plurals and gender-neutral Arabic (D8). Commit.

### Task P6: Reviews, full suite, open PR 2-3

**Skills:** code-review, then security-review; better-accessibility.

- [ ] **Step 1:** code-review (spec Pending decisions as the issue: every state row, the cause set, flush triggers, bfcache, `UNDO_MS`). security-review: the provider sends only the `request` its caller gave, same origin, `credentials: 'include'`; no request body logs; the env value cannot exceed 5000 in a production build.
- [ ] **Step 2:** Fix. **[verify]** the full suite (default database is enough: no migration in this PR, but use `--db migrated` once 2-1 is on `main`). Per-PR step 5. Open `feat(portal): pending decisions provider and sign-out flush (portal phase 2, PR 3)`.

**Verification boxes (2-3).**

- [ ] **unit:** `machine.unit.test.ts`, `undo-ms.unit.test.ts`, `pending-provider.dom.test.tsx`, `undo-all-bar.dom.test.tsx`; browser `pending-ring.browser.test.tsx`, `more-sheet.browser.test.tsx`; e2e `portal-shell` (unchanged rows still pass with the provider mounted).
- [ ] **live:** Scenario on the kept app as the fixture student: open `/en/spaces`, open and close the More sheet at 390 px, then **Sign out** from the account menu at 1440 px. Pass: no console error; sign-out ends on the signed-out page within the time it took on `main` (no wait with zero items); `document` has listeners for `pagehide` and `visibilitychange` (`agent-browser eval "getEventListeners"` is not in agent-browser, so check with a `performance.mark` added only in a scratch build, or read the provider's dom test instead and say so).
- [ ] **perf:** Metric 1: the client JavaScript the student's `/en/spaces` route loads, gzip, from `next build` output on the Mac (route table "First Load JS"), `main` at the base vs the head. Pass: head minus base at most 4 KB (the provider renders on every portal page; spec Lazy loading rule; the ring and the toast content load only where used). Metric 2: TTFB p75 per role on `/en/spaces` by Perf runs (1d Global Constraints), baseline `main` at the base. Pass: head p75 at most `L`. BLOCKING or REPORT-ONLY by the 1d P12 rule.
