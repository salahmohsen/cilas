# Portal phase 1b: status and lists. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every reviewed document one status from one function, and give fellows, students and admins an Articles list and a Courses list in the portal that show that status, the next action and the work that waits on the reader.

**Architecture:** PR 1b-1 adds pure rules in `src/lib/` (`review-status.ts`, `reviewed-fields.ts`, `document-href.ts`), changes how the review hook keeps `review.request`, and lets an owner delete a declined, never-published item. It has no screen. PR 1b-2 adds `src/portal/lists/` (the group table, the row loader, the row and the list view) and two pages under `(portal)/spaces/`, and adds two items to `portalNav`.

**Tech stack:** Next.js 16.4.6 App Router, React 19.2.6, next-intl 4, Payload 3.91.0 (Postgres), Arc UI (`src/components/arc`), Vitest 4, Playwright 1.58.2, `@axe-core/playwright` (from phase 1a PR C).

**Spec:** `docs/superpowers/specs/2026-11-18-portal-design.md`: Status model, Lists, Document links, Navigation, Onboarding (empty states), Tests, Migrations, Phase 1b. The spec wins where they differ, except for the Deviations below.

**Baseline:** `docs/superpowers/plans/2026-11-19-portal-phase-1a-frame-and-shell.md` (merged). This plan points at its sections by name and does not copy them.

**Status.** Nothing is built. No command ran: the worktree has no `node_modules`. Each "Expected" line is a prediction. These premises are unproven until their named test runs. Each has a fallback.

| #   | Premise                                                                                                                             | Test that proves it                        | Fallback                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| U1  | The latest version of a published document with no pending edit has `version._status: 'published'`                                 | S2 "a clean published article"             | Tell a draft copy by `version.updatedAt > main.updatedAt` instead; S2 records which                                       |
| U2  | An approval leaves no draft version newer than the published one                                                                    | S2 "approval leaves no draft copy"         | `hasUnsentEdits` returns false for it (field compare); the test then asserts that                                         |
| U3  | A draft copy saved by an approval or a withdraw has the same `updatedAt` as the live row only when nothing changed after it         | S2 "the updatedAt short cut"               | Drop the short cut; compare fields every time                                                                             |
| U4  | A gated `findVersions` as an owner returns only their own versions, and as an admin every version                                   | S2 "versions are gated"                    | None needed: `readVersions` is `isAdminOrOwn(..., { versions: true })` today; a failure is a security bug, stop and report |
| U5  | `findVersions` accepts `where: { 'parent._status': { equals: 'published' } }` on the Postgres adapter                               | L3 "finds the draft copy of a live article" | Read the latest draft versions, then keep the parents that a `find` with `_status: published` and `select: { id: true }` returns |
| U6  | An admin decision from `/admin` sends no `review.request` (`submit-for-review.tsx:175-178` overrides the whole `review` group)      | S3 table, rows 5 and 6                     | None needed: the hook reads `data.review?.request ?? originalDoc?.review?.request` either way                            |

---

## File structure

- `src/lib/review-status.ts` (new): `StatusKey`, `statusOf`, `statusInputOf`, `hasUnsentEdits`, `waitsOn`, `neverPublished`, `statusBadge`, `nextAction`. Pure. No server import, so a client component may import it.
- `src/lib/reviewed-fields.ts` (new): `REVIEWED_FIELDS`, `NOT_REVIEWED`.
- `src/lib/document-href.ts` (new): `documentHref`.
- `src/lib/review-hooks.ts` (changed): the `request` rule in `applyReview`.
- `src/access.ts` (changed): `OWNER_DELETE`, `mayAuthor`, `mayTeach`.
- `src/portal/lists/` (new, PR 1b-2): `groups.ts`, `rows.ts`, `course-meta.ts`, `list-row.tsx`, `list-view.tsx`, `page-header.tsx`, `list-chips.tsx`, `show-more.tsx`, `lists.module.css`.
- `src/app/(frontend)/[locale]/(portal)/spaces/articles/page.tsx`, `.../courses/page.tsx` (new).
- `testing/portal-lists.fixture.ts`, `e2e/portal-lists.e2e.test.ts` (new).
- Each task's **Files** line lists the rest.

## PRs

| PR                 | Branch                     | Base                                                       | Tasks    | Screen | Ends when                                                                               |
| ------------------ | -------------------------- | ---------------------------------------------------------- | -------- | ------ | --------------------------------------------------------------------------------------- |
| 1b-1. Status core  | `portal/phase-1b-status`   | `portal/integration`                                       | S1 to S7 | none   | `review-status` (unit, int), `document-href` (unit), `src/owner-delete.int.test.ts`, the audit snapshot |
| 1b-2. Lists        | `portal/phase-1b-lists`    | `portal/phase-1a-shell` (PR C) with `portal/phase-1b-status` merged in | L1 to L7 | yes    | `portal-lists` (int `src/portal/lists/rows.int.test.ts`, e2e `e2e/portal-lists.e2e.test.ts`) |

- 1b-1 needs nothing of PR C. It adds no message key: `statusBadge` and `nextAction` return key strings, and 1b-2 adds the messages. So 1b-1 does not touch `messages/*.json`, where PR C adds the `Portal` namespace (`grep '"Portal"' messages/en.json` finds nothing on `portal/integration`).
- 1b-2 needs PR C: `portalNav`, `PortalNavItem`, `nav-icons.ts`, `PortalShell`, `PortalEmptyState`, `announce()`, the `Portal` messages and `testing/portal.fixture.ts` as C1 extends it. **Dependency:** `origin/portal/phase-1a-shell` does not exist yet (checked 2026-11-20). This plan writes 1b-2 against the names in the phase 1a plan, tasks C2, C4, C6 and C8. When PR C lands with other names, 1b-2 uses PR C's names. 1b-2 starts only after PR C has a branch.
- Merge order: PR C, then 1b-1, then 1b-2. 1b-2 rebases on `main` after both merge.

## Global Constraints

**Run location (this overrides phase 1a).** Builders work on the user's Mac, each in its own git worktree. Nothing in this plan runs on the server: a `next build` there restarted production on 2026-11-19. Light commands (oxlint, `pnpm exec tsgo --noEmit`, one `*.unit.test.ts` or `*.dom.test.tsx` file through `pnpm exec vitest run --project node|dom <file>`) run in the Mac worktree. Heavy jobs (any `*.int.test.ts`, `*.browser.test.tsx`, Playwright, `next build`, a dev server, the full suite) run only through the Mac runner:

```
~/cilas-verify/verify.sh [--e2e-only] [--no-tests] [--tests-only] [--int-only] [--keep] <branch> <sha> [specs|-g pat]
```

It writes `~/cilas-verify/runs/<sha>/RESULT.md`. Push the branch first; the runner checks out `<sha>`. In this plan, **[verify]** marks a step that runs through it. The phase 1a plan has no "Mac runner" section to point at. Its server-only rules do not apply on the Mac: the env recipe and leak check, the `RUN` shorthand, port 3100, the Database block, the review-world script and its control file. The runner owns env, database and port.

**From phase 1a, still in force** (read these sections of the phase 1a plan, Global Constraints): Spec values; Code and tests (Libraries first, Tests, Matrix, Describes, Locators, `spaces_mode`, Copy, Components, Lazy UI); Commits and PRs. Also its Deviation 19 (matrix exemptions) as a pattern, and "No streaming boundary above the check".

**New in 1b.**

