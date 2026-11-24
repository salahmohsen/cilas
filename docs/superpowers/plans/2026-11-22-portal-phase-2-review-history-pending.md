# Portal phase 2: To review, history and the pending provider. Implementation plan

> **For agentic workers:** use the pstack poteto-mode skill and its Feature playbook (`<newest pstack>/skills/poteto-mode/playbooks/feature.md`). Use only pstack/poteto skills; never superpowers or caveman. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins decide on submitted articles, courses and publications in the portal (To review), with a 5 s undo window, a history of every review move and a field diff. Owners open their work in the portal as read-only pages, and withdraw, request removal or discard their changes there. Every email and bell link opens the page that fits the reader's role.

**Architecture:** Seven PRs. PR 2-1a changes the write path with no screen: one row lock for every write to a reviewed document (`lockRow`), a savepoint helper for the bell rows, the withdraw and discard moves (D3), the `withdrawn` kind (M3) and one module of owner moves. PR 2-1b adds the history: the `review-events` collection and its hook (M1) and `reviewHistoryFor`. PR 2-2 changes how links are built and sent, with no visible link change yet: `documentHref` covers every notice, review emails go one per recipient in that recipient's locale, and the bell adds the reader's locale to a `/spaces` link. PR 2-3 adds the pending provider (a pure transition function, a plain store and a thin client provider in the shell) and the **Sign out** flush. PR 2-4 adds the review endpoint `POST /api/{collection}/{id}/review` with its move table, `Origin` check, lock, stale check and idempotent retry, run by one `withTransaction` helper, and the course `onApprove` (D10). PR 2-5 splits `CourseBody` out of `CourseView` (the public page stays the same), ships the owner's read-only pages `/spaces/articles/[id]` and `/spaces/courses/[id]` with the banner, the history and the owner buttons, and switches the owner branch of `documentHref`. PR 2-6 ships To review (nav item, list, pane, diff, actions on the pending provider), switches the admin branch of `documentHref`, and adds the one-off link script.

**Tech stack:** Next.js 16.4.6 App Router, React 19.2.6, next-intl 4, Payload 3.91.0 (Postgres, `push: false`, `src/payload.config.ts`), Arc UI (`src/components/arc`), Vitest 4, Playwright 1.58.2, `@axe-core/playwright`.

**Spec:** `docs/superpowers/specs/2026-11-18-portal-design.md`: Phases (Phase 2 and the target table rows "To review, and an admin's `documentHref`" and "An owner's `documentHref`"), Pending decisions and the undo window, Review and history, Document links, Status model (Discard my changes, `published_unsent`), Tasks (`countReviewQueue`), Navigation, Routes, Feature folders, Data access rule, Lazy loading rule, Accessibility baseline, Design language (Toasts, Undo not confirm, Motion), UI skills, Migrations (M1, M3), Tests, Decisions log (D3, D6, D9, D10, D15, D16), Calls this spec makes that no decision covers. The spec wins where they differ, except for the Deviations below.

**Sources read for this plan** (by reading only; no command ran a build, a server or a test). Line numbers are true at the SHA given. Each premise check is a `git grep` or a type name, so it still works after a line moves.

| Source                           | Ref                                                                                                                                                                                                                      | SHA                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`                           | `origin/main`                                                                                                                                                                                                            | `9abfbe67` (#66, 1c-4), on top of `30c1a60a` (#65, 1d-2), `b107b9be` (#64, 1b-2b), `c3cdd332` (#63, 1d-1), `3cd81cc6` (#62, 1c-1). Phases 0, 1a, 1b, 1c-0, 1c-1, 1c-4, 1d-1 and 1d-2 are on `main`                                                                                                        |
| Phase 1c PR 1c-2 (Inbox, counts) | `origin/portal/phase-1c-inbox`                                                                                                                                                                                           | `94a51605` (in build when this plan was fixed, no PR merged; first read at `18b689b6`): `COUNT_OF` in `src/portal/nav/nav-counts.tsx`, `PortalNavItem` with no `count`, `INBOX`, `PortalShell` takes `counts`, `REFRESHES_WORK: Record<NotificationKind, boolean>` in `src/portal/needs/work-refresh.tsx` |
| Phase 1c PR 1c-3 (Home)          | plan on `main`, `docs/superpowers/plans/2026-11-21-portal-phase-1c-tasks-home-inbox.md`                                                                                                                                  | not started                                                                                                                                                                                                                                                                                               |
| Phase 1d PR 1d-3 (Calendar tab)  | `origin/portal/phase-1d-calendar`                                                                                                                                                                                        | `574c0508` (in build): `CALENDAR` in `portal-nav.ts`, `NAV_BY_ROLE` and route-shape rows in `testing/portal-e2e.test-utils.ts`                                                                                                                                                                            |
| Payload                          | `/home/salah/cilas/node_modules/payload` 3.91.0                                                                                                                                                                          | `dist/collections/operations/updateByID.js` (transaction `:24`, `beforeOperation` `:61`, document read `:132`), `restoreVersion.js` (`:26`, `:30`)                                                                                                                                                        |
| Next.js docs                     | `/home/salah/cilas/node_modules/next/dist/docs/` (16.4.6)                                                                                                                                                                | `01-app/03-api-reference/04-functions/refresh.md` (`import { refresh } from 'next/cache'`, `:30`), `use-router.md` (`router.refresh()` keeps client state, `:46`), `01-app/02-guides/upgrading/version-16.md:1003` (no First Load JS in `next build`)                                                     |
| UI rules                         | `src/components/sdk/README.md` (read in full) and AGENTS.md; ADRs 0011 and 0012 by title only (the README restates the 0012 rule; phase 2 changes no calendar code, so 0011 is cited only for "sessions have no review") | `9abfbe67`                                                                                                                                                                                                                                                                                                |
| Arc registry                     | `https://uiarc.dev/r/registry.json` (public JSON)                                                                                                                                                                        | Read 2026-11-22: 147 items. No countdown-to-commit ring, diff view, undo bar or sticky action bar (UI parts order)                                                                                                                                                                                        |

**Who decided.** "Plan decision" marks a call of this plan writer. The phase 2 orchestrator may change it in a review round. "Operator rule" marks a rule from the ledger's "Rules for the run" (`/home/salah/cilas-portal-run/LEDGER.md`).

---

## What each reader sees

- **2-1a:** nothing new on a page. An owner can withdraw a submission in `/admin` through the existing REST path (the move becomes legal). Admins get a `withdrawn` bell row (and a push, unless they turned the kind off) when an owner withdraws. A new preference row "Withdrawn" in Settings, Notifications, for admins.
- **2-1b:** nothing on a page. Every review move writes a history row that no screen reads yet.
- **2-2:** each review email goes to one address, so recipients no longer see each other's addresses. An approved article's bell line names the tier. Links still open the admin (no target changes yet).
- **2-3:** nothing visible, except that **Sign out** in the portal waits for pending decisions (none exist until 2-6).
- **2-4:** nothing visible. A new API path that only the To review pane of 2-6 calls.
- **2-5:** owners open their articles and courses in the portal from the lists, Home, Inbox, the bell and emails. The read-only page has the status banner, the history, and **Withdraw**, **Withdraw changes**, **Request removal** and **Discard my changes** with **Restore them**. **Edit** opens the admin editor. The public course page does not change.
- **2-6:** admins get **To review** in the sidebar (with its count), the list with the pane, the history, the diff, and decisions with a 5 s undo. Admin links to waiting documents open To review.

## PRs