- **No schema change.** `review.request` already has its column (`src/fields/review.ts:43-58`, migration `20261019_224849_review_request`). `OWNER_DELETE` is an access `Where`. The spec's Migrations section lists "the `request` and Discard changes" under "No migration". So no task runs `payload migrate:create`. A task that finds it needs a field stops and reports. (Had one been needed, the rule is: generate on the branch, rename the SQL by hand, test only on a throwaway copy that the seed guard accepts, never `cilas_dev`, and list it for the morning.)
- **Access rules** (AGENTS.md, Access rules). Every new rule has a name. `OWNER_DELETE` is a `Where` that two collections use, so it lives in `src/access.ts`. `pnpm audit:access` regenerates `scripts/access-audit.snapshot.json`; S6 commits the diff. The audit does not see custom endpoints, so the course delete rule (`deleteCourse`, `src/collections/Courses.ts:109-113`, behind `POST /api/courses/{id}/delete`) changes with no snapshot row. S7's security-review checks it by hand.
- **Owner lists filter by owner.** `readTiers` (`src/access.ts:319-345`) lets any signed-in reader read every published community or public row. A gated `find` as a student therefore returns the public archive. Every owner-list query adds the ownership `where` (`ownsViaAuthors(user)`, `ownsViaFellows(user)`), as `ownList` does (`src/access.ts:266-272`). A reader with no person owns nothing: the list is empty and its query does not run.
- **Which row is which.** A draft save never writes the main row (`payload/dist/collections/operations/utilities/update.js:309-318`: `db.updateOne` runs only when `!isSavingDraft`). So only the main row says whether a document is live, and only the latest version holds the newest title. One function, `statusInputOf({ main, latest })`, builds `StatusInput` from the two rows. No caller builds `StatusInput` by hand. Each Interfaces block below names the row it takes.
- **Data access.** Every list read is a gated read (`user`, `overrideAccess: false`), per the spec's Data access rule. No projection is new in 1b.
- **Not found for a role.** `/spaces/courses` returns `notFound()` for a student. No `loading.tsx` or `<Suspense>` sits above that check (phase 1a, "No streaming boundary above the check").
- **English.** Plan text, commit bodies and PR bodies follow ASD-STE100. UI copy follows the spec's strings exactly.

**Per-PR order** (replaces phase 1a's, which ran on the server). 1. Tasks, each with its targeted tests. 2. Reviews (each PR's last task). 3. Fixes with tests. 4. **[verify]** the full suite once (`verify.sh <branch> <sha>`); a failure that the base also has is one line in the PR. 5. `pnpm exec tsgo --noEmit`, `pnpm audit:access` and `git status --short scripts/access-audit.snapshot.json` print nothing new (Mac worktree; `audit:access` runs one node-project file). 6. Open the PR per `worker.md`, title `type(scope): subject (portal phase 1b, PR <n>)`.

## Check open source first

The user's rule: before a new module, compare existing tools. Verdicts:

| Module                                   | Candidates                                                                                                                                                           | Verdict | Evidence                                                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `statusOf` and the status table          | XState (statelyai/xstate, MIT, active, not installed); a typed lookup table                                                                                           | build   | XState models events over time. `statusOf` maps four stored facts to one of 11 keys with no event. The moves already live in `src/lib/review.ts`.       |
| `hasUnsentEdits` compare                 | `node:util` `isDeepStrictEqual` (built in); `dequal` (lukeed, MIT, not installed); a canonical-JSON compare                                                            | build   | `review-status.ts` must stay importable from client code, so `node:util` is out. Node ids must go before any compare, so the compare after it is one `JSON.stringify` with sorted keys (about 15 lines). |
| Paging                                   | Payload `find` `limit`, `page`, `totalDocs`, `hasNextPage` (installed); Arc `pagination` (numbered pages); TanStack Query (not installed)                              | adopt Payload | The spec wants **Show more**, not page numbers. Payload already returns the totals. TanStack Query is client state; the lists render on the server.    |
| Relative time ("Updated 2 days ago")     | next-intl `getFormatter().relativeTime` (installed); `Intl.RelativeTimeFormat`                                                                                        | adopt next-intl | Installed, locale-aware, already the app's formatter.                                                                                                |
| Badge                                    | Arc `badge` (installed, tones `neutral`, `success`, `info`, `warning`, `danger`)                                                                                      | adopt   | Its five tones are the spec's five tones (`badge.tsx:20`).                                                                                             |
| Search field                             | Arc `search-field` (installed, extends input attributes)                                                                                                              | adopt   | It takes `name`, so it submits in a GET `<form>`.                                                                                                      |
| Filter chips                             | Arc `chip-group` (installed)                                                                                                                                          | build   | Its chips are pressed buttons with roving focus (`chip-group.tsx:30-34`). The spec wants links with `aria-current="true"`, because the filter is in the URL. |
| Page header                              | Arc `page-header` (installed)                                                                                                                                         | build   | It is the space header: a required breadcrumb, members, tabs (`page-header.tsx:11-25`). The spec's header is an H1, a subtitle and two button slots.   |
| Row table                                | Arc `sortable-data-table` (installed)                                                                                                                                 | reject  | Table semantics and sort headers. The spec's rows are list rows with a slot, badges and a next-action line.                                            |
| Empty state                              | Arc `empty-state`; `PortalEmptyState` (phase 1a PR C)                                                                                                                 | adopt `PortalEmptyState` | Phase 1a rejected Arc's (hard-coded `<h3>`, a morph animation; 1a Deviation 10).                                                     |
| Admin URL in `documentHref`              | Payload `formatAdminURL` (`payload/shared`)                                                                                                                           | build   | The repo writes `/admin/collections/...` by hand in 5 places; one template string in one function replaces them later (phase 2).                         |
| Cover thumbnail                          | `mediaThumbnail`, `mediaPopulate` (`src/lib/media-image.ts`, installed)                                                                                               | adopt   | Existing helpers.                                                                                                                                      |

## Deviations from the spec

The operator may veto any line.

1. **Test paths.** Spec names spec files (`review-status`, `document-href`, `portal-lists`). The repo puts tests beside their subject as `*.unit.test.ts`, `*.int.test.ts`, and e2e as `e2e/*.e2e.test.ts` (`testing/README.md`). Map: `review-status` is `src/lib/review-status.unit.test.ts` and `src/lib/review-status.int.test.ts`; `document-href` is `src/lib/document-href.unit.test.ts`; `portal-lists` is `src/portal/lists/rows.int.test.ts` and `e2e/portal-lists.e2e.test.ts`.
2. **The owner-delete int test ships in 1b-1**, as `src/owner-delete.int.test.ts`, with the access change it proves. The spec files it under `portal-lists`.
3. **"A unit test settles whether Payload leaves an equal draft version after a publish"** is an int test (S2, U2): it needs the database.
4. **`StatusInput` carries `collection`.** `statusOf` calls `hasUnsentEdits`, which needs that collection's reviewed fields. Signature: `statusOf({ collection, doc, draft })`.
5. **Admin empty states** ("No one has written an article yet.", "No courses yet.") cannot show on a database that holds articles and courses, such as the prod clone. A dom test of `ListView` with zero rows proves them (L4). The e2e proves the fellow and student empty states with the fixture's `loners` (phase 1a C1).
6. **Filter chips show one group.** Spec: "All, Needs you, Drafts, Published", silent on what Drafts means. Plan: Needs you shows the Needs you group; Drafts shows In progress (Proposals on the fellow's Courses list); Published shows Published (Teaching now on the fellow's Courses list); All shows every group.
7. **Show more is a link.** `?published=2` (or `closed`, `teaching`) asks the server for 2 pages of 50. It works with no script. A small client part moves focus to the first new row and calls `announce()`. Spec is silent on the mechanism.
8. **Row title.** Spec is silent on which title a row shows. Plan: the latest version's title, in the reader's locale, else the other locale (as `NeedRow.label`), else "Untitled article" or "Untitled course". The owner sees what they write; an admin sees what waits.
9. **Header buttons follow the create rules.** **New article** shows when `mayAuthor(user)`; **Propose a course** when `mayTeach(user)`. `canAuthor` and `canTeach` call the same predicates. Spec names only the admin-with-no-person case.
10. **`documentHref` replaces no caller in 1b.** The spec ships it in 1b "because the list rows need it". Phase 2 changes the email and bell links, and their call shape changes there (one email per recipient), so moving them now would be done twice.
11. **Nav counts are `null` in 1b.** The spec's count for Articles and Courses ("own items in Needs you") comes from `needsCounts(user)`, which phase 1c ships ("the sidebar counts").
12. **The `request` table's withdraw case moves to phase 2.** Spec: "Approval and withdraw clear `request`" in the 1b hook table. An owner cannot withdraw before phase 2 (`AUTHOR_MOVES.submitted` is `[]`, `src/lib/review.ts:20`). S3 tests the rule on the move to `draft` that exists (an admin removal); phase 2's `review-events` test covers withdraw.

## Ends when

The spec's Phase 1b line, by clause.

1. `review-status` passes: S2, S3 (`src/lib/review-status.unit.test.ts`, `src/lib/review-status.int.test.ts`).
2. `document-href` passes: S5 (`src/lib/document-href.unit.test.ts`).
3. `portal-lists` passes: L3 (`src/portal/lists/rows.int.test.ts`), L6 (`e2e/portal-lists.e2e.test.ts`). The owner-delete case: S6 (`src/owner-delete.int.test.ts`, Deviation 2).
4. The audit snapshot holds the one changed row, `collection:articles` `delete` (S6).

Scope check, from the spec's Phase 1b Scope line: `statusOf`, `waitsOn`, `neverPublished` (S2); `reviewed-fields.ts` (S1); the `request` change and its table (S3); `statusBadge`, `nextAction` (S4); `documentHref` (S5); owner delete with no button (S6); lists, nav items, empty states, paging (L1 to L6); Needs you group (L2, L3); header buttons to the admin create pages (L5); no applicant link and no Participants link on a course row (L4 test).

## Review Focus

The five inputs the spec implies and no clause tests, most likely first. Each has its test in the named task.

1. **An owner with no linked person.** `ownsVia` returns `false`; the list must render the empty state, not the public archive, and the header shows no create button. L3 "a reader with no person owns no row", L6.
2. **A never-published draft whose title changed only in autosaves.** The main row keeps the old title. The row shows the latest version's title. L3 "the row shows the newest title".
3. **A live document with an equal draft copy** (after a withdraw, a kept removal, or an autosave with no change). It reads `published` or `published_removal_kept`, not `published_unsent`, and sits in Published. S2, L3.
4. **Admin lists with other people's drafts.** An admin reads every row; the list leaves out other people's `draft` rows and their draft copies at `draft`. L3 "an admin does not see another owner's draft".
5. **Worst-case rows:** a 120-character Arabic title with no space, an English title in an Arabic page, a row with two badges at 390px, a course with no cycle and no type. L4 browser test, L7 break-ui.

## Decision log (structural)

Each problem, then its fix.

- P1. Four stored facts (`_status`, `review.status`, `review.request`, the latest version) make one state, and no code joins them. Fix: `statusInputOf` and `statusOf` in `src/lib/review-status.ts`, the one place that reads them.
- P2. `applyReview` clears `review.request` on every move but `submitted` (`src/lib/review-hooks.ts:169-173`), so a declined edit and a kept removal store the same facts. Fix: the S3 rule.
- P3. A move into `submitted` falls back to the stored `request` (`review-hooks.ts:172`), so an edit after a kept removal inherits `removal`. Fix: the S3 rule takes the write's `request`, else `changes`.
- P4. The owner delete rule is `WITH_OWNER` with `draft: true` (`Articles.ts:58`, `Courses.ts:109-113`), so a declined draft can never be deleted by its owner. Fix: `OWNER_DELETE` in `src/access.ts`. `WITH_OWNER` stays for publications and its other readers.
- P5. Who may create an article or a course is written inside `canAuthor` and `canTeach` only. The list header needs the same answer with no `req`. Fix: `mayAuthor(user)` and `mayTeach(user)`; the access rules call them.
- P6. Which fields review covers is written nowhere. Fix: `REVIEWED_FIELDS`, and a unit test that derives the owner-writable fields from the audit snapshot, so a new field fails until it is listed as reviewed or not.
- P7. Group membership could spread over each list page. Fix: `groupOf` in `src/portal/lists/groups.ts`, one pure table for every list and role.

Done means: a new reviewed collection needs one `REVIEWED_FIELDS` entry and one `groupOf` view; a new status key fails the `statusOf`, `statusBadge`, `nextAction` and `groupOf` table tests until each covers it. `src/lib/**` imports nothing from `src/portal/**` (S7 and L7 check with `rg -l "@/portal/" src/lib src/components src/i18n`).

## Open questions (product calls)

None block the plan. For the operator:

- Q1. Does `verify.sh` run an e2e spec against `cilas_empty` (`pnpm db:seed:empty`)? If yes, L6 adds the admin empty states on it and Deviation 5 goes.

---

## PR 1b-1. Status core (`portal/phase-1b-status`)

From `portal/integration`. No screen. Reviews: code-review, then security-review.

### Task S1: `reviewed-fields.ts`

**Skills:** tdd, payload (`.agents/skills/payload/SKILL.md`).

**Files:** Create `src/lib/reviewed-fields.ts`, `src/lib/reviewed-fields.unit.test.ts`.

**Interfaces:**

- Consumes: `REVIEWED` (`src/lib/reviewed-collections.ts`); `scripts/access-audit.snapshot.json` (test only).
- Produces: `type ReviewedCollection = (typeof REVIEWED)[number]['collection']`. `REVIEWED_FIELDS: Record<ReviewedCollection, readonly string[]>`, top-level field names. `NOT_REVIEWED: Record<ReviewedCollection | 'all', readonly string[]>`: `all` is `review`, `last_edited_by`, `updatedAt`, `createdAt`, `_status`; `articles` adds `publications` (a join); `courses` adds `syllabus` and `enrollments` (joins) and `first_day`, `last_day` (kept from the sessions, `Courses.ts:341-347`).

- [ ] **Step 1: Failing test.** "reviewed and not reviewed fields cover every owner-writable field of $collection": read the snapshot; take rows of `collection:$collection` whose `field` has no `.` and whose `rules.update` is `open`; expect that set to equal `REVIEWED_FIELDS[c]` plus `NOT_REVIEWED.all` plus `NOT_REVIEWED[c]`, with no name in both. "courses review fellows" (`REVIEWED_FIELDS.courses` contains `fellows`). Run `pnpm exec vitest run --project node src/lib/reviewed-fields.unit.test.ts`: FAIL, module missing.
- [ ] **Step 2: Implement.** Today's lists, from the snapshot: articles `title`, `cover_image`, `requested_tier`, `body`, `authors`, `credits`, `translation`, `tags`, `related_articles`, `meta`; courses `cover_image`, `title`, `subtitle`, `epigraph`, `description`, `fellows`, `course_type`, `location`, `teaching_languages`, `language_note`, `bibliography`, `facilitator_note`, `content_warning`, `syllabus_tentative`, `sessions`, `schedule`, `applicant_questions`, `meta`; publications `cover_image`, `title`, `subtitle`, `intro`, `kind`, `articles`, `editors`, `credits`, `produced_by`, `license`, `print_edition_url`, `meta`. Run: PASS. Commit.

### Task S2: `statusOf`, `statusInputOf`, `hasUnsentEdits`, `waitsOn`, `neverPublished`

**Skills:** tdd.

**Files:** Create `src/lib/review-status.ts`, `src/lib/review-status.unit.test.ts`, `src/lib/review-status.int.test.ts`.

**Interfaces:**