| PR                      | Branch                           | Base                                       | Tasks                   | Screen            | Ends when                                                                                                                                                                                          |
| ----------------------- | -------------------------------- | ------------------------------------------ | ----------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2-1a. Lock and withdraw | `portal/phase-2-lock-withdraw`   | `origin/main` after phase 1c merges        | V0, C1, C2, C3, C7, C8a | none              | `src/lib/row-lock.int.test.ts`, `src/lib/owner-moves.int.test.ts`, `src/migrations/lib/portal-phase-2.int.test.ts` (the enum case), `review.unit.test.ts`, `notification-preferences.unit.test.ts` |
| 2-1b. Review events     | `portal/phase-2-review-events`   | `origin/main` after 2-1a merges            | C4, C5, C6, C8b         | none              | `src/lib/review-events.int.test.ts`, `src/migrations/lib/portal-phase-2.int.test.ts` (the table case), the audit snapshot                                                                          |
| 2-2. Link plumbing      | `portal/phase-2-links`           | `origin/main` after 2-1a merges            | L1 to L5                | none              | `document-href.unit.test.ts`, `src/lib/review-mail.int.test.ts`, `site-notifications` dom test, `latest-list` dom test                                                                             |
| 2-3. Pending provider   | `portal/phase-2-pending`         | `origin/main` after phase 1c merges        | V1, P1 to P6            | none (shell only) | `machine.unit.test.ts`, `store.unit.test.ts` (the spec's `pending` unit spec), `pending-provider.dom.test.tsx`, `modal-open.browser.test.tsx`, `pending-ring.browser.test.tsx`, the shell tests    |
| 2-4. Review endpoint    | `portal/phase-2-review-endpoint` | `origin/main` after 2-1a and 2-1b merge    | E1 to E7                | none              | `src/lib/review-endpoint.int.test.ts` (the spec's `review-events` int cases for the endpoint), `review-moves.unit.test.ts`                                                                         |
| 2-5. Owner pages        | `portal/phase-2-owner-pages`     | `origin/main` after 2-1b and 2-2 merge     | O0 to O7                | yes               | `e2e/portal-document.e2e.test.ts`, `document-href.unit.test.ts` (owner rows), `course-view-body.browser.test.tsx`, the view tests                                                                  |
| 2-6. To review          | `portal/phase-2-to-review`       | `origin/main` after 2-3, 2-4 and 2-5 merge | R1 to R10               | yes               | `e2e/portal-review.e2e.test.ts` (the spec's `portal-review` and the `pending` e2e cases), the To review rows of `portal-shell`, `review-diff.unit.test.ts`, the end gate                           |

**Dependency graph.** "1c" means all of phase 1c is on `main` (1c-2 and 1c-3 included). The operator rule and the spec ("Depends on: phase 1c, M1, M3") say the same: no phase 2 PR starts building before that.

```
2-1a  needs 1c
2-1b  needs 2-1a
2-2   needs 2-1a
2-3   needs 1c
2-4   needs 2-1a and 2-1b
2-5   needs 2-1b and 2-2
2-6   needs 2-3, 2-4 and 2-5
1d-3  soft link to 2-3 and 2-6 (shared shell and nav files; see Shared files)
```

- 2-1a needs nothing of phase 2. It changes `review-hooks.ts` and `notify.ts`, and makes M3.
- 2-1b needs 2-1a: both change `review-hooks.ts` (C4 adds a hook beside C3's `notifyReview` change), and the history cases read the withdraw move. It makes M1.
- 2-2 needs 2-1a: both change `notifyReview` in `src/lib/review-hooks.ts` and `src/lib/review-mail.ts`, and the per-recipient email test reads the `withdrawn` rule. It does not need 2-1b.
- 2-3 needs no other phase 2 PR. It edits `portal-shell.tsx`, `account-menu.tsx` and `bottom-bar.tsx`, which phase 1c also changed (P1). It may build in parallel with 2-1a, 2-1b, 2-2 and 2-4.
- 2-4 needs 2-1a (`lockRow`, the withdraw move for the race tests) and 2-1b (`review-events`, which its repeat check reads). It may build in parallel with 2-2, 2-3 and 2-5.
- 2-5 needs 2-1b (`reviewHistoryFor`) and 2-2 (`documentHref` shape, Deviation 3). The owner moves come from 2-1a. It needs neither 2-3 nor 2-4: owner moves commit at once (spec, "Discard commits at once"), and they are not review decisions.
- 2-6 needs 2-3 (the provider), 2-4 (the endpoint) and 2-5 (the banner, history and body views in `src/portal/review/`, which 2-5 creates).

**Parallel build.** Up to three builders at a time: 2-1a and 2-3 first; then 2-1b and 2-2 after 2-1a merges; then 2-4 after 2-1b; then 2-5 after 2-1b and 2-2; then 2-6 last. A builder may start a dependent PR before its base merges by branching from the base PR's branch, and rebases on `origin/main` once the base merges (the 1d-3 rule). The PR then targets `main`. This never lets a PR start before phase 1c is on `main`.

**Landing order:** 2-1a, then 2-1b and 2-2 (either order), 2-3 (any time after 1c), then 2-4, then 2-5, then 2-6. Rebase each PR on `origin/main` before it opens and again before it merges (Shared files).

**Merge (MERGE RULE, ledger Rules).** Each PR squash-merges when READY, one at a time, under `merge.lock`, and waits for the deploy run. READY needs every verification box of the PR ticked (Global Constraints, Verification boxes). 2-1a is the first portal PR with a migration (M3, an enum value) and 2-1b the second (M1, a table). The deploy of each applies its migration to production (Dockerfile `pnpm db:migrate`). Prod is a beta with no real users (memory prod-is-beta), and both migrations only add (a table, an enum value, a nullable column), so a rollback of the app does not need a down migration. The 2-1a merge also changes what every other thread's Mac runs need (Global Constraints, Database per run, and For the operator, item 1).

**Files each PR may touch.** A builder who needs a file outside its list stops and reports.

- **2-1a:** `src/lib/row-lock.ts` and `src/lib/row-lock.int.test.ts` (new), `src/lib/savepoint.ts` (new), `testing/row-lock.test-utils.ts` (new), `src/forms/application-decision.ts` (`load` calls `lockRow`), `src/lib/review.ts`, `src/lib/review.unit.test.ts`, `src/lib/review-hooks.ts` (`recordDraftSave`, `applyReview`, `notifyReview`), `src/lib/notify.ts` (optional `req`, savepoint), `src/lib/notification-kinds.ts`, `src/lib/notification-preferences.ts`, `src/lib/notification-preferences.unit.test.ts`, `src/lib/owner-moves.ts` and `src/lib/owner-moves.int.test.ts` (new), the bell's glyph map (`src/components/notification-glyphs.tsx`; one glyph), `src/portal/needs/work-refresh.tsx` (one `REFRESHES_WORK` row, P3), `src/migrations/<ts>_portal_withdrawn_kind.{ts,json}`, `src/migrations/index.ts`, `src/migrations/lib/portal-phase-2.int.test.ts` (new), `messages/{en,ar}.json` (the `withdrawn` kind name and its preference label, under the keys the bell and Settings already read: P22), `testing/portal-lists.fixture.ts` (only an export, if C8a needs a writer), and the Mac runner `~/cilas-verify/verify.sh` (V0, outside the repo).
- **2-1b:** `src/collections/ReviewEvents.ts` (new), `src/payload.config.ts` (register the collection), `src/payload-types.ts` (generated), `src/lib/review-hooks.ts` (one more `afterChange` hook, and `recordDraftSave` sets `context.sentNote`), `src/lib/review-history.ts` (new), `src/lib/review-events.int.test.ts` (new), `src/lib/owner-moves.int.test.ts` (the row assertions), `src/migrations/<ts>_portal_review_events.{ts,json}`, `src/migrations/index.ts`, `src/migrations/lib/portal-phase-2.int.test.ts` (the table cases), `scripts/access-audit.snapshot.json` (regenerated).
- **2-2:** `src/lib/document-href.ts`, `src/lib/document-href.unit.test.ts`, `src/lib/review-mail.ts`, `src/lib/review-mail.int.test.ts` (new), `src/lib/review-hooks.ts` (`notifyReview` only), `src/lib/review-queue.ts` (`getReviewQueue` `href`), `src/lib/invitation.ts` (one `link`), `src/lib/invitation.int.test.ts` (confirm only: it asserts `/admin/collections/users/...`, which stays true), `src/forms/notify-application.ts` (two `link`s), `src/portal/needs/needs.ts` and `src/portal/needs/owner-rows.ts` (localize the row `href` where it is built, P27), `src/portal/lists/list-row.tsx` (localize at render), `src/portal/lists/list-view.unit.test.tsx` and any `src/portal/needs/*.test.*` that reads an `href` this PR changes (the first step of L1 prints them), `src/components/site-notifications.tsx` (one `href`) and its dom test, `src/portal/needs/latest-list.tsx` and `latest-list.dom.test.tsx` (one `href`), `src/emails/transactional.tsx` (only if P12 fails).
- **2-3:** `src/portal/pending/*` (new: `machine.ts`, `machine.unit.test.ts`, `store.ts`, `store.unit.test.ts`, `pending-provider.tsx`, `pending-provider.dom.test.tsx`, `modal-open.ts`, `modal-open.browser.test.tsx`, `clock.ts`, `undo-ms.ts`, `undo-ms.unit.test.ts`, `pending-ring.tsx`, `pending-ring.module.css`, `pending-ring.browser.test.tsx`, `undo-all-bar.tsx`, `undo-all-bar.dom.test.tsx`, `pending-toast.ts`, `pending-toast.unit.test.ts`, `sign-out.ts`, `pending.module.css`), `src/lib/sign-out.ts` (export the inner `signOut`), `src/env.ts` (`NEXT_PUBLIC_PORTAL_UNDO_MS`), `src/portal/nav/portal-shell.tsx` (mount), `src/portal/nav/account-menu.tsx`, `src/portal/nav/bottom-bar.tsx` (sign-out flush), `src/portal/nav/more-sheet.browser.test.tsx` (a test only; `more-sheet.tsx` is not edited), `src/components/calendar/ui/move-dialog.tsx` (only if the observer misses it, P28), `src/portal/nav/shell.module.css` (the bar's `scroll-padding-block-end`), `messages/{en,ar}.json` (`Portal.pending.*`), `playwright.config.ts` (only in the `env` of `webServer`, and only if V1 shows it is needed), and the Mac runner `~/cilas-verify/verify.sh` (V1, outside the repo).
- **2-4:** `src/lib/review-moves.ts` and `src/lib/review-moves.unit.test.ts` (new), `src/lib/with-transaction.ts` (new), `src/lib/review-endpoint.ts` (new), `src/lib/review-endpoint.int.test.ts` (new), `src/forms/application-decision.ts` (`decide` calls `withTransaction`), `src/collections/Articles.ts`, `src/collections/Courses.ts`, `src/collections/Publications.ts` (`endpoints`, and the course `onApprove`), `testing/payload-rest.test-utils.ts` (JSON body, headers, base URL), `scripts/access-audit.snapshot.json` (only if the audit lists endpoints; P20).
- **2-5:** `src/app/(frontend)/[locale]/(site)/study/[slug]/CourseBody.tsx` (new), `CourseView.tsx`, `course-view-body.browser.test.tsx` and `course-view-body.snap.html` (new), `src/lib/course-language.ts` (shared one-liners, if O0 needs them), `src/portal/review/*` (new: `read-document.ts`, `review-banner.tsx`, `review-history.tsx`, `document-body.tsx`, `reviewed-rows.tsx`, their tests, `review.module.css`), `src/portal/document/*` (new: `document-page.tsx`, `back-link.ts`, `back-link.unit.test.ts`, `owner-actions.ts`, `owner-buttons.ts`, `owner-buttons.unit.test.ts`, `owner-actions-bar.tsx`, `restore-line.tsx`, their tests, `document.module.css`), `src/app/(frontend)/[locale]/(portal)/spaces/articles/[id]/page.tsx` and `courses/[id]/page.tsx` (new), `src/lib/document-href.ts` (owner branch), `src/lib/document-href.unit.test.ts`, `messages/{en,ar}.json` (`Portal.document.*`, `Portal.history.*`, `Portal.banner.*`), `testing/portal-e2e.test-utils.ts` (route-shape rows), `testing/review.fixture.ts` (new), `e2e/portal-document.e2e.test.ts` (new), the tests that assert an owner row link (`e2e/portal-lists.e2e.test.ts:201,210,221`, `src/portal/lists/list-view.unit.test.tsx:230,253`, and any `src/portal/needs/*.test.*` the first step of O4 prints), `e2e/portal-axe-known.json` (only by the axe rule).
- **2-6:** `src/portal/review/*` (add `review-list.tsx`, `review-pane.tsx`, `review-actions.tsx`, `review-diff-view.tsx`, `review-page.tsx`, `review-rows.ts`, `pane-data.ts`, their tests), `src/lib/review-diff.ts` and `review-diff.unit.test.ts` (new), `package.json` and `pnpm-lock.yaml` (add `diff`, Check open source first), `src/app/(frontend)/[locale]/(portal)/spaces/review/page.tsx`, `review/[collection]/[id]/page.tsx` (new), `src/portal/nav/portal-nav.ts`, `portal-nav.unit.test.ts`, `nav-icons.ts`, `nav-counts.tsx`, `src/lib/document-href.ts` (admin branch), `document-href.unit.test.ts`, `src/lib/review-queue.int.test.ts` (`:123` asserts the queue row `href`), `e2e/portal-lists.e2e.test.ts` and `src/portal/lists/list-view.unit.test.tsx` (admin-viewer link assertions, R6), the Home grouped-row file and the `needs` tests that assert an admin `href` (P25 prints them), `scripts/rewrite-notification-links.ts` and `scripts/rewrite-notification-links.int.test.ts` (new), `messages/{en,ar}.json` (`Portal.review.*`, `Portal.nav.review`), `testing/portal-e2e.test-utils.ts` (`NAV_BY_ROLE`, route shapes), `testing/review.fixture.ts`, `e2e/portal-review.e2e.test.ts` (new), `e2e/portal-shell.e2e.test.ts` (To review rows), `e2e/portal-axe-known.json` (only by the axe rule).

## Shared files

Phase 1c (1c-2 Inbox and counts, 1c-3 Home) and phase 1d (1d-3 Calendar tab, in build at `574c0508`) change the same shell files. No phase 2 PR starts building before phase 1c is on `main` (spec, Phase 2 "Depends on: phase 1c, M1, M3"; operator rule). 1d-3 is a separate phase, so its shell files stay a soft link. Each phase 2 edit is the smallest change. **Conflict rule:** rebase on `origin/main` before each PR opens and before it merges; on a conflict in a file below, keep the other phase's lines and re-apply only the phase 2 lines named here; re-run the premise of that file.

| File                                                                          | Who else changes it                                 | What phase 2 changes (smallest edit)                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/portal/nav/portal-nav.ts`                                                | 1c-2 (`INBOX`, no `count`), 1d-3 (`CALENDAR`)       | 2-6: one const `REVIEW` (`key: 'review'`, `labelKey: 'nav.review'`, `group: 'admin'`, `href: '/spaces/review'`, `icon: 'review'`), inserted in `ITEMS_BY_VIEW.admin` before `OPEN_DASHBOARD`; `'review'` joins the `key` and `PortalNavIcon` unions. No `count` field (P1)                                                                |
| `src/portal/nav/nav-counts.tsx`                                               | 1c-2 (new file)                                     | 2-6: one `COUNT_OF` row `review: (counts) => counts.by.reviewQueue ?? null` (P1, P2)                                                                                                                                                                                                                                                      |
| `src/portal/nav/nav-icons.ts`                                                 | 1c-2, 1d-3 (one icon each)                          | 2-6: one `review` icon (lucide `file-search`, the glyph of the `submitted` kind)                                                                                                                                                                                                                                                          |
| `src/portal/nav/portal-shell.tsx`                                             | 1c-2 (counts provider)                              | 2-3: wrap the shell's children in `<PendingProvider>` inside `FoldProvider`, and render `<UndoAllBar />` after `<main>`. No other line                                                                                                                                                                                                    |
| `src/portal/nav/account-menu.tsx`, `bottom-bar.tsx`                           | 1c-2 (`bottom-bar.tsx` counts), 1c-3 (none planned) | 2-3: `useSignOut()` becomes `usePortalSignOut()` (one import and one call per file). `more-sheet.tsx` gets `onSignOut` from `bottom-bar.tsx` and needs no edit (it has no `useSignOut`); the modal state comes from `modal-open.ts` (Deviation 6)                                                                                         |
| `src/portal/nav/shell.module.css`                                             | 1c-2 (count chip)                                   | 2-3: one rule, `--pending-bar-block-size` added to the existing `scroll-padding-block-end` sum                                                                                                                                                                                                                                            |
| `src/portal/needs/latest-list.tsx`                                            | 1c-2 (new file)                                     | 2-2: `const href = localizedLink(note.link, locale)`, used by both anchors (`ReadLink` gets `href` as a prop and needs no edit)                                                                                                                                                                                                           |
| `src/components/site-notifications.tsx`                                       | 1c-2 (glyph map moves out)                          | 2-2: `href: n.link ? localizedLink(n.link, locale) : undefined` in `toItem` (one line)                                                                                                                                                                                                                                                    |
| Live refresh kinds (1c-2 task I5, file per P3)                                | 1c-2                                                | 2-1a: add `withdrawn: true` to `REFRESHES_WORK` (P3)                                                                                                                                                                                                                                                                                      |
| `src/portal/needs/needs.ts`, `owner-rows.ts`, `src/portal/lists/list-row.tsx` | 1c-2, 1c-3 (callers of `needs`)                     | 2-2: drop the `locale` argument of `documentHref` (Deviation 3) and wrap the result in `localizedLink(path, locale)` where the row `href` is built (`needs.ts`, `owner-rows.ts`) or rendered (`list-row.tsx:87`). `need-list.tsx` renders `row.href` and needs no edit (P27)                                                              |
| `src/lib/review-queue.ts`                                                     | none open                                           | 2-2: `getReviewQueue` `href` from `documentHref` (one line)                                                                                                                                                                                                                                                                               |
| `messages/{en,ar}.json`                                                       | 1c-2, 1c-3, 1d-3                                    | New keys only, under `Portal.pending`, `Portal.review`, `Portal.document`, `Portal.history`, `Portal.banner`, `Portal.nav.review`, and the `withdrawn` kind name. Add each namespace as one block at one fixed spot (the end of `Portal`, in alphabetical order of namespace), so two PRs that rebase do not both insert at the same line |
| `testing/portal-e2e.test-utils.ts`                                            | 1c-2, 1d-3                                          | 2-5, 2-6: route-shape rows and one `NAV_BY_ROLE` row for `review` (admin), by the 1d premise P4/P5 pattern (P13)                                                                                                                                                                                                                          |
| `e2e/portal-shell.e2e.test.ts`                                                | 1c-2, 1c-3, 1d-3                                    | 2-6: one `describe('To review item')` block; no edit to other blocks                                                                                                                                                                                                                                                                      |
| `e2e/portal-axe-known.json`                                                   | every screen PR                                     | Only by the axe rule (Global Constraints)                                                                                                                                                                                                                                                                                                 |
| `src/collections/Articles.ts`, `Courses.ts`, `Publications.ts`                | none open                                           | 2-4: `endpoints` entry and the course `onApprove`; 2-1a and 2-1b add nothing to them (the review hooks come through `reviewHooks`)                                                                                                                                                                                                        |
| `src/payload.config.ts`, `src/migrations/index.ts`                            | none open                                           | 2-1b registers `ReviewEvents`; 2-1a adds the M3 migration entry and 2-1b the M1 entry                                                                                                                                                                                                                                                     |

## Premises to re-check before build

Each premise names what this plan assumes, the SHA where it was read, the PR that uses it, and the exact check. The builder runs the check as the first step of the PR that uses it and writes the output in the PR body. A failed check uses the fallback written beside it, never a new design.

- **P1. 1c-2 shape of the nav.** Phase 1c is on `main` before any phase 2 build starts. At `94a51605` (the 1c-2 branch tip when this plan was fixed): `PortalNavItem` has no `count`; counts come from `COUNT_OF` in `src/portal/nav/nav-counts.tsx`; `PortalShell` takes `counts`. Used by 2-3 (shell files) and 2-6 R1.
  - Check: `git grep -n "export const COUNT_OF" origin/main -- src/portal/nav/nav-counts.tsx`. Prints a line: go. Prints nothing: the phase 1c rule was broken, so stop and report. When `git grep -n "count: number | null" origin/main -- src/portal/nav/portal-nav.ts` prints a line, 2-6 R1 also adds `count: null` to `REVIEW`.
- **P2. The review count key.** On `main` at `9abfbe67`, `NeedsCounts` is `{ total; by: Partial<Record<NeedSource, number | null>> }` and `countsOf` fills `by.reviewQueue` (`src/portal/needs/needs.ts:62`, `:83`). Used by 2-6 R1.
  - Check: `git grep -n "'reviewQueue'" origin/main -- src/portal/needs/needs.ts` prints the `case` and the loop line.
- **P3. Live refresh kinds.** 1c-2 types the live refresh as `REFRESHES_WORK: Record<NotificationKind, boolean>` (`src/portal/needs/work-refresh.tsx:14` at `94a51605`), so a new kind does not compile until it has a row. The spec lists `withdrawn` among the kinds that refresh the shell (Tasks, Data). Used by 2-1a C3.
  - Check: `git grep -n "REFRESHES_WORK" origin/main -- src/portal`. Prints the record: C3 adds `withdrawn: true`. Prints nothing: phase 1c is not on `main`, so stop and report.
- **P4. The lock runs inside the operation's transaction.** In Payload 3.91.0, `updateByID` starts the transaction (`updateByID.js:24`), then runs `beforeOperation` (`:61`), then reads the document (`:132`); `restoreVersion` does the same (`restoreVersion.js:26`, `:30`) and reads the version through `db.findVersions` (`:42`) before it reads the main row (`:101`), so a lock on the version's `parent` taken in `beforeOperation` is first. A bulk `update` (no `id`) runs `beforeOperation` once, then reads every matched row with `db.find` (`update.js:178`) and only then runs the per-document hooks (`processDocument`, `:320`), so a per-document `lockRow` would come after the read: stale for those rows. So a `lockRow` call in `recordDraftSave` holds the lock before the hooks read `originalDoc` for `update` with an `id` and for `restoreVersion`, and not for a bulk `update`. Used by 2-1a C1 (Deviation 1).
  - Check: `grep -n "initTransaction\|buildBeforeOperation\|getLatestCollectionVersion" /home/salah/cilas/node_modules/payload/dist/collections/operations/updateByID.js` prints the three in that order. The The C1 int test "a draft save on a live article waits for the row lock" proves it at run time.
- **P5. The transaction session.** `load` in `src/forms/application-decision.ts:59-70` reads `payload.db.sessions[String(req.transactionID)].db` and runs `select … for update` through it. Used by 2-1a C1.
  - Check: `git grep -n "for update" origin/main -- src/forms/application-decision.ts` prints one line.
- **P6. Approve publishes the draft copy's fields.** Payload's update reads the latest version as `originalDoc` when drafts are on (`updateByID.js:132`, `getLatestCollectionVersion`), and a partial `data` merges onto it. So the endpoint's approve, which sends only `review`, `tier` and `cycle`, publishes the copy's fields. Used by 2-4 E2.
  - Check: E6 row `endpoint approves a live edit` asserts that a public read returns the copy's title after the commit. If it fails, E2 first reads the latest version with `req` and sends its reviewed fields (`REVIEWED_FIELDS[collection]`) in `data`, and Deviation 9 says so.
- **P7. The enum migration adds a value.** The appended `withdrawn` kind must produce `ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'withdrawn';` in the generated SQL, not a drop and create of the type. Used by 2-1a C3.
  - Check: `grep -n "enum_notifications_kind" src/migrations/<ts>_portal_withdrawn_kind.ts` after `migrate:create`. If the SQL recreates the type, replace `up` with the one `ADD VALUE` line and `down` with a comment that Postgres cannot drop an enum value (down is a no-op), and say so in the PR.
- **P8. `Origin` and the host.** The endpoint accepts an `Origin` that equals `siteOrigin()` (`new URL(env.NEXT_PUBLIC_SERVER_URL).origin`, `src/env.ts:104`) or the origin the request reached the server on (`x-forwarded-proto` and `x-forwarded-host`, else `new URL(req.url).origin`; Deviation 18). A browser sets `Origin` itself, so a cross-site page cannot make it match either value. With only the first rule, an admin who reaches the portal by a host other than the canonical one would get 403 on every decision. Used by 2-4 E2 and every 2-6 e2e and live run.
  - Check (production, read only): read the app's `NEXT_PUBLIC_SERVER_URL` from Dokploy (`application-one`; copy that one value only into the PR body) and run `curl -sI` on each host that reaches the app (`ci-las.org`, `cilas.lkssystems.com`, the Tailscale name). Write which host redirects and which serves. The 2-4 PR body lists the result.
  - Check (Mac): in `playwright.config.ts:23-30` the default base URL is `http://localhost:3000`, and outside CI the config refuses port 3000, so `PLAYWRIGHT_BASE_URL` is required (the runner sets it). `grep -n "NEXT_PUBLIC_SERVER_URL\|PLAYWRIGHT_BASE_URL" ~/cilas-verify/verify.sh`. When the built server's `NEXT_PUBLIC_SERVER_URL` origin differs from the base URL, V0 makes `verify.sh` export `NEXT_PUBLIC_SERVER_URL="$PLAYWRIGHT_BASE_URL"` for the build and the server. The own-origin rule makes the endpoint work either way, but R9 case 13 opens `reviewEmailUrl(...)`, which starts with `NEXT_PUBLIC_SERVER_URL`, so the export stays.
- **P9. `notify` has no `req`.** `notify(payload, recipients, note)` creates each row with `payload.create` and no `req` (`src/lib/notify.ts:58-88`), so in the endpoint's transaction the bell row would commit even when the decision rolls back, and it would not wait for the lock. The spec says every `notify` call in the handler passes the same `req`. Used by 2-1a C3.
  - Plan decision: `notify` takes an optional fourth argument `req?: PayloadRequest` and passes it to `payload.create`. `notifyReview` passes its `req`. Other callers do not change. A failed insert inside a transaction aborts the whole Postgres transaction, and `notify` swallows the error (its documented contract: "a notification must not undo a save"), so the next statement would fail with "current transaction is aborted" and the decision would roll back with a 500. So each insert that has a `req` runs inside `withSavepoint(req, ...)` (`src/lib/savepoint.ts`): a failed row rolls back to its savepoint, `notify` logs it, and the transaction goes on. Evidence that the live event is safe: the notification's own `afterChange` (`publishChange`) sends it with `pg_notify` inside the request's transaction when there is one (`src/lib/realtime/publish.ts:39-52`), and Postgres delivers it on commit, so the bell hears of the row only once the decision is saved. Today, with no `req`, the row and its event commit at once, before the decision. `publish` swallows its own error too, but `select pg_notify(...)` cannot fail for a payload that `MAX_PAYLOAD` caps, so it gets no savepoint. The push (`sendPushForNotification`, `publish.ts:89`) is not awaited and can go before the commit; a rolled-back decision then leaves a push whose link shows the current state (risk accepted). Check: `git grep -n "export const notify = async" origin/main -- src/lib/notify.ts`.
- **P10. `CourseView` is a whole page, not a body.** `CourseView` takes `course: Course` and `sessions: readonly Session[]` (`src/app/(frontend)/[locale]/(site)/study/[slug]/CourseView.tsx:78-91`) and renders a site page: the `page-frame` wrapper (`:444`), a back link, the `<h1>` (`:520`), the apply bar and apply card (`applyUrl`, `:124`, `:447`, `:639`), the share and AI sections, the side card and the related list. The article page also owns its `<h1>` (`article-page.tsx:421`) and its fetches. Inside the portal page (which has a `PageHeader` H1) and a 320 px pane, that gives two H1, an Apply button on a draft, and site padding. The spec asks the views to render through `CourseView`. Plan decision (Deviation 14): 2-5 task O0 moves the contiguous body of `CourseView`'s `<article>` (from the epigraph block to the end of the bibliography section) into `CourseBody`, which `CourseView` renders at the same place, so the public page does not change. The portal renders `CourseBody`. For an article it renders `ResolvedRichTextField` (`src/components/resolved-rich-text-field.tsx`) with `footnotesOf(body)`, as `article-page.tsx:460-490` does for the text. Sessions have no review (ADR 0011), so the page passes the course's sessions from a gated read.
  - Check: `git grep -nE "<h1|page-frame|applyUrl" origin/main -- 'src/app/(frontend)/[locale]/(site)/study/[slug]/CourseView.tsx'` prints the lines named above. Then read how `course-page.tsx` loads the course (its `depth`) and use the same `depth` for the version read. O0's characterization test proves that the public output stays the same.
- **P11. Writes in every locale.** Discard and **Restore them** write the reviewed fields of every locale into the draft copy. The plan assumes `payload.update({ locale: 'all', data })` accepts `{ en, ar }` values for localized fields in Payload 3.91.0. Used by 2-1a C7.
  - Check: C8a case 5 (`discard, then restore them`) passes. If Payload refuses `locale: 'all'` on update, C7 writes one `payload.update` per locale with the same `req` (the spec's Duplicate pattern, Lists), and the PR says so.
- **P12. The review email template takes a URL.** `reviewMail(settings, state, title, note, { noun, url })` (`src/lib/review-mail.ts:89`). Used by 2-2 L3.
  - Check: `git grep -n "export const reviewMail" origin/main -- src/emails/transactional.tsx`. If the template builds its own link, L3 passes the absolute URL through its existing `url` option and changes nothing in the template.
- **P13. e2e route shapes and `NAV_BY_ROLE`.** 1d-3 at `574c0508` adds route-shape rows and a `NAV_BY_ROLE` row in `testing/portal-e2e.test-utils.ts`. Used by 2-5 O6 and 2-6 R1, R9.
  - Check: `git grep -nE "^export const [A-Z_]+_SHAPES|NAV_BY_ROLE" origin/main -- testing/portal-e2e.test-utils.ts`. Add the phase 2 rows to the table that holds page routes (`PAGE_SHAPES` if 1d made it), else to the last `_SHAPES` table that `shapeOf` reads.
- **P14. Pruned versions.** No reviewed collection sets `versions.maxPerDoc` (`rg -n maxPerDoc src/collections` prints nothing), so Payload keeps its default (100) and an old version can be gone. Used by 2-6 R3.
  - Check: the same `rg`. The diff shows "The earlier version is no longer stored." when `findVersionByID` finds nothing.
- **P15. The version id after a write.** Payload saves the version before `afterChange` (`dist/collections/operations/utilities/update.js`, `saveVersion` call before the `afterChange` loop) and passes no version id to the hook. Used by 2-1b C4.
  - Check: `grep -n "saveVersion\|afterChange" /home/salah/cilas/node_modules/payload/dist/collections/operations/utilities/update.js` prints `saveVersion` above the `afterChange` hooks. C8b case 1 (six distinct `version` ids) proves it.
- **P16. Arc parts.** The plan uses Arc `Select` (`src/components/arc/select/select.tsx:12`), `Textarea`, `Alert` (`alert.tsx:29`), `ScrollArea` (`scroll-area.tsx:36`), `ExpandableText` (`expandable-text.tsx:10`), `Badge`, `Button`, `PageHeader`, `EmptyState` and the `ToastStack` API (`toast-stack.tsx:38-60`: `toast({ id, type, title, description, action, duration })`, `update`, `dismiss`). `ToastOptions.title` is a string and there is no content slot; `ToastStackProvider` has a `limit` that drops the oldest toast; the stack sits above `--toast-stack-offset` on `<html>`. `Timeline` (`timeline.tsx`) is not used (Deviation 16). Used by 2-3, 2-5, 2-6.
  - Check: before a task uses a part, read its props interface at the file above. `ExpandableText` takes React nodes but clamps by `lines` (`expandable-text.tsx:10-18`), and the spec asks for 320 px, so the body clamp is own code (UI parts order, row "Body clamp").
- **P17. Payload endpoints on a collection.** A collection takes `endpoints: [{ path: '/:id/review', method: 'post', handler }]` and serves it at `/api/{slug}/{id}/review` (`src/collections/Courses.ts:134` adds `deleteEndpoints('courses', …)` this way; `.agents/skills/payload/reference/ENDPOINTS.md`). Used by 2-4 E2.
  - Check: `git grep -n "endpoints:" origin/main -- src/collections/Courses.ts`.
- **P18. The runner can use a migrated copy.** At the time of writing, `verify.sh` has `--db empty` (memory mac-verify-runner) and no option for a migrated copy. Used by every phase 2 int, e2e and live run after the M3 step of C3.
  - Check (Mac): `grep -n -- "--db" ~/cilas-verify/verify.sh`. V0 adds `--db migrated` when it is missing.
- **P19. `documentHref` callers.** On `main` at `9abfbe67`: `src/lib/review-hooks.ts:286`, `src/portal/needs/needs.ts:127`, `src/portal/needs/owner-rows.ts:64`, `src/portal/lists/list-row.tsx:72`. 1c-2 and 1c-3 may add callers before 2-2 starts. Used by 2-2 L1.
  - Check: `git grep -n "documentHref(" origin/main -- src ':!*.test.*'`. Run it at the start of 2-2 and again before its merge. Every caller that prints gets the L1 edit.
- **P20. The access audit and endpoints.** `pnpm audit:access` rows are per collection, per field and per operation (`scripts/access-audit.snapshot.json`, for example `collection:notifications`). The audit does not cover custom endpoints (`scripts/access-audit.ts:28`). Used by 2-1b C4 and 2-4 E2.
  - Check: `grep -c '"entity": "[^"]*endpoint' scripts/access-audit.snapshot.json` prints 0 (the only `endpoint` in the file is the `"field": "endpoint"` of `push-subscriptions`). So the endpoint adds no audit row, and E2 changes no snapshot. C4 adds the `collection:review-events` rows and one row per field (nine).
- **P21. `space-preferences` holds the locale.** `src/collections/SpacePreferences.ts` has `account` (relationship to `users`) and `locale`. Used by 2-2 L3.
  - Check: `git grep -nE "name: '(account|locale)'" origin/main -- src/collections/SpacePreferences.ts` prints two lines.
- **P22. Kind names in the bell and Settings.** The bell reads `t('kinds.<kind>')` (`src/components/site-notifications.tsx`, `noteText`), and Settings reads the preference labels from messages. Used by 2-1a C3.
  - Check: `git grep -n "kinds\." origin/main -- src/components/site-notifications.tsx` and `git grep -n "PREFERENCE_KINDS" origin/main -- src/components`. Add the `withdrawn` key to each message namespace that the two print.

- **P23. A locale-free `/spaces` link redirects.** next-intl runs with `localePrefix: 'always'` (`src/i18n/routing.ts:11`) through `src/proxy.ts`. The admin bell and push keep locale-free paths (2-2 L4). Used by 2-2 L4 and 2-6.
  - Check (Mac, kept app): `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -b <admin cookie> http://localhost:<port>/spaces/review` prints a 307 to `/en/spaces/review` (or the cookie locale). If it prints 404, the admin bell and the push sender also call `localizedLink` with `routing.defaultLocale`, and the PR says so.
- **P24. No hook writes the same reviewed document with a new `req`.** Under Deviation 1, such a write waits for a lock its own outer transaction holds, and hangs. At `9abfbe67`, `rg -n -U "\.update\(\{[^}]{0,200}collection: '(articles|courses|publications)'" src --glob '!*.test.*'` prints only a migration (`20261018_175500_backfill_publication_versions.ts`) and an MCP tool (`src/plugins/mcp/tools/form.ts:332`), neither a hook. `disableTransaction` appears nowhere in `src`, `scripts`, `seed`, `testing` or `e2e`. Used by 2-1a C1.
  - Check: the same `rg`, plus `rg -n disableTransaction src scripts seed testing e2e`. A new hook hit gets `req` passed in C1.
- **P25. Home's grouped review row.** The spec links Home's grouped `review` rows to `/admin/reviews` before phase 2 (Tasks, "Where the two lists show"). 1c-3 (Home) is on `main` before 2-6 starts. Used by 2-6 R1.
  - Check: `git grep -n "/admin/reviews" origin/main -- src/portal`. Each hit in `src/portal` becomes `/spaces/review` in R1, and R1 lists the files that print (Home's grouped-row file, and the `needs` tests that assert the href). The admin's own links (`src/components/admin/work-views.ts:26`, `review-queue.tsx:54`, `ai-access-guide-content.tsx:39`) stay in the admin (spec, Navigation).
- **P26. Every document has a version row.** `readDocument` and `reviewHistoryFor` gate on a version read. A document imported with no version row (a migration once backfilled publication versions, `20261018_175500_backfill_publication_versions.ts`) would read as not found for its owner. Used by 2-5 O1.
  - Check (Mac, on the run's `cilas_migrated_<sha8>`): `select count(*) from articles a where not exists (select 1 from _articles_v v where v.parent_id = a.id)`, and the same for `courses`. A count above 0: O1 then falls back, for that document only, to the gated main row when the reader is an admin or one of its owners (`ownersOf`, the `REVIEWED` owners field), and the PR lists the count.
- **P27. Row hrefs render through plain `<a>`.** `list-row.tsx:87` renders `<a href={href}>` on `main`. At `94a51605` the Needs rows render `<a href={row.href}>` (`src/portal/needs/need-list.tsx:72`; its grouped link builds `/{locale}/spaces/...` itself) and the Latest rows render `<a href={note.link}>` or `ReadLink` (`latest-list.tsx:73,77`). None uses next-intl `Link`, so a locale-free path from `documentHref` would work only through the proxy redirect (a 307 to the saved or browser locale, which can differ from the page's, and a full document load). Used by 2-2 L1 and L4.
  - Check: `git grep -n "href={" origin/main -- src/portal/lists src/portal/needs ':!*.test.*'`, and read each hit. A plain `<a>` gets a localized href (L1, L4); a next-intl `Link` gets a locale-free one. One place localizes each href, never two.
- **P28. What a modal looks like in the DOM.** Every portal modal is Radix (`@radix-ui/react-dialog`: Arc `Dialog`, `BottomSheet`, `Drawer`, the More sheet) or ui-sdk (the calendar `MoveDialog`). A Radix modal locks body scroll through `react-remove-scroll`, which sets `data-scroll-locked` on the body (`react-remove-scroll-bar` `lockAttribute`). The ui-sdk dialog is modal by default (`@ui-sdk/core/dist/components/dialog/dialog-primitive.js:43`) and sets `aria-modal="true"` on its `role="dialog"` content (`foundation/popups/popup-features.js:121`); a non-modal popup sets neither, so it does not pause an item. `MoveDialog` imports `@ui-sdk/react/dialog` directly, and `src/components/sdk/` holds no dialog wrapper yet. Many files open a modal today (`git grep -lE "showModal|<Dialog|BottomSheet|<Drawer" origin/main -- src/portal src/components`). Used by 2-3 P2.
  - Check: `modal-open.browser.test.tsx` opens each primitive once (Arc `Dialog`, `BottomSheet`, `Drawer`, and the ui-sdk dialog through `MoveDialog` or the `src/components/sdk/` wrapper if one exists) and asserts `isModalOpen()` is true while it is open and false after it closes. A primitive that fails gets an explicit `overlay(open)` call: in its Arc part, or in a new sdk wrapper (`src/components/sdk/`, ADR 0012), or, for `MoveDialog` only, in `src/components/calendar/ui/move-dialog.tsx` after reading the ui-sdk skill (AGENTS.md). The PR says so and the file is added to 2-3's list.
- **P29. The row lock mode.** `_articles_v.parent_id` has a foreign key to `articles.id` (`src/migrations/20261010_121318.ts:1918`), and a foreign key insert takes `FOR KEY SHARE` on the parent row, which `FOR UPDATE` blocks. A holder with `FOR UPDATE` would then block a live draft save through the foreign key alone, and the C1 test would pass with `lockRow` a no-op. `FOR NO KEY UPDATE` conflicts with itself and with `FOR UPDATE`, but not with `FOR KEY SHARE`. Used by 2-1a C1 (Deviation 19).
  - Check: `git grep -n "_articles_v_parent_id_articles_id_fk" origin/main -- src/migrations` prints the foreign key. The C1 test proves the rest at run time: with `lockRow` replaced by a no-op, "a draft save on a live article waits for the row lock" fails.

## Global Constraints

**From the merged plans, still in force** (read these there; they are not copied). From the 1d plan (`docs/superpowers/plans/2026-11-21-portal-phase-1d-calendar-and-account.md`, Global Constraints): **Run location**, **Int runs**, **Execution rules** (Machine balance, Quota, Merge, Hooks), **Perf runs** (the session, the pass line `L`, the control row, BLOCKING or REPORT-ONLY), **Scratch world script**, **Axe on new pages**, **Verification boxes**, **Copy**, **Per-PR order**. From the 1b plan: **Access rules**, **One role table**, **Data access** (every read names `depth`, `select`, `pagination: false` or a `limit`), **Not found for a role**, **Int test setup** (`mockNetwork(resendInbox().handler, ...localServices)`; read by your own ids, never by table counts), **Arabic digits**. From the 1c plan: **Review predicate** (no Critical or High finding stays open), **Mail off (M)**, **Perf gate (G)**, **Prod clone restore (R)**, P17 (the lock).

**Models (operator rule, ledger "Models").** Builders and fixers: Codex gpt-6.2-sol, reasoning effort high (T3 `delegate_task`, provider codex); after two failed checks, the next try goes to Claude Sonnet. Reviewers: the other vendor from the builder. Mac verify runs: Codex gpt-6.2-sol low or Claude Haiku. Every brief starts with the `worker.md` line and says "Use only pstack/poteto skills; never superpowers or caveman."

**New in phase 2.**

- **Where steps run (plan decision).** Server worktrees have no `node_modules`. Every `pnpm exec vitest`, `tsgo`, `pnpm audit:access`, `pnpm payload generate:types` and `migrate:create` step in this plan runs on the Mac, in the run's worktree, or through `verify.sh` (`--tests-only`, `--int-only`, `--e2e-only`). Read-only `git`, `git grep`, `gh` and file edits run anywhere.
- **Database per run (plan decision; ledger "Migrations").** M1 and M3 change the schema, and `push: false` (`src/payload.config.ts:308-312`) means a database without them has no `review_events` table and no `withdrawn` value. The int suite (`vitest.setup.ts` accepts any database at `localhost:5433`), the `verify.sh` server and Playwright all read `DATABASE_URL`, and the Mac's `.env` points at `cilas_dev`. The ledger forbids a migration on `cilas_dev`. So:
  - V0 (2-1a) adds `--db migrated` to `verify.sh`: it drops and makes its own database `cilas_migrated_<sha8>` (`<sha8>` is the first 8 characters of the run's sha, as in the run folder) from a `pg_dump` of `cilas_dev` (not `CREATE DATABASE … TEMPLATE`, which fails while another run is connected to `cilas_dev`), runs `pnpm db:migrate` from the run's worktree with `DATABASE_URL` set to the copy, refuses to run when the name is `cilas_dev` (a guard line before `db:migrate`), and then exports that `DATABASE_URL` for the build, the server, the int suite and Playwright. `process.env` wins over `.env` in all three (`vitest.config.mts:15`, dotenv's no-override default in `playwright.config.ts:3`, Next's env order). The seed guard (`seed/local-database.ts`) does not run in these modes.
  - Every phase 2 int, e2e, live and screen-review run from the M3 step of C3 on uses `--db migrated`. Runs before it (V0, C1, C2 and the C3 unit rows) use the default.
  - Name guards (checked): `vitest.setup.ts` accepts any database at `localhost:5433`; `playwright.config.ts:14-21` checks only a local host and, for the empty specs, the name `cilas_empty`; the seed guard (`seed/local-database.ts`) and `scripts/ttfb-accounts.ts` (`cilas_ttfb` only) do not run in these modes. So `cilas_migrated_<sha8>` passes every guard that runs.
  - The scratch world script (1d Global Constraints) writes to the database of the run's `DATABASE_URL`, which is `cilas_migrated_<sha8>` in these modes (the 1d text names `cilas_dev` because 1d had no other), and prints that name at start.
  - The perf boxes use `cilas_ttfb` (a throwaway restore, Prod clone restore (R)): the session runs `pnpm db:migrate` on it from the head worktree before the head build, and runs the baseline build first, on the unmigrated copy. The new table and value do not slow a read that does not use them.
  - Migration tests live in `src/migrations/lib/`, never beside the migrations: `payload migrate` imports every file in `src/migrations`, and a test file there breaks `pnpm db:migrate` (and the deploy).
  - In-suite proof: `src/migrations/lib/portal-phase-2.int.test.ts` uses `scratchPayload()` (`testing/scratch-database.test-utils.ts`), which makes a new database and runs every migration, then checks the table, the index, the foreign key and the enum value (C3 and C6).
  - After 2-1a merges, every branch that holds it (every phase 1c, 1d and 3 branch after a rebase) needs a migrated database for int and e2e runs. Until the operator migrates `cilas_dev` or says yes to agents doing it, those runs use `--db migrated`. For the operator, item 1.
- **Mail off (M) for every run that decides.** A review decision sends real mail through `notifyReview` when mail is on. Every `verify.sh` e2e or live run of 2-4, 2-5 and 2-6 repeats the 1c P32 server guard at its own head (the server log holds "No email adapter provided", and `--check-off` exits 0), as 1d does. Int tests capture mail with `resendInbox()` (Int test setup).
- **One lock for every write (Deviation 1).** `recordDraftSave` calls `lockRow(req, collection.slug, id)` for every `update` with an id and for every `restoreVersion` (on the version's parent), so every single-document writer (the review endpoint, the owner moves, `/admin`, REST, GraphQL, MCP) waits for the lock before any hook reads the document. An admin bulk `update` is the one writer with no lock (Deviation 1, limit). The lock is `select ... for no key update` (Deviation 19). The endpoint still calls `lockRow` itself first, before its step 1 read (spec, "The review endpoint").
- **Same `req` everywhere.** Every `payload.update`, `findVersions`, `find`, `create` and `notify` call in the endpoint, the `review-events` hook and the owner moves passes the request's `req` (spec; `application-decision.ts:52`). A builder who adds a call without `req` in these files fails review. `notify` with a `req` runs each insert in a savepoint (P9).
- **Mail and bell rows before the commit (risk accepted).** `notifyReview` runs in `afterChange`, inside the transaction, so its email goes before the commit (unlike the applicant handler, which mails after `commitTransaction`, `application-decision.ts:513-530`). The lock makes a second decision wait and then get 409, so one email goes per decision. If a later hook throws after the email, the decision rolls back and the email already went. This plan keeps that risk (it exists for every review write today) and names it in Review Focus.
- **Access rules (AGENTS.md).** `review-events`: `read: isAdmin`, `create: nobody`, `update: nobody`, `delete: nobody`, all from `src/access.ts`, never an inline arrow. The hook writes with `overrideAccess: true`. `pnpm audit:access` regenerates the snapshot in 2-1b, and the diff adds only the `collection:review-events` rows and their field rows. No collection or global operation is left at Payload's default.
- **Gated read or projection (spec, Data access rule).** Pages read documents and versions with `user` and `overrideAccess: false`. `review-events` is read only through `reviewHistoryFor` (projection). `getReviewQueue`, `adminQueue` and `adminReviewRows` read with `overrideAccess: true`, so every portal caller checks `isAdminUser(user)` first.
- **Untangle (AGENTS.md).** One move table (`src/lib/review-moves.ts`), one owner-button table (`src/portal/document/owner-buttons.ts`), one status function (`statusOf`), one link function (`documentHref`). The pane, the owner page, the emails and the bell call them. No status word or link is written in a second place.
- **UI parts order (operator rule, ADR 0012).** See "UI parts order" below. App code never imports `@ui-sdk/*`. Inner scroll regions (the To review list and the pane on a wide screen) use Arc `ScrollArea`.
- **Lazy loading (spec, Lazy loading rule).** The To review list, the pane and the owner page render on the server. The pending provider renders on first render (it owns the `pagehide` and `visibilitychange` listeners). The pending toast is text in the installed `ToastStack`, so nothing loads late (Deviation 15).
- **Skills.** Every task has a **Skills** line. A task that writes HTML, CSS or client JS loads `modern-web-guidance` first. A Payload task loads `payload` (`.agents/skills/payload/SKILL.md`). Every code task loads `tdd`. Load each UI skill only where the task needs it (spec, UI skills).
- **Copy.** New strings go in `messages/{en,ar}.json` under `Portal`, with ICU plurals and `{count, number}` digits, gender-neutral Arabic (D8). The spec's English strings are the source ("Accepting. Email in 5 s", "{n} emails wait", "Paused. Email waits.", "This changed while you reviewed it.", "Not saved.", "Nothing else waits.", "An admin decided this while you withdrew it.", "Your changes were discarded.", "The earlier version is no longer stored.").
- **Per-PR order** (1d's, with phase 2 step 5): 5. `pnpm exec tsgo --noEmit`, `pnpm audit:access`, then `git status --short scripts/access-audit.snapshot.json` prints the snapshot only in 2-1b (and in 2-4 only when P20 fails); in every other PR it prints nothing.
- **Formatting (operator rule).** Never commit or push with `LEFTHOOK=0` or `--no-verify`. In a worktree with no `node_modules`, run `/home/salah/cilas/node_modules/.bin/oxfmt --write <changed files>` before each commit and `oxfmt --check <changed files>` before each push.

## Check open source first

Rule check-open-source-first. Each new module was compared with maintained open-source options (GitHub API, 2026-11-22).

| Need                                   | Candidates                                                                        | Evidence                                                                                                                                                                                                                              | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paragraph diff for D9                  | `diff` (jsdiff, kpdecker/jsdiff); `fast-diff`; `diff-match-patch`; own LCS        | jsdiff: 9,222 stars, 30 contributors, last push 2026-11-18, 28 open issues, BSD-3-Clause, no runtime deps; `diff@8.0.4` is already in the pnpm store as a transitive package. `fast-diff` and `diff-match-patch` diff characters only | **Adopt** `diff` as a direct dependency, pinned exactly at the version `pnpm add diff --save-exact` resolves (8.x). `diffArrays` diffs the paragraph lists. It runs on the server only (the pane is a server component), so it adds no client JavaScript. The spec asks for changed paragraphs, old above new, not a character diff                                                                                                                                                                                    |
| State machine for the pending provider | XState (statelyai/xstate); `@xstate/store`; own reducer                           | XState: 30,531 stars, last push 2026-11-22, MIT. The spec's table has 11 legal transitions and one cause set. The provider renders on every portal page for every role                                                                | **Build** a pure transition function (`transition(item, event, now)`) from the spec table, inside a plain store (`createPendingStore`) that React reads with `useSyncExternalStore`. XState would add its runtime to every portal page, including students' pages, for a table this size, and the spec's perf rule says the provider adds no cost to non-admin pages. The transition function has no React and no timers, and the store takes an injected clock and fetcher, so the unit spec tests them as plain code |
| Row lock                               | Payload (no lock API); drizzle `for update` through the session                   | The repo already locks through the transaction session (`application-decision.ts:59-70`)                                                                                                                                              | **Extract** the existing code into `lockRow` (spec). No library                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Link rewrite script                    | Payload jobs; a migration; a tsx script                                           | The spec forbids deploys running it ("The owner runs it by hand on each database. Deploys never run it.")                                                                                                                             | **Build** a tsx script with a dry run by default (`scripts/rewrite-notification-links.ts`), like the other one-off scripts in `scripts/`                                                                                                                                                                                                                                                                                                                                                                               |
| Countdown ring                         | Arc `Countdown` (wall-clock target), Arc `Gauge` (270 degree value ring), own SVG | `Countdown` counts to a fixed moment and cannot pause; `Gauge` springs to a value and is open at the bottom                                                                                                                           | **Own code**, small (UI parts order)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## UI parts order

Operator rule: installed Arc (`src/components/arc`) -> free Arc registry -> a ui-sdk wrapper in `src/components/sdk/` -> a Radix primitive the repo already uses -> own code. Read each Arc part's props first (P16). The free Arc registry was read on 2026-11-22 (`https://uiarc.dev/r/registry.json`, public JSON, 147 items); its result is in the "Why not" column.

| Part                                          | PR  | Choice                                                                                                                                                                                                                            | Why not the earlier options                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pending ring                                  | 2-3 | Own code: an SVG circle with `stroke-dashoffset` from `remainingMs / UNDO_MS`, a `<button>` around it; under reduced motion, the whole seconds as text, `aria-hidden`, no arc                                                     | Registry: `countdown` is a rolling-digit launch countdown, `gauge` springs to a value, `progress` and `usage-meter` are linear or fill meters, `hold-to-confirm` and `confirm-morph` are confirms. None counts down to an auto-commit with a pause. ui-sdk `progress` and `meter` are linear (`@ui-sdk/react/docs/components/progress.md:109`) |
| Undo all bar                                  | 2-3 | Own `<section aria-label>` with Arc `Button`                                                                                                                                                                                      | Registry: `announcement-bar` is a top banner and `cookie-consent` a consent bar. Neither is a count with one action at the bottom                                                                                                                                                                                                              |
| Pending toast                                 | 2-3 | Arc `ToastStack` (installed, `SiteToasts`): `toast({ id: 'pending:{key}', title, action: { label: 'Undo', onClick }, duration: Infinity })`, then `update` and `dismiss` from the provider. The title is text, fixed at show time | The spec: the portal adds no second host. `ToastOptions` is text only and has no content slot (Deviation 15)                                                                                                                                                                                                                                   |
| To review list and pane (wide)                | 2-6 | CSS grid; each column an Arc `ScrollArea`                                                                                                                                                                                         | Operator rule: inner scrollers use Arc `ScrollArea`                                                                                                                                                                                                                                                                                            |
| List rows                                     | 2-6 | The 1b row layout (`src/portal/lists/list-row.tsx` classes in `lists.module.css`), with a pending state                                                                                                                           | One row look across lists (spec, Design language, List rows)                                                                                                                                                                                                                                                                                   |
| Status banner                                 | 2-5 | Arc `Alert`                                                                                                                                                                                                                       | Installed                                                                                                                                                                                                                                                                                                                                      |
| History                                       | 2-5 | Native `<details>` (the spec names it) holding a plain `<ol>` of rows, oldest first, each with a `<time>`                                                                                                                         | Arc `Timeline` is a client component that shows the newest first, groups by day with sticky labels, needs `now` and a fixed time zone, and reveals its line on scroll, which never runs in a closed `<details>` (Deviation 16). Arc `Accordion` is a group of panels; one disclosure is native HTML                                            |
| Diff                                          | 2-6 | Own server component: per field a `<dl>` row, old value above new, `<del>` and `<ins>` with text labels (not colour only)                                                                                                         | No Arc diff part. Registry: `image-compare` is for images, `json-viewer` is a tree                                                                                                                                                                                                                                                             |
| Body clamp, **Show more**                     | 2-5 | Own CSS (`max-block-size: 320px`, a **Show more** `<button aria-expanded>`)                                                                                                                                                       | P16                                                                                                                                                                                                                                                                                                                                            |
| Selects (**Publish as**, **Cycle**, **Tier**) | 2-6 | Arc `Select`                                                                                                                                                                                                                      | Installed                                                                                                                                                                                                                                                                                                                                      |
| Note field                                    | 2-6 | Arc `Textarea`, error under the field (`aria-invalid`, `aria-describedby`)                                                                                                                                                        | Installed                                                                                                                                                                                                                                                                                                                                      |
| Sticky phone action bar                       | 2-6 | Own CSS (`position: sticky; inset-block-end: 0`) with `scroll-padding-block-end` on the page                                                                                                                                      | Layout, not a component (registry: `page-header` folds on scroll, `announcement-bar` is a top banner)                                                                                                                                                                                                                                          |
| Owner action area and restore line            | 2-5 | Arc `Button` (secondary, quiet, quiet danger levels) and a `role="status"` line                                                                                                                                                   | Installed                                                                                                                                                                                                                                                                                                                                      |
| Empty state ("Nothing waits for review")      | 2-6 | `PortalEmptyState` (`src/portal/feedback/empty-state.tsx`)                                                                                                                                                                        | Installed in phase 1a                                                                                                                                                                                                                                                                                                                          |
| Read-only body (article, course)              | 2-5 | Article: `ResolvedRichTextField`. Course: `CourseBody`, split out of `CourseView` (Deviation 14)                                                                                                                                  | The existing site components; the public page stays the same                                                                                                                                                                                                                                                                                   |

No phase 2 part needs a ui-sdk wrapper or a Radix primitive.

## Deviations from the spec

1. **The lock is in the write path, not only in the endpoint and the owner buttons.** The spec puts `lockRow` in the review endpoint and in the owner's **Withdraw** and **Withdraw changes**. REST, GraphQL and `/api/mcp` stay open (spec, Data access rule), and `AUTHOR_MOVES.submitted` becomes `['draft']`, so an owner can withdraw through REST or `/admin` with no lock, and the endpoint's stale check would read a state that is about to change. `recordDraftSave` (the `beforeOperation` hook every reviewed collection has) calls `lockRow` for every `update` with an id (P4); `restoreVersion` takes the lock too: its `id` is a version id, so the hook reads that version's `parent` (one `db.findVersions` call, `limit: 1`) and locks that row (P4); a missing version skips the lock and Payload answers 404. Every writer except one is then serialized: the owner moves, the review endpoint, REST, GraphQL, MCP, `/admin` single saves and `restoreVersion` all wait. **Limit:** an admin bulk `update` (no `id`, for example the `/admin` list view's bulk edit) takes no lock, because Payload reads the matched rows before any per-document hook runs, so a lock there would follow the read (P4). Non-admins cannot bulk update (`recordDraftSave` refuses it). The owner moves need no lock code of their own. The endpoint keeps its own `lockRow` call ahead of its step 1 read. Plan decision; AGENTS.md "a call order callers must know: make the API enforce it".
2. **`lockRow` takes a collection slug, not a table name.** `lockRow(req, collection, id)` resolves the table through the adapter (`payload.db.tableNameMap`), so callers do not know table names. The applicant handler passes `'form-submissions'`. Plan decision.
3. **`documentHref` drops `locale`, and `localizedLink` adds it where the browser needs it.** In 1b every caller passes `locale` and the function ignores it (`src/lib/document-href.ts:9-16`). The spec stores links as locale-free paths and adds the locale at the edge (email, bell). So `documentHref` returns a locale-free path, and one function `localizedLink(path, locale)` in the same file adds `/{locale}` to a path that starts with `/spaces` and leaves `/admin` paths as they are. The email builder, the bell, the Latest list, the list rows and the Needs rows call it. List rows, Needs rows and Latest rows are plain `<a>`, not next-intl `Link` (P27), so each of them localizes the href where it builds or renders it. The `locale` property leaves `DocumentTarget` in 2-2 together with every caller (migrate the callers, then delete the old parameter in one wave). A branch of another phase that adds a call with `locale` stops compiling when it rebases; L1 step 1 tells the orchestrator, who relays it, and every PR rebases on `origin/main` before it merges. An optional `locale?` kept for a while was rejected: it is a parameter for a case that never varies (AGENTS.md "surplus"). Plan decision.
4. **Application links get their own function.** The spec routes the `application` notice through `documentHref`, with the submission id for an admin and the course id for a fellow. One `id` with two meanings is a hidden link. `applicantsHref({ application } | { course })` in `src/lib/document-href.ts` returns `/admin/applicants?application={id}` or `/admin/applicants?course={id}` until phase 3 changes both. Plan decision.
5. **`PendingApi` gets `flush()`.** **Sign out** must send every pending commit and await it, and stop on a failure (spec, Commit on leave). The spec's `PendingApi` has no call for that. `flush(): Promise<{ ok: boolean }>` sends every item that is pending, paused or failed, and resolves when every item that was pending, paused, committing or failed at the call has reached sent, undone (refused) or failed. An item that is already committing counts: its request is in flight and the store keeps its promise (`inflight`), so `flush` awaits it. `ok` is false when one ended failed. `usePortalSignOut()` in `src/portal/pending/sign-out.ts` awaits it, then runs the existing sign-out. The site header keeps `useSignOut()` (it renders outside the portal, with no provider). Plan decision.
6. **The overlay cause comes from the DOM, not from each surface.** The spec has each modal surface call `overlay(true)` and `overlay(false)`. The portal has more modal surfaces than this plan may edit: Arc `Dialog`, `BottomSheet` and `Drawer` are library parts, `calendar/ui/` is ui-sdk code that phase 2 does not touch (AGENTS.md asks for the ui-sdk skill first), and the pending timers keep running across route changes, so an admin can decide on To review, open the Calendar tab and a dialog there, and the item would commit while the page behind the modal is inert and Undo cannot be reached (spec, WCAG 2.2.1). `modal-open.ts` watches `document.body` with one `MutationObserver` and calls `overlay(isModalOpen())` when it changes. `isModalOpen()` is true while an element with `aria-modal="true"` or an open `dialog:modal` exists, or the body has `data-scroll-locked` (P28). One place covers every surface, also a future one. A surface the browser test finds undetected gets an explicit `overlay(open)` call (P28 names where). `PendingApi.overlay` stays as the spec writes it. Plan decision; AGENTS.md "a call order callers must know".
7. **The `pending` unit spec is a set of files.** The spec's `pending` (unit) is `machine.unit.test.ts` (the transition table), `store.unit.test.ts` (the plain store with an injected clock and fetcher: timers, the cause set, overlay, flush, one commit per item) and `pending-provider.dom.test.tsx` (Strict Mode, `pageshow`, the hooks, the modal observer). The `pending` e2e cases (reload, tab switch, **Sign out**, reduced motion, a modal from another route) need a decision surface, so they run in `e2e/portal-review.e2e.test.ts` in 2-6. Plan decision.
8. **The spec's `review-events` int spec is three files.** `src/lib/owner-moves.int.test.ts` (2-1a: withdraw, Discard, **Restore them**), `src/lib/review-events.int.test.ts` (2-1b: history, `reviewHistoryFor`, REST read, and the history rows of the owner moves) and `src/lib/review-endpoint.int.test.ts` (2-4: stale 409, repeat 200, the move table and its 400s, the lock with the owner's withdraw, `Origin`). The per-recipient email case is `src/lib/review-mail.int.test.ts` (2-2). Each PR then ends with its own evidence. Every `describe` starts with `review-events:` so `-g review-events` runs all of them. Plan decision.
9. **(Only if P6 fails.)** The endpoint's approve sends the copy's reviewed fields in `data`. Written here so the PR can cite it.
10. **The end gate is proven in two halves.** Mac runs have mail off (Mail off (M)), so no e2e reads a real email. `reviewEmailUrl(recipient, doc)` in `src/lib/review-mail.ts` is the one builder of the link the email holds. 2-6's int case asserts that the captured email (`resendInbox()`) has `reviewEmailUrl(owner, doc)` as its first `href`, parsed from the HTML, and the e2e opens `reviewEmailUrl(owner, doc)` as the owner and lands on the portal page. Plan decision.
11. **Reviewed fields that no body draws get label and value rows.** A publication has no public component that renders it (Open question 1), and the article and course bodies leave some reviewed fields out (the course body draws no `subtitle`, `cover_image`, `language_note`, `syllabus_tentative`, `applicant_questions` or `meta`; the article body draws no `cover_image`, `credits`, `related_articles` or `meta`). On a first submission there is no diff (D9), so a reviewer would never see those fields. `ReviewedRows` (`src/portal/review/reviewed-rows.tsx`, O2) renders every field of `REVIEWED_FIELDS[collection]` that the page header and the body do not draw, as label and value rows, under the body. A unit test fails when a reviewed field is drawn by nothing (the list is the structure, not a convention). Plan decision.
12. **`doc` and `version` are `numeric`, not `integer`.** The spec's M1 asks for integers. Payload's `number` field always maps to a Postgres `numeric` column (`@payloadcms/drizzle` `dist/schema/traverseFields.js:543-563`), and a hand edit of the migration to `integer` would make the next `migrate:create` emit an `ALTER` back. Ids are whole numbers, and equality, sort and the `(collection, doc)` index work on `numeric`. Plan decision.
13. **The pending contract carries refusals and focus.** Phase 3 reuses the provider, so its interface is the contract. The spec's `PendingView.result` holds the parsed body of a 2xx only, `PendingApi` has no call that removes a finished item, and **Undo all** must focus the first item that came back with no way to find it. Three additions: `result` also holds the parsed body of a 400 or 409 (the review pane reads `field` from it); `dismiss(key)` removes an item in `sent` or `undone` after its caller showed the line (else it leaves after 8 s); `decide` takes an optional `focus: () => void`, which **Undo all** calls for the first item it brought back. Plan decision.
14. **`CourseBody` is split out of `CourseView`.** The spec renders the read-only views through `CourseView`. `CourseView` is a whole site page (P10), so 2-5 O0 moves its contiguous body into `CourseBody`, and `CourseView` renders `CourseBody` at the same place. The public page output stays the same (a characterization test written before the move). The pane and the owner page render `CourseBody`, which leaves out the subtitle, the cover, the cycle and type line, the details card and the price and status; the reviewed fields among them show in `ReviewedRows` (Deviation 11). There is no `embedded` flag: a flag that switches off eight parts of a page is a parameter that only one caller understands (AGENTS.md). The article body uses `ResolvedRichTextField` directly. Plan decision (review r1 code H-4).
15. **The pending toast is text, with no `preloadable` content.** The spec lists the pending-decision toast among the `preloadable` parts. Arc `ToastOptions` is text only (P16), so there is no component to load late, and `ToastStack` is already installed. The title is fixed at show time ("Approving. Email in 5 s"). The row and the ring carry the live count, and a toast that changed every second would be read out every second. Plan decision.
16. **History is a plain list, not Arc `Timeline`.** See the UI parts table. Plan decision.
17. **`documentHref` has no `fellow` viewer.** The spec lists `owner | admin | fellow`. The only `fellow` link is the `application` notice, which Deviation 4 moves to `applicantsHref`. So `viewer` is `'owner' | 'admin'`, and a `fellow` viewer on a reviewed collection is a compile error, not a case. Plan decision.
18. **`Origin` also matches the request's own origin.** The spec says "the site's own origin". Production is reached by redirects from other hosts (memory archive-import-sources), and one fixed value would give 403 on every decision from a host that is not canonical. The endpoint accepts `siteOrigin()` or the origin the request reached the server on. A missing header is still refused (P8). Plan decision.
19. **`lockRow` takes `for no key update`.** The spec extracts the applicant code, which uses `for update`. A foreign key insert (every version row of a reviewed document) takes `for key share` on the parent row, which `for update` blocks, so the lock test could not tell a working `lockRow` from a no-op (P29). `for no key update` serializes writers just as well. Plan decision.
20. **One row-lock helper (merge of #78).** Main already has `src/lib/row-lock.ts` with `lockRow(req, collection, id): Promise<boolean>` (`for update`; false and no lock when the request has no transaction), used by `Courses.ts` and `LockedDocuments.ts`. 2-1a adds no second file. `row-lock.ts` keeps main's contract (false without a transaction; table through `to-snake-case`) and takes the 2-1a rules (5 s `lock_timeout` then a 409, reset after; `for no key update`). `requireRowLock` is `lockRow` plus a 500 when it returns false, for the callers that must not go on unserialized (`recordDraftSave`, the owner moves, `load`). `sessionDb` and `rowIdOf` live in the same file. It supersedes the "No session: throw" line and the "refuses outside a transaction" case of C1. Plan decision.

## Ends when

Phase 2 ends when all of these hold at the head of 2-6 on `main`:

- [ ] `pending`: `machine.unit.test.ts`, `store.unit.test.ts` and `pending-provider.dom.test.tsx` pass, and the `pending` cases of `portal-review` e2e pass (reload, tab switch, **Sign out**, reduced motion, a modal from another route).
- [ ] `review-events`: every `review-events:` describe passes (`row-lock.int.test.ts`, `owner-moves.int.test.ts`, `review-events.int.test.ts`, `review-endpoint.int.test.ts`, `review-mail.int.test.ts`), with the `google-sign-in` base failure as the only failure (Int runs).
- [ ] `portal-review` e2e passes as admin in English and Arabic at 1440 and 390, with the spec's list: approve with cycle and tier, undo, approve again and let the timer end, ask for changes with a note, the history shows, `/spaces/review/users/1` is not found, the toast text and "6 left." in the accessibility event log, focus visible above the sticky bar on a phone.
- [ ] End gate: an owner's email link opens the portal (Deviation 10, R9).
- [ ] The To review rows of `portal-shell` pass (admin only, per role, 1440 and 390).
- [ ] M1 and M3 are on `main`, applied by the deploy, and `portal-phase-2.int.test.ts` passes. Proof: the deploy log of 2-1a shows `portal_withdrawn_kind` and the deploy log of 2-1b shows `portal_review_events` (or a read-only `select name from payload_migrations` on production, through the Tailscale route of memory production-db-route, lists both).
- [ ] The review set ran per spec: ux-auditor and better-interface on To review and the read-only pages, then break-ui, then security-review of the review endpoint, with no Critical or High finding open.

## Review Focus

1. The lock: every write to a reviewed document takes it first (Deviation 1); a test fails when `lockRow` is a no-op (C1, E6).
2. The endpoint's three steps run after the lock, in order; the move table is the only gate in front of `applyReview`, and `tier`, `cycle` and `note` are read only as the table allows.
3. `Origin`: a missing header is refused too.
4. Mail before commit (Global Constraints): one email per decision under the race tests.
5. `review-events` access: `nobody` for writes through every API; reads through `reviewHistoryFor` only for an owner.
6. The pending provider: one `fetch` per item, started inside the `dispatch` call that moves it to `committing` (not in an effect, so `pagehide` needs no render), `keepalive`, body under 64 KB, `flush` awaiting commits already in flight, Strict Mode double mount, bfcache.
7. Focus after a decision, Undo, a refusal and a failure; `aria-busy`; the toast and `announce()` never both say one message.
8. Links: no `/admin` link reaches a non-admin for an article or course after 2-6 (except publications, D16, and `users`).
9. The endpoint ends its transaction on every path: 200, 400, 409 and any error commit or roll back through `withTransaction`, so the row lock never stays held.
10. A modal anywhere in the portal pauses the pending timers (`modal-open.ts`, P28).

## Decision log (structural)

Problems first, then each fix above the problems it solves.

- **Fix: one lock in the write path (Deviation 1).** Solves: (a) the endpoint's stale check reads a state that an unlocked REST write changes a moment later; (b) owner moves would each need their own transaction and lock code; (c) a convention ("call `lockRow` before you write") that every future writer must know.
- **Fix: one move table (`review-moves.ts`) used by the endpoint, and one owner-button table.** Solves: (a) `applyReview` lets an admin make any move, so the endpoint needs its own narrower rule; (b) the pane and the owner page would otherwise each decide which buttons show.
- **Fix: owner moves as one server module in 2-1a (`owner-moves.ts`).** Solves: (a) the spec's withdraw and discard int cases need the moves before any page exists; (b) the page's server actions stay thin (parse, call, `refresh()`).
- **Fix: a pure transition function for the pending state.** Solves: (a) the state table needs a test per legal and illegal event with no timers or React; (b) phase 3 reuses the provider and must add no special case: it calls `decide` with its own `key`, `label` and `request` and reads `result`.
- **Fix: `localizedLink` at the edge (Deviation 3).** Solves: (a) stored links must be locale-free; (b) emails need the recipient's locale; (c) the bell needs the reader's locale; (d) the list, Needs and Latest rows are plain `<a>`, so each one localizes its own href (P27).
- **Fix: shared review views in `src/portal/review/`, built by 2-5.** Solves: the pane (2-6) and the owner page (2-5) show the same banner, history and body.
- **Fix: a plain store for the pending state, a thin React provider.** Solves: (a) a reducer must be pure, so its `fetch` would run after a render, and `pagehide` gives no render; (b) timers and DOM listeners read stale reducer state; (c) `flush` must await requests that are already in flight.
- **Fix: one `withTransaction(req, fn)` that commits on return and rolls back on a throw.** Solves: (a) the endpoint's 400, 409 and repeat 200 would leave the row lock held; (b) the applicant handler and the endpoint each wrote init, commit and kill by hand. A refusal is a thrown `Refusal`.
- **Fix: `CourseBody` split from `CourseView`.** Solves: the read-only pages need the course body without the site page's H1, Apply control, frame and related list; a flag would add eight branches to a 700-line page.
- **Fix: modal state read from the DOM (`modal-open.ts`).** Solves: (a) the plan could wire only the surfaces it may edit; (b) every future modal would need its own call; (c) Arc and ui-sdk parts are not ours to edit for a portal concern.
- **Fix: `withSavepoint` for a `notify` call inside a transaction.** Solves: a swallowed SQL error would otherwise abort the transaction and roll the decision back with a 500.

## Review r1 decisions

Round 1 had two reviews: spec (`/home/salah/cilas-portal-run/phase-2/plan-review-r1-spec.md`: 0 Critical, 2 High, 9 Medium, 7 Low) and code (`/home/salah/cilas-portal-run/phase-2/plan-review-r1-code.md`: 0 Critical, 4 High, 8 Medium, 7 Low). This fixer round fixed all 37 findings. One reviewer fix was replaced by a better one (spec M-9, below), and two fixes went further than the report (code L-5 found that the lock test was invalid, spec M-7 and code M-3 became one rule). No finding was rejected. No further review round runs (ledger: finish mode).

| Finding                                        | Outcome                                                                                                                                                                                       | Where                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| spec H-1 overlay only on the More sheet        | Fixed: modal state read from the DOM; tests per primitive and a cross-route e2e                                                                                                               | Deviation 6, P28, P2, R9 case 15        |
| spec H-2 `flush` and a commit in flight        | Fixed: `flush` awaits `inflight` promises; two store tests and a Sign out test                                                                                                                | Deviation 5, P2, P3                     |
| spec M-1 phase 2 starts before 1c              | Fixed: every PR starts after phase 1c is on `main`                                                                                                                                            | Dependency graph, Shared files, P1, P3  |
| spec M-2 back link has no owner                | Fixed: `?from=` parsed by `backLinkFor`, built in R4                                                                                                                                          | O4, R4, O6 case 9, R9 case 13           |
| spec M-3 file lists miss tests                 | Fixed: files named per PR; each PR's first step greps them                                                                                                                                    | Files each PR may touch, L1, O4, R1, R6 |
| spec M-4 undo window in the runner             | Fixed: V1 (`--undo-ms`), `data-undo-ms`, R9 case 0, kept app at 5 s                                                                                                                           | V1, P4, R9, live box                    |
| spec M-5 2-1 perf box                          | Fixed: the metric is what the cases check; case 4 spies on `findVersions`                                                                                                                     | 2-1a and 2-1b boxes, C8b                |
| spec M-6 perf boxes without a number           | Fixed: base plus 150 ms (2-3), soft p75 800 ms (2-4)                                                                                                                                          | 2-3 and 2-4 boxes                       |
| spec M-7 and code M-3 `Origin` fixed host      | Fixed: `siteOrigin()` or the request's own origin; production read; 403 copy                                                                                                                  | Deviation 18, P8, E2, E6, R5            |
| spec M-8 Arc registry not searched             | Fixed: public `registry.json` read; result per part                                                                                                                                           | UI parts order                          |
| spec M-9 `locale` removal breaks open branches | Fixed another way: the optional `locale?` was rejected (surplus; Migrate callers then delete). Order after phase 1c, the P19 grep at start and before merge, and a notice to the orchestrator | Deviation 3, L1 step 1                  |
| spec L-1 email link not parsed                 | Fixed: first `href` parsed from the HTML                                                                                                                                                      | R8, Deviation 10                        |
| spec L-2 "Paused. Email waits." untested       | Fixed: R5 dom case                                                                                                                                                                            | R5                                      |
| spec L-3 bars stacking                         | Fixed: order and test with three bars                                                                                                                                                         | P4, R4, R9 case 7                       |
| spec L-4 `fellow` viewer                       | Fixed: removed from the type                                                                                                                                                                  | Deviation 17, L1                        |
| spec L-5 migrations proof                      | Fixed: deploy log or read-only query                                                                                                                                                          | Ends when                               |
| spec L-6 History open for an admin             | Fixed: `open={viewer === 'admin'}`                                                                                                                                                            | O4                                      |
| spec L-7 `messages` conflicts                  | Fixed: one block per namespace at one spot                                                                                                                                                    | Shared files                            |
| code H-1 endpoint leaves its transaction open  | Fixed: `withTransaction`, `Refusal`; test that 409, 400 and repeat 200 release the lock                                                                                                       | E2, E6 case 16                          |
| code H-2 fetch after render                    | Fixed: plain store, `fetch` inside `dispatch`                                                                                                                                                 | P2, Review Focus 6                      |
| code H-3 rows are plain `<a>`                  | Fixed: localize where the href is built or rendered; false sentence removed                                                                                                                   | Deviation 3, P27, L1, L4                |
| code H-4 `CourseView` is a page                | Fixed: `CourseBody` split out (task O0, characterization test); article uses `ResolvedRichTextField`                                                                                          | Deviation 14, P10, O0, O2               |
| code M-1 waiters of the whole database         | Fixed: recursive `pg_blocking_pids` chain from the holder's pid                                                                                                                               | C1, E6                                  |
| code M-2 `notify` poisons the transaction      | Fixed: `withSavepoint`; two int cases                                                                                                                                                         | P9, C1, C3                              |
| code M-4 PR 2-1 is not one change              | Fixed: split into 2-1a and 2-1b; 2-2 mail change has its own box label                                                                                                                        | PR table, 2-1a, 2-1b, 2-2 boxes         |
| code M-5 toast does not fit Arc                | Fixed: text toast, no `preloadable`, offset variable, limit test                                                                                                                              | Deviation 15, P4                        |
| code M-6 `Timeline` mismatch                   | Fixed: plain `<ol>` in `<details>`                                                                                                                                                            | Deviation 16, O2                        |
| code M-7 locale read for other callers         | Fixed: `withLocale` used only by `notifyReview`                                                                                                                                               | L3                                      |
| code M-8 Shared files rows wrong               | Fixed: `more-sheet.tsx` not edited; `latest-list.tsx` row; `need-list.tsx` no edit                                                                                                            | Shared files                            |
| code L-1 `transactional.tsx`                   | Fixed                                                                                                                                                                                         | P12, Files                              |
| code L-2 snapshot check                        | Fixed: `"entity"` pattern; field rows named                                                                                                                                                   | P20, C4                                 |
| code L-3 Playwright default port               | Fixed                                                                                                                                                                                         | P8                                      |
| code L-4 date compare                          | Fixed: `Date.parse`                                                                                                                                                                           | E2                                      |
| code L-5 `for update`                          | Fixed, and stronger: `for update` made the C1 test pass for the wrong reason                                                                                                                  | Deviation 19, P29, C1                   |
| code L-6 `latest` shape                        | Fixed: remap in `readDocument`                                                                                                                                                                | O1                                      |
| code L-8 steps need `node_modules`             | Fixed: "Where steps run"                                                                                                                                                                      | Global Constraints                      |

## Open questions (product calls)

Each has a default, so no build waits.

1. **Publication body in the pane.** No public component renders a publication. Default: the pane lists its reviewed fields (`REVIEWED_FIELDS.publications`) as label and value rows (`ReviewedRows`, Deviation 11), and "Open the full publication" opens its admin URL (D16).
2. **Request removal: an undo?** The spec gives **Withdraw** as the undo of **Request removal**, and Request removal commits at once and tells the admins. Default: as the spec says; the button area keeps its width, and **Withdraw** takes the place of **Request removal**.
3. **Tier in the approved email.** D6 asks for the tier in the notification. Default: the bell line names the tier; the email text does not change in phase 2.
4. **Owner page for an admin.** An admin who opens `/spaces/articles/[id]` of another person's article. Default: the page renders read-only with the banner, the history (open) and no owner buttons, and with a back link to To review when it comes from the pane (`?from=review:{collection}:{id}`); `documentHref` never sends an admin there.
5. **Draft owner page actions.** The spec's phase 2 buttons are Withdraw, Withdraw changes, Request removal and Discard. A draft or a returned item shows only **Edit** (admin editor) in phase 2, and **Submit** stays in the admin editor until phases 4e and 5. Default: as written.
6. **Undo window for publications.** Default: the same 5 s pending item as articles and courses.

## For the operator

1. **After 2-1a and 2-1b merge, migrate the Mac's `cilas_dev`, or say yes to agents doing it.** The ledger forbids agents from applying a migration to `cilas_dev`. Until it holds M1 and M3, every Mac run of a branch that contains 2-1a (all phases, after a rebase) must use `verify.sh --db migrated`. The command, on the Mac, in the repo checkout that `verify.sh` builds from (its source path is at the top of `~/cilas-verify/verify.sh`), on an up-to-date `main`: `DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:migrate`. The deploy applies both to production.
2. **Migrations M3 and M1** (`src/migrations/<ts>_portal_withdrawn_kind.ts`, `<ts>_portal_review_events.ts`), made with `pnpm db:migrate:create` through `expect`, applied by agents only to throwaway copies (`cilas_migrated_<sha8>`, `cilas_ttfb`, scratch databases). This bends the "ask before applying" memory rule, as the ledger allows.
3. **The one-off link script** `scripts/rewrite-notification-links.ts` (2-6). The owner runs it by hand on each database after 2-6 deploys: first with no flag (dry run, prints the count per old prefix and ten samples), then with `--apply`. Deploys never run it, and no agent runs it on production.
4. **`verify.sh --db migrated`** is a change to the Mac runner (V0), outside the repo; a backup copy `verify.sh.pre-db-migrated` stays beside it.
5. **`verify.sh --undo-ms N`** (V1, in 2-3) is a second change to the Mac runner. Test runs build with a 1500 ms undo window, and `--keep --no-tests` builds with the production 5000 ms, so a scripted click fits. A backup copy `verify.sh.pre-undo-ms` stays beside it.

## PR 2-1a. Lock and withdraw (`portal/phase-2-lock-withdraw`)

Base `origin/main` after phase 1c merges. No screen. Rebase before open and before merge (Shared files). This PR makes migration M3.

### Task V0: The runner uses a migrated copy

**Skills:** none (Mac shell script, outside the repo).

**Files:** `~/cilas-verify/verify.sh` on the Mac (backup `~/cilas-verify/verify.sh.pre-db-migrated` first, then write a copy and rename it over, as memory mac-verify-runner says).

- [ ] **Step 1: Premises.** Run the P8 (Mac) and P18 checks on the Mac. Write the output in the PR body.
- [ ] **Step 2: Add `--db migrated`.** After the run's worktree exists and before the build: `test "$DB_NAME" != cilas_dev || { echo 'refusing: cilas_dev'; exit 1; }` with `DB_NAME=cilas_migrated_<sha8>` (one name per run, so two runs at once never drop each other's database; the guard keeps its test against `cilas_dev`, and the run drops and removes only its own name); `docker exec cilas-db-1 dropdb -U cilas --if-exists --force "$DB_NAME"` (a kept app may hold connections); `docker exec cilas-db-1 createdb -U cilas "$DB_NAME"`; `docker exec cilas-db-1 pg_dump -U cilas cilas_dev | docker exec -i cilas-db-1 psql -U cilas -q -d "$DB_NAME"`; then in the run worktree `DATABASE_URL=postgres://cilas:dev@localhost:5433/$DB_NAME pnpm db:migrate`; then `export DATABASE_URL=postgres://cilas:dev@localhost:5433/$DB_NAME` for the build, the server, `vitest` and Playwright. The run folder is `runs/<sha>-migrated` (the `--db empty` pattern). When P8 found a port gap, also export `NEXT_PUBLIC_SERVER_URL="$PLAYWRIGHT_BASE_URL"` for the build and the server in every mode. RESULT.md starts with a line `db: cilas_migrated_<sha8>, migrations: <names from payload_migrations>`.
- [ ] **Step 3: Prove it.** After the M3 step of C3 is pushed: `~/cilas-verify/verify.sh --db migrated --no-tests portal/phase-2-lock-withdraw <sha>`. Expected: RESULT.md's first line lists `portal_withdrawn_kind`; `docker exec cilas-db-1 psql -U cilas -d cilas_migrated_<sha8> -c "select unnest(enum_range(null::enum_notifications_kind))"` prints `withdrawn`; the same query on `cilas_dev` does not (`cilas_dev` unchanged).

### Task C1: `lockRow`, `withSavepoint`, and the lock in the write path

**Skills:** tdd, payload.

**Files:** Create `src/lib/row-lock.ts`, `src/lib/savepoint.ts` (its cases run in C3), `src/lib/row-lock.int.test.ts`, `testing/row-lock.test-utils.ts`. Modify `src/forms/application-decision.ts` (`load`), `src/lib/review-hooks.ts` (`recordDraftSave`).

**Interfaces:**

- `sessionDb(req: PayloadRequest)`: exported from `row-lock.ts`. It returns the drizzle handle of the request's transaction, or `null` when there is none (the session lookup of `load`, `application-decision.ts:59-70`, P5). `lockRow` and `withSavepoint` both use it: one lookup, not two copies.
- `lockRow(req: PayloadRequest, collection: CollectionSlug, id: number): Promise<void>` (Deviations 2 and 19). The table comes from `req.payload.db.tableNameMap.get(toSnakeCase(collection))` (`@payloadcms/drizzle` `types.d.ts:340`), then ``db.execute(sql`select id from ${sql.identifier(table)} where id = ${id} for no key update`)``. No session: `throw new APIError('Could not lock the document. Try again.', 500)`. A second call in the same transaction returns at once (Postgres holds the lock already).
- `withSavepoint<T>(req: PayloadRequest, fn: () => Promise<T>): Promise<T>` in `savepoint.ts`. With no transaction on `req` it returns `fn()`. Else it runs `savepoint sp_<n>` (a module counter), `fn()`, and `release savepoint sp_<n>`; when `fn` throws, it runs `rollback to savepoint sp_<n>` and rethrows (P9).
- `load(req, id)` in `application-decision.ts` becomes `await lockRow(req, 'form-submissions', id)` then its `findByID`. No other change to that file (2-4 moves its transaction code to `withTransaction`).
- `recordDraftSave`: in the branch `operation === 'update' && write.id !== undefined`, call `await lockRow(req, collection.slug, Number(write.id))` first, before the `held` check and its `findOne` (P4). In the branch `operation === 'restoreVersion'`, read the version's parent first (`req.payload.db.findVersions({ collection: collection.slug, where: { id: { equals: write.id } }, limit: 1, pagination: false, req })`, `docs[0]?.parent`) and call `lockRow` on it when found; this runs before `recordDraftSave` sets the draft context. Not for `create` (no row yet), and not for a bulk update (refused for non-admins; an admin bulk write has no one row, and Payload reads the matched rows before any per-document hook, so the limit stays; Deviation 1).
- `testing/row-lock.test-utils.ts`: `holdRow(payload, collection, id): Promise<{ pid: number; release(): Promise<void> }>` opens a client from `payload.db.pool`, runs `begin`, `set local lock_timeout = '2s'` (a leaked lock makes the next `holdRow` fail fast, not hang), reads `select pg_backend_pid()`, and runs `select id from <table> where id = $1 for no key update`. `release` runs `commit` and releases the client. `waitForLockWaiters(payload, holderPid, count, timeoutMs = 5000): Promise<void>` polls every 25 ms until `count` backends wait on that holder, directly or in a chain, and throws on timeout. The count is `with recursive chain(pid) as (select ${holderPid}::int union select a.pid from pg_stat_activity a join chain c on c.pid = any(pg_blocking_pids(a.pid))) select count(*) - 1 as waiting from chain`. A backend of another test file that waits on its own lock is not in the chain, so parallel files (Vitest runs files in parallel on one database) cannot satisfy the wait. Postgres queues waiters on one row in arrival order, so "hold, start A, wait for 1 waiter, start B, wait for 2 waiters, release" runs A, then B.

- [ ] **Step 1: Premises, then failing int tests.** Run P29. `src/lib/row-lock.int.test.ts`:
  - `describe('review-events: lockRow')`: "a draft save on a live article waits for the row lock": publish an article (fixture writer), `holdRow` it, start an owner's draft save (`payload.update` as the author, a new title, `draft: true`), `waitForLockWaiters(payload, holder.pid, 1)` resolves, `release()`, the save resolves. A live draft save writes only the versions table, and the version row's foreign key takes `for key share`, which `for no key update` does not block (P29). So without `lockRow` the save never waits and `waitForLockWaiters` times out: the test fails when `lockRow` is a no-op. "a restoreVersion waits for the row lock": publish an article, edit it as a fixture writer so a version exists, `holdRow` the article, start an admin's `payload.restoreVersion` of that version, `waitForLockWaiters(payload, holder.pid, 1)` resolves, `release()`, the restore resolves; it fails when the `restoreVersion` branch of the lock is removed. "lockRow refuses outside a transaction": `createLocalReq({}, payload)` with no transaction; `lockRow` rejects with status 500.
  - **[verify]** `verify.sh --int-only` at the end of the C1 to C3 group (Int runs): FAIL on the first case.
- [ ] **Step 2: Implement.** Extract, call it from `load` and `recordDraftSave`. **[verify]** at the group end: PASS, and every existing int test that calls the applicant decide endpoints still passes (`rg -l "courses/.*/(accept|reject)|/(accept|reject|reopen)'" src testing --glob '*.int.test.ts'`). Commit.

### Task C2: The withdraw and discard moves

**Skills:** tdd, payload.

**Files:** Modify `src/lib/review.ts`, `src/lib/review.unit.test.ts`, `src/lib/review-hooks.ts` (`applyReview`).

**Interfaces:**

- `AUTHOR_MOVES.submitted = ['draft']` (spec, Withdraw).
- `LIVE_AUTHOR_MOVES = { approved: ['submitted'], rejected: ['submitted', 'draft'], changes_requested: ['draft'] }` (spec, Discard my changes).
- `applyReview`: the refusal of an owner's write from `submitted` becomes `if (!trusted && from === 'submitted' && to !== 'draft') throw ...` (same message, same 403). Nothing else in the hook changes: a non-live withdraw is a full save (the draft-save rule still throws on a status change in a draft save of a document that is not live), and `nextRequest` already clears `request` on a move to `draft`.
- [ ] **Step 1: Failing unit rows** in `review.unit.test.ts`: `canMove('submitted', 'draft', false)` is true; `canMove('submitted', 'approved', false)` is false; `canMove('changes_requested', 'draft', false, true)` is true; `canMove('changes_requested', 'draft', false, false)` is false; `canMove('rejected', 'draft', false, true)` is true. `pnpm exec vitest run --project node src/lib/review.unit.test.ts`. FAIL.
- [ ] **Step 2: Implement.** PASS. The hook cases run in C8a. Commit.

### Task C3: The `withdrawn` kind, an actor-first `notifyReview`, and M3

**Skills:** tdd, payload.

**Files:** Modify `src/lib/notification-kinds.ts`, `src/lib/notification-preferences.ts`, `src/lib/notification-preferences.unit.test.ts`, `src/lib/notify.ts`, `src/lib/review-hooks.ts` (`notifyReview`), `src/components/notification-glyphs.tsx` (one glyph; P22), `src/portal/needs/work-refresh.tsx` (P3), `messages/{en,ar}.json` (P22). Create `src/migrations/<ts>_portal_withdrawn_kind.{ts,json}`, `src/migrations/lib/portal-phase-2.int.test.ts`. Modify `src/migrations/index.ts`.

**Interfaces:**

- `NOTIFICATION_KINDS.withdrawn = { name: 'Withdrawn', tone: 'info', icon: 'undo-2', audience: 'admins' }`, appended last (the order is the order of stored values). Add the `undo-2` lucide glyph to the glyph map. `REFRESHES_WORK.withdrawn = true` (P3).
- `PREFERENCE_ORDER`: `'withdrawn'` right after `'submitted'`. Not in `EMAIL_KINDS` (no email).
- `notify(payload, recipients, note, req?: PayloadRequest)`: passes `req` to `payload.create`, and runs each insert that has a `req` inside `withSavepoint(req, ...)` (P9). Other callers do not change.
- `notifyReview`, after its two early returns: `const byAdmin = isAdminUser(req.user)`. When `!byAdmin && before === 'submitted' && state === 'draft'`: the audience is the admins, the kind is `withdrawn`, no email, the line is `WITHDRAWN_NOTES(noun, title, removal)` ("Submission withdrawn: “{title}”", or "Removal request withdrawn: “{title}”"), the link is `documentHref({ collection, id, viewer: 'admin', waiting: false, locale })` (2-2 drops `locale`), the actor is the owner's person; then return. The removal branch (`removal && before === 'submitted' && state === 'draft'`, kind `removed` to the owners) runs only when `byAdmin`. Every `notify` call passes `req`.
- [ ] **Step 1: Failing tests.** Unit rows in `notification-preferences.unit.test.ts`: "withdrawn is an admin preference after submitted" (`PREFERENCE_KINDS` index of `withdrawn` is the index of `submitted` plus 1, audience `admins`); "withdrawn sends no email" (`EMAIL_KINDS` does not hold it). Int cases in `row-lock.int.test.ts`, `describe('review-events: savepoint')`: "a failed row does not abort the transaction" (`initTransaction(req)`, then `notify(payload, [<an id that is no user>], note, req)`: the foreign key on `recipient` fails and `notify` logs it; then `payload.find({ collection: 'users', limit: 1, req })` on the same `req` succeeds; then `commitTransaction(req)`; without the savepoint the `find` fails with "current transaction is aborted"); "a notification row rolls back with the transaction" (`initTransaction`, `notify(..., req)` for a real user, `killTransaction`, and a read with no `req` finds no such row). FAIL. Implement. PASS. The hook cases run in C8a. Commit.
- [ ] **Step 2: Make M3.** On the Mac worktree (memory db-reset-creates-migration): `expect -c 'spawn pnpm db:migrate:create portal_withdrawn_kind; expect { -re {created or renamed} { send "\r"; exp_continue } eof }'`. Run P7 on the generated file. Expected: one `ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'withdrawn';` in `up`. `migrate:create` writes files only; it applies nothing. Commit.
- [ ] **Step 3: In-suite proof.** `src/migrations/lib/portal-phase-2.int.test.ts`, `describe('review-events: migrations')`, with `scratchPayload()` (which runs every migration on a new database): "withdrawn is a value of enum_notifications_kind" (`select unnest(enum_range(null::enum_notifications_kind))::text` holds it). Import nothing that loads the config before `scratchPayload()` (its header comment). 2-1b adds the table cases to this file.
- [ ] **Step 4: Apply to a throwaway copy.** `~/cilas-verify/verify.sh --db migrated --int-only portal/phase-2-lock-withdraw <sha>` (V0). Expected: RESULT.md line 1 lists `portal_withdrawn_kind`; `portal-phase-2.int.test.ts` passes. Never run `pnpm db:migrate` against `cilas_dev`. Commit; add the file to "For the operator" in the PR body.

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

- Every write is `payload.update({ collection, id, user, overrideAccess: false, depth: 0, ... })`, so `applyReview` and the lock (C1) apply. `withdraw`: `data: { review: { status: 'draft' } }`, `draft: false` on a document that is not live (spec: Submit and Withdraw are full saves), and a draft save on a live one (`recordDraftSave` forces it). `requestRemoval`: `data: { review: { status: 'submitted', request: 'removal' } }`. `discard`: run in one transaction (`withTransaction`, a `req` for every call below), `lockRow(req, collection, id)` first, then read the main row and the latest version (`find` and `findVersions`, `locale: 'all'`, `depth: 0`, gated, same `req`), so the version read is the version the discard replaces and no write can land between the read and the write; keep `restoreFrom = latest version id`, then write the live row's `REVIEWED_FIELDS[collection]` with `locale: 'all'` (P11) and `review.status` of `draft` when the copy is at `changes_requested` or `rejected`, else the copy's own status. `restore`: read version `from` with `findVersionByID` (gated); its `parent` must equal `id`, else `{ ok: false, reason: 'refused' }`; write its reviewed fields with `locale: 'all'`, keep the copy's status.
- An `APIError` with status 403 maps to `{ ok: false }`: `reason: 'decided'` when a fresh `statusOf` read of the document says `waitsOn(key) !== 'admin'` and the move was `withdraw` (the lock let an admin decide first; spec, Errors), else `'refused'`. Any other error rethrows.
- [ ] **Step 1:** Implement. Tests run in C8a. Commit.

### Task C8a: The owner-move int cases, reviews, full suite, open PR 2-1a

**Skills:** tdd, payload; then code-review, then security-review.

**Files:** Create `src/lib/owner-moves.int.test.ts`. Uses `testing/portal-lists.fixture.ts` writers and `resendInbox()` (Int test setup).

- [ ] **Step 1: The int cases** (all in `describe('review-events: owner moves')`, each with its own ids; mail captured by `resendInbox()`; none reads `review-events`, which 2-1b adds):
  1. "withdraw a new submission": `ownerMove(withdraw)` on a never-published submitted article. Key `draft`; admins get one `withdrawn` notification each; no email (`resendInbox()` holds none for this test); `getReviewQueue(payload)` does not list it.
  2. "withdraw changes on a live article": key becomes `published_unsent` (or `published` when the copy equals the live row), `request` null, admins get `withdrawn`, no email.
  3. "withdraw a removal request": the owners get no `removed` notification and no email; the admins get `withdrawn`; the article stays live.
  4. "discard from each copy state": for a live article with a copy at `approved`, `draft`, `changes_requested` and `rejected`: `ownerMove(discard)` succeeds, the public read is unchanged, no email, the key is `published`.
  5. "discard, then restore them": the key returns to `published_unsent` with the same field values in both locales (P11), and no email.
  6. "an owner's withdraw is refused once an admin decided": approve first (admin, `payload.update`), then `ownerMove(withdraw)` returns `{ ok: false, reason: 'decided' }`.
  7. "a withdraw through REST by the owner is legal" (`rest('PATCH', 'articles', ...)` as the owner with `{ review: { status: 'draft' } }` returns 200), and "an owner's approve through REST is still refused" (403).
  8. "discard reads after the lock" (the order is forced like rows 12 to 14 of the endpoint cases): `holdRow` the live article, start the author's draft save W (a new title, `draft: true`), `waitForLockWaiters(payload, holder.pid, 1)`, start `ownerMove(discard)` D, `waitForLockWaiters(payload, holder.pid, 2)`, `release()`, await both. W runs first, so D's `restoreFrom` is the version id W wrote (not the id before W), and `ownerMove(restore, from: restoreFrom)` brings back the copy with W's title. It fails when D reads before it takes the lock.
- [ ] **Step 2:** **[verify]** `verify.sh --db migrated --int-only portal/phase-2-lock-withdraw <sha>`. Pass predicate (Int runs): no test of `row-lock`, `owner-moves`, `portal-phase-2`, `review-status`, `notification-preferences` or the applicant files is named as failed in RESULT.md.
- [ ] **Step 3: Reviews.** code-review (spec Withdraw (D3), Status model Discard, Migrations M3 as the issue), then security-review: the lock never runs outside a transaction; `ownerMove` writes as the owner with `overrideAccess: false`; no `notify` call in `review-hooks.ts` lacks `req`; a failed bell row never aborts a decision.
- [ ] **Step 4:** Fix. **[verify]** the full suite with `--db migrated`. Per-PR step 5. Open `feat(portal): one row lock, withdraw and Discard moves (portal phase 2, PR 1a)`. The PR body lists M3 under "For the operator" and says that every Mac run of a branch with this PR needs `--db migrated` until `cilas_dev` is migrated.

**Verification boxes (2-1a).**

- [ ] **unit:** `review.unit.test.ts`, `notification-preferences.unit.test.ts`; int `row-lock.int.test.ts`, `owner-moves.int.test.ts`, `portal-phase-2.int.test.ts` (all on `--db migrated`).
- [ ] **live:** Scenario on the kept app (`verify.sh --db migrated --keep --no-tests`, Mail off (M) server guard first, a scratch world with one admin, one fellow and one submitted article): the fellow withdraws the article through REST (`curl -X PATCH -b <fellow cookie> -H 'Content-Type: application/json' -d '{"review":{"status":"draft"}}' http://localhost:<port>/api/articles/<id>`). Pass: HTTP 200; the admin's bell (`/en/spaces`, `agent-browser`) shows a "Withdrawn" row; `/admin/reviews` no longer lists the article; `docker exec cilas-db-1 psql -U cilas -d cilas_migrated_<sha8> -c "select kind from notifications order by id desc limit 1"` prints `withdrawn`. `agent-browser close`.
- [ ] **perf:** no route. Metric: work added per review write. One `select ... for no key update` per update through `lockRow` (the C1 waits case proves it runs, because it fails when `lockRow` is a no-op), and two statements (`savepoint`, `release`) per bell row inside a transaction (the C1 savepoint cases prove them). No statement counter exists, so the numbers are read from the code. Pass: both C1 cases green. Recorded in the PR.

## PR 2-1b. Review events (`portal/phase-2-review-events`)

Base `origin/main` after 2-1a merges. No screen. Rebase before open and before merge (Shared files). This PR makes migration M1. Every run uses `--db migrated`.

### Task C4: The `review-events` collection and its hook

**Skills:** tdd, payload.

**Files:** Create `src/collections/ReviewEvents.ts`. Modify `src/payload.config.ts` (add it to `collections`), `src/lib/review-hooks.ts` (one more `afterChange` hook, and `recordDraftSave` sets `context.sentNote`), `src/payload-types.ts` (`pnpm payload generate:types`), `scripts/access-audit.snapshot.json` (`pnpm audit:access`).

**Interfaces:**

- `ReviewEvents: CollectionConfig`: `slug: 'review-events'`, `admin: { hidden: true }`, `timestamps: false`, `access: { read: isAdmin, create: nobody, update: nobody, delete: nobody }` (named rules from `src/access.ts`), `indexes: [{ fields: ['collection', 'doc'] }]`. Fields: `collection` (select: `articles`, `courses`, `publications`, required), `doc` (number, required, `index: true`), `version` (number), `from` and `to` (select over `REVIEW_STATES`, required), `request` (select: `changes`, `removal`), `note` (textarea), `actor` (relationship to `users`), `at` (date, required). Payload maps `number` to `numeric` (`@payloadcms/drizzle` `traverseFields.js:543-563`); see Deviation 12.
- `recordReviewEvent(options): CollectionAfterChangeHook`, added to `reviewHooks(...).afterChange` before `notifyReview`, so a failed insert throws before any email goes. It returns early when `before === state` (`previousDoc?.review?.status ?? 'draft'` vs `doc.review?.status ?? 'draft'`) and on an autosave (`reviewContext(req).autosave`). It reads `version` with `req.payload.findVersions({ collection, where: { parent: { equals: doc.id } }, sort: '-updatedAt', limit: 1, depth: 0, req })` (P15). It writes `note` only when `isAdminUser(req.user)` and `notifyOn(before, state) === 'authors'` or the move is the removal outcome (`state === 'draft'` with `request: removal` from `submitted`), taken from the write's `data.review.review_note` (it reads the operation's incoming data through `req.context`, set by `recordDraftSave` as `context.sentNote = write.data?.review?.review_note ?? null`), else `null`. `request` is the stored request of the row that asked (`state === 'submitted' ? doc : previousDoc`), `actor` is `req.user?.id ?? null`, `at` is `new Date().toISOString()`. It writes with `req.payload.create({ collection: 'review-events', data, overrideAccess: true, req })`.
- [ ] **Step 1: Implement and generate.** `pnpm payload generate:types`, `pnpm audit:access`. Expected: `git diff --stat scripts/access-audit.snapshot.json` shows added lines only, and each added row is `collection:review-events` with `read: isAdmin#...` and `create`, `update`, `delete`: `nobody#c75af6b3`, plus one row per field (nine fields). `pnpm exec tsgo --noEmit`: no error. The behaviour tests run in C8b, after C6. Commit.

### Task C5: `reviewHistoryFor`

**Skills:** tdd, payload.

**Files:** Create `src/lib/review-history.ts`.

**Interfaces:**

- `type ReviewHistoryRow = { at: string; from: ReviewState; to: ReviewState; request: ReviewRequest | null; note: string | null; actorName: string | null }`.
- `reviewHistoryFor(payload: Payload, collection: ReviewedCollection, id: number, user: User): Promise<ReviewHistoryRow[]>` (spec, Data access rule): first `payload.findVersions({ collection, where: { parent: { equals: id } }, limit: 1, depth: 0, user, overrideAccess: false })`; no version found: `[]`. Else `payload.find({ collection: 'review-events', where: { and: [{ collection: { equals: collection } }, { doc: { equals: id } }] }, sort: 'at', depth: 0, pagination: false, overrideAccess: true })`, then one `people` read for the actors' names (`users.person` with `depth: 1`, `select: { person: true }`), mapped to rows with no user relation. Oldest first.
- [ ] **Step 1:** Implement. Tests run in C8b. Commit.

### Task C6: Migration M1

**Skills:** payload.

**Files:** `src/migrations/<ts>_portal_review_events.{ts,json}`, `src/migrations/index.ts`, `src/migrations/lib/portal-phase-2.int.test.ts`.

- [ ] **Step 1: Make M1.** Run this step at the end of C4, before C5 starts (commit order: C4 code, then the M1 files). On the Mac worktree (memory db-reset-creates-migration): `expect -c 'spawn pnpm db:migrate:create portal_review_events; expect { -re {created or renamed} { send "\r"; exp_continue } eof }'`. Read the SQL. Expected: `CREATE TABLE "review_events"` with `"doc" numeric NOT NULL`, `"version" numeric`, enum types for `collection`, `from`, `to`, `request`, `"actor_id" integer` with a foreign key `ON DELETE set null`, an index on `("collection", "doc")` and one on `"doc"`, and `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "review_events_id" integer` with its foreign key and index (spec, M1). Every name the SQL uses exists in the new `.json` snapshot. `migrate:create` writes files only; it applies nothing.
- [ ] **Step 2: In-suite proof.** Add to `src/migrations/lib/portal-phase-2.int.test.ts` (`describe('review-events: migrations')`, `scratchPayload()`): "the review_events table exists with its index and foreign key" (query `information_schema.columns` and `pg_indexes` for `review_events`, and `pg_constraint` for `confdeltype = 'n'` on `actor_id`).
- [ ] **Step 3: Apply to a throwaway copy.** `~/cilas-verify/verify.sh --db migrated --int-only portal/phase-2-review-events <sha>` (V0). Expected: RESULT.md line 1 lists both phase 2 migrations; `portal-phase-2.int.test.ts` passes; `docker exec cilas-db-1 psql -U cilas -d cilas_migrated_<sha8> -c '\d review_events'` prints the table. Never run `pnpm db:migrate` against `cilas_dev`. Commit; add the file to "For the operator" in the PR body.

### Task C8b: The `review-events` int cases, reviews, full suite, open PR 2-1b

**Skills:** tdd, payload; then code-review, then security-review.

**Files:** Create `src/lib/review-events.int.test.ts`. Modify `src/lib/owner-moves.int.test.ts` (case 8). Uses `testing/portal-lists.fixture.ts` writers and `resendInbox()` (Int test setup).

- [ ] **Step 1: The int cases** (all in `describe('review-events: history')`, each with its own ids; mail captured by `resendInbox()`):
  1. "six moves give six rows in order": submit, ask for changes with note 1 (admin), submit, ask for changes with note 2, submit, approve. Six rows in order; notes 1 and 2 on rows 2 and 4 and on no other row; six distinct `version` ids, also for two moves in one second (the two admin moves run back to back).
  2. "the owner reads the history; another member reads none": through `reviewHistoryFor`, the owner gets 6 rows; after the approval the item is published and another member gets `[]`.
  3. "a REST read of review-events as a member returns nothing": `rest('GET', 'review-events', { token })` returns no docs (403 or an empty list).
  4. "an autosave and a save that keeps the status write no row, and the hook reads no version": a spy `vi.spyOn(payload, 'findVersions')` counts zero calls from the hook during an autosave, and one call for a real status change.
  5. "submit tells the admins and writes one row with no note" (the owner's move has `note: null`).
  6. "a withdraw writes one row `submitted -> draft` with `note: null`" (new submission), and "a withdrawn removal request writes one row with `request: removal`".
  7. "discard writes one row from `changes_requested` and one from `rejected`, and none from `approved` or `draft`".
  8. (in `owner-moves.int.test.ts`) the row assertions of owner-move cases 1, 3 and 4 that 2-1a left out.
- [ ] **Step 2:** **[verify]** `verify.sh --db migrated --int-only portal/phase-2-review-events <sha>`. Pass predicate (Int runs): no test of `review-events`, `owner-moves`, `portal-phase-2`, `review-status` or `row-lock` is named as failed in RESULT.md.
- [ ] **Step 3: Reviews.** code-review (spec Review history, Migrations M1 as the issue), then security-review: `review-events` writes refused for every user through REST and GraphQL (`rest('POST', 'review-events', ...)` as an admin returns 403); `reviewHistoryFor` returns `[]` to a non-owner member.
- [ ] **Step 4:** Fix. **[verify]** the full suite with `--db migrated`. Per-PR step 5. Open `feat(portal): review events and the history read (portal phase 2, PR 1b)`. The PR body lists M1 under "For the operator".

**Verification boxes (2-1b).**

- [ ] **unit:** none new (the hook and the history read are int-tested). Int `review-events.int.test.ts`, `owner-moves.int.test.ts`, `portal-phase-2.int.test.ts` (all on `--db migrated`).
- [ ] **live:** Scenario on the kept app (`verify.sh --db migrated --keep --no-tests`, Mail off (M) server guard first, a scratch world with one admin, one fellow and one submitted article): the fellow withdraws the article through REST (the 2-1a command). Pass: HTTP 200; `docker exec cilas-db-1 psql -U cilas -d cilas_migrated_<sha8> -c "select \"from\", \"to\", note from review_events where doc = <id>"` prints `submitted | draft |` (null note). `agent-browser close` if a browser ran.
- [ ] **perf:** no route. Metric: work added to an autosave and to a real status change. Case 4 asserts zero `review_events` rows and zero `findVersions` calls from the hook on an autosave, and one `findVersions` and one insert on a real change. Pass: case 4 green. Recorded in the PR.

## PR 2-2. Link plumbing (`portal/phase-2-links`)

Base `origin/main` after 2-1a merges. No screen. No link target changes in this PR: every `documentHref` result stays an admin URL.

### Task L1: `documentHref` shape and `localizedLink`

**Skills:** tdd.

**Files:** Modify `src/lib/document-href.ts`, `src/lib/document-href.unit.test.ts`, and the callers P19 prints (`needs.ts`, `owner-rows.ts`, `list-row.tsx`, `review-hooks.ts`).

**Interfaces:**

```ts
type DocumentTarget = {
  collection: ReviewedCollection | 'users'
  id: number
  viewer: 'owner' | 'admin' // no 'fellow' (Deviation 17)
  waiting: boolean // waitsOn(key) === 'admin'
}
documentHref(target: DocumentTarget): string // a locale-free path (Deviation 3)
applicantsHref(target: { application: number } | { course: number }): string // Deviation 4
localizedLink(path: string, locale: Locale): string // `/{locale}${path}` when path starts with `/spaces`, else path
absoluteLink(path: string, locale: Locale): string // `${NEXT_PUBLIC_SERVER_URL without trailing /}${localizedLink(path, locale)}`
```

- In 2-2: every reviewed target gives `/admin/collections/{collection}/{id}`; `users` gives `/admin/collections/users/{id}`; `applicantsHref` gives today's two admin URLs.
- Where the browser meets a link (P27): `list-row.tsx` renders `<a href={localizedLink(href, locale)}>`; `needs.ts` and `owner-rows.ts` put `localizedLink(documentHref(...), locale)` in the row's `href` (so `need-list.tsx` renders it as it is); `latest-list.tsx` is L4. One place localizes each href.
- [ ] **Step 1: Premises and notice.** Run P19 and P27, and `git grep -nE "admin/(collections|reviews|applicants)" origin/main -- '*.test.*' e2e testing`. Write the output in the PR body: every hit asserts a link this PR keeps the same, because `localizedLink` leaves `/admin` paths as they are. In the builder's report to the orchestrator, say that `documentHref` drops `locale`: the orchestrator relays it to every active phase thread, because a branch that adds a call with `locale` stops compiling when it rebases.
- [ ] **Step 2: Failing unit table** (`pnpm exec vitest run --project node src/lib/document-href.unit.test.ts`): one row per collection (articles, courses, publications, users) x viewer (`owner`, `admin`) x `waiting`, all admin URLs; `applicantsHref` two rows; `localizedLink` keeps `/admin/...`, prefixes `/spaces/...` for `en` and `ar`; `absoluteLink` has no double slash; `// @ts-expect-error` on `viewer: 'fellow'`. FAIL. Implement. Drop `locale` from each `documentHref` call (P19), and keep it where `localizedLink` needs it. `pnpm exec tsgo --noEmit`: no error. PASS. Commit.

### Task L2: Callers that still write their own link

**Skills:** tdd.

**Files:** `src/lib/invitation.ts` (`link:` at `:83`), `src/forms/notify-application.ts` (`:42`, `:64`), `src/lib/review-queue.ts` (`getReviewQueue` `href`, `:147`).

- [ ] **Step 1:** `invitation.ts` uses `documentHref({ collection: 'users', id, viewer: 'admin', waiting: false })`; `notify-application.ts` uses `applicantsHref({ application: doc.id })` and `applicantsHref({ course: course.id })`; `getReviewQueue` uses `documentHref({ collection: row.collection, id: row.id, viewer: 'admin', waiting: true })`. `git grep -n "'/admin/" -- src/lib src/forms | grep -v test | grep -v document-href` prints no notification or email link. Existing tests that assert these links still pass (unit now, int at L5). Commit.

### Task L3: One review email per recipient, in that recipient's locale

**Skills:** tdd, payload.

**Files:** `src/lib/review-mail.ts`, `src/lib/review-hooks.ts` (`notifyReview`).

**Interfaces:**

- `type Recipient = { id: number; email: string }` stays as it is, because `src/forms/notify-application.ts:31,86` and `src/lib/invitation.ts:77` use `adminRecipients` and `ownerRecipients` and need no locale. `type LocalRecipient = Recipient & { locale: Locale }`. `withLocale(req, recipients: Recipient[]): Promise<LocalRecipient[]>` reads each user's `space-preferences` row (`account in ids`, `select: { account: true, locale: true }`, `overrideAccess: true`, `req`; P21) and uses `routing.defaultLocale` when there is no row or no locale. Only `notifyReview` calls it.
- `emailRecipients(req, people, kind)` keeps its filter and its return type.
- `reviewEmailUrl(recipient: LocalRecipient, target: DocumentTarget): string` = `absoluteLink(documentHref(target), recipient.locale)`. The one builder of an email link (Deviation 10).
- The tier line (D6, moved from 2-4): for an article, `NOTES.approved` gives "Your article “{title}” was published for the community" when `doc.tier === 'community'`, and "Your article “{title}” was published on the public site" when `public`. Courses and publications keep today's line.
- `sendReviewEmail(req, recipient, state, title, note, { noun, url })` sends one message `to: recipient.email`. `notifyReview` loops over `await withLocale(req, await emailRecipients(...))`, one `sendReviewEmail` per recipient, each with `reviewEmailUrl(recipient, ...)`. The stored `notifications.link` stays the locale-free `documentHref` path.
- [ ] **Step 1:** Implement. The int case runs in L5. Commit.

### Task L4: The bell adds the reader's locale

**Skills:** tdd, modern-web-guidance (first).

**Files:** `src/components/site-notifications.tsx` (`toItem`), its dom test (`src/components/site-notifications.dom.test.tsx`, create if missing), `src/portal/needs/latest-list.tsx` and its dom test (`latest-list.dom.test.tsx`).

Other readers of `notifications.link` (`git grep -n "\.link\b" origin/main -- src`): the Inbox Latest list (`src/portal/needs/latest-list.tsx`) renders `<a href={note.link}>` and `ReadLink` with the same value: both get `const href = localizedLink(note.link, locale)` (`ReadLink` takes `href` as a prop and needs no edit; P27). The admin bell (`src/components/admin/notification-bell.tsx:82`, `window.location.assign(note.link)`) and the push sender (`src/lib/push/send.ts:22`, `pathOf`) keep the locale-free path: next-intl runs with `localePrefix: 'always'` (`src/i18n/routing.ts:11`, middleware in `src/proxy.ts:8`), so a locale-free `/spaces/...` request redirects to the reader's locale (P23).

- [ ] **Step 1: Failing dom tests:** a stored link `/spaces/review/articles/5` renders as `href="/ar/spaces/review/articles/5"` in the Arabic bell and in the Arabic Latest list (both anchors, the read and the unread one); `/admin/collections/users/3` renders unchanged. FAIL. Change `href: n.link ?? undefined` to `href: n.link ? localizedLink(n.link, locale) : undefined` (`locale` is in scope from `useLocale()`), and give `latest-list.tsx` the one `href` const. PASS. Commit.

### Task L5: Int case, review, full suite, open PR 2-2

**Skills:** tdd, payload; then code-review.

**Files:** Create `src/lib/review-mail.int.test.ts`.

- [ ] **Step 1: Int cases** (`describe('review-events: one email per recipient')`): "a submit with one Arabic and one English admin sends two emails, each to one address, with a link in that admin's locale" (two admins, one `space-preferences` row with `locale: 'ar'`; `resendInbox()` holds two messages, each `to` has one address, and each body holds `reviewEmailUrl(thatAdmin, ...)`; in 2-2 both are admin URLs, so the locale shows only once 2-6 switches the admin branch; the case asserts `reviewEmailUrl` equality, which keeps it true across 2-6); "an approval email holds reviewEmailUrl(owner)" (used by the end gate, Deviation 10); "the approved notification of an article names the tier" (community and public, approved with `payload.update` as an admin); "notify-application and invitation still get plain recipients" (the existing int tests of those two files pass unchanged).
- [ ] **Step 2:** **[verify]** `verify.sh --db migrated --int-only`: no test of `review-mail`, `review-events`, `invitation`, `notify-application` or `review-queue` named as failed.
- [ ] **Step 3:** code-review (spec Document links as the issue). Fix. **[verify]** the full suite. Per-PR step 5. Open `refactor(portal): one link builder and per-recipient review emails (portal phase 2, PR 2)`.

**Verification boxes (2-2).**

- [ ] **unit (links, tasks L1, L2, L4):** `document-href.unit.test.ts`, `site-notifications.dom.test.tsx`, `latest-list.dom.test.tsx`; the existing `list-view.unit.test.tsx` and `needs` tests still pass.
- [ ] **live (mail, task L3):** Scenario on the kept app with mail captured, not sent: run the server with the console email adapter (Mail off (M) server env), submit an article as a fellow in a scratch world with two admins (one with `space-preferences.locale = 'ar'`). Pass: the server log shows two review messages, each with one `to` address; no message lists two addresses. Int `review-mail.int.test.ts`.
- [ ] **perf:** no route. Metric: mail calls per submit = number of admin recipients (was 1). Pass: the int case counts match the recipients. Recorded in the PR.

## PR 2-3. Pending provider (`portal/phase-2-pending`)

Base `origin/main` after phase 1c merges (P1). Shell only; no decision surface yet. Phase 3 reuses this provider with no change (spec `PendingApi`, plus `flush`).

### Task V1: The runner builds the undo window

**Skills:** none (Mac shell script, outside the repo).

**Files:** `~/cilas-verify/verify.sh` on the Mac (backup `~/cilas-verify/verify.sh.pre-undo-ms` first, then write a copy and rename it over).

- [ ] **Step 1: Add `--undo-ms N`.** `NEXT_PUBLIC_*` is inlined at build time, so a Playwright `webServer.env` does nothing against a server that is already built; the build is where the value must be set. Runs that execute tests (the default, `--tests-only`, `--int-only`, `--e2e-only`) export `NEXT_PUBLIC_PORTAL_UNDO_MS=1500` for the build and the server. `--no-tests` runs (the kept app of the live boxes) export nothing, so the window is the production 5 s and a scripted click fits. `--undo-ms N` overrides both. RESULT.md's first lines name the value (`undo-ms: 1500` or `undo-ms: default`).
- [ ] **Step 2: Prove it.** `grep -n "NEXT_PUBLIC_PORTAL_UNDO_MS" ~/cilas-verify/verify.sh` prints the export. 2-6 R9 case 0 reads `data-undo-ms` from the first pending ring and fails loudly when the value is not 1500, so a missing env never shows up as a flaky timer.

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
  | { type: 'refused'; status: 400 | 409; result: unknown } // result: the parsed body, so the caller reads `field` (Deviation 13)
  | { type: 'error'; status?: number }
  | { type: 'retry' }
  | { type: 'dismiss' }
export const startItem = (input: { key: string; label: string; request: PendingRequest }, now: number, undoMs: number, overlayOpen: boolean): PendingItem
export const transition = (item: PendingItem, event: PendingEvent, now: number): PendingItem | 'illegal' | 'gone'
export const remaining = (item: PendingItem, now: number): number
export const sends = (before: PendingItem, after: PendingItem) => before.state !== 'committing' && after.state === 'committing'
```

- One table `TRANSITIONS: Record<PendingState, Partial<Record<PendingEvent['type'], ...>>>` holds the spec's rows and nothing else. `pause` adds the cause and moves `pending` to `paused` (stores `remainingMs`); `resume` removes the cause and moves to `pending` only when the set is empty (sets `runningSince = now`); `dismiss` from `sent` or `undone` returns `'gone'`. Every other pair returns `'illegal'`. `startItem` starts `paused` with `causes: {overlay}` when `overlayOpen`. `decide` on a key that has an item is the store's refusal (it never reaches `transition`).
- [ ] **Step 1: Failing unit table** (`pnpm exec vitest run --project node src/portal/pending/machine.unit.test.ts`, `describe('pending: state machine')`): one row per legal row of the spec table (17 rows, with each `pause` cause); one refusal per illegal pair, among them `undo` from `committing` and from `sent`, `retry` from `pending`, `expire` from `paused`, `ok` from `pending`; "resume with one cause left stays paused"; "remaining after pause and resume is the time that was left, read from now" (start at 0, pause at 2000, resume at 9000, `remaining` at 10000 is `UNDO_MS - 3000`); "expire then flush sends once" (`sends` true only for the first). FAIL. Implement. PASS. Commit.

### Task P2: The store, the modal observer and the provider

**Skills:** tdd, modern-web-guidance (first), better-accessibility.

**Files:** Create `src/portal/pending/store.ts`, `store.unit.test.ts`, `pending-provider.tsx`, `pending-provider.dom.test.tsx`, `modal-open.ts`, `modal-open.browser.test.tsx`, `clock.ts`, `undo-ms.ts`, `undo-ms.unit.test.ts`. Modify `src/env.ts`.

**Interfaces:**

- `PendingApi` as the spec writes it, plus `flush(): Promise<{ ok: boolean }>` (Deviation 5), plus `dismiss(key)` and the optional `focus` on `decide`, with `result` on a refusal too (Deviation 13). `usePending(): PendingApi`, `usePendingItem(key): PendingView | null`. With no provider, `usePending` throws (a portal-only hook) and `usePendingItem` returns `null`. `overlay(open: boolean)` is a counter, as the spec writes it.
- `type Clock = { now(): number; setTimeout(fn, ms): number; clearTimeout(id): void }`; `browserClock` uses `performance.now()`.
- `createPendingStore({ clock, fetcher, undoMs, refresh }): PendingApi & { getSnapshot(): ReadonlyMap<string, PendingItem>; subscribe(listener): () => void; reset(): void; destroy(): void }` in `store.ts`, plain TypeScript with no React. State: `items` (an immutable `Map`, replaced on each change, so `getSnapshot` changes identity only when something changed), `timers: Map<string, number>`, `inflight: Map<string, Promise<void>>`.
  - `dispatch(key, event)` (internal): `transition(before, event, clock.now())`. `'illegal'` returns false. `'gone'` removes the item. Otherwise it stores the new item, re-arms or clears the timer (`clock.setTimeout(() => dispatch(key, { type: 'expire' }), remaining(item, now))`), notifies the subscribers and, when `sends(before, after)`, calls `commit(key)` **in the same call**. A reducer cannot do this: it must be pure and runs after a render, and `pagehide` gives no render (Decision log).
  - `commit(key)`: `fetcher(request.url, { method: 'POST', keepalive: true, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request.body) })`, called synchronously. The promise goes into `inflight`, and ends with `dispatch(key, ...)`: 2xx `ok` with the parsed JSON (`null` when the body is not JSON); 400 or 409 `refused` with the parsed body; any other status or a network error `error`. It calls `refresh()` after a `refused`.
  - `decide(input)` checks the body is under 64 KB (else it throws, a caller bug), refuses a key that has an item (returns false), and starts the item with `startItem` (paused when an overlay is open). A `sent` or `undone` item that no caller dismisses leaves after 8 s (`clock.setTimeout`), so the map never grows.
  - `flush()`: dispatches `flush` to every item in `pending`, `paused` or `failed` (each starts its commit), then awaits `Promise.allSettled` of every `inflight` promise present at that moment, which includes items that were already `committing`. It resolves `{ ok }` with `ok` false when one of those items ended `failed`. It never rejects.
  - `overlay(open)`: a counter. Above 0, every running item gets `pause` with `overlay`; back to 0, `resume` with `overlay`.
  - `reset()` drops every item and timer (used by `pageshow` with `persisted`).
- `modal-open.ts`: `isModalOpen(doc = document): boolean` is true while `doc.querySelector('[aria-modal="true"], dialog:modal')` finds an element or `doc.body.hasAttribute('data-scroll-locked')` (P28). `observeModals(onChange: (open: boolean) => void, doc = document): () => void` runs one `MutationObserver` on `doc.body` (`childList`, `subtree`, `attributes` with the filter `aria-modal`, `open`, `data-scroll-locked`) and calls `onChange` only when the answer changes (Deviation 6).
- `PendingProvider({ clock = browserClock, fetcher = fetch, undoMs = undoMsFromEnv(), children })`: `const [store] = useState(() => createPendingStore({ ..., refresh: () => router.refresh() }))` (`next/navigation`, `use-router.md`). The context holds `store` (stable). `usePendingItem(key)` is `useSyncExternalStore(store.subscribe, () => store.getSnapshot().get(key) ?? null, () => null)`. One effect attaches: `pagehide` and `visibilitychange` to `hidden` call `store.flush()`; `pageshow` with `event.persisted` calls `store.reset()` and `router.refresh()`; `observeModals((open) => store.overlay(open))`; the cleanup waits one task with `setTimeout(..., 0)` before `store.flush()` and does nothing when a remount set a `mounted` ref again (React Strict Mode).
- `undoMsFromEnv()`: `NEXT_PUBLIC_PORTAL_UNDO_MS` parsed as an integer from 500 to 5000, else 5000. `src/env.ts` declares it optional in `client` and `runtimeEnv`. Only test builds set it (1500, V1). Production never sets it, and `undo-ms.unit.test.ts` checks "unset gives 5000" and "6000 gives 5000".
- Focus pause: the pending row (R5), the ring and the toast call `pause(key, 'focus')` on `focusin` and `resume(key, 'focus')` on `focusout`. **Undo** is disabled (`aria-disabled`) while an item is `committing` or `sent`. A refused item is never retried.
- [ ] **Step 1: Failing tests.**
  - `store.unit.test.ts` (`pnpm exec vitest run --project node`, `describe('pending: store')`, fake clock and fetcher, no React): "expire and flush together send one fetch"; "the fetch runs inside the call that expired the timer, with no render between"; "decide, focus, blur: the commit comes after the time that was left"; "a 409 ends in undone with no retry, and calls refresh"; "a modal with two items pending: both pause, and both resume with their time left when it closes"; "a dialog over a sheet: items stay paused until the sheet closes" (`overlay(true)` twice, `overlay(false)` once, still paused); "on ok the view holds result"; "decide on a key with an item returns false"; "an item that starts while an overlay is open starts paused"; "flush waits for a commit that is already in flight" (expire, call `flush` while the fetch is pending: not resolved until the fetch is); "flush resolves ok false when an in-flight commit fails"; "flush resolves ok false when a failed item fails again"; "a sent item leaves after 8 s".
  - `pending-provider.dom.test.tsx` (`--project dom`, `describe('pending: provider')`): "Strict Mode remount does not flush" (render in `<StrictMode>`, no fetch); "pageshow persisted drops items and refreshes"; "visibilitychange to hidden sends the pending item once"; "usePending throws outside a provider and usePendingItem returns null"; "an element with aria-modal pauses an item and removing it resumes it".
  - `modal-open.browser.test.tsx` (`--project browser`): `isModalOpen()` is true while an Arc `Dialog`, `BottomSheet`, `Drawer` and the ui-sdk dialog are open and false after each closes (P28).
  - FAIL. Implement. PASS (**[verify]** for the browser file). Commit.

### Task P3: Mount and Sign out flush

**Skills:** tdd, modern-web-guidance (first), better-accessibility.

**Files:** Create `src/portal/pending/sign-out.ts`. Modify `src/lib/sign-out.ts`, `src/portal/nav/portal-shell.tsx`, `account-menu.tsx`, `bottom-bar.tsx`, `more-sheet.browser.test.tsx`.

**Interfaces:**

- `usePortalSignOut(): () => Promise<void>`: `const { ok } = await pending.flush()`; when `!ok`, it stops (no sign-out; the failed item shows its error with **Try again** and **Undo**, P4) and shows the toast `Portal.pending.signOutStopped` ("A decision was not saved. Sign out stopped."); else it runs the sign-out of `src/lib/sign-out.ts` (export the inner `signOut` for this; `useSignOut` keeps its behaviour for the site header).
- `PortalShell` renders `<PendingProvider>{...}<UndoAllBar /></PendingProvider>` inside `FoldProvider` (Shared files). The provider renders on first render (spec, Lazy loading rule).
- `more-sheet.tsx` is not edited: it gets `onSignOut` from `bottom-bar.tsx`, and the modal observer sees its Radix dialog (P28).
- [ ] **Step 1: Failing tests.** `pending-provider.dom.test.tsx` adds: "Sign out waits for a commit that is in flight, then signs out" (an item expired 100 ms ago, `fetcher` pending; `signOut` is not called until the fetch ends) and "Sign out stops when a commit fails" (no `signOut` call, the toast shows). `more-sheet.browser.test.tsx` adds: "opening the More sheet pauses a pending item" (a provider with a fake clock and one item; open the sheet; the item's view state is `paused`; close; `pending`). FAIL. Implement. PASS. **[verify]** `verify.sh --tests-only portal/phase-2-pending <sha> src/portal/nav` (browser tests). Commit.

### Task P4: Ring, Undo all bar, pending toast

**Skills:** tdd, modern-web-guidance (first), arc, better-accessibility, apple-design (the ring), animate (the ring drain), better-writing then humanizer (copy).

**Files:** Create `src/portal/pending/pending-ring.tsx`, `pending-ring.module.css`, `pending-ring.browser.test.tsx`, `undo-all-bar.tsx`, `undo-all-bar.dom.test.tsx`, `pending-toast.ts`, `pending-toast.unit.test.ts`, `pending.module.css`. Modify `src/portal/pending/pending-provider.tsx` (the toast mirror), `src/portal/nav/shell.module.css`, `messages/{en,ar}.json` (`Portal.pending.*`).

**Interfaces:**

- `PendingRing({ itemKey, label })`: a `<button>` (24x24 min, 44x44 under `(pointer: coarse)`) with an SVG arc whose `stroke-dashoffset` follows `remaining / undoMs` (read each animation frame from the view; no React state per frame), and `data-undo-ms={undoMs}` (the test build's window, read by R9 case 0). First tap on a touch screen: `pause(key, 'tap')`; second: `undo`. A tap elsewhere or Esc away from the item: `resume(key, 'tap')`. Esc on the ring: `undo`. Accessible name: "{label}. Undo. {n} seconds left." and, paused, ending "Timer paused." Under `prefers-reduced-motion: reduce`: no arc; the whole seconds as text, updated each second, `aria-hidden`.
- `UndoAllBar`: renders only with 2 or more items in `pending` or `paused`. `<section aria-label={t('bar.label')}>` ("Pending decisions"), text "{n} emails wait" plus "Emails go when you leave this page or switch app.", **Undo all**. On first show, `announce(t('bar.announce', { n }))` once ("{n} emails wait. Undo all is available."). After **Undo all**, focus moves to the first item that came back: `decide` takes an optional `focus: () => void` with the item (Deviation 13), and the bar calls the `focus` of the first item in decide order that `undoAll` brought back. Stacking from the bottom edge of a phone: the bottom bar, then this bar, then (in 2-6) the sticky action bar. The bar's height sets `--pending-bar-block-size` (the `scroll-padding-block-end` sum) and `--toast-stack-offset` on `<html>`, so toasts sit above it.
- `pending-toast.ts` (pure, no component; Deviation 15): `pendingToast(key, line, onUndo): ToastOptions` is `{ id: 'pending:{key}', type: 'info', title: line, action: { label: 'Undo', onClick: onUndo }, duration: Infinity }`, with `line` fixed at show time ("Approving. Email in 5 s", the window from `undoMs`); `sentToast`, `failedToast(onRetry)` and the 8 s `duration` for finished states. The provider mirrors items to toasts in one effect: a new item in `pending` shows `pendingToast`; `sent` calls `update(id, { title: 'Email sent', type: 'success', action: undefined, duration: 8000 })` (or "Decided" when the commit sent no email); `failed` calls `update` with "Not saved." and **Try again**; `refused` shows the caller's line; `undone` calls `dismiss(id)`. The first pending toast of a session adds "Emails go when you leave this page or switch app." The toast never takes focus and never holds the only path to an action (the pending row and the bar hold them too). `ToastStackProvider` has a `limit` that drops the oldest toast, so an `update` or `dismiss` of a dropped id must do nothing (checked in the test).
- [ ] **Step 1: Failing tests:** `pending-ring.browser.test.tsx`: "reduced motion shows seconds as text and no arc" (`page.emulateMedia({ reducedMotion: 'reduce' })` equivalent in Vitest browser mode); "Esc on the ring undoes"; "first tap pauses, second tap undoes" (touch pointer); "the name ends Timer paused while paused"; "the ring carries data-undo-ms"; RTL: the ring sits at the inline end. `undo-all-bar.dom.test.tsx`: "hidden with one item"; "two items show the bar and announce once"; "Undo all undoes both and focuses the first"; "the bar sets --pending-bar-block-size and --toast-stack-offset". `pending-toast.unit.test.ts`: the toast options for each state, and "the title does not change between ticks". `pending-provider.dom.test.tsx` adds: "three items over the stack limit: the oldest toast leaves, its item still undoes from the row, and updating its id does nothing". FAIL. Implement. PASS (**[verify]** for the browser file). Commit.

### Task P5: Copy

**Skills:** better-writing, then humanizer.

- [ ] **Step 1:** `Portal.pending` keys in English and Arabic: the line per verb ("Approving. Email in {n} s", "Asking for changes. Email in {n} s", "Declining. Email in {n} s", "Removing. Email in {n} s", "Keeping it. Email in {n} s"), "Paused. Email waits.", "Not saved.", "Not saved. Reload the page and sign in again." (a 403, R5), "Try again", "Undo", "Undo all", "{n, plural, one {# email waits} other {# emails wait}}", "Emails go when you leave this page or switch app.", the ring names, "Email sent", "Email failed", "Decided", the sign-out stop line. ICU plurals and gender-neutral Arabic (D8). Commit.

### Task P6: Reviews, full suite, open PR 2-3

**Skills:** code-review, then security-review; better-accessibility.

- [ ] **Step 1:** code-review (spec Pending decisions as the issue: every state row, the cause set, flush triggers, bfcache, `UNDO_MS`). security-review: the provider sends only the `request` its caller gave, same origin, `credentials: 'include'`; no request body logs; the env value cannot exceed 5000 in a production build; the modal observer reads attributes only.
- [ ] **Step 2:** Fix. **[verify]** the full suite (use `--db migrated`; 2-1a is on `main` by then or not, and both work). Per-PR step 5. Open `feat(portal): pending decisions provider and sign-out flush (portal phase 2, PR 3)`.

**Verification boxes (2-3).**

- [ ] **unit:** `machine.unit.test.ts`, `store.unit.test.ts`, `undo-ms.unit.test.ts`, `pending-toast.unit.test.ts`, `pending-provider.dom.test.tsx`, `undo-all-bar.dom.test.tsx`; browser `modal-open.browser.test.tsx`, `pending-ring.browser.test.tsx`, `more-sheet.browser.test.tsx`; e2e `portal-shell` (unchanged rows still pass with the provider mounted).
- [ ] **live:** Scenario on the kept app (`verify.sh --keep --no-tests`) as the fixture student, driven with `agent-browser`: open `/en/spaces`, open and close the More sheet at 390 px, then **Sign out** from the account menu at 1440 px, five times on the base build and five times on the head build. Pass: no console error on either page; sign-out lands on the signed-out page; the median time from the click to the URL change on the head is at most the base median plus 150 ms (with no pending items, `flush()` resolves at once); `/en/spaces` still renders the shell (the provider mounted). The listeners and flush behaviour are proven by `store.unit.test.ts` and `pending-provider.dom.test.tsx`, not by this box. `agent-browser close`.
- [ ] **perf:** Metric 1: the compressed JavaScript the student's `/en/spaces` page downloads. Next.js 16 removed the "First Load JS" column from `next build` (`next/dist/docs/01-app/02-guides/upgrading/version-16.md:1003`), so the probe is the browser: on each production build (Perf runs session), `agent-browser` opens `/en/spaces` as the student with the cache off and evaluates `performance.getEntriesByType('resource').filter((e) => e.initiatorType === 'script').reduce((n, e) => n + e.transferSize, 0)`, three times, median; `main` at the base vs the head. Pass: head minus base at most 4 KB (the provider renders on every portal page; spec Lazy loading rule; the ring loads only where used). Metric 2: TTFB p75 per role on `/en/spaces` by Perf runs (1d Global Constraints), baseline `main` at the base. Pass: head p75 at most `L`. BLOCKING or REPORT-ONLY by the 1d P12 rule.

## PR 2-4. Review endpoint (`portal/phase-2-review-endpoint`)

Base `origin/main` after 2-1a and 2-1b merge. No screen. Every run uses `--db migrated` and Mail off (M).

### Task E1: The move table and the body parser (pure)

**Skills:** tdd.

**Files:** Create `src/lib/review-moves.ts`, `src/lib/review-moves.unit.test.ts`.

**Interfaces:**

```ts
export type ReviewTo = 'approved' | 'changes_requested' | 'rejected' | 'draft'
export type Asked = 'changes' | 'removal' // stored review.request: 'removal', else 'changes' (also for null)
export const MOVES: Record<Asked, Partial<Record<ReviewTo, { note: 'optional' | 'required' }>>> = {
  changes: { approved: { note: 'optional' }, changes_requested: { note: 'required' }, rejected: { note: 'required' } },
  removal: { draft: { note: 'optional' }, rejected: { note: 'required' } },
}
export type ReviewCommit = { to: ReviewTo; note: string | null; tier: 'community' | 'public' | null; cycle: number | null; updatedAt: string }
export const parseCommit = (raw: unknown): { ok: true; commit: ReviewCommit } | { ok: false; field: 'to' | 'note' | 'tier' | 'cycle' | 'updatedAt'; message: string }
export const checkMove = (asked: Asked, commit: ReviewCommit, collection: ReviewedCollection): { ok: true } | { ok: false; field: 'to' | 'note' | 'cycle'; message: string }
```

- `parseCommit` (zod, unknown keys dropped): `to` one of `ReviewTo`; `note` a string trimmed to `null` when empty, at most 4000 characters; `tier` `community`, `public` or absent (`owner` and any other value: `field: 'tier'`); `cycle` a positive integer or absent; `updatedAt` an ISO date string.
- `checkMove`: the move must be in `MOVES[asked]` (else `field: 'to'`); a `required` note must be present (else `field: 'note'`); a course approval needs `cycle` (else `field: 'cycle'`, spec D10). `tier` and `cycle` count only on `approved`; on any other move the endpoint drops them.
- [ ] **Step 1: Failing unit table** (`pnpm exec vitest run --project node src/lib/review-moves.unit.test.ts`, `describe('review-events: move table')`): every legal pair of the spec table gives `ok`; `changes`+`draft`, `changes`+`submitted`, `removal`+`approved`, `removal`+`changes_requested` give `field: 'to'`; empty and whitespace notes on each `required` move give `field: 'note'`; `tier: 'owner'` gives `field: 'tier'`; a course approval with no `cycle` gives `field: 'cycle'`; an article approval with no tier is `ok`. FAIL. Implement. PASS. Commit.

### Task E2: The transaction helper and the endpoint factory

**Skills:** tdd, payload.

**Files:** Create `src/lib/with-transaction.ts`, `src/lib/review-endpoint.ts`. Modify `src/collections/Articles.ts`, `Courses.ts`, `Publications.ts` (`endpoints`), `src/forms/application-decision.ts` (`decide` calls `withTransaction`).

**Interfaces:**

- `withTransaction<T>(req: PayloadRequest, fn: () => Promise<T>): Promise<T>` in `with-transaction.ts`: `const owns = await initTransaction(req)`; `try { const result = await fn(); if (owns) await commitTransaction(req); return result } catch (error) { if (owns) await killTransaction(req); throw error }`. It is the one place that ends the transaction on every path, so no refusal can leave the row lock held. The applicant handler's `decide` (`application-decision.ts:498-504`) wrote the same init, commit and kill by hand; it calls `withTransaction` in this PR and its copy goes (migrate callers, then delete the legacy code in one wave). Its mail after the commit stays where it is.
- `class Refusal extends Error { status: 400 | 409; body: { error: string; field?: string } }` in `review-endpoint.ts`. A refusal is thrown, so `withTransaction` rolls back.
- `reviewEndpoint(collection: ReviewedCollection): Endpoint` = `{ path: '/:id/review', method: 'post', handler }` (P17). `Courses` keeps `deleteEndpoints(...)` and adds it: `endpoints: [...deleteEndpoints('courses', ...), reviewEndpoint('courses')]`.
- Handler, in this order. Steps 1 to 4 run before any transaction:
  1. `isAdminUser(req.user)`, else 403 `{ error: 'Admins only.' }`.
  2. `Origin`: the header must be present and equal `siteOrigin()` (`new URL(env.NEXT_PUBLIC_SERVER_URL).origin`) or `requestOrigin(req)` (the `x-forwarded-proto` and `x-forwarded-host` headers when both exist, else `new URL(req.url).origin`); else 403 `{ error: 'Wrong origin.' }` (Deviation 18, P8). A missing header is refused.
  3. `id` from `req.routeParams.id`, an integer, else 404.
  4. `parseCommit(await req.json())`, else 400 `{ error, field }`.
  5. `const outcome = await withTransaction(req, () => decide(req, collection, id, commit))`, where `decide` runs these steps:
     1. `lockRow(req, collection, id)`; read `main` (`findByID`, `depth: 0`, `user: req.user`, `overrideAccess: false`, `req`; missing: `throw new APIError('Not found.', 404)`) and `latest` (`findVersions({ where: { parent: { equals: id } }, sort: '-updatedAt', limit: 1, depth: 0, user: req.user, overrideAccess: false, req })`).
     2. Spec step 1: the newest `review-events` row of this document (`find`, `sort: '-at'`, `limit: 1`, `overrideAccess: true`, `req`). When its `to` equals `commit.to`, its `actor` is `req.user.id`, and `Date.parse(row.at) > Date.parse(commit.updatedAt)`: return `{ ok: true, repeated: true }`. The transaction commits; it wrote nothing.
     3. Spec step 2: when `Date.parse(latest.updatedAt) > Date.parse(commit.updatedAt)` or `latest.version.review.status !== 'submitted'`: `throw new Refusal(409, { error: 'stale' })`. (Dates are parsed, never compared as strings: `parseCommit` accepts any ISO form.)
     4. `checkMove(asked, commit, collection)` with `asked` from `latest.version.review.request`, else `throw new Refusal(400, { error, field })`. On a course approval, `findByID({ collection: 'cycles', id: commit.cycle, depth: 0, overrideAccess: true, req })` must find it, else `Refusal(400)` with `field: 'cycle'` (the handler's own read; Payload's relationship check is not relied on).
     5. Spec step 3: `payload.update({ collection, id, draft: false, depth: 0, user: req.user, overrideAccess: false, req, data: { review: { status: commit.to, review_note: commit.note }, ...(approve && commit.tier ? { tier: commit.tier } : {}), ...(approve && collection === 'courses' ? { cycle: commit.cycle } : {}) } })`; return `{ ok: true }`. `review_note` is `null` when there is no note, on every move (spec; `submit-for-review.tsx:177`). `draft: false` on every move: `recordDraftSave` turns an admin's `changes_requested` or `rejected` on a live document into a draft save of the copy (`HELD`), an approval publishes (P6), and a removal approved (`draft`) takes the main row off the site, as the admin button does.
  6. Respond 200 with the outcome. A `Refusal` returns its status and body; an `APIError` (a `ValidationError` too) returns its status with `{ error, field }` (the first field path of a `ValidationError`); any other error rethrows (500). Every one of these paths has already committed or rolled back, so the row lock is gone.
- [ ] **Step 1:** Implement and register. `pnpm exec tsgo --noEmit`. The existing applicant int tests still pass (`decide` now uses `withTransaction`). The cases run in E6. Commit.

### Task E3: Course `onApprove` (D10)

**Skills:** tdd, payload.

**Files:** Modify `src/collections/Courses.ts`.

- [ ] **Step 1:** `approveCourse: ReviewOptions['onApprove'] = ({ data, originalDoc }) => { const tier = (data.tier ?? originalDoc?.tier) as string | null | undefined; return { tier: tier && tier !== 'owner' ? tier : 'public' } }`; `courseReview = reviewHooks(courseNoun, { onApprove: approveCourse })`. So an approval from `/admin` also leaves no course at `owner`. The case runs in E6. Commit.

### Task E4: (moved)

The tier line (D6) moved to 2-2 task L3, because it edits `notifyReview`, which 2-2 also edits, and 2-2 and 2-4 build in parallel.

### Task E5: Test helpers

**Skills:** tdd.

**Files:** Modify `testing/payload-rest.test-utils.ts`.

- [ ] **Step 1:** `rest(method, path, { token, body, json, headers, baseUrl })`: `json` sets the body to `JSON.stringify(json)` and `Content-Type: application/json`; `headers` merge after the auth header; `baseUrl` sets the origin of the request URL (so a test can send a request that reached another host). Existing callers do not change. Commit.

### Task E6: The endpoint int cases

**Skills:** tdd, payload.

**Files:** Create `src/lib/review-endpoint.int.test.ts`. Uses `rest()` with `headers: { Origin: siteOrigin() }`, `holdRow` and `waitForLockWaiters` (2-1a), `ownerMove` (2-1a), `resendInbox()`.

**Concurrency (needs a real Postgres transaction, so every case runs on the Mac through `verify.sh --db migrated --int-only`).** Rows 12 to 14 force the order: `const holder = await holdRow(article)`, start request A, `waitForLockWaiters(payload, holder.pid, 1)`, start request B, `waitForLockWaiters(payload, holder.pid, 2)`, `holder.release()`, await both. Postgres queues row-lock waiters in arrival order, so A runs first, and the count follows the chain of blocked backends, so another test file's waits cannot satisfy it. Each of the three fails when `lockRow` is a no-op. A and B still wait, because a full save updates the main row, but both have already read the same stale state, so both write: two `review-events` rows, two emails and no 409. The builder proves this once with a scratch edit (not committed) and writes the failing output in the PR.

- [ ] **Step 1: The cases** (`describe('review-events: the review endpoint')`):
  1. "approve publishes a new article at the tier sent" (`tier: 'public'` on a request for `community`; public read shows it; tier `public`).
  2. "approve a live edit publishes the copy" (P6).
  3. "approving a course with cycle and tier publishes it at that tier" and its fellows get the `fellow` role.
  4. "a course approved at tier owner from /admin is public" (E3, a `payload.update` as an admin).
  5. "ask for changes stores the note; every move sets review_note, null when none".
  6. "each move outside the table gets 400 with field to" (the four pairs of E1).
  7. "a missing required note gets 400 with field note" (three moves).
  8. "tier owner gets 400"; "an unknown cycle gets 400"; "a course approval with no cycle gets 400".
  9. "a member gets 403"; "a foreign Origin gets 403"; "a missing Origin gets 403"; "an Origin that equals the request's own origin is accepted when it differs from NEXT_PUBLIC_SERVER_URL" (`rest(..., { baseUrl, headers: { Origin: baseUrl } })`); "an unknown id gets 404"; "POST /api/users/1/review is not found".
  10. "the owner withdraws, then a commit with the old updatedAt gets 409 and nothing publishes".
  11. "the same commit sent twice returns 200 both times and sends one email".
  12. "two commits with different verdicts at once: one writes, the other gets 409, one email goes" (A approve, B ask for changes).
  13. "owner withdraw and admin approval at once, admin first: the withdraw is refused with reason decided" (A endpoint, B `ownerMove(withdraw)`); the page copy for `decided` is 2-5's.
  14. "owner withdraw and admin approval at once, owner first: the admin gets 409".
  15. "a removal approved takes the article off the site; keep it published needs a note" (`to: 'draft'` then a second document with `to: 'rejected'` and a note).
  16. "a 409, a 400 and a repeat 200 each release the row lock": after each response, `holdRow` (it has a 2 s `lock_timeout`) on the same article returns at once, so the lock did not outlive the transaction (E2 `withTransaction`).
- [ ] **Step 2:** **[verify]** `verify.sh --db migrated --int-only portal/phase-2-review-endpoint <sha>`. Pass predicate (Int runs): no case of `review-endpoint`, `review-moves`, `review-events` or `review-status` is named as failed. Commit.

### Task E7: Reviews, full suite, open PR 2-4

**Skills:** code-review, then security-review.

- [ ] **Step 1:** code-review (spec, The review endpoint, Errors, D6, D10 as the issue). security-review of the endpoint: admin only; `Origin` exact match, missing refused; only the body keys of `parseCommit` reach `payload.update`; `overrideAccess: false` with the admin as `user`; one `req` for every call (lock, reads, update, hooks); 409 and 400 never leak another document; `review_note` length bound; no `tier: 'owner'` path; a GET to the path is not served.
- [ ] **Step 2:** Fix. **[verify]** the full suite (`--db migrated`). Per-PR step 5. Open `feat(portal): review endpoint with move table, lock and stale check (portal phase 2, PR 4)`.

**Verification boxes (2-4).**

- [ ] **unit:** `review-moves.unit.test.ts`; int `review-endpoint.int.test.ts` and the existing applicant int tests.
- [ ] **live:** Scenario on the kept app (`--db migrated --keep --no-tests`, Mail off (M) server guard first; scratch world: one admin, one fellow, one submitted article): as the admin, `curl -s -o /dev/null -w '%{http_code}' -X POST -b <admin cookie> -H "Origin: http://localhost:<port>" -H 'Content-Type: application/json' -d '{"to":"approved","note":null,"tier":"public","updatedAt":"<version updatedAt>"}' http://localhost:<port>/api/articles/<id>/review` twice, then once with `Origin: https://example.com`. Pass: `200`, `200`, `403`; `/en/articles/<slug>` renders for a signed-out reader; one `review_events` row `submitted | approved`; the server log shows one review message.
- [ ] **perf:** no route. Metric: wall time of one commit on the kept app, 20 sequential approves of scratch articles (`curl -w '%{time_total}'`). Soft line (a guess: the spec sets none): p75 at most 800 ms on the Mac. Above it the PR says so and does not block (REPORT-ONLY); a commit runs off the reader's path, after the undo window. Write p50 and p75 in the PR.

## PR 2-5. Owner pages (`portal/phase-2-owner-pages`)

Base `origin/main` after 2-1b and 2-2 merge. Screen: `/spaces/articles/[id]`, `/spaces/courses/[id]`.

### Task O0: Split `CourseBody` out of `CourseView`

**Skills:** tdd, modern-web-guidance (first; the public DOM must stay the same).

**Files:** Create `src/app/(frontend)/[locale]/(site)/study/[slug]/CourseBody.tsx`, `course-view-body.browser.test.tsx`, `course-view-body.snap.html`. Modify `CourseView.tsx`, `src/lib/course-language.ts` (only for shared one-liners).

**Interfaces:**

- `CourseBody({ course: Course; sessions: readonly Session[]; editable?: boolean })`: the run of `CourseView`'s `<article>` from the epigraph block to the end of the bibliography section (epigraph, About, content warning, the fellows with the facilitator's note, the syllabus, the bibliography), returned as a fragment, so its DOM sits where it did. It has no `<h1>`, no apply control, no page frame, no share or AI block and no related list. `CourseView` keeps the back link, the header, the cover, the apply card, the side card, the share and AI sections, `after` and `related`, and renders `<CourseBody course sessions editable />` at the same place (Deviation 14).
- The values both components use (`fellows`, `dir`, `lang`, `syllabus`) come from one place each (`src/lib/course-language.ts` or `syllabusOf`), not from two copies.
- [ ] **Step 1: Characterization test first.** `course-view-body.browser.test.tsx` renders `CourseView` (as `course-view-time.browser.test.tsx` does) with a course that has an epigraph, a description, a content warning, two fellows (one with a bio), a facilitator note, three sessions and a bibliography, in English and in Arabic. It compares `container.innerHTML`, with the `useId` ids normalised, to `course-view-body.snap.html` (`toMatchFileSnapshot`). Write the snapshot on the unchanged `CourseView`. PASS. Commit.
- [ ] **Step 2: Move.** Create `CourseBody.tsx`; `CourseView` renders it. The same test passes with no change to the snapshot file, and `src/lib/side-card-css.unit.test.ts` and `course-view-time.browser.test.tsx` still pass. **[verify]** `verify.sh --tests-only portal/phase-2-owner-pages <sha> 'src/app/(frontend)/[locale]/(site)/study'` and the unit file. Commit.

### Task O1: The document read

**Skills:** tdd, payload.

**Files:** Create `src/portal/review/read-document.ts`, `src/portal/review/read-document.int.test.ts`.

**Interfaces:**

- `readDocument(payload, user, target: { collection: ReviewedCollection; id: number }, locale): Promise<ReviewedRead | null>`. A gated `findByID` of the main row (`depth` as the public page reads it, P10; `user`, `overrideAccess: false`), a gated `findVersions` of the latest version (`limit: 1`, `sort: '-updatedAt'`, same `depth`). No version found (the reader is neither an owner nor an admin): `null`, so the page is not found (spec: the version access lets only owners and admins through). It returns `{ main, latest, latestVersionId, key, updatedAt }`: `latest` is the version's `version` object with its `id` set to the parent id (the shape `statusInputOf` expects, `review-status.ts:131-142`; `readDocument` does that remap once, so no caller does), `key` is `statusOf(statusInputOf(...))`, and `updatedAt` is the version's `updatedAt`. For a course it also reads its sessions with a gated `find` (`course equals id`, `depth: 0`, `pagination: false`). P26 gives the fallback for a document with no version row.
- [ ] **Step 1: Failing int cases** (`describe('review-events: readDocument')`): "the owner reads a draft"; "an admin reads it"; "another member gets null on a published article" (the main row is readable, the version is not); "a student gets null for a course of someone else"; "latest has the parent id". **[verify]** at the O1 to O4 group end. Implement. PASS. Commit.

### Task O2: Banner, history, body

**Skills:** tdd, modern-web-guidance (first), arc, better-accessibility, better-layout, better-typography, better-writing then humanizer.

**Files:** Create `src/portal/review/review-banner.tsx`, `review-history.tsx`, `document-body.tsx`, `reviewed-rows.tsx`, `review.module.css`, `review-banner.dom.test.tsx`, `review-history.dom.test.tsx`, `reviewed-rows.dom.test.tsx`, `document-body.browser.test.tsx`. Modify `messages/{en,ar}.json` (`Portal.banner.*`, `Portal.history.*`).

**Interfaces:**

- `ReviewBanner({ statusKey, viewer, latestNote })` (server): Arc `Alert` with `statusBadge(statusKey)` badges, the `nextAction(statusKey, viewer)` line, and the latest note (`dir="auto"`) when there is one.
- `ReviewHistory({ rows, open })` (server): `<details open={open}>` with `<summary>` "History ({n})", holding a plain `<ol>` of rows, oldest first (Deviation 16). Each `<li>` has the date as `<time dateTime>` (tabular numbers; formatted in the reader's locale and the site's time zone), "{actor} moved it from {from} to {to}" with status words from `Portal.status`, and the note (`dir="auto"`). `open` is true for an admin (spec, pane order 2). No rows: "No review moves yet."
- `DocumentBody({ collection, doc, sessions, clamp, user })` (server): article through `ResolvedRichTextField` (`data={doc.body}`, `footnotes={footnotesOf(doc.body)}`, `footnoteLabel`, `footnoteLocale`, `user`, class `article-prose`, as `article-page.tsx:460-490`; no `<h1>`, no cards); course through `CourseBody` (`course={doc}`, `sessions`; O0); publication through `ReviewedRows` alone. Below the body, every collection renders `<ReviewedRows collection doc />` (Deviation 11): a `<dl>` with one row per field of `REVIEWED_FIELDS[collection]` that is not `title` and not drawn by the body (`BODY_DRAWS`: articles `body`; courses `epigraph`, `description`, `fellows`, `bibliography`, `facilitator_note`, `content_warning`; publications none). A value is text: a string as it is, a boolean Yes or No, a media `alt` or `filename`, a relation its `title` or `name`, an array its items joined (or a count), `meta` its `title` and `description`; an empty value is left out. `clamp`: `max-block-size: 320px`, `overflow: hidden`, and a **Show more** `<button aria-expanded>` (own CSS; Arc `ExpandableText` clamps by lines, not by height, `expandable-text.tsx:10-18`). Each localized block carries `lang` and `dir`.
- [ ] **Step 1: Failing tests:** banner "shows two badges for a live item with edits in review and the latest note"; history "is closed for an owner, open for an admin, counts rows in the summary, lists oldest first" (dom); body (browser) "clamps at 320 px, Show more expands, and the button's aria-expanded follows", "Arabic body has dir rtl", "a course body has no h1, no Apply link and no page-frame class", "an article body has no h1", "a closed History opens and shows its rows"; `reviewed-rows.dom.test.tsx`: "for each collection, `BODY_DRAWS` plus `title` plus the rendered keys of a fully filled fixture equal `REVIEWED_FIELDS[collection]`" (it fails when a reviewed field is added and nothing draws it), "a course shows its subtitle, language note and applicant questions", "an empty value is left out". FAIL. Implement. PASS (**[verify]** for the browser file). Commit.

### Task O3: Owner moves on the page

**Skills:** tdd, modern-web-guidance (first), arc, better-accessibility, better-writing then humanizer.

**Files:** Create `src/portal/document/owner-buttons.ts`, `owner-buttons.unit.test.ts`, `owner-actions.ts` (`'use server'`), `owner-actions-bar.tsx` (client), `owner-actions-bar.dom.test.tsx`, `restore-line.tsx`, `document.module.css`. Modify `messages/{en,ar}.json` (`Portal.document.*`).

**Interfaces:**

- `OWNER_BUTTONS: Record<StatusKey, OwnerButton[]>` with `OwnerButton = 'withdraw' | 'withdrawChanges' | 'requestRemoval' | 'discard'`: `submitted` [withdraw]; `published_edits` [withdrawChanges]; `published_removal` [withdraw]; `published` [requestRemoval]; `published_unsent` [discard, requestRemoval]; `published_edits_returned` [discard]; `published_edits_declined` [discard]; `published_removal_kept` [requestRemoval]; `draft`, `changes_requested`, `rejected` []. **Edit** (secondary, the admin editor URL) shows for every key except `submitted`, `published_edits`, `published_removal` (the owner cannot edit while it waits). `withdraw` and `withdrawChanges` both call `ownerMove({ move: 'withdraw' })`.
- `ownerMoveAction(input: unknown): Promise<OwnerMoveResult>`: parses `{ collection, id, move, from? }` with zod (collection `articles` or `courses`), reads `currentReader()` (no reader: `{ ok: false, reason: 'refused' }`), calls `ownerMove`, then `refresh()` (`next/cache`, `refresh.md`) on `ok` and on `decided`.
- `OwnerActionsBar`: the buttons in one area with a fixed inline size, so nothing shifts across **Withdraw** and **Request removal** (spec, Success moments). After a move, focus goes to the first button of the new state, or to the banner when there is none. `decided`: the line "An admin decided this while you withdrew it." (`role="status"`) and the page shows the new state (after `refresh()`). Discard `ok`: `RestoreLine` "Your changes were discarded." with **Restore them** (`ownerMoveAction({ move: 'restore', from: restoreFrom })`); the line stays until the owner edits again or leaves the page; a toast repeats it (the line is the keyboard path; spec, Undo not confirm). Discard commits at once, with no pending timer (spec, Calls).
- [ ] **Step 1: Failing tests:** `owner-buttons.unit.test.ts`: one row per `StatusKey`. `owner-actions-bar.dom.test.tsx`: "Withdraw calls the action and moves focus to the new first button"; "decided shows the line"; "Discard shows the restore line and Restore them calls restore with restoreFrom"; "the area keeps its inline size". FAIL. Implement. PASS. Commit.

### Task O4: The routes and the owner branch of `documentHref`

**Skills:** tdd, modern-web-guidance (first), arc, better-layout.

**Files:** Create `src/portal/document/document-page.tsx`, `src/portal/document/back-link.ts`, `back-link.unit.test.ts`, `src/app/(frontend)/[locale]/(portal)/spaces/articles/[id]/page.tsx`, `src/app/(frontend)/[locale]/(portal)/spaces/courses/[id]/page.tsx`. Modify `src/lib/document-href.ts`, `document-href.unit.test.ts`, `testing/portal-e2e.test-utils.ts` (route shapes, P13), and the tests that assert an owner row link.

**Interfaces:**

- Each route: `currentReader()`; `id` an integer, else `notFound()`; courses: `adminViewOf(user)` must be `fellow` or `admin`, else `notFound()` (spec, Routes); `readDocument`, `null` gives `notFound()`; renders `DocumentPage` with `viewer = isAdminUser(user) ? 'admin' : 'owner'`, `PageHeader` (H1 the title in the reader's locale, or the other locale's title; **Edit**; **View on the site** for a live item; the back link), `ReviewBanner`, `ReviewHistory` (`open={viewer === 'admin'}`), `OwnerActionsBar` (owners only; Open question 4), `DocumentBody` (no clamp). `generateMetadata` with the title and `robots: { index: false }`. No `loading.tsx` above the banner (first-render content, server-rendered).
- `backLinkFor(from: string | string[] | undefined, viewer): { collection: ReviewedCollection; id: number } | null` in `back-link.ts`: parses `review:{collection}:{id}`, with `collection` one of `articles`, `courses`, `publications` and `id` a positive integer; anything else, or a viewer that is not an admin, gives `null`. The page turns it into the back link "To review" to `/spaces/review/{collection}/{id}`. Never a free URL (spec: "Its back link returns to the same row"). 2-6 R4 builds the link with the `from` value.
- `documentHref`: `viewer: 'owner'` and `collection` `articles` or `courses` gives `/spaces/{collection}/{id}`. A publication owner keeps the admin URL (D16). Admin rows unchanged until 2-6.
- [ ] **Step 1: Premises.** Run P27 and `git grep -nE "admin/collections" origin/main -- '*.test.*' e2e testing`. Each hit that asserts an article or course owner row link (`e2e/portal-lists.e2e.test.ts:201,210,221`, `src/portal/lists/list-view.unit.test.tsx:230,253`) changes to the portal path in this task. Write the hits in the PR body.
- [ ] **Step 2: Failing unit rows** in `document-href.unit.test.ts` (owner articles, owner courses, owner publications stays admin) and `back-link.unit.test.ts` ("a valid `review:articles:5` for an admin"; "`review:users:5`, `review:articles:abc`, `https://evil.test` and an array give null"; "a non-admin gives null"). FAIL. Implement. PASS. Commit.

### Task O5: Fixture

**Skills:** tdd, payload.

**Files:** Create `testing/review.fixture.ts`.

- [ ] **Step 1:** `reviewWorld(payload)`: an admin, a fellow with a submitted course (two fellows), a student with a submitted article (requested `community`), a live article with unsent edits, a live article with edits in review, a live article with a removal request, a submitted publication, each tracked for cleanup (`createTracker`). Returns ids, accounts and each document's latest version `updatedAt`. Used by 2-5 and 2-6. Commit.

### Task O6: `portal-document` e2e

**Skills:** tdd, better-accessibility.

**Files:** Create `e2e/portal-document.e2e.test.ts`.

- [ ] **Step 1: The cases** (owner roles fellow and student, English and Arabic, 1440 and 390; Mail off (M); `reviewWorld`):
  1. "the list row opens the portal page" (Articles list, title link goes to `/{locale}/spaces/articles/{id}`).
  2. "a submitted article: banner, history, Withdraw" (banner Submitted; the history summary "History (1)"; **Withdraw**; banner Draft; focus on the first button of the new state or the banner).
  3. "a live article: Discard, then Restore them" (badges Published and Unsent edits; **Discard my changes**; the line and the toast; badges Published only; **Restore them**; Unsent edits again).
  4. "Request removal, then Withdraw keeps it on the site".
  5. "another member gets not found on the owner page"; "a student gets not found on /spaces/courses/{id}"; "/spaces/articles/new is not found".
  6. "Edit opens the admin editor".
  7. axe on each page shape (the axe rule); keyboard-only walk through the actions.
  8. At 390 px in Arabic: no horizontal scroll, the back link and chevrons mirror.
  9. "an admin opens the owner page from To review and the back link returns to the row": `?from=review:articles:{id}` as the admin shows the back link "To review" to `/spaces/review/articles/{id}`; `?from=review:articles:abc` and a `from` for an owner show none.
- [ ] **Step 2:** **[verify]** `verify.sh --db migrated --e2e-only portal/phase-2-owner-pages <sha> e2e/portal-document.e2e.test.ts e2e/portal-lists.e2e.test.ts e2e/portal-shell.e2e.test.ts`. PASS. Commit.

### Task O7: Reviews, full suite, open PR 2-5

**Skills:** ux-auditor, better-interface, then break-ui; code-review, then security-review.

- [ ] **Step 1: Screen reviews** on the kept app (`--db migrated --keep --no-tests`, Mail off (M) server guard; `reviewWorld` by the scratch world script): ux-auditor and better-interface on the two read-only pages, as fellow and student, 1440 and 390, English and Arabic, light and dark. Reports in a PR comment.
- [ ] **Step 2: break-ui** with `agent-browser` (headless): a 120-character Arabic title, a body of 30 paragraphs, a history of 40 rows, an empty note, a course with 8 fellows, a document whose other locale is empty. `agent-browser close`.
- [ ] **Step 3:** code-review (spec Review and history, Read-only views, Status model Discard). security-review: `ownerMoveAction` parses its input, takes the user from the session, never sets `overrideAccess`; the pages read through the gated read and return not found for a reader without version access; `rg -l "@/portal/" src/lib src/components src/i18n` prints nothing.
- [ ] **Step 4:** Fix. **[verify]** the full suite. Per-PR step 5. Scratch-world `--remove`. Open `feat(portal): read-only article and course pages with owner moves (portal phase 2, PR 5)`.

**Verification boxes (2-5).**

- [ ] **unit:** `owner-buttons.unit.test.ts`, `document-href.unit.test.ts`, `back-link.unit.test.ts`, `review-banner.dom.test.tsx`, `review-history.dom.test.tsx`, `owner-actions-bar.dom.test.tsx`; browser `document-body.browser.test.tsx`, `course-view-body.browser.test.tsx` (the public course page is unchanged); int `read-document.int.test.ts`; e2e `portal-document`, `portal-lists`.
- [ ] **live:** Scenario on the kept app (`--db migrated --keep --no-tests`, `reviewWorld`) as the fixture student who owns the submitted article, with `agent-browser`: open `/en/spaces/articles`, follow the article's row link, press **Withdraw**; then, as the admin, open the bell; then, as another student, open the same article URL. Pass: the row link lands on `/en/spaces/articles/<id>` inside the portal shell with banner Submitted; after **Withdraw** the banner says Draft; the admin's bell has a "Withdrawn" row; the other student gets the not-found page. `agent-browser close`.
- [ ] **perf:** Metric: TTFB p75 by Perf runs (1d Global Constraints, `cilas_ttfb` migrated in the head session). Baseline `main` at the base, `/en/spaces`. Head routes: `/en/spaces/courses/<id>` for the fellow account (its first own course, printed by a gated `find` as that account) and `/en/spaces/articles/<id>` for the account that owns an article (when the clone has one), with `/en/spaces` as the control. Pass: head p75 at most `L` per role and route. BLOCKING or REPORT-ONLY by the 1d P12 rule.

## PR 2-6. To review (`portal/phase-2-to-review`)

Base `origin/main` after 2-3, 2-4 and 2-5 merge. Screen: `/spaces/review`, `/spaces/review/[collection]/[id]`.

### Task R1: The nav item and its count

**Skills:** tdd, modern-web-guidance (first), arc.

**Files:** `src/portal/nav/portal-nav.ts`, `portal-nav.unit.test.ts`, `nav-icons.ts`, `nav-counts.tsx`, the Home grouped-row file and the `needs` tests that P25 prints, `testing/portal-e2e.test-utils.ts`, `messages/{en,ar}.json` (`Portal.nav.review`: "To review").

- [ ] **Step 1:** Run P1, P2, P3, P13 and P25 (write the P25 hits in the PR body). Failing unit row in `portal-nav.unit.test.ts`: "an admin gets To review in the admin group before Open dashboard; a fellow and a student do not". FAIL. Add `REVIEW` (Shared files), the `COUNT_OF.review` row, the icon, the `NAV_BY_ROLE` row, and change each `/admin/reviews` hit in `src/portal` (and the test that asserts it) to `/spaces/review`; a hit that renders through a plain `<a>` (Home's grouped row) wraps the path in `localizedLink(path, locale)` (P27). PASS. Commit.

### Task R2: List and pane data

**Skills:** tdd, payload.

**Files:** Create `src/portal/review/review-rows.ts`, `src/portal/review/pane-data.ts`, `src/portal/review/pane-data.int.test.ts`.

**Interfaces:**

- `reviewRows(payload, user, locale): Promise<AdminReviewRow[]>`: throws for a non-admin (callers return not found first); `adminReviewRows(payload, await adminQueue(payload), locale)` (oldest first, `src/lib/review-queue.ts`).
- `reviewPane(payload, user, target, locale): Promise<ReviewPane | null>`: `readDocument` (2-5) as the admin; `reviewHistoryFor`; `reviewDiff` (R3) when the key is a resubmission or a published edit; the facts row (article: requested tier, translation, tag count, locales; course: course type (`courseTypeKey`), mode, language, start date, session count, locales, fellows' names); for a course, the cycles for the select (`find` `cycles`, `select: { title: true }`, `depth: 0`, `pagination: false`) and the current `cycle` and `tier` of a live course; the fellows who become fellows on approval (people in `fellows` whose account lacks the `fellow` role); `waitsOnAdmin: waitsOn(key) === 'admin'` (actions show only then); `asked` (`changes` or `removal`).
- [ ] **Step 1: Failing int cases** (`describe('review-events: pane data')`): "the rows equal getReviewQueue in order"; "a non-admin throws"; "a course pane names the fellows who become fellows"; "a decided item returns its pane with waitsOnAdmin false". **[verify]** at the group end. Implement. PASS. Commit.

### Task R3: The diff (D9)

**Skills:** tdd.

**Files:** Create `src/lib/review-diff.ts`, `src/lib/review-diff.unit.test.ts`. Modify `package.json`, `pnpm-lock.yaml` (`pnpm add diff --save-exact` on the Mac; Check open source first).

**Interfaces:**

```ts
type FieldChange =
  | { field: string; locale: Locale | null; kind: 'text'; before: string | null; after: string | null }
  | { field: string; locale: Locale | null; kind: 'richText'; hunks: { removed: string[]; added: string[] }[] }
  | { field: string; kind: 'people'; added: string[]; removed: string[] }
type ReviewDiff = { kind: 'changes'; changes: FieldChange[] } | { kind: 'pruned' } | { kind: 'none' }
diffBaseId(events: { to: ReviewState; version: number | null }[], live: boolean): 'live' | number | null
reviewDiff(collection: ReviewedCollection, base: ReviewedDoc | null, submitted: ReviewedDoc, names: Map<number, string>): ReviewDiff
```

- Base (spec D9): a document that is not live uses the `version` of the latest `review-events` row whose `to` is `changes_requested`; a live document uses the live row. No such row on a document that is not live: `none` (a first submission has no diff). The version is gone (`findVersionByID` finds nothing, P14): `pruned`.
- Fields: `REVIEWED_FIELDS[collection]`, compared with the fingerprint rule of `hasUnsentEdits` (no Lexical node ids). A text field gives both values. A rich text field gives its paragraphs as plain text (Lexical text nodes joined per top-level block) per locale, diffed with `diffArrays` from `diff`; each hunk lists removed above added. `fellows` gives the names added and removed. Sessions are not a field (ADR 0011).
- [ ] **Step 1: Failing unit table** (`pnpm exec vitest run --project node src/lib/review-diff.unit.test.ts`): a changed title in Arabic only; a rich text body with one paragraph changed and one added; node id changes alone give no change; fellows added and removed; base for a document that is not live after two rounds uses the latest `changes_requested` row; a live document uses `live`; a first submission gives `none`; a missing version gives `pruned`. FAIL. Implement. PASS. Commit.

### Task R4: Routes and layout

**Skills:** tdd, modern-web-guidance (first), arc, better-layout, better-typography, better-accessibility.

**Files:** Create `src/portal/review/review-page.tsx`, `review-list.tsx`, `review-pane.tsx`, `review-diff-view.tsx`, their tests, `src/app/(frontend)/[locale]/(portal)/spaces/review/page.tsx`, `src/app/(frontend)/[locale]/(portal)/spaces/review/[collection]/[id]/page.tsx`. Modify `review.module.css`, `messages/{en,ar}.json` (`Portal.review.*`).

**Interfaces:**

- Both routes: `currentReader()`; not an admin: `notFound()`. The pane route: `collection` in `articles`, `courses`, `publications`, else `notFound()` (spec); `id` an integer; `reviewPane` `null` gives `notFound()`.
- `/spaces/review`: H1 "To review", the list, and on a wide screen the pane of the oldest row (no pane when the list is empty: `PortalEmptyState` "Nothing waits for review."). `/spaces/review/[collection]/[id]`: the list with that row selected (`aria-current="true"`) and its pane. Under 700 px the list route shows only the list, and the pane route shows only the pane, with a back link "To review" (a chevron that mirrors in Arabic) and the sticky action bar. Stacking from the bottom edge of a phone: the bottom bar, the Undo all bar (2-3), then the sticky action bar. The page sets `scroll-padding-block-end` to the sum of the heights of the bars that show (`--pending-bar-block-size` and the sticky bar's own height).
- Wide: a CSS grid of two columns; each is an Arc `ScrollArea` (operator rule). The list is server-rendered (spec, Lazy loading rule).
- `ReviewList`: each row is a container (not a link): the title is the link to the row's pane route; meta "{owner} · Waiting {n} days"; the 40x40 slot; `statusBadge`. The pending state comes from R5 on the client (`usePendingItem('review:{collection}:{id}')`).
- `ReviewPane` order (spec): title, byline, facts row (13 px); `ReviewBanner` and `ReviewHistory open`; **What changed** (`ReviewDiffView`, or "The earlier version is no longer stored."); `DocumentBody clamp` with "Read the full article" or "Open the full course" (a quiet link to `/spaces/{collection}/{id}?from=review:{collection}:{id}`, the owner page that an admin may open read-only (Open question 4), whose back link `backLinkFor` builds from that `from` value and which returns to this row; a publication's link opens its admin URL, D16); the actions (R5).
- `ReviewDiffView`: per change a `<dl>` row: the field label (with the locale), old above new; `<del>` and `<ins>` with visually hidden "Removed" and "Added" (colour is never the only cue).
- [ ] **Step 1: Failing tests:** `review-list.dom.test.tsx` "the title is the only link; the selected row has aria-current"; `review-diff-view.dom.test.tsx` "old above new, with Removed and Added text". FAIL. Implement. PASS. Commit.

### Task R5: Actions on the pending provider

**Skills:** tdd, modern-web-guidance (first), arc, better-accessibility, apple-design, better-writing then humanizer.

**Files:** Create `src/portal/review/review-actions.tsx`, `review-actions.dom.test.tsx`, `pending-row.tsx`, `review-drafts.ts` (client store of form state per key). Modify `review-list.tsx`, `messages/{en,ar}.json`.

**Interfaces:**

- `ReviewActions({ pane })` (client), by item (spec, Actions by item): article: **Approve and publish** with **Publish as** (Arc `Select`, Community and Public, starting at the requested tier, D6); course: **Approve and publish** with **Cycle** (required) and **Tier** (Community, Public, starting at Public; on an edit of a live course both start at its current values, D10), and the label "Approve and publish. Makes {names} fellows." when the approval makes someone a fellow; publication: **Approve and publish**; each with **Ask for changes** and **Decline** (note required). Removal request: **Remove from the site** and **Keep it published** (note required). The note is an Arc `Textarea`.
- On press: validate **Cycle** and a required note; a gap shows the error under the field (`aria-invalid`, `aria-describedby`), focus moves there, no item starts. Else `pending.decide({ key: 'review:{collection}:{id}', label: title, request: { url: '/api/{collection}/{id}/review', body: { to, note, tier, cycle, updatedAt: pane.updatedAt } } })`.
- After `decide`: the row becomes a `PendingRow` (`aria-busy="true"`, the line "Approving. Email in {n} s", **Undo**, `PendingRing`, all siblings of the title link); focus moves to the next row that is not pending and the router goes to its pane route (`router.push`, the provider keeps its timers across the route change); no such row: focus to the list heading and the pane shows "Nothing else waits."; on a phone, the next row's pane page, or the list. A toast "Approved. Email in {n} s" with **Undo**. 500 ms after the toast shows, `announce(t('left', { n }))` ("6 left."), counting rows that are not pending.
- **Undo** (row, ring, toast, Esc on the row, **Undo all**): the row is normal again, selected, with the note and selects as they were (`review-drafts.ts` keeps them per key until the item leaves); focus moves to that row.
- `ok`: `router.refresh()`; the row leaves. `refused` 409: the row is normal again, selected; toast "This changed while you reviewed it."; refresh. `refused` 400: the row is normal again, selected, with the field error from `view.result.field` under that field (Deviation 13); then `dismiss(key)`. `failed`: the row line "Not saved." with **Try again** and **Undo**; the toast says the same. When `view.status === 403` (the `Origin` check or a lost session, which a retry cannot fix), the line is "Not saved. Reload the page and sign in again." with **Undo** only.
- A pending row never shows the decision buttons; a second `decide` on its key is refused by the provider.
- [ ] **Step 1: Failing dom tests** (fake clock and fetcher through `PendingProvider` props): "an empty required note shows the error and starts nothing"; "approve starts one pending item with the body of the spec"; "focus moves to the next row that is not pending"; "Undo restores the note and selects and focuses the row"; "409 shows the changed toast"; "400 puts the error under the field"; "failure shows Not saved with Try again and Undo"; "a 403 shows Reload the page and sign in again with Undo only"; "a focused pending row shows Paused. Email waits. and its ring name ends Timer paused"; "6 left is announced 500 ms after the toast and counts only rows that are not pending"; "the course label names the new fellows". FAIL. Implement. PASS. Commit.

### Task R6: The admin branch of `documentHref`

**Skills:** tdd.

**Files:** `src/lib/document-href.ts`, `document-href.unit.test.ts`, `src/lib/review-mail.int.test.ts` (one assertion), `src/lib/review-queue.int.test.ts` (`:123`), and the admin-viewer link assertions that `git grep -nE "admin/collections" origin/main -- '*.test.*' e2e testing` prints (`e2e/portal-lists.e2e.test.ts` and `src/portal/lists/list-view.unit.test.tsx`, where a row that waits on the admin is read as the admin).

- [ ] **Step 1:** Run the `admin/collections` grep above and write its hits in the PR body; each assertion of an admin viewer on a row that waits on the admin (for example `e2e/portal-lists.e2e.test.ts:221`, a `published_edits` course) changes to `/spaces/review/{collection}/{id}`, and one that does not wait stays. Failing unit rows: admin and `waiting` gives `/spaces/review/{collection}/{id}` for articles, courses and publications; admin and not waiting keeps the admin URL; `users` keeps the admin URL. Add to the 2-2 int case: the Arabic admin's link holds `/ar/spaces/review/articles/`. Change `src/lib/review-queue.int.test.ts:123` (the queue row `href`) to `/spaces/review/articles/{id}`. FAIL. Implement. PASS. The `/admin/reviews` page (`getReviewQueue` `href`) now links to To review. Commit.

### Task R7: The one-off link script

**Skills:** tdd, payload.

**Files:** Create `scripts/rewrite-notification-links.ts`, `scripts/rewrite-notification-links.int.test.ts`.

**Interfaces:**

- `rewriteNotificationLinks(payload, { apply }): Promise<{ scanned; changed; skipped: Record<'users' | 'gone' | 'same', number>; samples: { id; from; to }[] }>`. Reads `notifications` whose `link` starts with `/admin/collections/` or `/admin/applicants` (`overrideAccess: true`, `depth: 0`, pages of 200). For a reviewed collection link: reads the document and its latest version, `waiting = waitsOn(statusOf(...)) === 'admin'`, `viewer = isAdminUser(recipient) ? 'admin' : 'owner'`, the new link from `documentHref`; a gone document is skipped (`gone`); a `users` link is skipped (`users`). An applicants link goes through `applicantsHref` (the same URL until phase 3, so `same`). With `apply`, each changed row is updated with `overrideAccess: true`.
- The CLI (`npx tsx scripts/rewrite-notification-links.ts [--apply]`) prints the database name, the counts and ten samples. With no flag it writes nothing. The owner runs it by hand on each database after 2-6 deploys; deploys never run it; it is not called from `package.json` scripts, the Dockerfile or a migration (For the operator, item 3).
- [ ] **Step 1: Failing int cases** (`describe('review-events: link script')`): "a dry run changes nothing and counts"; "apply rewrites an owner's article link to /spaces/articles/{id} and a waiting admin link to /spaces/review/..."; "users links and gone documents are skipped". **[verify]** at the group end. Implement. PASS. Commit.

### Task R8: The end gate int half

**Skills:** tdd, payload.

**Files:** `src/lib/review-mail.int.test.ts` (one case).

- [ ] **Step 1:** "the owner's approval email holds reviewEmailUrl(owner), which is the portal page": approve through the endpoint; `resendInbox()` holds one message to the owner. Parse the first `href` out of the captured HTML with an attribute parser (not `includes`, so an escaped or rewritten link cannot pass) and assert it equals `reviewEmailUrl(owner, { collection: 'articles', id, viewer: 'owner', waiting: false })`, and that this URL ends `/{locale}/spaces/articles/{id}` (Deviation 10). Run it once with a message that was sent 100 ms before the assertion. **[verify]**. Commit.

### Task R9: `portal-review` e2e (with the `pending` cases and the end gate)

**Skills:** tdd, better-accessibility.

**Files:** Create `e2e/portal-review.e2e.test.ts`. Modify `e2e/portal-shell.e2e.test.ts` (one block), `testing/review.fixture.ts`.

- [ ] **Step 1: The cases** (admin, English and Arabic, 1440 and 390, `reviewWorld`; Mail off (M); the test build's undo window is 1500 ms, set by V1): 0. "the build's undo window is 1500 ms": the first pending ring's `data-undo-ms` equals 1500 before any timing, so a missing env value fails here and not as a flaky timer.
  1. "approve a course with cycle and tier, undo, approve again and let the timer end" (the row is pending with `aria-busy`, the toast shows, focus is on the next row; **Undo** on the row brings it back selected with cycle and tier as set; the second approval commits after 1.5 s and the row leaves; the course's public page shows at that tier).
  2. "ask for changes with a note" (an empty note first: the error under the field and focus in it).
  3. "the history shows" (the pane's `<details>` is open with the rows).
  4. "Publish as starts at the requested tier".
  5. "/spaces/review/users/1 is not found"; "a fellow gets not found on /spaces/review".
  6. "the toast text and 6 left arrive in the accessibility event log": an init script records each text change of `[role=status]` and `[aria-live]` nodes with a timestamp (MutationObserver); both strings are recorded, "{n} left." at least 500 ms after the toast text.
  7. "on a phone, tabbing through the pane keeps focus visible above the bars" (390 px, with two items pending so the bottom bar, the Undo all bar and the sticky action bar all show: for each focused element, its bottom edge is at or above the top edge of the highest of the three).
  8. `pending`: "reload during the window decides the item" (reload at 0.5 s; then the document's key is `published` and the owner's notification row exists, the row the hook writes beside the email).
  9. `pending`: "switching tab during the window commits" (`page.evaluate` sets `document.visibilityState` to `hidden` and dispatches `visibilitychange`; headless Chromium does not hide a tab on its own); the commit request is seen (`page.waitForRequest('**/review')`) before 1.5 s.
  10. `pending`: "Sign out during the window commits first" (the commit request finishes before `/api/users/logout` starts).
  11. `pending`: "with reducedMotion reduce the ring shows the remaining seconds as text and no arc".
  12. "Undo all brings two items back and focuses the first".
  13. End gate: "an owner's email link opens the portal": after case 1, as the course's fellow (owner) in a new context, open `reviewEmailUrl(owner, ...)` (imported from `src/lib/review-mail.ts`; the Playwright config registers `tsx`); the page is `/{locale}/spaces/courses/{id}` inside the portal shell with banner Published. And "an admin's email link opens To review" for a waiting document. And "the full-course link opens the owner page and its back link returns to the same row".
  14. axe on both route shapes; a keyboard-only walk (Tab to a row, Enter, choose the tier with the keyboard, press **Approve and publish**, Esc on the pending row undoes).
  15. `pending`: "a modal from another route pauses the item" (390 px: decide an item, go to another page, open the More sheet, wait 2 s: no request to `**/review` was sent; close the sheet: the request is sent).
  - `portal-shell`: `describe('To review item')`: admin sees it in the admin group with its count and accessible name ("To review, 3 tasks" style, the 1c-2 count words) at 1440 and in the More sheet at 390; fellow and student do not.
- [ ] **Step 2:** **[verify]** `verify.sh --db migrated --e2e-only portal/phase-2-to-review <sha> e2e/portal-review.e2e.test.ts e2e/portal-shell.e2e.test.ts e2e/portal-document.e2e.test.ts`. PASS. Commit.

### Task R10: Reviews, full suite, open PR 2-6

**Skills:** ux-auditor, better-interface, then break-ui; code-review, then security-review.

- [ ] **Step 1: Screen reviews** on the kept app (`--db migrated --keep --no-tests`, Mail off (M), `reviewWorld` by the scratch world script): ux-auditor and better-interface on To review (list, pane, pending rows, the Undo all bar, the phone pane page), 1440 and 390, English and Arabic, light and dark. Reports in a PR comment.
- [ ] **Step 2: break-ui** (`agent-browser`, headless): 0 items, 60 items, a 120-character Arabic title, a course with 8 fellows, a missing title, a pruned version, a note of 4000 characters, three decisions pending at once. `agent-browser close`.
- [ ] **Step 3:** code-review (spec Review and history, Pending decisions, Document links as the issue). **security-review of the review endpoint** (spec, Phase 2 Review line) with the pane in place: the pane's request reaches only `/api/{collection}/{id}/review` of the shown document; the `updatedAt` it sends is the pane's read; a non-admin gets not found on both routes; the link script writes only with `--apply`.
- [ ] **Step 4:** Fix. **[verify]** the full suite (`--db migrated`). Per-PR step 5. Scratch-world `--remove`. Open `feat(portal): To review with history, diff and undo (portal phase 2, PR 6)`. The PR body names the link script under "For the operator".

**Verification boxes (2-6).**

- [ ] **unit:** `portal-nav.unit.test.ts`, `review-diff.unit.test.ts`, `document-href.unit.test.ts`, `review-list.dom.test.tsx`, `review-diff-view.dom.test.tsx`, `review-actions.dom.test.tsx`; int `pane-data.int.test.ts`, `rewrite-notification-links.int.test.ts`, `review-mail.int.test.ts`; e2e `portal-review`, `portal-shell`.
- [ ] **live:** Scenario on the kept app as the admin (`reviewWorld`; the kept app is built with `--no-tests`, so its undo window is the production 5 s and a scripted click fits): open `/en/spaces` and follow **To review** in the sidebar; open the submitted course; choose a cycle and Public; press **Approve and publish**; press **Undo**; press it again and wait. Then open the course's fellow's newest notification link from the bell as that fellow. Pass: the sidebar count drops by one after the commit; the row shows "Approving. Email in" with a ring, then leaves; `review_events` holds `submitted | approved` for the course; the fellow's bell link opens `/en/spaces/courses/<id>` with banner Published.
- [ ] **perf:** Metric: TTFB p75 by Perf runs (1d Global Constraints), admin account, `cilas_ttfb` migrated in the head session. Baseline `main` at the base, `/en/spaces`. Head: `/en/spaces/review`, and `/en/spaces/review/<collection>/<id>` for the oldest queue row on the clone (`getReviewQueue` prints it; an empty queue makes the pane route REPORT-ONLY), with `/en/spaces` as the control. Pass: head p75 at most `L`. BLOCKING or REPORT-ONLY by the 1d P12 rule.

## Could not verify from this server

- `~/cilas-verify/verify.sh` on the Mac: its env for `NEXT_PUBLIC_SERVER_URL` and its `--db` options (P8, P18). V0 settles both. V1 adds `--undo-ms`.
- The SQL that `migrate:create` writes for M3 and M1 (P7, C3, C6): `migrate:create` needs the Mac worktree with `node_modules`.
- `payload.update({ locale: 'all' })` for localized fields in Payload 3.91.0 (P11). C8a case 5 settles it, with the per-locale fallback written.
- Whether Arc `Select` renders well in a 360 px pane and in RTL (P16); R4 reads its props first, and the screen reviews check the result.
- The final shape of 1c-2, 1c-3 and 1d-3 (1c-2 and 1d-3 in build): P1, P3 and P13 re-check them.
- That headless Chromium never fires `visibilitychange` on its own: R9 case 9 dispatches it by hand.
- The exact `diff` version that `pnpm add diff --save-exact` resolves (8.x expected; `diff@8.0.4` is in the store).
- That the modal observer sees every portal modal (P28): `modal-open.browser.test.tsx` settles it per primitive, and a primitive it misses gets an explicit `overlay(open)`.
- Production's hosts for the `Origin` check (P8): the Dokploy read and the `curl -sI` runs need a machine that can reach them. The own-origin rule makes the endpoint work on any host that serves it.
- P23 (the locale redirect) and P26 (version rows on the clone) need the Mac.
- The free Arc registry was read here (public `registry.json`), so no part is left unchecked. The result is in the UI parts table.