- Consumes: `ReviewState`, `ReviewRequest` (`src/lib/review.ts`); `REVIEWED_FIELDS`, `ReviewedCollection` (S1).
- Produces:
  - `type StatusKey = 'draft' | 'submitted' | 'changes_requested' | 'rejected' | 'published' | 'published_unsent' | 'published_edits' | 'published_removal' | 'published_edits_returned' | 'published_edits_declined' | 'published_removal_kept'`; `STATUS_KEYS: readonly StatusKey[]`.
  - `type ReviewedDoc = { id: number; _status?: 'draft' | 'published' | null; updatedAt: string; review?: { status?: ReviewState | null; request?: ReviewRequest | null } | null } & Record<string, unknown>`.
  - `type StatusInput = { collection: ReviewedCollection; doc: ReviewedDoc; draft: ReviewedDoc | null }` (Deviation 4).
  - `statusInputOf({ collection, main, latest }: { collection: ReviewedCollection; main: ReviewedDoc; latest: ReviewedDoc | null }): StatusInput`. `main` is the row of a `find` with `draft: false`. `latest` is the `version` of the latest version (`findVersions` with `latest: true`), with `id` set to the parent id, or null. Rule: when `neverPublished(main)`, `doc` is `latest ?? main` and `draft` is null; else `doc` is `main` and `draft` is `latest` when `latest._status === 'draft'` (U1), else null.
  - `statusOf(input: StatusInput, warn?: (message: string) => void): StatusKey`. Not live (`doc._status !== 'published'`): `review.status` gives `draft`, `submitted`, `changes_requested`, `rejected`; `approved` gives `draft` and calls `warn` with the id (spec, Errors). Live with no draft copy: `published`. Live with a copy: copy `submitted` gives `published_removal` when `request` is `removal`, else `published_edits`; `changes_requested` gives `published_edits_returned`; `rejected` with `removal` gives `published_unsent` when `hasUnsentEdits`, else `published_removal_kept`; `rejected` with `changes` or null gives `published_edits_declined`; `approved` or `draft` gives `published_unsent` when `hasUnsentEdits`, else `published`. `warn` defaults to `console.warn`.
  - `hasUnsentEdits(draft: ReviewedDoc, doc: ReviewedDoc, fields: readonly string[]): boolean`. False when `draft.updatedAt === doc.updatedAt` (U3). Else true when any field in `fields` differs after both values pass `canonical(value)`: object keys sorted, every key `id` whose value is a string dropped at any depth (Lexical node ids, block ids, array row ids), `undefined` and `null` equal. The values come with `locale: 'all'`, so a localized field is one object per locale.
  - `waitsOn(key: StatusKey): 'owner' | 'admin' | null` (spec table).
  - `neverPublished(main: ReviewedDoc): boolean`: `main._status === 'draft'`. It takes the main row only.

- [ ] **Step 1: Failing unit tests** (`pnpm exec vitest run --project node src/lib/review-status.unit.test.ts`). A table, one row per case, built with `doc(overrides)` and `copy(overrides)` in the test file:
  - "$facts reads $key" for every row of the spec's Status model table, plus: both `published_unsent` shapes (copy at `approved`, copy at `draft`); the third shape (changed copy at `rejected`, `removal`); a copy at `rejected` with `request: null` reads `published_edits_declined`; an equal copy at `rejected`, `removal` reads `published_removal_kept`; an equal copy at `approved` reads `published`.
  - "an unknown combination reads draft and warns with the id" (not live, `approved`; `warn` collects messages; one message holds the id).
  - "statusInputOf takes the latest version for a document never published" and "takes the main row and the draft copy for a live document" and "ignores a latest version that is the published one".
  - "hasUnsentEdits ignores Lexical node ids and array row ids", "sees a change in one locale only", "sees a fellow added", "is false when updatedAt is equal".
  - "waitsOn names admin for $keys, owner for $keys, nobody for the rest" (all 11 keys).
  - "neverPublished is true for a draft main row, also after a removal" (`_status: 'draft'`, `review.status: 'draft'`).
- [ ] **Step 2: Implement.** Run: PASS.
- [ ] **Step 3: Failing int tests** **[verify]** (`src/lib/review-status.int.test.ts`, `verify.sh --int-only <branch> <sha> src/lib/review-status.int.test.ts`). Setup as `src/lib/publishing.int.test.ts:18-63` (admin, author with person, `createTracker`). A local `facts(id)` reads `main` (`findByID`, `draft: false`, `locale: 'all'`, `depth: 0`) and `latest` (`findVersions`, `where: { parent: { equals: id }, latest: { equals: true } }`, `locale: 'all'`, `depth: 0`), both as the author with `overrideAccess: false`, and returns `statusOf(statusInputOf(...))`.
  - "a clean published article" (U1): created published by the admin; its latest version's `_status` is `published`; key `published`.
  - "approval leaves no draft copy" (U2): author edits a live article, submits, admin approves; key `published`.
  - "the updatedAt short cut" (U3): after the approval above, record whether the latest version's `updatedAt` equals the main row's; assert the recorded result; `hasUnsentEdits` is false either way.
  - "versions are gated" (U4): a second member's `findVersions` of the author's article returns no doc; the admin's returns it.
  - "a fellow edits a published course" (spec): fellow with a person, course published by the admin with the fellow in `fellows`; the fellow saves a new title (draft save): key `published_unsent`; the fellow submits with `request: 'changes'`: key `published_edits`; an anonymous `find` (`overrideAccess: false`, no user) still returns the old title.
  - Run: PASS after Step 2's code (these test Payload's behaviour, so they may pass at once; record that in the commit). A failing premise takes its fallback from the Status table, and the commit says which. Commit.

### Task S3: Keep `review.request` until the next move

**Skills:** tdd, payload.

**Files:** Modify `src/lib/review-hooks.ts:169-174`, `src/lib/review-status.int.test.ts`.

**Interfaces:**

- Consumes: `applyReview` (`review-hooks.ts:120-183`); the `live` flag (`req.context[LIVE]`).
- Produces: the rule, on a live document (`live` is true):
  - `to === 'submitted'` and `from !== 'submitted'`: `data.review?.request ?? 'changes'`. No fallback to the stored value.
  - `to === 'submitted'` and `from === 'submitted'`: `originalDoc?.review?.request ?? data.review?.request ?? 'changes'`, so an admin save of a waiting removal keeps `removal`.
  - `to` is `changes_requested` or `rejected`: `data.review?.request ?? originalDoc?.review?.request ?? null` (U6).
  - `to` is `draft` or `approved`: `null`.
  - Not live: `null`, as today.

- [ ] **Step 1: Failing int table** **[verify]**, in `review-status.int.test.ts`, `describe('the request rule')`, one live article per row (made published by the admin), writes as `/admin` sends them (`src/components/admin/submit-for-review.tsx:62-67`, `:173-178`):
  1. "a kept removal, then a resubmitted edit, asks for changes": author `submitted` + `removal`; admin `rejected` with a note; key `published_removal_kept`; author edits the title and sends `submitted` with no `request`; stored `request` is `changes`; key `published_edits`.
  2. "an admin save at submitted keeps removal": author `submitted` + `removal`; admin saves `review: { status: 'submitted' }`; `request` is `removal`.
  3. "approval clears request": author `submitted` + `changes`; admin `approved` with `_status: 'published'`; `request` is null.
  4. "a move to draft clears request": author `submitted` + `removal`; admin removes it (`_status: 'draft'`, `review.status: 'draft'`, as `SAVES.removed`); `request` is null. This is the only move to `draft` that exists in 1b: the owner's withdraw ships in phase 2 (`AUTHOR_MOVES.submitted` is `[]`, `review.ts:20`), and an admin draft save that changes the status throws (`review-hooks.ts:135-141`). Phase 2's `review-events` int test covers withdraw.
  5. "changes_requested on a live document keeps request": author `submitted` + `changes`; admin `changes_requested` with a note and no `request`; `request` is `changes`; key `published_edits_returned`.
  6. "rejected on a live document keeps request": as 5 with `rejected`; key `published_edits_declined`. With `removal` instead: key `published_removal_kept`.
  7. "a document that is not live stores no request": a never-published draft submitted with `request: 'removal'` stores null.
  Expected before Step 2: rows 1, 5 and 6 FAIL (today `request` is null after `changes_requested` and `rejected`, `review-hooks.ts:170-173`). Rows 2, 3, 4 and 7 pass today and guard the rule.
- [ ] **Step 2: Implement** the rule in `applyReview`. Update the comment at `review-hooks.ts:169` to the new rule. Run **[verify]**: the table passes; `src/lib/publishing.int.test.ts` still passes (its "publishes the change only when an admin approves it" expects `request` null after approval). Commit.

### Task S4: `statusBadge` and `nextAction`

**Skills:** tdd.

**Files:** Modify `src/lib/review-status.ts`, `src/lib/review-status.unit.test.ts`.

**Interfaces:**

- Consumes: `StatusKey` (S2); `BadgeTone` (`src/components/arc/badge/badge.tsx:20`, type import only).
- Produces: `type StatusBadge = { tone: BadgeTone; icon: StatusIcon; labelKey: \`status.${string}\` }`, where `StatusIcon` is the union of the spec's lucide names (`pencil-line`, `clock`, `message-square-warning`, `circle-x`, `globe`, `file-pen`, `file-clock`, `archive-x`). `statusBadge(key: StatusKey): StatusBadge[]`: one badge, or two on a live key (Published first). Keys under `Portal.`: `status.draft`, `status.submitted`, `status.changesRequested`, `status.declined`, `status.published`, `status.unsentEdits`, `status.editsInReview`, `status.removalRequested`, `status.editsDeclined`, `status.keptOnSite`. The spec gives `published_edits_returned`'s second badge as Changes requested with `--warning` and no icon, and `published_edits_declined`'s and `published_removal_kept`'s with no icon: they reuse `message-square-warning`, `circle-x` and `archive-x`. `nextAction(key: StatusKey, viewer: 'owner' | 'admin'): { labelKey: \`next.${string}\` } | null`: the spec table's two columns, `null` where it says "none". Keys: `next.owner.<key>` and `next.admin.<key>` in camel case.

- [ ] **Step 1: Failing tests:** "statusBadge($key) gives $badges" (all 11 rows: tone, icon, label key, count); "only published keys use the success tone" (spec: green means only published); "nextAction($key, $viewer)" (22 rows). Run: FAIL.
- [ ] **Step 2: Implement** as one `Record<StatusKey, ...>` per function, so a new key is a type error. Run: PASS. Commit.

### Task S5: `documentHref`

**Skills:** tdd.

**Files:** Create `src/lib/document-href.ts`, `src/lib/document-href.unit.test.ts`.

**Interfaces:**

- Consumes: `ReviewedCollection` (S1).
- Produces: `type HrefViewer = 'owner' | 'admin' | 'fellow'`. `documentHref({ collection, id, viewer, waiting, locale }: { collection: ReviewedCollection | 'users'; id: number; viewer: HrefViewer; waiting: boolean; locale: string }): string`. In 1b it returns `/admin/collections/${collection}/${id}` for every input. A locale-free path, as the spec's stored links are. Phase 2 adds the portal branches in this function.

- [ ] **Step 1: Failing test:** "documentHref gives the admin URL for $collection, $viewer, waiting $waiting, $locale": every combination of the four collections, three viewers, two `waiting` values and `en`, `ar` (48 rows). Run: FAIL.
- [ ] **Step 2: Implement.** Run: PASS. Commit.

### Task S6: `OWNER_DELETE`, `mayAuthor`, `mayTeach`, and the audit

**Skills:** tdd, payload.

**Files:** Modify `src/access.ts` (beside `WITH_OWNER`, `:177-182`; `canTeach`, `:174-175`; `canAuthor`, `:222-225`), `src/collections/Articles.ts:58`, `src/collections/Courses.ts:108-113` and the `blockedUnless` message at `:133`, `scripts/access-audit.snapshot.json` (generated). Create `src/owner-delete.int.test.ts`.

**Interfaces:**

- Consumes: `isAdminOrOwn` (`access.ts:199-215`); `rest` (`testing/payload-rest.test-utils.ts`) for the course endpoint; `createTracker`, `uniq`, `uniqEmail` (`testing/payload.fixture.ts`).
- Produces: `OWNER_DELETE: Where = { 'review.status': { in: ['draft', 'changes_requested', 'rejected'] } }`, with a doc comment: an owner deletes their own document while it is with them or after a decline, never once submitted; with `draft: true` it is never published (`neverPublished`). Articles `delete` and `deleteCourse` use `{ draft: true, while: OWNER_DELETE }`. `WITH_OWNER` stays (publications, `review-hooks.ts` comments). `mayAuthor(user: RoleHolder): boolean` and `mayTeach(user: RoleHolder): boolean`, exported; `canAuthor` is `({ req }) => mayAuthor(req.user)` and `canTeach` is `({ req }) => mayTeach(req.user)`, names unchanged. Course message: `You can delete only your own draft or declined courses.`

- [ ] **Step 1: Failing int tests** **[verify]** (`src/owner-delete.int.test.ts`), as a member author and a fellow with persons, documents made through the review path (author submits, admin declines with a note):
  - "an owner deletes a declined, never-published article".
  - "an owner deletes a declined course that has a session" through `rest('POST', 'courses/{id}/delete', { token })`, with the fellow's token from `payload.login`; 200; the course and its session are gone (`src/lib/course-delete.ts` removes sessions with `overrideAccess: true`).
  - "an owner cannot delete a submitted article" (throws, row stays) and "...a submitted course" (403 from the endpoint).
  - "an owner cannot delete a published article" (throws), as today.
  - "another member cannot delete the declined article" (throws).
  Expected: the two "deletes" tests FAIL (403 or `Forbidden`).
- [ ] **Step 2: Implement.** Run **[verify]**: PASS. Also `src/access.unit.test.ts`, `src/portal-access.int.test.ts` and `src/lib/publishing.int.test.ts` pass.
- [ ] **Step 3: Audit.** `pnpm audit:access` (Mac worktree). Expected diff: `collection:articles` `delete` becomes `isAdminOrOwn(ownsVia(authors),draft,while={"review.status":{"in":["draft","changes_requested","rejected"]}})#0286aa49`; rows whose rule is `canAuthor` or `canTeach` directly change only their hash. Any other row: stop and report. Commit the code, the test and the snapshot together.

### Task S7: Review, full suite, open PR 1b-1

**Skills:** code-review, then security-review.

**Interfaces:** Consumes S1 to S6. Produces PR 1b-1.

- [ ] **Step 1: code-review** against `portal/integration`, with the spec's Status model and Lists (Delete) sections as the issue.
- [ ] **Step 2: security-review.** Write in the PR: the delete rule now admits `rejected` with `draft: true` for articles (snapshot row) and courses (`deleteCourse`, behind `POST /api/courses/{id}/delete`, which the audit does not see; read `blockedUnless`, `src/forms/delete-endpoints.ts:67-81`, to confirm it counts with the same `where`); a submitted or published document stays undeletable by its owner (S6 tests); the `request` rule changes stored data only on live documents, and only `review-hooks.ts` writes it; `review-status.ts` and `document-href.ts` read nothing; `rg -l "@/portal/" src/lib src/components src/i18n` prints nothing.
- [ ] **Step 3:** Fix. **[verify]** the full suite (`verify.sh <branch> <sha>`). Per-PR step 5. Open `feat(review): one status model, the request rule and owner delete (portal phase 1b, PR 1)`. Blast Radius: owners may now delete declined drafts in `/admin` too; a decline on a live document now keeps `review.request`, which `/admin`'s removal note reads (`submit-for-review.tsx:184`); no screen changes.

## PR 1b-2. Lists (`portal/phase-1b-lists`)

From `portal/phase-1a-shell` with `portal/phase-1b-status` merged in. Changes portal screens: operator review before merge (phase 1a's gate for PR C).

### Task L1: Messages and nav items

**Skills:** tdd, better-writing, then humanizer.

**Files:** Modify `src/portal/nav/portal-nav.ts`, `portal-nav.unit.test.ts`, `nav-icons.ts` (all from PR C, task C2), `messages/en.json`, `messages/ar.json`, `src/lib/review-status.unit.test.ts`.

**Interfaces:**

- Consumes: `PortalNavItem`, `portalNav` (C2); `isAdminUser`, `isFellowUser` (`src/access.ts`); `statusBadge`, `nextAction`, `STATUS_KEYS` (S2, S4).
- Produces: `PortalNavItem['key']` adds `'articles' | 'courses'`; `PortalNavIcon` adds `'articles' | 'courses'` (lucide `file-text`, `book-open`). Items, in order after Home: Articles (`/spaces/articles`; group `myWork` for a student or a fellow, `admin` for an admin), Courses (`/spaces/courses`; `myWork` for a fellow, `admin` for an admin, none for a student). `count: null`, `external: false` (Deviation 11). Admin order in the `admin` group: Articles, Courses, Open dashboard.
- Messages under `Portal`, English and Arabic (gender-neutral, ICU plurals): `nav.articles` "Articles", `nav.courses` "Courses"; every `status.*` and `next.*` key of S4 with the spec's English labels and next-action lines; `lists.*`: `myArticles` "My articles", `allArticles` "All articles", `myCourses` "My courses", `allCourses` "All courses", `newArticle` "New article", `proposeCourse` "Propose a course", `group.needsYou` "Needs you", `group.inProgress` "In progress", `group.withEditors` "With editors", `group.published` "Published", `group.closed` "Closed", `group.teachingNow` "Teaching now", `group.proposals` "Proposals", `group.waitingOnAuthor` "Waiting on the author", `groupCount` "{name}, {count, plural, one {# item} other {# items}}", `chips.label` "Filter", `chips.all` "All", `chips.needsYou` "Needs you", `chips.drafts` "Drafts", `chips.published` "Published", `search` "Search", `noMatch` "No articles match \"{query}\".", `noMatchCourses` "No courses match \"{query}\".", `clearSearch` "Clear search", `showMore` "Show more", `moreRows` "{count, plural, one {# more row.} other {# more rows.}}", `loadError` "The list could not load.", `retry` "Retry", `untitledArticle` "Untitled article", `untitledCourse` "Untitled course", `meta.updated` "Updated {when}", `meta.waiting` "Waiting {days, plural, one {# day} other {# days}}", `meta.held` "{held} of {total} held", `tier.public` "Public", `tier.community` "Community"; the empty states of the spec's Onboarding list for Articles, All articles, Courses (fellow), All courses (admin).

- [ ] **Step 1: Failing tests.** In `portal-nav.unit.test.ts`: "roles %j see %j" updated (`member`, `non_degree_seeking`: `['home', 'articles']`; `fellow`: `['home', 'articles', 'courses']`; `admin`, `super_admin`: `['home', 'articles', 'courses', 'openDashboard']`); "a student's Articles item is in My work, an admin's in Admin". In `review-status.unit.test.ts`: "every status and next-action key exists in both languages" (all keys `statusBadge` and `nextAction` return, read from `messages/{en,ar}.json`). Run: FAIL.
- [ ] **Step 2: Implement.** Run: PASS. Commit.

### Task L2: The group table

**Skills:** tdd.

**Files:** Create `src/portal/lists/groups.ts`, `groups.unit.test.ts`.

**Interfaces:**

- Consumes: `StatusKey`, `waitsOn` (S2).
- Produces: `type ListView = 'ownerArticles' | 'fellowCourses' | 'admin'`; `type GroupId = 'needsYou' | 'waitingOnAuthor' | 'inProgress' | 'withEditors' | 'proposals' | 'teachingNow' | 'published' | 'closed'`; `GROUPS: Record<ListView, readonly GroupId[]>` in the spec's order; `PAGED: ReadonlySet<GroupId>` = `published`, `teachingNow`, `closed`; `groupOf(key: StatusKey, view: ListView, row: { hasSpace: boolean }): GroupId`; `chipGroup: Record<ListView, Record<'needsYou' | 'drafts' | 'published', GroupId>>` (Deviation 6).
- The table (a row goes to the first group that matches):

| View            | needsYou                       | then                                                                                       |
| --------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| `ownerArticles` | `waitsOn(key) === 'owner'`     | inProgress: `draft`, `published_unsent`, `published_edits_declined`; withEditors: `submitted`, `published_edits`, `published_removal`; published: `published`, `published_removal_kept`; closed: `rejected` |
| `fellowCourses` | `waitsOn(key) === 'owner'`     | teachingNow: any `published*` key, or `hasSpace`; proposals: `draft`, `submitted`; closed: `rejected` |
| `admin`         | `waitsOn(key) === 'admin'`     | waitingOnAuthor: `waitsOn(key) === 'owner'`; inProgress: `draft`; published: `published`, `published_unsent`, `published_edits_declined`, `published_removal_kept`; closed: `rejected` |

- [ ] **Step 1: Failing test:** "groupOf($key, $view) is $group" for all 11 keys x 3 views, plus "a fellow's draft course with a space is teaching now"; "every key lands in a group of its view's GROUPS"; "only work groups load in full" (`PAGED`). Run: FAIL.
- [ ] **Step 2: Implement** as a `Record` per view. Run: PASS. Commit.

### Task L3: The row loader

**Skills:** tdd, payload.

**Files:** Create `src/portal/lists/rows.ts`, `src/portal/lists/course-meta.ts`, `course-meta.unit.test.ts`, `rows.int.test.ts`, `testing/portal-lists.fixture.ts`.

**Interfaces:**

- Consumes: `statusInputOf`, `statusOf`, `waitsOn`, `REVIEWED_FIELDS` (S1, S2); `groupOf`, `GROUPS`, `PAGED` (L2); `ownsViaAuthors`, `ownsViaFellows`, `isAdminUser`, `isFellowUser`, `personOf` (`src/access.ts`); `mediaPopulate`, `mediaThumbnail` (`src/lib/media-image.ts`); `meetingsOf` (`src/lib/meetings.ts`); `cycleTitle` (`src/lib/cycle.ts`); `portalWorld` (phase 1a A4, C1).
- Produces:
  - `type ListRow = { id: number; collection: 'articles' | 'courses'; key: StatusKey; group: GroupId; title: string | null; cover: string | null; updatedAt: string; waitingSince: string | null; owners: string[]; tier: 'public' | 'community' | null; course: { type: CourseType | null; cycle: string | null; held: number; total: number } | null }`. `title` is null when no locale has one; the view prints the untitled label (Deviation 8). `waitingSince` is the latest version's `updatedAt` when `waitsOn(key) === 'admin'`. `owners` holds names on an admin list only.
  - `type ListGroup = { id: GroupId; rows: ListRow[]; total: number; hasMore: boolean }`.
  - `type ListQuery = { collection: 'articles' | 'courses'; view: ListView; search: string | null; only: GroupId | null; pages: Partial<Record<GroupId, number>> }`.
  - `listViewOf(user: User, collection: 'articles' | 'courses'): ListView | null`: `admin` for an admin; `ownerArticles` for articles; `fellowCourses` for a fellow on courses; null otherwise (the page then returns not found).
  - `loadList(payload: Payload, user: User, query: ListQuery, locale: Locale): Promise<ListGroup[]>`, every read gated (`user`, `overrideAccess: false`, `depth: 0` except `populate` for covers, owner names and cycle titles).
  - `heldCount(sessions: SessionTimes[], now: Date): { held: number; total: number }` (`course-meta.ts`): `total` counts sessions that are not cancelled; `held` those whose last meeting ended before `now`.
- How `loadList` reads (the invariants; the implementer picks the query code):
  - **Ownership.** Owner views add `ownsVia…(user)` to every main query; with no person, return `[]` with no query. Admin views add `or: [{ 'review.status': { not_equals: 'draft' } }, ownsViaAuthors|Fellows(user) || { id: { equals: 0 } }]` to main queries, and leave out other people's draft copies whose `version.review.status` is `draft`.
  - **Work groups load in full** (every group not in `PAGED`): (a) main rows with `_status: draft` and the `review.status` values of the view's work keys; (b) live rows with a draft copy, from `findVersions` with `latest: true`, `version._status: draft` and `parent._status: published` (U5). Each candidate gets its latest version (`findVersions`, `parent in ids`, `latest: true`, `locale: 'all'`, `select` of `REVIEWED_FIELDS` plus `title`, `review`, `updatedAt`, `_status`) and its key. A candidate whose group is paged leaves the work set.
  - **Paged groups** load in order, 50 rows times `pages[group]` (default 1), `sort: '-updatedAt'`, with `id not_in` the ids already placed. `published`: main `_status: published`. `teachingNow`: main `_status: published` or `id in` the reader's courses that have a space (a gated `find` of `spaces`, `select: { course: true }`; a fellow who cannot read a space leaves that course in Proposals or Closed). `closed`: main `_status: draft`, `review.status: rejected`.
  - **Search.** `search` adds `title like search` to each main query, and the same on `version.title` for the draft copies; the union decides. `only` loads that one group.
  - Groups with no rows are dropped. `total` comes from the query's `totalDocs` for a paged group, from the row count for a work group.

- [ ] **Step 1: Fixture.** `listWorld(payload, track, world)` in `testing/portal-lists.fixture.ts` returns `{ articles: Record<StatusKey, number>, courses: Record<'published' | 'published_edits' | 'draft' | 'rejected', number>, bulk: number[] }`. It makes, through the real review path (author writes as the author with `overrideAccess: false`; admin decisions as the admin): one student article for each of the 11 keys; for the fellow, a published course with edits waiting (`published_edits`, two badges), a draft proposal, a declined one with a session; for the student, 60 published articles (`bulk`, made published by the admin with `overrideAccess: true`, titles `uniq('Bulk')`). Every row through `track`.
- [ ] **Step 2: Failing tests.** `course-meta.unit.test.ts`: "heldCount counts sessions whose last meeting has ended", "a cancelled session counts in neither". `rows.int.test.ts` **[verify]**, with `portalWorld` and `listWorld`:
  - "each article reads its key and sits in its group" (the student's list: the 11 rows, each `key` and `group` as L2's table).
  - "the row shows the newest title" (the `draft` article autosaved to a new title as the author: the row's title is the new one; Review Focus 2).
  - "finds the draft copy of a live article" (U5; `published_unsent` is in In progress, `published_edits` in With editors).
  - "an equal draft copy sits in Published" (Review Focus 3: the `published_removal_kept` row is in Published).
  - "Published shows 50 rows and has more" (60 bulk rows: `published` group `rows.length` 50, `total` 60 or more, `hasMore` true; with `pages: { published: 2 }` all bulk ids are in it; no id is in two groups).
  - "a student sees only their own articles" (no row whose id is not the student's; a public article of another author is absent).
  - "a reader with no person owns no row" (`[]`; Review Focus 1).
  - "an admin does not see another owner's draft" (Review Focus 4: the student's `draft` article is not in the admin list; its `submitted` one is in Needs you; the admin's own draft is in In progress).
  - "the fellow's live course with edits waiting is teaching now and reads published_edits".
  - "search finds a row by its draft title" and "only loads one group".
  Run: FAIL, module missing.
- [ ] **Step 3: Implement.** Run **[verify]**: PASS. A U5 failure takes its fallback; the commit says which. Commit.

### Task L4: The row, the list view, the page header and the empty states

**Skills:** tdd, modern-web-guidance, arc, better-layout, better-typography, better-accessibility, better-writing, then humanizer.

**Files:** Create `src/portal/lists/list-row.tsx`, `list-view.tsx`, `page-header.tsx`, `lists.module.css`, `list-view.dom.test.tsx`, `list-row.browser.test.tsx`.

**Interfaces:**

- Consumes: `ListRow`, `ListGroup` (L3); `statusBadge`, `nextAction` (S4); `documentHref` (S5); Arc `Badge`; `PortalEmptyState` (C6); next-intl `getTranslations`, `getFormatter` (`relativeTime`); `COURSE_TYPE_OPTIONS` (`src/fields/course-type.ts`); `renderWithIntl` (`testing/intl.test-utils.tsx`).
- Produces:
  - `PortalPageHeader({ title, subtitle, primary, secondary }: { title: string; subtitle?: string; primary?: { label: string; href: string; external: boolean }; secondary?: { label: string; href: string; external: boolean } }): React.JSX.Element` (server): `h1` 28px, subtitle 15px, at most one primary (`--foreground` fill, pill) and one secondary (1px `--border-strong`). An external `href` (`/admin/...`) renders `<a>`, a full load, as phase 1a's `external` nav item.
  - `ListRowView({ row, viewer, locale }: { row: ListRow; viewer: 'owner' | 'admin'; locale: Locale }): Promise<React.JSX.Element>` (server): an `<li>` container (spec, Rows and cards with actions): the 40x40 slot at `--radius-inner` (`<img alt="">` from `row.cover`, else an empty `--surface-muted` box with no letter and no icon); the title as the one link, to `documentHref({ collection, id, viewer, waiting: waitsOn(key) === 'admin', locale })`, an `<a>` (admin URL, full load), 15px, one line, ellipsis, `dir="auto"`, in `<bdi>`; the meta line 13px (article: "Updated {when} · {tier}", admin adds owner names and "Waiting {days}" when `waitingSince`; course: "{type} · {cycle} · {held} of {total} held", each part left out when it is missing); the badges (Arc `Badge` with the `StatusBadge` icon from lucide, label from `Portal`); the next-action line. A course row has no applicant link and no Participants link.
  - `ListView({ groups, view, empty, locale, query }: { groups: ListGroup[]; view: ListView; empty: { title: string; body: string; next?: string; action?: { label: string; href: string } }; locale: Locale; query: ListQuery }): Promise<React.JSX.Element>` (server): no groups and no search: `PortalEmptyState` with `empty`. No groups with a search: "No articles match "{query}"." and **Clear search** (a link to the URL without `q`). Else one `<section aria-labelledby>` per group with an `<h2>` holding the name and the count (`lists.groupCount`, counts in `tabular-nums`), then an `<ol>` of rows, then L5's `ShowMore` when `hasMore`.

- [ ] **Step 1: Failing dom tests** (`pnpm exec vitest run --project dom src/portal/lists/list-view.dom.test.tsx`; server components are awaited and rendered as phase 1a's tests do; rows from a `listRow(overrides)` helper in the test file):
  - "every row has a slot, a badge and a next-action line" (one row per key).
  - "a row with no cover shows an empty slot with no text".
  - "the title is the only link of the row and opens the admin URL".
  - "a course row has no applicant link and no Participants link" (exactly one link per row).
  - "a live course with edits waiting shows two badges".
  - "groups keep their order, each a section with an h2 that names its count".
  - "the admin row names the owner and how long it waits".
  - "an empty list shows its role's empty state" for Articles (owner: **Write an article** to `/admin/collections/articles/create`, then "Drafts save. Nothing is sent until you submit."), All articles (no button), Courses (fellow: **Propose a course**), All courses (admin: **Open dashboard** to `/admin`). Deviation 5.
  - "a search with no result offers Clear search".
  Run: FAIL.
- [ ] **Step 2: Failing browser test** **[verify]** (`list-row.browser.test.tsx`): "a 120-character Arabic title with no space stays on one line at 390 and 1440, in rtl and ltr" (the row's `scrollWidth` at most its `clientWidth`; the title ends in an ellipsis); "two badges and the meta line fit at 320"; "the row link is at least 24x24, and 44x44 under (pointer: coarse)" (`emulateMedia`, or record that it cannot emulate `pointer` and move the check to L6). FAIL.
- [ ] **Step 3: Implement.** Run both: PASS. Commit.

### Task L5: The pages, chips, search and Show more

**Skills:** tdd, modern-web-guidance, better-accessibility.

**Files:** Create `src/app/(frontend)/[locale]/(portal)/spaces/articles/page.tsx`, `.../spaces/courses/page.tsx`, `src/portal/lists/list-chips.tsx`, `show-more.tsx`, `show-more.dom.test.tsx`, `list-page.tsx`.

**Interfaces:**

- Consumes: `currentReader` (cached, C8); `listViewOf`, `loadList` (L3); `ListView`, `PortalPageHeader` (L4); `chipGroup`, `PAGED` (L2); `mayAuthor`, `mayTeach` (S6); `announce` (C4); Arc `SearchField`; `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (`searchParams` is a Promise) and `02-components/link.md` (`scroll={false}`).
- Produces:
  - `ListPage({ collection, locale, searchParams }: { collection: 'articles' | 'courses'; locale: Locale; searchParams: Record<string, string | string[] | undefined> }): Promise<React.JSX.Element>` (`list-page.tsx`, server). Both route files only await `params` and `searchParams` and render it. It reads the user; `listViewOf` null calls `notFound()` (a student on Courses), with no boundary above it. Title: `myArticles`, `allArticles`, `myCourses`, `allCourses`. Primary button: **New article** to `/admin/collections/articles/create` when `mayAuthor(user)`; **Propose a course** to `/admin/collections/courses/create` when `mayTeach(user)`. URL: `q` (search), `show` (`needsYou`, `drafts`, `published`, or absent for All), and one page count per paged group (`published`, `teachingNow`, `closed`; integers from 1 to 20, anything else is 1). On a failed `loadList` it logs the error and renders the header and "The list could not load." with **Retry** (a link to the same URL).
  - `ListChips({ current, base })` (server): shows only when the list has more than 6 rows in total; one `<nav aria-label={chips.label}>` of links (All, Needs you, Drafts, Published), the current with `aria-current="true"`; each link at least 24x24, 44x44 under `(pointer: coarse)`. The search field shows under the same rule: a GET `<form role="search">` with Arc `SearchField` `name="q"` and the current `show`.
  - `ShowMore({ group, href, firstNewIndex })` (client): a `next/link` with `scroll={false}` to `href` (the page count plus one). After the new rows render, focus moves to the row at `firstNewIndex` of that group and `announce(t('lists.moreRows', { count }))` runs once.

- [ ] **Step 1: Failing dom test** (`show-more.dom.test.tsx`): "after Show more, focus moves to the first new row and one announcement says how many" (render a group with 50 rows and `ShowMore`; rerender with 60; the 51st row's link has focus; the live region read once "10 more rows."). Run: FAIL.
- [ ] **Step 2: Implement** the pages, chips, search and `ShowMore`. Run: PASS. `pnpm exec tsgo --noEmit` exits 0. Commit.

### Task L6: The `portal-lists` e2e matrix

**Skills:** tdd, better-accessibility.

**Files:** Create `e2e/portal-lists.e2e.test.ts`.

**Interfaces:**

- Consumes: `portalWorld`, `holdSpacesMode`, `login`, `localePath`, `ROLES`, `LOCALES`, `WIDTHS`, `MESSAGES` (phase 1a A4, C1); `listWorld` (L3); AxeBuilder (C1).
- Matrix: role x locale x 1440/390, as phase 1a's Matrix rule. Exemptions (phase 1a Deviation 19 pattern): a student opens Courses only in "a student gets not found on Courses" (role); the empty-state test runs for fellow and student only (Deviation 5); "Show more moves focus" runs at 1440 and 390 in English only (one client code path, no locale branch).

- [ ] **Step 1: Failing e2e** **[verify]** (`verify.sh --e2e-only <branch> <sha> e2e/portal-lists.e2e.test.ts`). `test.describe.configure({ mode: 'serial', timeout: 300_000 })`; `holdSpacesMode` held `on` in `beforeAll`.
  - "the nav opens Articles and Courses ($role $locale $width)": the nav item (390: inside `openMore`) lands on `/{locale}/spaces/articles`, 200, `h1` "My articles" or "All articles"; Courses for fellow and admin.
  - "every row has a slot, a badge and a next-action line": on the student's and the fellow's lists, each `li` in a group section has the slot, at least one badge and the next-action line.
  - "the group order holds": the `h2`s in the spec's order for the role.
  - "Needs you holds the rows that wait on the reader": the student's `changes_requested` and `published_edits_returned` rows are in Needs you; the admin's Needs you holds the student's `submitted`, `published_edits` and `published_removal` rows.
  - "Published shows 50 rows and Show more" (student): with 60 bulk rows and one row that waits on the reader, Needs you shows that row; Published shows 50 rows and **Show more**.
  - "Show more moves focus to the first new row": keyboard only, Tab to **Show more**, Enter; the 51st row's link is focused; the URL holds `published=2`.
  - "a live course with edits waiting shows two badges" (fellow).
  - "header buttons open the admin create pages": **New article** `href` is `/admin/collections/articles/create`; **Propose a course** for the fellow and for an admin with a person; none for the fixture admin, who has no person.
  - "a course row has no applicant link and no Participants link".
  - "filter chips and search show only above 6 rows": the student (more than 6) sees them; a chip click sets `show` and the current chip has `aria-current="true"`; a search with no match shows "No articles match "{q}"." and **Clear search**.
  - "an empty list shows the empty state" (fellow and student loners from C1: the `h2` and body of their role's empty state).
  - "a student gets not found on Courses" (status 404 on a hard load).
  - "axe finds no violation on the lists" (C1's tags; light and dark at 1440; a list with a search open).
  - "reflow at 320 and 720" (student, English and Arabic): `scrollWidth <= innerWidth`.
  - "lists load with spaces off" (`set('off')` then `set('on')` in `finally`; one role per list; the spec's Navigation tests require Articles and Courses to load).
  Run: FAIL only where L1 to L5 are missing; with them in place, PASS. Commit.

### Task L7: Review, full suite, open PR 1b-2

**Skills:** ux-auditor, better-interface, then break-ui; code-review, then security-review.

**Interfaces:** Consumes L1 to L6. Produces PR 1b-2.

- [ ] **Step 1: Screen reviews** on the Mac: `verify.sh --keep --no-tests <branch> <sha>` keeps the app running; a scratch script (not committed) runs `portalWorld` and `listWorld` against the runner's database and prints the accounts. ux-auditor and better-interface on both lists, as each role, 1440 and 390, English and Arabic, light, dark, more contrast.
- [ ] **Step 2: break-ui** with the `agent-browser` CLI, headless, against the kept app: a 120-character Arabic title, a Latin title in an Arabic row, 0 rows, 1 row, 7 rows (chips appear), 60 rows, a course with no cycle and no type, a row with two badges at 320px. `agent-browser close` when done. Screenshots and findings in a PR comment.
- [ ] **Step 3: code-review** (spec Lists, Status model, Navigation as the issue), then **security-review**. Write in the PR: every list read is gated and owner views add the ownership `where` (L3 test); an admin list leaves out other people's drafts; `listViewOf` refuses a student on Courses before any read; links in rows are admin URLs only; the URL params are parsed to fixed values; no new projection; `rg -l "@/portal/" src/lib src/components src/i18n` prints nothing.
- [ ] **Step 4:** Fix. **[verify]** the full suite. Per-PR step 5. Open `feat(portal): Articles and Courses lists (portal phase 1b, PR 2)`.
