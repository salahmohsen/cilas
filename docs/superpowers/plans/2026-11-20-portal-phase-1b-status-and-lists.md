# Portal phase 1b: status and lists. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every reviewed document one status from one function, and give fellows, students and admins an Articles list and a Courses list in the portal that show that status, the next action and the work that waits on the reader.

**Architecture:** PR 1b-1 adds pure rules in `src/lib/` (`review-status.ts`, `reviewed-fields.ts`, `document-href.ts`), changes how the review hook keeps `review.request`, and lets an owner delete a declined, never-published item. It has no screen. PR 1b-2a adds the list data in `src/portal/lists/` (the group table, the row loader, the course meta) with its fixture and int test. It has no screen and needs nothing of PR C. PR 1b-2b adds the screens: the row, the list view, two pages under `(portal)/spaces/`, two items in `portalNav`, and the e2e.

**Tech stack:** Next.js 16.4.6 App Router, React 19.2.6, next-intl 4, Payload 3.91.0 (Postgres), Arc UI (`src/components/arc`), Vitest 4, Playwright 1.58.2, `@axe-core/playwright` (from phase 1a PR C).

**Spec:** `docs/superpowers/specs/2026-11-18-portal-design.md`: Status model, Lists, Document links, Navigation, Onboarding (empty states), Tests, Migrations, Phase 1b. The spec wins where they differ, except for the Deviations below.

**Baseline:** `docs/superpowers/plans/2026-11-19-portal-phase-1a-frame-and-shell.md`. On `main`: phase 1a PR A (#50), PR B (#49), PR D (#48) and PR F (#51), as squash merges. PR C (`portal/phase-1a-shell`) is in progress: at `d49c1d0b` (checked 2026-11-21) it holds C1 to C7; C8 to C12 are not there yet. This plan points at phase 1a sections by name and does not copy them.

**Status.** Nothing is built. No command ran: the plan was checked by reading `origin/main` at `57248c77`, `origin/portal/phase-1a-shell` at `d49c1d0b`, the Payload 3.91.0, next-intl 4.14.9 and Next 16.4.6 source. Each "Expected" line is a prediction. These premises are unproven until their named test runs. Each has a fallback.

| #   | Premise                                                                                                                             | Test that proves it                        | Fallback                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| U1  | The latest version of a published document with no pending edit has `version._status: 'published'`                                 | S2 "a clean published article"             | Tell a draft copy by `version.updatedAt > main.updatedAt` instead; S2 records which                                       |
| U2  | An approval leaves no draft version newer than the published one                                                                    | S2 "approval leaves no draft copy"         | `hasUnsentEdits` returns false for it (field compare); the test then asserts that                                         |
| U4  | A gated `findVersions` as an owner returns only the versions whose own `authors` (articles) or `fellows` (courses) hold their person (`appendVersionToQueryKey`, `src/access.ts:208`), and as an admin every version | S2 "versions are gated"; L3 "a co-author removed in the copy reads published" | None needed: `readVersions` is `isAdminOrOwn(..., { versions: true })` today; a failure is a security bug, stop and report |
| U5  | `findVersions` accepts `where: { 'parent._status': { equals: 'published' } }` on the Postgres adapter                               | S2 "KEY_WHERE finds the rows of its keys" (1b-1); L3 "finds the draft copy of a live article" | `LIVE_COPY` holds no `parent._status`. Every reader of a version row keeps only the parents that a `find` with `_status: published` and `select: { id: true }` returns |
| U6  | An admin decision from `/admin` sends no `review.request` (`submit-for-review.tsx:175-178` overrides the whole `review` group)      | S3 table, rows 5 and 6                     | None needed: the hook reads `data.review?.request ?? originalDoc?.review?.request` either way                            |
| U7  | After **Show more**, `window.history.replaceState` takes `focus` out of the URL and the server does not render the page again. The Next docs (`01-app/01-getting-started/04-linking-and-navigating.md:346-392`) say the URL hooks update; they do not say the page is not requested again | L6 "Show more moves focus to the first new row" (the URL loses `focus`, and the 51st row link still has focus when the network is idle) | Leave `focus` in the URL. A reload of that URL then moves focus to the first new row again; Deviation 7 says so |
| U8  | A `find` accepts a per-locale path, `{ 'title.en': { like } }` and `{ 'title.ar': { like } }`, on a localized field                | L3 "search finds a row by its title in the other language" | Search the reader's locale only; the Deviation 15 line says so                                                       |
| U9  | `findVersions` with `select: { parent: true, version: { title: true, … } }` returns each version's `parent` id and only those version fields. `findVersions.js:71-77` passes the incoming `select` as it is; only `forceSelect` gets `parent` added (`getQueryDraftsSelect.js:2-16`) | L3 "finds the draft copy of a live article" | Read versions with no `select`, at `depth: 0` (whole version rows): slower, same keys |

---

## File structure

- `src/lib/review-status.ts` (new): `StatusKey`, `statusOf`, `statusInputOf`, `hasUnsentEdits`, `waitsOn`, `NOT_LIVE`, `LIVE_COPY`, `KEY_WHERE`, `neverPublished`, `statusBadge`, `nextAction`. Pure. No server import and no UI import, so a client component may import it.
- `src/lib/reviewed-fields.ts` (new): `REVIEWED_FIELDS`, `NOT_REVIEWED`.
- `src/lib/document-href.ts` (new): `documentHref`.
- `src/lib/review-hooks.ts` (changed): the `request` rule in `applyReview`, the `removal` flag in `notifyReview`.
- `src/fields/review.ts` (changed): the `request` field description.
- `src/access.ts` (changed): `OWNER_DELETE`, `mayAuthor`, `mayTeach`, `canProposeCourse`; `canProposePublication` calls `mayAuthor`.
- `src/lib/meetings.ts` (changed, 1b-2a): the internal `held` filter is exported as `notCancelled`.
- `src/portal/lists/` (new). PR 1b-2a: `groups.ts`, `rows.ts`, `course-meta.ts`. PR 1b-2b: `list-row.tsx`, `list-view.tsx`, `empty-states.ts`, `page-header.tsx`, `status-icons.ts`, `list-params.ts`, `create-action.ts`, `list-chips.tsx`, `list-search.tsx`, `show-more.tsx`, `list-page.tsx`, `lists.module.css`.
- `src/app/(frontend)/[locale]/(portal)/spaces/articles/page.tsx`, `.../courses/page.tsx` (new, 1b-2b).
- `testing/portal-lists.fixture.ts` (new, 1b-2a); `e2e/portal-lists.e2e.test.ts`, `e2e/portal-lists.empty.e2e.test.ts` (new, 1b-2b).
- Each task's **Files** line lists the rest.

## PRs

| PR                  | Branch                        | Base                                                                                       | Tasks          | Screen | Ends when                                                                               |
| ------------------- | ----------------------------- | ------------------------------------------------------------------------------------------ | -------------- | ------ | --------------------------------------------------------------------------------------- |
| 1b-1. Status core   | `portal/phase-1b-status`      | `main`                                                                                     | S1 to S7       | none   | `review-status` (unit, int), `document-href` (unit), `src/owner-delete.int.test.ts`, the audit snapshot |
| 1b-2a. List data    | `portal/phase-1b-list-data`   | `main` after 1b-1 merges. Until then it branches from `portal/phase-1b-status` and the PR targets `main` once 1b-1 is in | L2, L3, L8     | none   | `groups.unit.test.ts`, `course-meta.unit.test.ts`, `src/portal/lists/rows.int.test.ts`  |
| 1b-2b. List screens | `portal/phase-1b-lists`       | `portal/phase-1a-shell` (PR C) once PR C is open, rebased with 1b-1 and 1b-2a merged in     | L1, L4 to L7   | yes    | `portal-lists` e2e (`e2e/portal-lists.e2e.test.ts`, `e2e/portal-lists.empty.e2e.test.ts`), the 1b assertions in `portal-shell` |

- 1b-1 and 1b-2a need nothing of PR C. They add no message key: `statusBadge` and `nextAction` return key strings, and 1b-2b adds the messages. So they do not touch `messages/*.json`, where PR C adds the `Portal` namespace (`grep '"Portal"' messages/en.json` finds nothing on `main`). 1b-2a also does not touch `testing/portal.fixture.ts`, which PR C changes (C1).
- 1b-2a uses only `portalWorld` as it is on `main` (phase 1a A4). It does not use `world.loners`, which only PR C's C1 adds.
- 1b-2b needs PR C: `portalNav`, `PortalNavItem`, `nav-icons.ts` (C2), `announce()` (C4), `PortalEmptyState` (C6), `currentReader` and `PortalShell` (C8), the `Portal` messages, `world.loners` and the axe helpers (C1). C1 to C7 are on the PR C branch at `d49c1d0b`; C8 to C12 are not. 1b-2b uses PR C's names. Where they differ from the phase 1a plan, PR C wins. 1b-2b also needs the three changes in "Requests to PR C".
- Merge order. PR C first is advice, not a rule: 1b-1 and 1b-2a need nothing of PR C and may merge before it. 1b-2b merges last, rebased on `main` after the other three merge.

## Requests to PR C

1b-2b needs three changes in PR C's code. Send them to the PR C builder. If PR C lands without one of them, 1b-2b makes that change itself, in its own commit, in the task named.

1. **C6 `PortalEmptyState`: an external action.** `action` becomes `{ label: string; href: string; external?: boolean }`, with `external` false when it is not given, so PR C's callers do not change. When `external` is true, it renders a plain `<a href>` with the same button classes; when false, next-intl `Link`, as now. Reason: `localePrefix` is `'always'` (`src/i18n/routing.ts:11`), so `Link` makes `/admin/...` into `/en/admin/...`, which is not a route. Every 1b empty-state action is an `/admin` URL. Phase 1a Deviation 10 lets the first consumer add this. Dom test: "an external action is a plain link with no locale prefix". Fallback: L5 changes `src/portal/feedback/empty-state.tsx` and `empty-state.dom.test.tsx`.
2. **The shell e2e helpers move to a test util.** Move `AXE_TAGS`, `ROUTE_SHAPES`, `shapeOf`, `known`, `portalRoutes` and `axeCounts` from `e2e/portal-shell.e2e.test.ts` to `testing/portal-e2e.test-utils.ts`, and `openMore` too once C9 or C12 adds it (it is not on the branch at `d49c1d0b`). `ROUTE_SHAPES` stays the four shell routes: the shell's axe loop (`ROUTE_SHAPES.forEach(([shape], index) => … portalRoutes(world, locale)[index]!)`) pairs each shape with a route by index, so a fifth shape would open an undefined route. Add a second table, `LIST_SHAPES`, with `/spaces/articles` (`/^\/[a-z]{2}\/spaces\/articles$/`) and `/spaces/courses`; `shapeOf` searches `ROUTE_SHAPES`, then `LIST_SHAPES`. `RouteShape` becomes the union of both tables' names, so `Known` (typed by `RouteShape`) takes list keys, and `portal-axe-known.json` needs no list entry (`known` gives `{}`). Reason: a spec file that imports another spec file registers that file's tests, and `shapeOf` throws for a route that has no shape. Fallback: L1 moves them, in a commit of its own.
3. **Nav assertions read one table.** If C9 (folded names) and C12 ("nav per role") are written before 1b-2b starts, they take the expected items, each with its group, from one table per role, so a later phase adds rows only. Fallback: L1 adds the Articles and Courses assertions to `e2e/portal-shell.e2e.test.ts` itself, and writes `openMore` in the test util if PR C has none.

## Global Constraints

**Run location (this overrides phase 1a).** Builders work on the user's Mac, each in its own git worktree. Nothing in this plan runs on the server: a `next build` there restarted production on 2026-11-19. Light commands (oxlint, `pnpm exec tsgo --noEmit`, one `*.unit.test.ts` or `*.dom.test.tsx` file through `pnpm exec vitest run --project node|dom <file>`, `pnpm audit:access`) run in the Mac worktree. They need its env: `vitest.setup.ts:12-18` refuses to run unless `DATABASE_URL` contains `@localhost:5433/` (for example `postgres://cilas:dev@localhost:5433/cilas_dev`), `requireLocalStorage` (`testing/local-env.ts`) needs the local storage settings, and `pnpm audit:access` loads the whole Payload config. The Mac worktree's `.env.local` gives all three. Heavy jobs (any `*.int.test.ts`, `*.browser.test.tsx`, Playwright, `next build`, a dev server, the full suite) run only through the Mac runner:

```
~/cilas-verify/verify.sh [--e2e-only] [--no-tests] [--tests-only] [--int-only] [--keep] <branch> <sha> [specs|-g pat]
```

It writes `~/cilas-verify/runs/<sha>/RESULT.md`. Push the branch first; the runner checks out `<sha>`. In this plan, **[verify]** marks a step that runs through it. The phase 1a plan has no "Mac runner" section to point at. Its server-only rules do not apply on the Mac: the env recipe and leak check, the `RUN` shorthand, port 3100, the Database block, the review-world script and its control file. The runner owns env, database and port.

**Runner need (L6).** `verify.sh` must be able to run one e2e spec against a database made by the empty seed (`pnpm db:seed:empty`, which makes `cilas_empty`). If it cannot, the builder adds a `--db empty` option to `~/cilas-verify/verify.sh` on the Mac (outside the repo) before L6 Step 5.

**From phase 1a, still in force** (read these sections of the phase 1a plan, Global Constraints): Spec values; Code and tests (Libraries first, Tests, Matrix, Describes, Locators, `spaces_mode`, Copy, Components, Lazy UI); Commits and PRs. Also phase 1a Deviation 19 (matrix exemptions) as a pattern, and "No streaming boundary above the check".

**New in 1b.**

- **No schema change.** `review.request` already has its column (`src/fields/review.ts:43-58`, migration `20261019_224849_review_request`). `OWNER_DELETE` is an access `Where`. The spec's Migrations section lists "the `request` and Discard changes" under "No migration". So no task runs `payload migrate:create`. A task that finds it needs a field stops and reports. (Had one been needed, the rule is: generate on the branch, rename the SQL by hand, test only on a throwaway copy that the seed guard accepts, never `cilas_dev`, and list it for the morning.)
- **Access rules** (AGENTS.md, Access rules). Every new rule has a name. `OWNER_DELETE` is a `Where` that two collections use, so it lives in `src/access.ts`. `pnpm audit:access` regenerates `scripts/access-audit.snapshot.json`; S6 commits the diff. The audit does not see custom endpoints, so the course delete rule (`deleteCourse`, `src/collections/Courses.ts:109-113`, behind `POST /api/courses/{id}/delete`) changes with no snapshot row. S7's security-review checks it by hand.
- **One role table.** Which view an account gets comes from `adminViewOf` (`src/access.ts:57-62`): `admin`, `fellow`, `student` or `null`. `mayAuthor`, `mayTeach`, `listKindOf` and the 1b nav items all read it. An account with no role gets `null` and reaches no list.
- **Owner lists filter by owner.** `readTiers` (`src/access.ts:319-345`) lets any signed-in reader read every published community or public row. A gated `find` as a student therefore returns the public archive. Every owner-list query adds the ownership `where` (`ownsViaAuthors(user)`, `ownsViaFellows(user)`), as `ownList` does (`src/access.ts:266-272`). A version read adds no ownership `where`: the version access already keeps an owner to the versions whose own `authors` or `fellows` hold their person (U4). Each parent that a version read finds then passes a main read under the list's base `where` (L3). So no version `where` names a `parent.*` field other than `parent._status`. A reader with no person owns nothing: the list is empty and its query does not run. Only an admin can lack a person through the real hooks (`src/collections/Users.ts:45-56` links one to every other account), so tests of the no-person case use a synthetic user object, as `src/lib/publishing.int.test.ts:402` does.
- **Which row is which.** A draft save never writes the main row (`payload/dist/collections/operations/utilities/update.js:309-318`: `db.updateOne` runs only when `!isSavingDraft`). So only the main row says whether a document is live, and only the latest version holds the newest title. One function, `statusInputOf({ main, latest })`, builds `StatusInput` from the two rows. No caller builds `StatusInput` by hand. Each Interfaces block below names the row it takes.
- **Latest versions.** `createVersion` clears the old `latest` flag only where `updatedAt` is older than the new version (`payload/dist/versions/createVersion.js:48-56`), so two versions saved in one millisecond can both be `latest`. Every reader of latest versions keeps the newest `updatedAt` per parent.
- **Data access.** Every list read is a gated read (`user`, `overrideAccess: false`), per the spec's Data access rule. No projection is new in 1b. Reads that populate use `depth: 1` with `select` and `populate` limited to the fields they need, as `src/lib/review-queue.ts:44-53` does (`depth: 0` populates nothing). A version `select` is `{ parent: true, version: { <field>: true, … } }`: field names as keys, and `parent` named, because `findVersions` adds `parent` only to `forceSelect` (U9). Version reads use `depth: 0`, because at `depth: 1` a selected `parent` populates the whole parent document. Two rows that `hasUnsentEdits` compares are read with the same `depth`, `locale` and field list, so a relationship is an id on both sides.
- **Not found for a role.** `/spaces/courses` returns `notFound()` for a student. No `loading.tsx` or `<Suspense>` sits above that check (phase 1a, "No streaming boundary above the check").
- **English.** Plan text, commit bodies and PR bodies follow ASD-STE100. UI copy follows the spec's strings exactly, except where Deviations 13, 15 and 16 give the 1b strings.
- **Int test setup.** Every new int test file starts as `src/lib/publishing.int.test.ts:9-13`: `mockNetwork(resendInbox().handler, ...localServices)` (`testing/msw-node.test-utils.ts`, `testing/resend.test-utils.ts`, `testing/local-services.test-utils.ts`), so mail goes to the fake inbox and media reaches local storage. The database is shared with other test files, so a test reads by the ids it made (`id in`, `parent in`), never by counts of the whole table.
- **Arabic digits.** A number in a 1b message goes through the `digits` format (`{count, number, digits}`, `src/i18n/formats.ts:11-25`), also inside a plural, where it replaces `#`. "Updated {when}" comes from `format.relativeTime`, which takes its own `numberingSystem` option (`numberingSystemOf(locale)`, `src/lib/digits.ts`).

**Per-PR order** (replaces phase 1a's, which ran on the server). 1. Tasks, each with its targeted tests. 2. Reviews (each PR's last task). 3. Fixes with tests. 4. **[verify]** the full suite once (`verify.sh <branch> <sha>`); a failure that the base also has is one line in the PR. 5. `pnpm exec tsgo --noEmit`, `pnpm audit:access` and `git status --short scripts/access-audit.snapshot.json` print nothing new (Mac worktree). 6. Open the PR per `worker.md`, title `type(scope): subject (portal phase 1b, PR <n>)`.

## Check open source first

The user's rule: before a new module, compare existing tools. Verdicts:

| Module                                   | Candidates                                                                                                                                                           | Verdict | Evidence                                                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `statusOf` and the status table          | XState (statelyai/xstate, MIT, active, not installed); a typed lookup table                                                                                           | build   | XState models events over time. `statusOf` maps four stored facts to one of 11 keys with no event. The moves already live in `src/lib/review.ts`.       |
| `hasUnsentEdits` compare                 | `node:util` `isDeepStrictEqual` (built in); `dequal` (lukeed, MIT, not installed); a canonical-JSON compare                                                            | build   | `review-status.ts` must stay importable from client code, so `node:util` is out. Node ids must go before any compare, so the compare after it is one `JSON.stringify` with sorted keys (about 15 lines). |
| Paging                                   | Payload `find` `limit`, `page`, `totalDocs`, `hasNextPage` (installed); Arc `pagination` (numbered pages); TanStack Query (not installed)                              | adopt Payload | The spec wants **Show more**, not page numbers. Payload already returns the totals. TanStack Query is client state; the lists render on the server.    |
| Relative time ("Updated 2 days ago")     | next-intl `getFormatter().relativeTime` (installed); `Intl.RelativeTimeFormat`                                                                                        | adopt next-intl | Installed, locale-aware, already the app's formatter.                                                                                                |
| Course type and season labels            | `Study.filters.types`, `Study.filters.seasons` (`messages/*.json`), `localDigits` (`src/lib/digits.ts:14`), as `src/api/courses.api.ts:133-146` uses them              | adopt   | Already in both languages. `cycleTitle` and `COURSE_TYPE_OPTIONS` labels are English only.                                                             |
| Badge                                    | Arc `badge` (installed, tones `neutral`, `success`, `info`, `warning`, `danger`)                                                                                      | adopt   | Its five tones are the spec's five tones (`badge.tsx:20`).                                                                                             |
| Search field                             | Arc `search-field` (installed)                                                                                                                                        | adopt, wrapped | It is a controlled client component (`'use client'`, required `value` and `onValueChange`, `search-field.tsx:1-12`) with an English default clear label. `ListSearch`, a small client wrapper, holds the text and submits `name="q"` in a GET `<form>`. |
| Filter chips                             | Arc `chip-group` (installed)                                                                                                                                          | build   | Its chips are pressed buttons with roving focus (`chip-group.tsx:30-34`). The spec wants links with `aria-current="true"`, because the filter is in the URL. |
| Page header                              | Arc `page-header` (installed)                                                                                                                                         | build   | It is the space header: a required breadcrumb, members, tabs (`page-header.tsx:11-25`). The spec's header is an H1, a subtitle and one primary button.  |
| Row table                                | Arc `sortable-data-table` (installed)                                                                                                                                 | reject  | Table semantics and sort headers. The spec's rows are list rows with a slot, badges and a next-action line.                                            |
| Empty state                              | Arc `empty-state`; `PortalEmptyState` (phase 1a PR C)                                                                                                                 | adopt `PortalEmptyState` | Phase 1a rejected Arc's (hard-coded `<h3>`, a morph animation; 1a Deviation 10). It needs an external action (Requests to PR C, 1).   |
| Admin URL in `documentHref`              | Payload `formatAdminURL` (`payload/shared`)                                                                                                                           | build   | The repo writes `/admin/collections/...` by hand in 5 places; one template string in one function replaces them later (phase 2).                         |
| Cover thumbnail                          | `mediaThumbnail`, `mediaPopulate` (`src/lib/media-image.ts`, installed)                                                                                               | adopt   | Existing helpers. `mediaThumbnail` reads `sizes.thumbnail`, so the populate is `{ ...mediaPopulate, sizes: true }`, as `admin-avatar.tsx:32` does.     |

## Deviations from the spec

The operator may veto any line.

1. **Test paths.** Spec names spec files (`review-status`, `document-href`, `portal-lists`). The repo puts tests beside their subject as `*.unit.test.ts`, `*.int.test.ts`, and e2e as `e2e/*.e2e.test.ts` (`testing/README.md`). Map: `review-status` is `src/lib/review-status.unit.test.ts` and `src/lib/review-status.int.test.ts`; `document-href` is `src/lib/document-href.unit.test.ts`; `portal-lists` is `src/portal/lists/rows.int.test.ts`, `e2e/portal-lists.e2e.test.ts` and `e2e/portal-lists.empty.e2e.test.ts` (the empty seed).
2. **The owner-delete int test ships in 1b-1**, as `src/owner-delete.int.test.ts`, with the access change it proves. The spec files it under `portal-lists`.
3. **"A unit test settles whether Payload leaves an equal draft version after a publish"** is an int test (S2, U2): it needs the database.
4. **`StatusInput` carries `collection`.** `statusOf` calls `hasUnsentEdits`, which needs that collection's reviewed fields. Signature: `statusOf({ collection, doc, draft })`.
5. **No deviation.** Kept as a number so that reviews and decisions that cite Deviations 6 to 17 stay valid. The empty states follow the spec: the e2e on the empty seed, for all three roles (L6).
6. **Filter chips show one group.** Spec: "All, Needs you, Drafts, Published", silent on what Drafts means. Plan: Needs you shows the Needs you group; Drafts shows In progress (Proposals on the fellow's Courses list); Published shows Published (Teaching now on the fellow's Courses list); All shows every group. Cost: on an owner's Articles list, a live article with edits sits in In progress or With editors, so the Published chip does not show it, although its badge says Published. All shows it.
7. **Show more is a link.** `?published=2&focus=published` (or `closed`, `teaching`) asks the server for 2 pages of 50. It works with no script. `focus` tells the page that the reader came from **Show more**: a small client part, `NewRowsFocus`, then moves focus to the first new row, calls `announce()`, and takes `focus` out of the URL with `history.replaceState` (U7). A fresh load or a reload of `?published=2` has no `focus` and moves no focus. Spec is silent on the mechanism.
8. **Row title.** Spec is silent on which title a row shows. Plan: on an owner list, the latest version's title; on an admin list, the latest version's title when `waitsOn(key)` is `admin` (what waits for the admin), else the main row's title (what the admin approved or sent back, not the owner's unsent writing). In the reader's locale, else the other locale (as `NeedRow.label`), else "Untitled article" or "Untitled course".
9. **Header buttons follow the create rules.** **New article** shows when `mayAuthor(user)`. **Propose a course** shows when `canProposeCourse(user)`: `mayTeach(user)` and a linked person, so an admin with no person has none, as the spec says. `canAuthor` and `canTeach` call `mayAuthor` and `mayTeach`; course create access does not change. The spec names only the admin-with-no-person case.
10. **`documentHref` replaces no caller in 1b.** The spec ships it in 1b "because the list rows need it". Phase 2 changes the email and bell links, and their call shape changes there (one email per recipient), so moving them now would be done twice.
11. **Nav counts are `null` in 1b.** The spec's count for Articles and Courses ("own items in Needs you") comes from `needsCounts(user)`, which phase 1c ships ("the sidebar counts").
12. **The `request` table's withdraw case moves to phase 2.** Spec: "Approval and withdraw clear `request`" in the 1b hook table. An owner cannot withdraw before phase 2 (`AUTHOR_MOVES.submitted` is `[]`, `src/lib/review.ts:20`). S3 tests the rule on the move to `draft` that exists (an admin removal). Carry-over to phase 2: its `review-events` int test asserts "approval and withdraw clear `request`".
13. **Owner next-action lines name no control that 1b lacks.** The spec's owner column names **Withdraw**, **Withdraw changes**, discard, Duplicate and delete, which ship in phase 2 (withdraw, discard) and phases 4e and 5 (Duplicate and Delete, with the editors), and "View on the site", but a 1b row has one link only, its title, to the admin URL. A line that names a missing control tells the owner to do what they cannot. 1b ships these owner lines; every other line is the spec's:
    - `published`: "Edits wait for review."
    - `submitted`: "With an admin."
    - `rejected`: "Read the note."
    - `published_unsent`: "Submit changes for review."
    - `published_edits`: "With an admin. The live version does not change."
    - `published_removal`: "With an admin."
    - `published_edits_declined`: "Read the note. Edit and submit again."
    Carry-over: phase 2 restores the spec strings for `submitted`, `published_unsent`, `published_edits`, `published_removal` and `published_edits_declined` with its buttons; phases 4e (courses) and 5 (articles) restore `rejected` ("Read the note. Duplicate as a new draft, or delete") with Duplicate and Delete; `published` gets "View on the site." back in the phase that gives the row a site link (no phase plans one yet, so the phase 2 plan decides).
14. **`documentHref` takes `{ collection, id }` in 1b.** Spec, Document links: `documentHref({ collection, id, viewer, waiting, locale })`; Tests table, `document-href` row: "links per collection, viewer, `waiting` value and locale". In 1b every input gives the admin URL, so the 1b signature has no `viewer`, `waiting` or `locale`, and S5 tests per collection only. Phase 2 adds the three inputs and `users` with the portal branches, and the tests per viewer, `waiting` value and locale move to phase 2 with them.
15. **One search string for both lists.** Spec, Lists: `No articles match "{query}".`; spec, Onboarding: `No results for "{query}".` with **Clear search** in a list. Plan: the Onboarding wording, one key `lists.noResults`, on both lists, because "articles" is wrong on the Courses list. The search matches the title in both languages (U8), because a row can show its other-language title (Deviation 8).
16. **A filter with no row.** Spec is silent. When `show` is set, the list has rows, and the chosen group has none: "Nothing here now." with **Show all** (a link to the URL without `show`), as the search pattern. Keys `lists.noneInFilter`, `lists.showAll`.
17. **No `updatedAt` short cut in `hasUnsentEdits`.** Spec, Status model: "When the draft copy's `updatedAt` equals the live row's, it returns false with no field compare." Payload sets `updatedAt` to now on every draft version (`payload/dist/versions/saveVersion.js:13-15`), so a draft copy never shares it with the live row and the short cut never fires. `hasUnsentEdits` always compares fields.
18. **Chips and search also show under a filter or a search.** Spec: they show "only when the list has more than 6 rows". Plan: they show when `total` (the reader's rows with no search and no filter) is above 6, or when `q` or `show` is set (`controlsShown`, L5). Else a reader who lands on `?show=needsYou` with 2 rows, or on a search, has no control to go back.
19. **Signatures and slots that differ from the spec's sketch.** `statusOf` takes an optional `warn` (the spec's Errors line asks for the warning; the parameter lets a test read it). `hasUnsentEdits` takes the field list, so it needs no collection. `PortalPageHeader` has no secondary slot: no 1b page has a secondary button, and the phase that adds one adds the slot. The spec's table gives no icon to three second badges, but its Design language says "the icon and the label always show". Plan: each takes the icon of the same label elsewhere in the table, Changes requested `message-square-warning` and Edits declined `circle-x`; Kept on the site, which has no other row, takes `archive-restore`.

## Ends when

The spec's Phase 1b line, by clause.

1. `review-status` passes: S2, S3 (`src/lib/review-status.unit.test.ts`, `src/lib/review-status.int.test.ts`).
2. `document-href` passes: S5 (`src/lib/document-href.unit.test.ts`, Deviation 14).
3. `portal-lists` passes: L3 (`src/portal/lists/rows.int.test.ts`), L6 (`e2e/portal-lists.e2e.test.ts`, `e2e/portal-lists.empty.e2e.test.ts`). The owner-delete case: S6 (`src/owner-delete.int.test.ts`, Deviation 2).
4. The audit snapshot changes in one row only: `collection:articles` `delete`, whose `while` gains `rejected` (S6).
5. `portal-shell` holds the Articles and Courses nav assertions (L1, L6).

Scope check, from the spec's Phase 1b Scope line: `statusOf`, `waitsOn`, `neverPublished` (S2); `reviewed-fields.ts` (S1); the `request` change and its table (S3); `statusBadge`, `nextAction` (S4); `documentHref` (S5); owner delete with no button (S6); lists, nav items, empty states, paging (L1 to L6); Needs you group (L2, L3); header buttons to the admin create pages (L5); no applicant link and no Participants link on a course row (L4 test).

## Review Focus

The inputs the spec implies and no clause tests, most likely first. Each has its test in the named task.

1. **A reader with no linked person.** Only an admin can lack one through the real hooks. `ownsVia` returns `false`; an owner list must render the empty state, not the public archive, and the header shows no **Propose a course**. L3 "a reader with no person owns no row" (synthetic user), S6 `canProposeCourse` unit tests, L6 (the fixture admin).
2. **A never-published draft whose title changed only in autosaves.** The main row keeps the old title. The owner's row shows the latest version's title. L3 "the row shows the newest title".
3. **A live document with an equal draft copy** (after a withdraw, a kept removal, or an autosave with no change). It reads `published` or `published_removal_kept`, not `published_unsent`, and sits in Published, also on page 1 of the paged group. S2, L3.
4. **Admin lists with other people's work.** An admin reads every row; the list leaves out other people's not-live rows at `draft`, and at `approved` (an admin Unpublish leaves `_status: draft` with `review.status: approved`, which `statusOf` reads as `draft` with a warning). The admin's own not-live `approved` row sits in In progress, so every row that `total` counts sits in a group. A live row with an owner's unsent copy shows the live title. L3 "an admin does not see another owner's draft", "every counted row sits in one group".
5. **Filters and search on a small result.** `?show=needsYou` with 2 rows, or a search with 2 hits, keeps the chips and the search so the reader can go back (Deviation 18). L3 (`total`), L5 (`controlsShown`), L6.
6. **Worst-case rows:** a 120-character Arabic title with no space, an English title in an Arabic page, a row with two badges at 390px, a course with no cycle and no type. L4 browser test, L7 break-ui.
7. **Co-authors who differ between the live row and the copy.** Each owner sees what their version access gives them (U4). A co-author removed in the copy reads the live row with no copy: `published`, in Published, until an admin approves the copy. A co-author added only in the copy owns no live row, so the row is not on their list until the approval. L3 "a co-author removed in the copy reads published", "a co-author added in the copy does not see the row".
8. **A filter on a paged group.** `?show=published` loads no work group, but the paged query still leaves out the work set's ids, so a live article with edits stays out of Published. L3 "only published leaves out the work rows".

## Decision log (structural)

Each problem, then its fix.

- P1. Four stored facts (`_status`, `review.status`, `review.request`, the latest version) make one state, and no code joins them. Fix: `statusInputOf` and `statusOf` in `src/lib/review-status.ts`, the one place that reads them.
- P2. `applyReview` clears `review.request` on every move but `submitted` (`src/lib/review-hooks.ts:169-173`), so a declined edit and a kept removal store the same facts. Fix: the S3 rule.
- P3. A move into `submitted` falls back to the stored `request` (`review-hooks.ts:172`), so an edit after a kept removal inherits `removal`. Fix: the S3 rule takes the write's `request`, else `changes`.
- P4. `notifyReview` reads `previousDoc.review.request` on every move but `submitted` (`review-hooks.ts:213`). Once P2's fix keeps `removal` on a declined copy, a later decision on that copy would be told as a removal. Fix: S3 reads the previous `request` only on the move out of `submitted`.
- P5. The owner delete rule is `WITH_OWNER` with `draft: true` (`Articles.ts:58`, `Courses.ts:109-113`), so a declined draft can never be deleted by its owner. Fix: `OWNER_DELETE` in `src/access.ts`. `WITH_OWNER` stays for publications and its other readers.
- P6. Who may create an article or a course is written inside `canAuthor` and `canTeach` only, and the role-to-view choice is written again in each caller. Fix: `mayAuthor(user)` and `mayTeach(user)` built on `adminViewOf`; the access rules, `canProposeCourse`, `listKindOf` and the nav read them.
- P7. Which fields review covers is written nowhere. Fix: `REVIEWED_FIELDS`, and a unit test that derives the owner-writable fields from the audit snapshot, so a new field fails until it is listed as reviewed or not.
- P8. The status rules could be copied into each query that finds work, and the not-live `approved` state could read `draft` in `statusOf` and something else in a query. Fix: `KEY_WHERE`, one `{ key, where }` table beside `waitsOn`, built from two shared parts, `NOT_LIVE` and `LIVE_COPY`. Its `draft` row holds `review.status` `draft` and `approved`, as `statusOf` reads them. A key that needs a field compare (`published`, `published_unsent`, `published_edits_declined`, `published_removal_kept`) has no row. The list loader builds its work candidates from it (L3); `needsCounts` reads it in phase 1c.
- P9. Group membership could spread over each list page. Fix: `groupOf` in `src/portal/lists/groups.ts`, one pure table for every list and role.
- P10. The list controls and the empty state could read the filtered rows, so a filter could hide its own way back. Fix: `loadList` returns `total`, the reader's rows with no search and no filter; the chips, the search and the empty state read only `total`.
- P11. The header button and the owner's empty-state action could disagree. Fix: `createActionOf(collection, user)`, one function that both read.
- P12. Which keys load in full could be written in the loader as well as in the group table. Fix: `workKeys(kind)` in `groups.ts`, derived from `groupOf`; the loader reads it.
- P13. The Show more focus signal could be a module variable that one component sets and another reads. Fix: the link carries it in the URL (`focus`), and `NewRowsFocus` reads it from its props.
- P14. `canProposePublication` copies the `mayAuthor` rule. Fix: it calls `mayAuthor` (S6).

Done means: a new reviewed collection needs one `REVIEWED_FIELDS` entry and one `groupOf` view; a new status key fails the `statusOf`, `statusBadge`, `nextAction`, `KEY_WHERE` and `groupOf` table tests until each covers it. `src/lib/**` imports nothing from `src/portal/**` or `src/components/**` (S7 and L7 check with `rg -l "@/portal/" src/lib src/components src/i18n` and `rg -l "@/components/" src/lib/review-status.ts src/lib/document-href.ts src/lib/reviewed-fields.ts`).

## Open questions (product calls)

None block the plan. Deviations 13, 15 and 16 hold new UI copy for the operator to veto.

---

## PR 1b-1. Status core (`portal/phase-1b-status`)

From `main`. No screen. Reviews: code-review, then security-review.

### Task S1: `reviewed-fields.ts`

**Skills:** tdd, payload (`.agents/skills/payload/SKILL.md`).

**Files:** Create `src/lib/reviewed-fields.ts`, `src/lib/reviewed-fields.unit.test.ts`.

**Interfaces:**

- Consumes: `REVIEWED` (`src/lib/reviewed-collections.ts`); `scripts/access-audit.snapshot.json` (test only).
- Produces: `type ReviewedCollection = (typeof REVIEWED)[number]['collection']`. `REVIEWED_FIELDS: Record<ReviewedCollection, readonly string[]>`, top-level field names. `NOT_REVIEWED: Record<ReviewedCollection | 'all', readonly string[]>`: `all` is `review`, `last_edited_by`, `updatedAt`, `createdAt`, `_status`; `articles` adds `publications` (a join); `courses` adds `syllabus` and `enrollments` (joins), `first_day`, `last_day` (kept from the sessions, `Courses.ts:341-347`), and `sessions`, `schedule` (the old hidden, read-only fields, `Courses.ts:348-353` and `:424-430`; sessions have no review, ADR 0011). Each `NOT_REVIEWED` entry has a one-line comment with its reason.

- [ ] **Step 1: Failing test.** "reviewed and not reviewed fields cover every owner-writable field of $collection": read the snapshot; take rows of `collection:$collection` whose `field` has no `.` and whose `rules.update` is `open`; expect that set to equal `REVIEWED_FIELDS[c]` plus `NOT_REVIEWED.all` plus `NOT_REVIEWED[c]`, with no name in both. "courses review fellows" (`REVIEWED_FIELDS.courses` contains `fellows`). "course sessions and schedule are not reviewed" (both in `NOT_REVIEWED.courses`, neither in `REVIEWED_FIELDS.courses`). Run `pnpm exec vitest run --project node src/lib/reviewed-fields.unit.test.ts`: FAIL, module missing.
- [ ] **Step 2: Implement.** Today's lists, from the snapshot: articles `title`, `cover_image`, `requested_tier`, `body`, `authors`, `credits`, `translation`, `tags`, `related_articles`, `meta`; courses `cover_image`, `title`, `subtitle`, `epigraph`, `description`, `fellows`, `course_type`, `location`, `teaching_languages`, `language_note`, `bibliography`, `facilitator_note`, `content_warning`, `syllabus_tentative`, `applicant_questions`, `meta`; publications `cover_image`, `title`, `subtitle`, `intro`, `kind`, `articles`, `editors`, `credits`, `produced_by`, `license`, `print_edition_url`, `meta`. Run: PASS. Commit.

### Task S2: `statusOf`, `statusInputOf`, `hasUnsentEdits`, `waitsOn`, `KEY_WHERE`, `neverPublished`

**Skills:** tdd, payload.

**Files:** Create `src/lib/review-status.ts`, `src/lib/review-status.unit.test.ts`, `src/lib/review-status.int.test.ts`.

**Interfaces:**

- Consumes: `ReviewState`, `ReviewRequest` (`src/lib/review.ts`); `REVIEWED_FIELDS`, `ReviewedCollection` (S1); `Where` (`payload`, type import only).
- Produces:
  - `type StatusKey = 'draft' | 'submitted' | 'changes_requested' | 'rejected' | 'published' | 'published_unsent' | 'published_edits' | 'published_removal' | 'published_edits_returned' | 'published_edits_declined' | 'published_removal_kept'`; `STATUS_KEYS: readonly StatusKey[]`.
  - `type ReviewedDoc = { id: number; _status?: 'draft' | 'published' | null; updatedAt: string; review?: { status?: ReviewState | null; request?: ReviewRequest | null } | null } & Record<string, unknown>`.
  - `type StatusInput = { collection: ReviewedCollection; doc: ReviewedDoc; draft: ReviewedDoc | null }` (Deviation 4).
  - `statusInputOf({ collection, main, latest }: { collection: ReviewedCollection; main: ReviewedDoc; latest: ReviewedDoc | null }): StatusInput`. `main` is the row of a `find` with `draft: false`. `latest` is the `version` of the latest version (`findVersions` with `latest: true`, the newest `updatedAt` per parent), with `id` set to the parent id, or null. Rule: when `neverPublished(main)`, `doc` is `latest ?? main` and `draft` is null; else `doc` is `main` and `draft` is `latest` when `latest._status === 'draft'` (U1), else null.
  - `statusOf(input: StatusInput, warn?: (message: string) => void): StatusKey`. Not live (`doc._status !== 'published'`): `review.status` gives `draft`, `submitted`, `changes_requested`, `rejected`; `approved` gives `draft` and calls `warn` with the id (spec, Errors). Live with no draft copy: `published`. Live with a copy: copy `submitted` gives `published_removal` when `request` is `removal`, else `published_edits`; `changes_requested` gives `published_edits_returned`; `rejected` with `removal` gives `published_unsent` when `hasUnsentEdits`, else `published_removal_kept`; `rejected` with `changes` or null gives `published_edits_declined`; `approved` or `draft` gives `published_unsent` when `hasUnsentEdits`, else `published`. `warn` defaults to `console.warn`.
  - `hasUnsentEdits(draft: ReviewedDoc, doc: ReviewedDoc, fields: readonly string[]): boolean`. True when any field in `fields` differs after both values pass `canonical(value)`: object keys sorted, every key `id` whose value is a string dropped at any depth (Lexical node ids, block ids, array row ids), `undefined` and `null` equal. The values come with `locale: 'all'`, so a localized field is one object per locale. No `updatedAt` short cut (Deviation 17).
  - `waitsOn(key: StatusKey): 'owner' | 'admin' | null` (spec table).
  - `NOT_LIVE: Where = { _status: { equals: 'draft' } }` (main rows). `LIVE_COPY: Where = { and: [{ latest: { equals: true } }, { 'version._status': { equals: 'draft' } }, { 'parent._status': { equals: 'published' } }] }` (versions; U5): the latest version of a live document is a draft copy.
  - `KEY_WHERE: { readonly [K in StatusKey]?: { on: 'main' | 'version'; where: Where } }`, beside `waitsOn` (spec, Tasks, Counts). Every row is `and: [NOT_LIVE, …]` or `and: [LIVE_COPY, …]`, so the two parts are written once. Rows on `main`: `draft` (`review.status` in `draft`, `approved`: `statusOf` reads a not-live `approved` row as `draft`), `submitted`, `changes_requested`, `rejected` (that `review.status`). Rows on `version`: `published_edits`, `published_removal`, `published_edits_returned` (`version.review.status`, and `version.review.request` for the first two). The other keys need a field compare, so they have no row.
  - `neverPublished(main: ReviewedDoc): boolean`: `main._status === 'draft'`. It takes the main row only.

- [ ] **Step 1: Failing unit tests** (`pnpm exec vitest run --project node src/lib/review-status.unit.test.ts`). A table, one row per case, built with `doc(overrides)` and `copy(overrides)` in the test file:
  - "$facts reads $key" for every row of the spec's Status model table, plus: both `published_unsent` shapes (copy at `approved`, copy at `draft`); the third shape (changed copy at `rejected`, `removal`); a copy at `rejected` with `request: null` reads `published_edits_declined`; an equal copy at `rejected`, `removal` reads `published_removal_kept`; an equal copy at `approved` reads `published`.
  - "an unknown combination reads draft and warns with the id" (not live, `approved`; `warn` collects messages; one message holds the id).
  - "statusInputOf takes the latest version for a document never published" and "takes the main row and the draft copy for a live document" and "ignores a latest version that is the published one".
  - "hasUnsentEdits ignores Lexical node ids and array row ids", "sees a change in one locale only", "sees a fellow added", "is false for equal fields with different updatedAt".
  - "waitsOn names admin for $keys, owner for $keys, nobody for the rest" (all 11 keys).
  - "every key that waits on someone has a KEY_WHERE row" (each key with a non-null `waitsOn` has a row).
  - "neverPublished is true for a draft main row, also after a removal" (`_status: 'draft'`, `review.status: 'draft'`).
- [ ] **Step 2: Implement.** Run: PASS.
- [ ] **Step 3: Failing int tests** **[verify]** (`src/lib/review-status.int.test.ts`, `verify.sh --int-only <branch> <sha> src/lib/review-status.int.test.ts`). Setup as `src/lib/publishing.int.test.ts:9-63` (the network mock at `:13`, admin, author with person, `createTracker`). An article "created published by the admin" has `authors: [the author's person]`, so the author owns it. A local `facts(id)` reads `main` (`findByID`, `draft: false`, `locale: 'all'`, `depth: 0`) and `latest` (`findVersions`, `where: { parent: { equals: id }, latest: { equals: true } }`, `sort: '-updatedAt'`, `limit: 1`, `locale: 'all'`, `depth: 0`), both as the author with `overrideAccess: false`, and returns `statusOf(statusInputOf(...))`.
  - "a clean published article" (U1): created published by the admin; its latest version's `_status` is `published`; key `published`.
  - "approval leaves no draft copy" (U2): author edits a live article, submits, admin approves; key `published`.
  - "versions are gated" (U4): a second member's `findVersions` of the author's article returns no doc; the admin's returns it.
  - "a fellow edits a published course" (spec): fellow with a person, course published by the admin with the fellow in `fellows`; the fellow saves a new title (draft save): key `published_unsent`; the fellow submits with `request: 'changes'`: key `published_edits`; an anonymous `find` (`overrideAccess: false`, no user) still returns the old title.
  - "KEY_WHERE finds the rows of its keys": for each `KEY_WHERE` row, a `find` (`on: 'main'`) or `findVersions` (`on: 'version'`) as the admin, with `and: [row.where, { id: { in: ids } }]` (or `parent: { in: ids }`) over this test's ids only, returns the ids whose `statusOf` key is that key, and no other. The test makes one article per `KEY_WHERE` key: `draft`, `submitted`, `changes_requested` and `rejected` never published; `published_edits`, `published_removal` and `published_edits_returned` as a live article with its copy in that state; plus a not-live `approved` article (published by the admin, then a write with `_status: 'draft'` and no `draft: true`, so the main row changes, as an admin Unpublish does; `KEY_WHERE.draft` finds it, and its key is `draft`), one never-published article whose latest version is at `submitted` (the version rows must not find it, U5) and the clean published one.
  - Run: PASS after Step 2's code (these test Payload's behaviour, so they may pass at once; record that in the commit). A failing premise takes its fallback from the Status table, and the commit says which. Commit.

### Task S3: Keep `review.request` until the next move

**Skills:** tdd, payload.

**Files:** Modify `src/lib/review-hooks.ts:169-174` (`applyReview`) and `:213` (`notifyReview`), `src/fields/review.ts:55` (the `request` description), `src/lib/review-status.int.test.ts`.

**Interfaces:**

- Consumes: `applyReview` (`review-hooks.ts:120-183`); `notifyReview` (`review-hooks.ts:205-240`); the `live` flag (`req.context[LIVE]`).
- Produces: the rule, on a live document (`live` is true):
  - `to === 'submitted'` and `from !== 'submitted'`: `data.review?.request ?? 'changes'`. No fallback to the stored value.
  - `to === 'submitted'` and `from === 'submitted'`: `originalDoc?.review?.request ?? data.review?.request ?? 'changes'`, so an admin save of a waiting removal keeps `removal`.
  - `to` is `changes_requested` or `rejected`: `data.review?.request ?? originalDoc?.review?.request ?? null` (U6).
  - `to` is `draft` or `approved`: `null`.
  - Not live: `null`, as today.
- Produces, in `notifyReview`: `removal` is `(state === 'submitted' ? doc : before === 'submitted' ? previousDoc : null)?.review?.request === 'removal'`. A decision on a copy that did not come from `submitted` is never told as a removal.
- Produces, in `src/fields/review.ts`: description `What the owner asks, or last asked, of the published ${noun}.` The read-only field now stays visible on a declined copy.

- [ ] **Step 1: Failing int table** **[verify]**, in `review-status.int.test.ts` (S2's setup and network mock), `describe('the request rule')`, one live article per row (made published by the admin), writes as `/admin` sends them (`src/components/admin/submit-for-review.tsx:62-67`, `:173-178`):
  1. "a kept removal, then a resubmitted edit, asks for changes": author `submitted` + `removal`; admin `rejected` with a note; key `published_removal_kept`; author edits the title and sends `submitted` with no `request`; stored `request` is `changes`; key `published_edits`.
  2. "an admin save at submitted keeps removal": author `submitted` + `removal`; admin saves `review: { status: 'submitted' }`; `request` is `removal`.
  3. "approval clears request": author `submitted` + `changes`; admin `approved` with `_status: 'published'`; `request` is null.
  4. "a move to draft clears request": author `submitted` + `removal`; admin removes it (`_status: 'draft'`, `review.status: 'draft'`, as `SAVES.removed`); `request` is null. This is the only move to `draft` that exists in 1b: the owner's withdraw ships in phase 2 (`AUTHOR_MOVES.submitted` is `[]`, `review.ts:20`), and an admin draft save that changes the status throws (`review-hooks.ts:135-141`). Phase 2's `review-events` int test covers withdraw (Deviation 12).
  5. "changes_requested on a live document keeps request": author `submitted` + `changes`; admin `changes_requested` with a note and no `request`; `request` is `changes`; key `published_edits_returned`.
  6. "rejected on a live document keeps request": as 5 with `rejected`; key `published_edits_declined`. With `removal` instead: key `published_removal_kept`.
  7. "a document that is not live stores no request": a never-published draft submitted with `request: 'removal'` stores null.
  8. "a decision after a kept removal is not told as a removal": after row 1's kept removal, the admin approves the copy straight from `rejected`; `rejected` to `approved` notifies the owners (`notifyOn`, `src/lib/review.ts:52-57`); the owner's newest `notifications` row has the approval line (`NOTES.approved`, "was approved and published"). With `removal` wrongly true, the line falls back to the bare title (`review-hooks.ts:236`: `REMOVAL_NOTES` has no `approved` entry).
  Expected before Step 2: rows 1, 5 and 6 FAIL (today `request` is null after `changes_requested` and `rejected`, `review-hooks.ts:170-173`). Row 8 passes today, because the stored `request` is null; it guards the `notifyReview` change. Rows 2, 3, 4 and 7 pass today and guard the rule.
- [ ] **Step 2: Implement** the rule in `applyReview`, the `removal` line in `notifyReview` and the field description. Update the comment at `review-hooks.ts:169` to the new rule. Run **[verify]**: the table passes, row 8 included (it fails if only the `applyReview` part lands); `src/lib/publishing.int.test.ts` still passes (its "publishes the change only when an admin approves it" expects `request` null after approval). Commit.

### Task S4: `statusBadge` and `nextAction`

**Skills:** tdd.

**Files:** Modify `src/lib/review-status.ts`, `src/lib/review-status.unit.test.ts`.

**Interfaces:**

- Consumes: `StatusKey` (S2).
- Produces: `type StatusTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger'` (a literal union: `src/lib` imports no UI). `type StatusIcon = 'pencil-line' | 'clock' | 'message-square-warning' | 'circle-x' | 'globe' | 'file-pen' | 'file-clock' | 'archive-x' | 'archive-restore'`. `type StatusBadge = { tone: StatusTone; icon: StatusIcon; labelKey: \`status.${string}\` }`. `statusBadge(key: StatusKey): StatusBadge[]`: one badge, or two on a live key (Published first). Every badge has an icon (Deviation 19): the second badges of `published_edits_returned`, `published_edits_declined` and `published_removal_kept` take `message-square-warning`, `circle-x` and `archive-restore`. Keys under `Portal.`: `status.draft`, `status.submitted`, `status.changesRequested`, `status.declined`, `status.published`, `status.unsentEdits`, `status.editsInReview`, `status.removalRequested`, `status.editsDeclined`, `status.keptOnSite`. `nextAction(key: StatusKey, viewer: 'owner' | 'admin'): { labelKey: \`next.${string}\` } | null`: the spec table's two columns, `null` where it says "none", with the 1b owner lines of Deviation 13. Keys: `next.owner.<key>` and `next.admin.<key>` in camel case.

- [ ] **Step 1: Failing tests:** "statusBadge($key) gives $badges" (all 11 rows: tone, icon, label key, count); "every badge has an icon"; "only published keys use the success tone" (spec: green means only published); "nextAction($key, $viewer)" (22 rows); "Arc Badge accepts every status tone" (a type test: `expectTypeOf<StatusTone>().toMatchTypeOf<BadgeProps['tone']>()` with a type-only import of `BadgeProps` from `src/components/arc/badge/badge.tsx`). Run: the vitest rows FAIL (module members missing). `expectTypeOf` does nothing at run time, so the type test fails only through `pnpm exec tsgo --noEmit`; run it too and see it fail before Step 2.
- [ ] **Step 2: Implement** as one `Record<StatusKey, ...>` per function, so a new key is a type error. Run: PASS. `pnpm exec tsgo --noEmit` exits 0. Commit.

### Task S5: `documentHref`

**Skills:** tdd.

**Files:** Create `src/lib/document-href.ts`, `src/lib/document-href.unit.test.ts`.

**Interfaces:**

- Consumes: `ReviewedCollection` (S1).
- Produces: `documentHref({ collection, id }: { collection: ReviewedCollection; id: number }): string`, which returns `/admin/collections/${collection}/${id}`: a locale-free path, as the spec's stored links are. Phase 2 adds `viewer`, `waiting`, `locale`, `users` and the portal branches (Deviation 14).

- [ ] **Step 1: Failing test:** "documentHref gives the admin URL for $collection" (articles, courses, publications). Run: FAIL.
- [ ] **Step 2: Implement.** Run: PASS. Commit.

### Task S6: `OWNER_DELETE`, `mayAuthor`, `mayTeach`, `canProposeCourse`, and the audit

**Skills:** tdd, payload.

**Files:** Modify `src/access.ts` (beside `WITH_OWNER`, `:177-182`; `canTeach`, `:174-175`; `canAuthor`, `:222-225`; `canProposePublication`, `:247-251`), `src/access.unit.test.ts` (the `canAuthor` describe at `:172`, the `canTeach` describe at `:338`), `src/collections/Articles.ts:58`, `src/collections/Courses.ts:108-113` and the `blockedUnless` message at `:133`, `scripts/access-audit.snapshot.json` (generated). Create `src/owner-delete.int.test.ts`.

**Interfaces:**

- Consumes: `isAdminOrOwn` (`access.ts:199-215`); `adminViewOf`, `personOf` (`access.ts:57-74`); `rest` (`testing/payload-rest.test-utils.ts`) for the course endpoint; `createTracker`, `uniq`, `uniqEmail` (`testing/payload.fixture.ts`).
- Produces:
  - `OWNER_DELETE: Where = { 'review.status': { in: ['draft', 'changes_requested', 'rejected'] } }`, with a doc comment: an owner deletes their own document while it is with them or after a decline, never once submitted; with `draft: true` it is never published (`neverPublished`). Articles `delete` and `deleteCourse` use `{ draft: true, while: OWNER_DELETE }`. `WITH_OWNER` stays (publications, `review-hooks.ts` comments). Course message: `You can delete only your own draft or declined courses.`
  - `mayAuthor(user: RoleHolder): boolean`: `adminViewOf(user)` is `admin`, or it is not null and `personOf(user)` is not null. `mayTeach(user: RoleHolder): boolean`: `adminViewOf(user)` is `admin`, or it is `fellow` and `personOf(user)` is not null. Both equal today's rules. `canAuthor` is `({ req }) => mayAuthor(req.user)` and `canTeach` is `({ req }) => mayTeach(req.user)`, names unchanged, so course and article create access do not change. `canProposePublication` is the same rule as `mayAuthor` today (admin, or a student or fellow view with a person), so it becomes `({ req }) => mayAuthor(req.user)` too (P14).
  - `canProposeCourse(user: RoleHolder): boolean`: `mayTeach(user) && personOf(user) !== null`. A predicate for the list header, not an access rule. It adds the spec's rule: an admin with no person cannot propose, because `addSelfAs('fellows')` needs one.

- [ ] **Step 1: Failing unit tests** (`pnpm exec vitest run --project node src/access.unit.test.ts`): "mayAuthor($roles, person $person) is $result" and "mayTeach(...)" (admin, fellow, member, non_degree_seeking and no role, each with and without a person; the same answers as `canAuthor`, `canProposePublication` and `canTeach` give today); "canProposeCourse: an admin with a person, a linked fellow; not an admin with no person, not an unlinked fellow, not a student". Run: FAIL, names missing.
- [ ] **Step 2: Failing int tests** **[verify]** (`src/owner-delete.int.test.ts`, with the network mock of Int test setup), as a member author and a fellow with persons, documents made through the review path (author submits, admin declines with a note):
  - "an owner deletes a declined, never-published article".
  - "an owner deletes a declined course that has a session" through `rest('POST', 'courses/{id}/delete', { token })`, with the fellow's token from `payload.login`; 200; the course and its session are gone (`src/lib/course-delete.ts` removes sessions with `overrideAccess: true`).
  - "an owner cannot delete a submitted article" (throws, row stays) and "...a submitted course" (403 from the endpoint).
  - "an owner cannot delete a published article" (throws), as today.
  - "another member cannot delete the declined article" (throws).
  Expected: the two "deletes" tests FAIL (403 or `Forbidden`).
- [ ] **Step 3: Implement.** Run Step 1: PASS. Run **[verify]** Step 2: PASS. Also `src/access.unit.test.ts`, `src/portal-access.int.test.ts` and `src/lib/publishing.int.test.ts` pass.
- [ ] **Step 4: Audit.** `pnpm audit:access` (Mac worktree). Expected diff: one row. `collection:articles` `delete` becomes `isAdminOrOwn(ownsVia(authors),draft,while={"review.status":{"in":["draft","changes_requested","rejected"]}})`; its hash covers the source of `isAdminOrOwn`, which does not change, so the hash stays. The `adminPublishes(canAuthor)`, `adminPublishes(canTeach)` and `adminPublishes(canProposePublication)` rows do not change: the audit hashes the outer rule (`scripts/access-audit.ts:141-145`). Any other change: stop and report. Commit the code, the tests and the snapshot together.

### Task S7: Review, full suite, open PR 1b-1

**Skills:** code-review, then security-review.

**Interfaces:** Consumes S1 to S6. Produces PR 1b-1.

- [ ] **Step 1: code-review** against `main`, with the spec's Status model and Lists (Delete) sections as the issue.
- [ ] **Step 2: security-review.** Write in the PR: the delete rule now admits `rejected` with `draft: true` for articles (snapshot row) and courses (`deleteCourse`, behind `POST /api/courses/{id}/delete`, which the audit does not see; read `blockedUnless` in `src/forms/delete-endpoints.ts` to confirm it counts with the same `where`); a submitted or published document stays undeletable by its owner (S6 tests); the `request` rule changes stored data only on live documents; `review.request` is written by the hook from what `submit-for-review.tsx:66` sends, and the hook decides what is stored; `review-status.ts` and `document-href.ts` read nothing; `mayAuthor` and `mayTeach` give the same answers as before (S6 unit tests); `rg -l "@/portal/" src/lib src/components src/i18n` prints nothing.
- [ ] **Step 3:** Fix. **[verify]** the full suite (`verify.sh <branch> <sha>`). Per-PR step 5. Open `feat(review): one status model, the request rule and owner delete (portal phase 1b, PR 1)`. Blast Radius: owners may now delete declined drafts in `/admin` too; a decline on a live document now keeps `review.request`, so the read-only Request field in `/admin` stays visible on a declined copy, with the new description; `/admin`'s removal note in `AdminDecision` (`submit-for-review.tsx:184`) is not affected, because `AdminDecision` renders only at `submitted`; no screen changes.

## PR 1b-2a. List data (`portal/phase-1b-list-data`)

From `portal/phase-1b-status` while 1b-1 is open; the PR targets `main` after 1b-1 merges. No screen, no message key, no change to `testing/portal.fixture.ts`. Reviews: code-review, then security-review.

### Task L2: The group table

**Skills:** tdd.

**Files:** Create `src/portal/lists/groups.ts`, `groups.unit.test.ts`.

**Interfaces:**

- Consumes: `StatusKey`, `STATUS_KEYS`, `waitsOn` (S2).
- Produces: `type ListKind = 'ownerArticles' | 'fellowCourses' | 'admin'`; `type GroupId = 'needsYou' | 'waitingOnAuthor' | 'inProgress' | 'withEditors' | 'proposals' | 'teachingNow' | 'published' | 'closed'`; `type PagedGroup = 'published' | 'teachingNow' | 'closed'`; `GROUPS: Record<ListKind, readonly GroupId[]>` in the spec's order; `PAGED: ReadonlySet<GroupId>` = the three paged groups; `groupOf(key: StatusKey, kind: ListKind, row: { hasSpace: boolean }): GroupId`; `workKeys(kind: ListKind): readonly StatusKey[]`, the keys whose group is not paged when `hasSpace` is false, derived from `groupOf` over `STATUS_KEYS` (P12); `type Chip = 'needsYou' | 'drafts' | 'published'`; `chipGroup: Record<ListKind, Record<Chip, GroupId>>` (Deviation 6).
- The table (a row goes to the first group that matches):

| Kind            | needsYou                       | then                                                                                       |
| --------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| `ownerArticles` | `waitsOn(key) === 'owner'`     | inProgress: `draft`, `published_unsent`, `published_edits_declined`; withEditors: `submitted`, `published_edits`, `published_removal`; published: `published`, `published_removal_kept`; closed: `rejected` |
| `fellowCourses` | `waitsOn(key) === 'owner'`     | teachingNow: any `published*` key, or `hasSpace`; proposals: `draft`, `submitted`; closed: `rejected` |
| `admin`         | `waitsOn(key) === 'admin'`     | waitingOnAuthor: `waitsOn(key) === 'owner'`; inProgress: `draft`; published: `published`, `published_unsent`, `published_edits_declined`, `published_removal_kept`; closed: `rejected` |

- [ ] **Step 1: Failing test:** "groupOf($key, $kind) is $group" for all 11 keys x 3 kinds, plus "a fellow's draft course with a space is teaching now"; "every key lands in a group of its kind's GROUPS"; "only work groups load in full" (`PAGED`); "workKeys($kind) is $keys" (owner articles: `draft`, `submitted`, `changes_requested`, `published_unsent`, `published_edits`, `published_removal`, `published_edits_returned`, `published_edits_declined`; fellow courses: `draft`, `submitted`, `changes_requested`, `published_edits_returned`; admin: `draft`, `submitted`, `changes_requested`, `published_edits`, `published_removal`, `published_edits_returned`); "each chip names a group of its kind". Run `pnpm exec vitest run --project node src/portal/lists/groups.unit.test.ts`: FAIL.
- [ ] **Step 2: Implement** as a `Record` per kind. Run: PASS. Commit.

### Task L3: The row loader

**Skills:** tdd, payload.

**Files:** Create `src/portal/lists/rows.ts`, `src/portal/lists/course-meta.ts`, `course-meta.unit.test.ts`, `rows.int.test.ts`, `testing/portal-lists.fixture.ts`. Modify `src/lib/meetings.ts` (export the internal `held` filter, `:75-76`, as `notCancelled`; `firstDay` and `lastDay` call it by the new name).

**Interfaces:**

- Consumes: `statusInputOf`, `statusOf`, `waitsOn`, `NOT_LIVE`, `LIVE_COPY`, `KEY_WHERE`, `REVIEWED_FIELDS` (S1, S2); `groupOf`, `workKeys`, `GROUPS`, `PAGED`, `ListKind`, `GroupId`, `PagedGroup` (L2); `ownsViaAuthors`, `ownsViaFellows`, `adminViewOf`, `personOf` (`src/access.ts`); `mediaPopulate`, `mediaThumbnail` (`src/lib/media-image.ts`); `meetingsOf`, `notCancelled`, `SessionTimes` (`src/lib/meetings.ts`); `cairoDay`, `cairoInstant` (`src/lib/cairo-day.ts`); `Season` (`src/lib/cycle.ts`); `CourseType` (`src/fields/course-type.ts`); `portalWorld`, `PortalWorld`, `PortalAccount`, `PASSWORD` (`testing/portal.fixture.ts` as on `main`, phase 1a A4); `mockNetwork`, `resendInbox`, `localServices` (Int test setup).
- Produces:
  - `type ListRow = { id: number; collection: 'articles' | 'courses'; key: StatusKey; group: GroupId; title: string | null; cover: string | null; updatedAt: string; waitingSince: string | null; owners: string[]; tier: 'public' | 'community' | null; course: { type: CourseType | null; season: Season | null; year: number | null; held: number; total: number } | null }`. Raw values only: the view turns `type`, `season` and `year` into words in the reader's language (L4), so the loader needs no translator. `title` follows Deviation 8 and is null when no locale has one. `updatedAt` is the latest version's on a work row and the main row's on a paged row. `waitingSince` is the latest version's `updatedAt` when `waitsOn(key) === 'admin'`. `owners` holds names on an admin list only. `tier` is the main row's `tier` when it is `public` or `community`; a row that was never published has `tier: 'owner'` (`src/fields/tier.ts`), so it gets null and its meta line shows no tier.
  - `type ListGroup = { id: GroupId; rows: ListRow[]; total: number; hasMore: boolean }`.
  - `type ListResult = { groups: ListGroup[]; total: number }`. `total` counts the reader's rows with no search and no filter: one `payload.count` of the main rows with the kind's base `where` (every document is one row). The chips, the search and the empty state read it (P10).
  - `type ListQuery = { collection: 'articles' | 'courses'; kind: ListKind; search: string | null; only: GroupId | null; pages: Partial<Record<PagedGroup, number>> }`.
  - `listKindOf(user: User, collection: 'articles' | 'courses'): ListKind | null`, from `adminViewOf(user)`: `admin` gives `admin`; `fellow` gives `ownerArticles` on articles and `fellowCourses` on courses; `student` gives `ownerArticles` on articles and null on courses; null gives null (the page then returns not found).
  - `loadList(payload: Payload, user: User, query: ListQuery, locale: Locale): Promise<ListResult>`, every read gated (`user`, `overrideAccess: false`).
  - `heldCount(sessions: SessionTimes[], now: Date): { held: number; total: number }` (`course-meta.ts`): `total` counts the sessions whose `cancelled` is not true. `held` counts those of them whose last meeting (`notCancelled(meetingsOf([session]))`) has ended before `now`: a timed meeting ends at `cairoInstant(date, end_time ?? start_time)`; an all-day meeting has ended when its `date` is before `cairoDay(now)`. A session with no meeting is not held.
- How `loadList` reads (the invariants; the implementer picks the query code):
  - **Base `where`** (also the `total` count). Owner kinds: the ownership `where` (`ownsVia…(user)`); with no person, return `{ groups: [], total: 0 }` with no query. Admin: `or: [{ _status: { equals: 'published' } }, { 'review.status': { in: ['submitted', 'changes_requested', 'rejected'] } }, ownsViaAuthors|Fellows(user)]`, the last term only when the admin has a person. So an admin list leaves out other people's not-live rows at `draft` and at `approved` (Review Focus 4).
  - **The work set** holds the rows of the groups that load in full, the keys of `workKeys(kind)`. `loadList` builds it on every call, whatever `only` says, because each paged query leaves out its ids (Review Focus 8). It has two kinds of candidates:
    - **Main candidates:** one gated `find` of main rows, `and: [base, { or: [KEY_WHERE[k].where for each main-row key k in workKeys(kind)] }]`. `KEY_WHERE.draft` holds the not-live `approved` state too, so an admin Unpublish row reads `draft` (with a warning) in In progress or Proposals. On an admin list the base `where` keeps only the admin's own not-live drafts, so the admin's own not-live `approved` row sits in In progress and `total` counts no row that no group shows.
    - **Copy candidates:** one gated `findVersions`. Its `where` is `or` of the `KEY_WHERE` rows of the version keys in `workKeys(kind)` when each of them has a row (admin, `fellowCourses`); else `LIVE_COPY`, the part those rows share (`ownerArticles`: `published_unsent` and `published_edits_declined` need a field compare, so `statusOf` decides). It has no ownership term and no other `parent.*` term (Global Constraints, Owner lists filter by owner).
    - **Rows:** for the candidate ids, one main read `and: [base, { id: { in: ids } }]` (a parent outside the base `where` drops out here) and one read of their latest versions (`parent in ids`, `latest: true`, newest `updatedAt` per parent). `statusInputOf`, then `statusOf`, gives each key, and `groupOf` its group. A candidate whose group is paged (a `fellowCourses` draft with a space; an owner's equal copy) leaves the work set. Work rows sort by the latest version's `updatedAt`, newest first.
  - **Co-authors.** Each owner sees what their version access gives them (U4; spec, Status model, Access). A co-author removed in the copy finds no copy: their row reads the live row alone, key `published`, in Published, until an admin approves the copy. A co-author added only in the copy owns no main row, so the main read drops the copy candidate and the row is not on their list until the approval.
  - **Paged groups.** 50 rows times `pages[group]` (default 1), `sort: '-updatedAt'` on the main row. Each `where` adds `id not_in` the work set's ids and is disjoint from the earlier paged groups by its own terms, so `only` can load one paged group with no other: `published`: `_status: published`. `teachingNow`: `_status: published`, or `id in` the reader's courses that have a space (a gated `find` of `spaces`, `select: { course: true }`; a fellow who cannot read a space leaves that course in Proposals or Closed). `closed`: `_status: draft`, `review.status: rejected`, and on `fellowCourses` `id not_in` those space courses. Each page then reads the latest versions of its ids in one `findVersions` (`parent in ids`, `latest: true`, newest per parent) and builds each key with `statusInputOf`, so a paged row reads `published_unsent`, `published_edits_declined` or `published_removal_kept` when its copy says so. Every paged row's `groupOf` is its group (L3 tests it).
  - **Reads and the compare.** A version read is `depth: 0`, `locale: 'all'`, `select: { parent: true, version: { title: true, review: true, updatedAt: true, _status: true, …REVIEWED_FIELDS[collection] as `field: true` } }` (U9). The main row that `hasUnsentEdits` compares with it is read at `depth: 0`, `locale: 'all'`, with the same field list, so a relationship (cover, authors, fellows) is an id on both sides. Covers, owner names and the cycle come from one more main read of the rows shown, at `depth: 1` with `select` and `populate` (`{ media: { ...mediaPopulate, sizes: true }, people: { name: true }, cycles: { season: true, start_year: true } }`).
  - **Courses.** One gated `find` of `sessions` (`course in` the shown ids, `select` of the times and `cancelled`) gives `heldCount` per course. The read passes the course's own access (`throughRelation('course', readCourse)`, `src/collections/Sessions.ts:100`).
  - **Search.** `search` adds `or: [{ 'title.en': { like } }, { 'title.ar': { like } }]` (U8) to the main candidates and to each paged query, and `or: [{ 'version.title.en': { like } }, { 'version.title.ar': { like } }]` to the copy candidates; the union decides. The main read of the candidates' rows adds no search term. A paged row matches on its main row's title, which an admin's paged row shows (Deviation 8). `like` keeps `%` and `_` as wildcards: they only widen a match over rows the reader may read. `only` returns that one group. Neither changes `total`.
  - Groups with no rows are dropped. A group's `total` comes from the query's `totalDocs` for a paged group, from the row count for a work group.
  - The admin review queue (`src/lib/review-queue.ts:36-62`) already merges the main row with the latest version. It moves to `statusInputOf` in phase 1c, with `needs()`; 1b does not touch it.

- [ ] **Step 1: Fixture, articles.** `listWorld(payload, track, world)` in `testing/portal-lists.fixture.ts`. It writes every row with no `user` and `overrideAccess: true`: that is the hook's trusted path, and `notifyReview` returns at once with no user, so the fixture sends no mail and makes no notification row. An approval written this way still runs `publishOwners` (`review-hooks.ts:258-270`), which sets the owners' people `visible: true`; no 1b test reads `visible`. It sets `authors` or `fellows` itself. The owner path is proven in S2, S3 and S6, not here. This step makes: one student article for each of the 11 keys (`articles: Record<StatusKey, number>`), the `published_removal_kept` one with a cover (one `media` row, made as `src/portal-access.int.test.ts:866-873` does); `unpublished`, a student article published, then set to `_status: 'draft'` on the main row (as an admin Unpublish does, `review.status` stays `approved`); and `shared`, a live student article with `authors: [student, poster]` and a draft copy (a draft save) whose `authors` is `[student]` only. Every row through `track`. Failing check: `rows.int.test.ts` (Int test setup) "listWorld makes each article key" (the 11 article ids read their keys through `statusOf`; `unpublished` reads `draft`). Run **[verify]**: FAIL, module missing; write this part; PASS. Commit.
- [ ] **Step 2: Fixture, courses, bulk rows and accounts.** `listWorld` also returns `courses: Record<'published_edits' | 'published_edits_returned' | 'draft' | 'rejected', number>`, `bulk: number[]`, `teacher: PortalAccount` and `writer: PortalAccount`. `teacher` is a fellow account with a person, made for this fixture, so its Courses list holds exactly its 4 courses (fewer than 7, L6): a published course with edits waiting (`published_edits`, two badges), a published course with its copy at `changes_requested` (`published_edits_returned`), a draft proposal, and a declined one with a session. `bulk`: 60 published student articles, titles `uniq('Bulk')`. `writer`: an admin account with a linked person (a `people` row and a `users` row with `roles: ['admin']`, password `PASSWORD`), with one draft article of its own and one not-live `approved` article of its own (`writerUnpublished`). Failing check: "listWorld makes the courses, the bulk rows and the accounts" (the 4 course keys; 60 bulk ids; `teacher` and `writer` have a person). Run **[verify]**: FAIL; write; PASS. Commit.
- [ ] **Step 3: Owner article work groups.** Failing tests in `rows.int.test.ts` **[verify]**, with `portalWorld` and `listWorld`, each assertion on the fixture's ids:
  - "an unpublished approved article reads draft in In progress" (`unpublished`: key `draft`, group In progress, in one group only).
  - "each article reads its key and sits in its group" (the student's list: the 11 rows, each `key` and `group` as L2's table).
  - "Needs you holds the KEY_WHERE rows of the owner keys" (the student's Needs you ids, inside the fixture's ids, equal the ids that the `KEY_WHERE` rows of `changes_requested` and `published_edits_returned` find as the student, inside the same ids).
  - "the row shows the newest title" (the `draft` article autosaved to a new title as the student, `overrideAccess: false`: the row's title is the new one; Review Focus 2).
  - "finds the draft copy of a live article" (U5, U9; `published_unsent` is in In progress, `published_edits` in With editors).
  - "work rows are newest first".
  - "a student sees only their own articles" (no row whose id is not the student's; a public article of another author is absent).
  - "a co-author removed in the copy reads published" (U4: on `poster`'s list, `shared` reads `published` and sits in Published, with the live title; on the student's list it reads `published_unsent` in In progress).
  - "a co-author added in the copy does not see the row" (the student saves a draft copy of a live article that adds `poster` to `authors`: the row is not on `poster`'s list).
  - "a reader with no person owns no row" (a synthetic `{ id: -1, roles: ['member'], person: null }` user: `{ groups: [], total: 0 }`; Review Focus 1).
  Implement the base `where`, the work set and `listKindOf`. Run: PASS. Commit.
- [ ] **Step 4: Paged groups.** Failing tests **[verify]**:
  - "an equal draft copy sits in Published" (Review Focus 3: the `published_removal_kept` row, which has a cover, is in Published, page 1, and reads `published_removal_kept`, not `published_unsent`).
  - "Published shows 50 rows and has more" (60 bulk rows: `published` group `rows.length` 50, `total` 60 or more, `hasMore` true; with `pages: { published: 2 }` all bulk ids are in it; no id is in two groups).
  - "only published leaves out the work rows" (`only: 'published'`: no row of the student's `published_unsent`, `published_edits` or `published_edits_declined` articles; the `published` and `published_removal_kept` rows are there). "only closed shows the declined row only" (`only: 'closed'`: of the fixture's ids, only the `rejected` article).
  - "every paged row belongs to its group" (each row's `groupOf(key)` equals its group's id).
  - "every counted row sits in one group" (the student, with `pages: { published: 20 }`, no search and no filter: the sum of the groups' `total` equals `total`, and no id is in two groups).
  Implement. Run: PASS. Commit.
- [ ] **Step 5: Courses.** Failing tests: `course-meta.unit.test.ts` (`pnpm exec vitest run --project node src/portal/lists/course-meta.unit.test.ts`): "heldCount counts sessions whose last meeting has ended", "a cancelled session counts in neither", "a session that ends today in Cairo after now is not held", "an all-day meeting is held from the next Cairo day", "a session with no meeting counts in total, not in held". `rows.int.test.ts` **[verify]**: "the teacher's live course with edits waiting is teaching now and reads published_edits"; "only teachingNow leaves out a live course that waits on the teacher" (`only: 'teachingNow'`: no `published_edits_returned` row; without `only` it is in Needs you); "a course row has its type, season, year and session counts". Implement. Run: PASS. Commit.
- [ ] **Step 6: Admin kind, search, filter and total.** Failing tests **[verify]**:
  - "an admin does not see another owner's draft" (Review Focus 4: the student's `draft` article and `unpublished` are not in the admin list; its `submitted` one is in Needs you; `writer`'s own draft and `writerUnpublished` are in In progress).
  - "the admin's Needs you and Waiting on the author hold the KEY_WHERE rows" (as `writer`, inside the fixture's ids: Needs you equals what the `KEY_WHERE` rows of `submitted`, `published_edits` and `published_removal` find; Waiting on the author equals `changes_requested` and `published_edits_returned`).
  - "every fixture row on the admin list sits in one group" (as `writer`, with `pages` at 20: each fixture id that the base `where` admits is in exactly one group; the table is shared, so the test does not compare sums).
  - "an admin row shows the live title unless it waits on the admin" (the `published_unsent` row's title is the main row's; the `published_edits` row's is the copy's).
  - "a student and a fellow have no list kind for nothing they may open" (`listKindOf` is null for a student on courses and for an account with no role).
  - "search finds a row by its draft title" and "search finds a row by its title in the other language" (U8).
  - "only loads one group, and total still counts every row" (`only: 'needsYou'`: one group of 2 rows, `total` above 6).
  - "a search keeps total" (a search with 1 hit: `total` above 6).
  Implement. Run: PASS. A U5, U8 or U9 failure takes its fallback; the commit says which. Commit.

### Task L8: Review, full suite, open PR 1b-2a

**Skills:** code-review, then security-review.

**Interfaces:** Consumes L2, L3. Produces PR 1b-2a.

- [ ] **Step 1: code-review** against `main` (or `portal/phase-1b-status` while 1b-1 is open), with the spec's Lists (Behavior, Data, Access) as the issue.
- [ ] **Step 2: security-review.** Write in the PR: every list read is gated and owner kinds add the ownership `where` to their main reads (L3 tests); version reads rely on the version access, and their parents pass a main read under the base `where`, so a co-author sees only what their version access gives them (L3 co-author tests); an admin list leaves out other people's not-live rows at `draft` and `approved`; `listKindOf` gives null before any read for a student on courses and for an account with no role; the fixture writes as the server only in tests; `rg -l "@/portal/" src/lib src/components src/i18n` prints nothing.
- [ ] **Step 3:** Fix. **[verify]** the full suite. Per-PR step 5. Open `feat(portal): list data for Articles and Courses (portal phase 1b, PR 2a)`.

## PR 1b-2b. List screens (`portal/phase-1b-lists`)

From `portal/phase-1a-shell` (PR C) once PR C is open, with `portal/phase-1b-status` and `portal/phase-1b-list-data` merged in. Changes portal screens: operator review before merge (phase 1a's gate for PR C).

### Task L1: Messages and nav items

**Skills:** tdd, better-writing, then humanizer.

**Files:** Modify `src/portal/nav/portal-nav.ts`, `portal-nav.unit.test.ts`, `nav-icons.ts` (all from PR C, task C2), `messages/en.json`, `messages/ar.json`, `src/lib/review-status.unit.test.ts`, `e2e/portal-shell.e2e.test.ts` (the 1b nav assertions). If PR C lacks Request 2: create `testing/portal-e2e.test-utils.ts` and move the helpers out of `e2e/portal-shell.e2e.test.ts`, in a commit of its own, first; if it has no `openMore`, write it there.

**Interfaces:**

- Consumes: `PortalNavItem`, `portalNav` (C2); `adminViewOf` (`src/access.ts`); `statusBadge`, `nextAction`, `STATUS_KEYS` (S2, S4); `portalWorld`, `inContext`, `ROLES`, `LOCALES`, `WIDTHS`, `MESSAGES` (A4, C1); `openMore` (Request 2, or written here).
- Produces: `PortalNavItem['key']` adds `'articles' | 'courses'`; `PortalNavIcon` adds `'articles' | 'courses'` (lucide `file-text`, `book-open`). Items, from `adminViewOf(user)`, in order after Home: Articles (`/spaces/articles`; group `myWork` for `student` and `fellow`, `admin` for `admin`), Courses (`/spaces/courses`; `myWork` for `fellow`, `admin` for `admin`, none for `student`). No item for a null view. `count: null`, `external: false` (Deviation 11). Admin order in the `admin` group: Articles, Courses, Open dashboard.
- Messages under `Portal`, English and Arabic (gender-neutral, ICU plurals; every number through `digits`, Global Constraints; Arabic plurals as the repo's Arabic messages write them, `=1` and `other`): `nav.articles` "Articles", `nav.courses` "Courses"; every `status.*` and `next.*` key of S4, with the spec's English labels and next-action lines and the 1b owner lines of Deviation 13; `lists.*`: `myArticles` "My articles", `allArticles` "All articles", `myCourses` "My courses", `allCourses` "All courses", `metaTitle` "{name} — CILAS" (as the other portal pages' `metaTitle`), `newArticle` "New article", `proposeCourse` "Propose a course", `openDashboard` "Open dashboard", `group.needsYou` "Needs you", `group.inProgress` "In progress", `group.withEditors` "With editors", `group.published` "Published", `group.closed` "Closed", `group.teachingNow` "Teaching now", `group.proposals` "Proposals", `group.waitingOnAuthor` "Waiting on the author", `groupCount` "{name}, {count, plural, one {{count, number, digits} item} other {{count, number, digits} items}}", `chips.label` "Filter", `chips.all` "All", `chips.needsYou` "Needs you", `chips.drafts` "Drafts", `chips.published` "Published", `search` "Search", `noResults` "No results for \"{query}\"." (Deviation 15), `clearSearch` "Clear search", `noneInFilter` "Nothing here now.", `showAll` "Show all" (Deviation 16), `showMore` "Show more", `moreRows` "{count, plural, one {{count, number, digits} more row.} other {{count, number, digits} more rows.}}", `loadError` "The list could not load.", `retry` "Retry", `untitledArticle` "Untitled article", `untitledCourse` "Untitled course", `meta.updated` "Updated {when}", `meta.waiting` "Waiting {days, plural, one {{days, number, digits} day} other {{days, number, digits} days}}", `meta.held` "{held, number, digits} of {total, number, digits} held", `tier.public` "Public", `tier.community` "Community"; the empty states of the spec's Onboarding list for Articles, All articles, Courses (fellow), All courses (admin).

- [ ] **Step 1: Failing unit tests.** In `portal-nav.unit.test.ts`: "roles %j see %j" updated (`member`, `non_degree_seeking`: `['home', 'articles']`; `fellow`: `['home', 'articles', 'courses']`; `admin`, `super_admin`: `['home', 'articles', 'courses', 'openDashboard']`; no role: `['home']`); "a student's Articles item is in My work, an admin's in Admin". In `review-status.unit.test.ts`: "every status and next-action key exists in both languages" (all keys `statusBadge` and `nextAction` return, read from `messages/{en,ar}.json`). Run: FAIL.
- [ ] **Step 2: Failing nav e2e** **[verify]** in `e2e/portal-shell.e2e.test.ts` (spec, Navigation, Tests: "These checks live in `portal-shell`"), role x locale x 1440/390: Articles for every role and Courses for fellow and admin, each in its group (student and fellow: My work; admin: Admin, before Open dashboard), with no count; at 390 inside `openMore`; folded, each 1b link has the same accessible name as unfolded (C9's check, or written here if C9 is not there). If Request 3 landed, these are rows in its tables. Commit the test alone, push, and run `verify.sh --e2e-only <branch> <sha> e2e/portal-shell.e2e.test.ts`: FAIL (no Articles or Courses item).
- [ ] **Step 3: Implement.** Run Step 1: PASS. Push and run Step 2 **[verify]**: PASS. Commit.

### Task L4: The row, the list body, the page header and the empty states

**Skills:** tdd, modern-web-guidance, arc, better-layout, better-typography, better-accessibility, better-writing, then humanizer.

**Files:** Create `src/portal/lists/list-row.tsx`, `list-view.tsx` (the Body and `resultOrFailed`; L5 adds `ListView`), `empty-states.ts`, `page-header.tsx`, `status-icons.ts`, `lists.module.css`, `list-view.unit.test.tsx`, `list-row.browser.test.tsx`. Modify `testing/server-intl.test-utils.ts`: `Namespace` adds `'Portal'` and `'Study.filters'`, and `serverTranslator` passes `formats: formatsOf(locale)` and `timeZone: CAIRO`, as `src/i18n/request.ts:24-31` does, so a test formats numbers as the app does.

**Interfaces:**

- Consumes: `ListRow`, `ListGroup`, `ListResult` (L3); `ListKind`, `Chip` (L2); `statusBadge`, `nextAction`, `StatusIcon` (S2, S4); `documentHref` (S5); Arc `Badge`; next-intl `getTranslations`, `getFormatter` (types only); `Study.filters.types`, `Study.filters.seasons` messages; `localDigits`, `numberingSystemOf` (`src/lib/digits.ts`); `formatsOf` (`src/i18n/formats.ts`); `serverTranslator`, `serverFormatter` (`testing/server-intl.test-utils.ts`); `renderToStaticMarkup` (`react-dom/server`). Pattern: `testing/README.md`, "Server code with framework inputs"; exemplar `src/components/events/event-attendance.unit.test.tsx`.
- Produces:
  - In `list-row.tsx`: `type PortalTranslator = Awaited<ReturnType<typeof getTranslations<'Portal'>>>`, `type StudyFiltersTranslator = Awaited<ReturnType<typeof getTranslations<'Study.filters'>>>`, `type Formatter = Awaited<ReturnType<typeof getFormatter>>`, from type-only imports of `next-intl/server` (as `testing/server-intl.test-utils.ts:2`), so the browser test loads no server code.
  - `STATUS_ICONS: Record<StatusIcon, LucideIcon>` (`status-icons.ts`): the nine lucide components (all exist in lucide-react 1.49.0, `ArchiveRestore` included). It sits in `src/portal/lists/`, because `src/lib` imports no UI.
  - `PortalPageHeader({ title, subtitle, primary }: { title: string; subtitle?: string; primary?: { label: string; href: string; external: boolean } }): React.JSX.Element` (server): `h1` 28px, subtitle 15px, at most one primary (`--foreground` fill, pill), no secondary slot (Deviation 19). An external `href` (`/admin/...`) renders `<a>`, a full load, as phase 1a's `external` nav item.
  - `ListRowBody({ row, viewer, t, tStudy, format, locale, now }: { row: ListRow; viewer: 'owner' | 'admin'; t: PortalTranslator; tStudy: StudyFiltersTranslator; format: Formatter; locale: Locale; now: Date }): React.JSX.Element`: an `<li>` container (spec, Rows and cards with actions): the 40x40 slot at `--radius-inner` (`<img alt="">` from `row.cover`, else an empty `--surface-muted` box with no letter and no icon); the title as the one link, to `documentHref({ collection, id })`, an `<a>` (admin URL, full load), 15px, one line, ellipsis, `dir="auto"`, in `<bdi>`; the meta line 13px. Article: "Updated {when} · {tier}", `when` from `format.relativeTime(new Date(row.updatedAt), { now, numberingSystem: numberingSystemOf(locale) })`; an admin row adds the owner names and "Waiting {days}" when `waitingSince` (whole days from `waitingSince` to `now`). Course: "{type} · {season} {year} · {held} of {total} held": the type from `tStudy(\`types.${type.toLowerCase()}\`)`, because `CourseType` values are upper case (`CORE`) and the message keys lower case (as `src/api/courses.api.ts:133`), the season from `tStudy(\`seasons.${season}\`)`, the year through `localDigits`; each part left out when it is missing. Then the badges (Arc `Badge` with `STATUS_ICONS[icon]`, label from `Portal`) and the next-action line. A course row has no applicant link and no Participants link. It imports no server module, so the browser test may render it.
  - `emptyStateOf(collection: 'articles' | 'courses', kind: ListKind, createHref: string | null): { titleKey: string; bodyKey: string; nextKey?: string; action?: { labelKey: string; href: string; external: true } }` (`empty-states.ts`, pure): the spec's Onboarding empty states. Owner kinds take only the href from `createActionOf` (L5), with their own label (**Write an article**, **Propose a course**), and no action when it is null; All articles has no action; All courses has **Open dashboard** to `/admin`. Every action is an `/admin` URL, so `external` is true.
  - `ListViewBody({ result, query, hrefs, empty, moreOf, t, tStudy, format, locale, now }: { result: ListResult | 'failed'; query: { q: string | null; show: Chip | null }; hrefs: { retry: string; clearSearch: string; showAll: string }; empty: React.ReactNode; moreOf: (group: ListGroup) => React.ReactNode; t; tStudy; format; locale; now: Date }): React.JSX.Element`. The caller builds the three hrefs (L5, `hrefOf`), and `empty` and `moreOf` are slots, so the Body imports nothing of L5, and neither `@/i18n/navigation` nor `next/link`: no node unit test in the repo renders either (the exemplars render plain `<a>`). In order: `'failed'`: "The list could not load." with **Retry** (a plain link to `hrefs.retry`). `result.total === 0`: the `empty` slot. No groups and `q`: "No results for "{query}"." and **Clear search** (`hrefs.clearSearch`). No groups and `show`: "Nothing here now." and **Show all** (`hrefs.showAll`). No groups otherwise (a write between the count and the reads): the `empty` slot. Else one `<section aria-labelledby>` per group with an `<h2>` holding the name and the count (`lists.groupCount`, counts in `tabular-nums`), then an `<ol>` of `ListRowBody`, then `moreOf(group)`.
  - `resultOrFailed(load: () => Promise<ListResult>, log: (error: unknown) => void): Promise<ListResult | 'failed'>` (`list-view.tsx`): the list page's one catch; on a throw it calls `log` once and gives `'failed'`.

- [ ] **Step 1: Failing unit tests** (`pnpm exec vitest run --project node src/portal/lists/list-view.unit.test.tsx`; `renderToStaticMarkup` of the `…Body` components with `serverTranslator('Portal', locale)`, `serverTranslator('Study.filters', locale)`, `serverFormatter(locale)` and a fixed `now`; rows from a `listRow(overrides)` helper in the test file):
  - "every row has a slot, a badge and a next-action line" (one row per key).
  - "every badge shows its icon" (one `svg` per badge, two on a live key with a copy).
  - "a row with no cover shows an empty slot with no text".
  - "the title is the only link of the row and opens the admin URL".
  - "a course row has no applicant link and no Participants link" (exactly one link per row).
  - "a course row names its type and season in Arabic" (`ar`, `course_type: 'CORE'`: the Arabic type and season; the year, held and total in Arabic-Indic digits).
  - "an Arabic row writes its numbers in Arabic digits" (`ar`: "Updated …", "Waiting {days}" and the group count in the `h2` hold Arabic-Indic digits and no digit 0 to 9).
  - "a live course with edits waiting shows two badges".
  - "groups keep their order, each a section with an h2 that names its count".
  - "the admin row names the owner and how long it waits".
  - "emptyStateOf gives each role's empty state" (a table on the pure function): Articles (owner: **Write an article** to `/admin/collections/articles/create`, then "Drafts save. Nothing is sent until you submit."), Articles with no create href (no action), All articles (no action), Courses (fellow: **Propose a course**), All courses (admin: **Open dashboard** to `/admin`); every key exists in `messages/en.json` and `messages/ar.json`.
  - "a list with no row renders the empty slot" (`total` 0: the slot's markup and no section).
  - "a search with no result offers Clear search"; "a filter with no row offers Show all"; "a filtered list with rows shows no empty state" (`total` above 0, one group); "a list whose rows are gone shows the empty slot" (`total` 3, no group, no `q`, no `show`).
  - "a failed load shows the error line and Retry".
  - "a load that throws gives failed and logs once" (`resultOrFailed`); "a load that resolves gives its result".
  Run: FAIL.
- [ ] **Step 2: Implement** the Body, the row, the header, the empty states, the icons and the `serverTranslator` change. Run Step 1: PASS. Also run `pnpm exec vitest run --project node src/components/events/event-attendance.unit.test.tsx src/lib/public-event-card.unit.test.tsx` (the other `serverTranslator` users): PASS. `pnpm exec tsgo --noEmit` exits 0. Commit.
- [ ] **Step 3: Failing browser test** **[verify]** (`list-row.browser.test.tsx`, renders `ListRowBody` only): "a 120-character Arabic title with no space stays on one line at 390 and 1440, in rtl and ltr" (the row's `scrollWidth` at most its `clientWidth`; the title ends in an ellipsis); "two badges and the meta line fit at 320"; "the row link is at least 24x24". Run with the row unstyled: FAIL.
- [ ] **Step 4: Implement** `lists.module.css`. Run **[verify]**: PASS. Commit.

### Task L5: The list view, the pages, chips, search and Show more

**Skills:** tdd, modern-web-guidance, better-accessibility.

**Files:** Create `src/app/(frontend)/[locale]/(portal)/spaces/articles/page.tsx`, `.../spaces/courses/page.tsx`, `src/portal/lists/list-page.tsx`, `list-params.ts`, `list-params.unit.test.ts`, `create-action.ts`, `create-action.unit.test.ts`, `list-chips.tsx`, `list-search.tsx`, `show-more.tsx`, `show-more.dom.test.tsx`. Modify `src/portal/lists/list-view.tsx` (adds `ListView`). If PR C lacks Request 1: modify `src/portal/feedback/empty-state.tsx` and `empty-state.dom.test.tsx`, in a commit of their own, first.

**Interfaces:**

- Consumes: `currentReader` (cached, C8); `listKindOf`, `loadList`, `ListQuery` (L3); `ListViewBody`, `resultOrFailed`, `emptyStateOf`, `PortalPageHeader`, `PortalTranslator` (L4); `chipGroup`, `Chip`, `PagedGroup` (L2); `mayAuthor`, `canProposeCourse` (S6); `announce` (C4); `LiveRegion` (C4, test only); `PortalEmptyState` with `external` (C6, Request 1); next-intl `Link` (`@/i18n/navigation`); Arc `SearchField`; in `node_modules/next/dist/docs/01-app/`: `03-api-reference/03-file-conventions/page.md` (`searchParams` is a Promise), `03-api-reference/02-components/link.md` (`scroll={false}`), `03-api-reference/04-functions/generate-metadata.md`, `01-getting-started/04-linking-and-navigating.md:346-392` (`window.history.replaceState`).
- Produces:
  - `type ListParams = { q: string | null; show: Chip | null; pages: Partial<Record<PagedGroup, number>>; focus: PagedGroup | null }`. `parseListParams(searchParams: Record<string, string | string[] | undefined>): ListParams` (`list-params.ts`, pure). `q`: the first value, trimmed, cut to 100 characters, null when empty. `show`: `needsYou`, `drafts` or `published`, else null. One page count per paged group (`published`, `teaching` for `teachingNow`, `closed`): an integer from 1 to 20, anything else is 1. `focus`: `published`, `teaching` or `closed`, read as that group, else null.
  - `hrefOf(path: string, params: ListParams): string` (pure): `path` with each param that is not its default, in a fixed order, and `focus` only when it is set. `path` is `/spaces/articles` or `/spaces/courses`. A next-intl `Link` takes it as it is and adds the locale. A plain `<a>` and the search form take `/${locale}` before it, because `localePrefix` is `'always'`.
  - `controlsShown(total: number, params: ListParams): boolean` (pure): `total > 6 || params.q !== null || params.show !== null` (Deviation 18).
  - `createActionOf(collection: 'articles' | 'courses', user: User): { labelKey: 'lists.newArticle' | 'lists.proposeCourse'; href: string } | null` (`create-action.ts`, pure): **New article** to `/admin/collections/articles/create` when `mayAuthor(user)`; **Propose a course** to `/admin/collections/courses/create` when `canProposeCourse(user)`; else null. The header shows its label and href; the owner kinds' empty state takes only its href (`emptyStateOf`, L4), so the two never disagree on who may create (P11).
  - `ListView({ result, params, collection, kind, user, locale })` (server, `list-view.tsx`): awaits `getTranslations('Portal')`, `getTranslations('Study.filters')` and `getFormatter()`, and renders `ListViewBody` with `now: new Date()`. It fills `empty` with `PortalEmptyState` from `emptyStateOf(collection, kind, createActionOf(collection, user)?.href ?? null)`, translated, with `external: true`. It fills `moreOf(group)` with **Show more** when `hasMore` (a next-intl `Link`, `scroll={false}`, to `hrefOf(path, { ...params, pages: { ...params.pages, [group]: n + 1 }, focus: group })`) and with `NewRowsFocus` for every paged group whose page count is above 1. `hrefs`: `retry` keeps every param but `focus`; `clearSearch` drops `q`; `showAll` drops `show`. No test renders it.
  - `ListPage({ collection, locale, searchParams })` (`list-page.tsx`, server). Both route files only await `params` and `searchParams` and render it, and export `generateMetadata`: `{ title: t('lists.metaTitle', { name }), robots: { index: false } }`, as the other portal pages, with `name` the page's H1 for the reader's role (`myArticles`, `allArticles`, `myCourses`, `allCourses`; WCAG 2.4.2); `{}` when `listKindOf` is null, because the page then calls `notFound()`. The page reads the user; `listKindOf` null calls `notFound()` (a student on Courses), with no boundary above it. The header's primary button comes from `createActionOf`. The result is `await resultOrFailed(() => loadList(…), (error) => console.error('[portal-lists]', error))`; on `'failed'` the header still renders.
  - `ListChips({ total, params, path })` (server): renders when `controlsShown(total, params)`. One `<nav aria-label={chips.label}>` of next-intl `Link`s (soft navigation; All, Needs you, Drafts, Published, each to `hrefOf` with that `show` and no `focus`), the current with `aria-current="true"`; each link at least 24x24, 44x44 under `(pointer: coarse)`. The search shows under the same rule.
  - `ListSearch({ q, show, action, label, clearLabel })` (client, `list-search.tsx`): a GET `<form role="search" action={action}>` (`action` is `/${locale}` plus the path) that holds the text in state, renders Arc `SearchField` with `name="q"`, `value`, `onValueChange`, `clearLabel` from `lists.clearSearch`, and a hidden `show` input when `show` is set.
  - `NewRowsFocus({ group, firstNewIndex, message, focus }: { group: PagedGroup; firstNewIndex: number; message: string; focus: PagedGroup | null })` (client, `show-more.tsx`). It reads only its props, no module state (P13). In an effect keyed on `focus` and `firstNewIndex`: when `focus === group` and the group's section has a row link at `firstNewIndex`, it moves focus to that link, calls `announce(message)` once, and takes `focus` out of the URL with `window.history.replaceState` (U7). An index past the last row (`?published=20` on a short list) does nothing. `firstNewIndex` is `(pages - 1) * 50`; `message` is `t('lists.moreRows', { count })`, translated on the server, with `count` the rows from that index on.

- [ ] **Step 1: Failing unit tests** (`pnpm exec vitest run --project node <file>`): `list-params.unit.test.ts`: "show takes only the three chips", "a page count is an integer from 1 to 20, else 1", "q is trimmed, cut to 100 characters, and empty is null", "focus takes only the three paged groups", "hrefOf leaves out default values, in a fixed order", "hrefOf gives back what parseListParams reads", "controlsShown($total, $params) is $shown" (6 and none: false; 7: true; 0 with `q`: true; 2 with `q`: true; 2 with `show`: true). `create-action.unit.test.ts`: "a linked student and fellow get New article", "a linked fellow and an admin with a person get Propose a course", "an admin with no person gets no Propose a course", "a student gets none on courses". Run: FAIL. Implement `list-params.ts` and `create-action.ts`. Run: PASS. Commit.
- [ ] **Step 2: Failing dom test** (`pnpm exec vitest run --project dom src/portal/lists/show-more.dom.test.tsx`; `LiveRegion` mounted; rows as plain `<ol><li><a>` markup in a section; the test does not render the **Show more** link, because no dom test in the repo renders a router link, and L6 proves its click):
  - "with focus set, focus moves to the first new row and one announcement says how many" (60 rows, `firstNewIndex` 50, `focus: 'published'`, URL `?published=2&focus=published`: the 51st row's link has focus; the live region read once "10 more rows."; `location.search` no longer holds `focus`).
  - "with no focus, a render of page 2 moves no focus".
  - "a rerender for page 3 moves focus again" (then 110 rows, `firstNewIndex` 100: row 101 has focus; two announcements in all).
  - "an index past the last row moves no focus" (20 rows, `firstNewIndex` 50).
  Run: FAIL. Implement `NewRowsFocus`. Run: PASS. Commit.
- [ ] **Step 3: Implement** `ListView`, the pages, chips and search (Request 1 first, if PR C lacks it). Run the unit and dom tests of L4 and L5: PASS. `pnpm exec tsgo --noEmit` exits 0. Commit. L6 holds the e2e checks of these parts.

### Task L6: The `portal-lists` e2e acceptance checks

**Skills:** tdd, better-accessibility.

These checks run after L1 to L5, so they do not fail first: the failing tests of those parts are L1 (nav), L4 and L5 (unit, dom, browser). A check that fails here is a bug in L1 to L5: write a failing test at the lowest level that shows it, then fix it.

**Files:** Create `e2e/portal-lists.e2e.test.ts`, `e2e/portal-lists.empty.e2e.test.ts`. Modify `e2e/portal-shell.e2e.test.ts` (each 1b nav item lands on its page), `playwright.config.ts` (the empty-seed spec runs only on `cilas_empty`).

**Interfaces:**

- Consumes: `portalWorld`, `world.loners`, `holdSpacesMode`, `inContext`, `localePath`, `ROLES`, `LOCALES`, `WIDTHS`, `MESSAGES` (phase 1a A4, C1); `login` (`testing/login.test-utils.ts`); `listWorld` (L3); `AXE_TAGS`, `known`, `axeCounts`, `openMore` (`testing/portal-e2e.test-utils.ts`: Request 2, or L1); `EMPTY_ACCOUNTS` (`seed/empty.ts`); `EMPTY_DATABASE` (`seed/empty-url.ts`).
- Produces: in `playwright.config.ts`, `testIgnore` adds `*.empty.e2e.test.ts` unless the path of `DATABASE_URL` is `/${EMPTY_DATABASE}`; on `cilas_empty`, only `*.empty.e2e.test.ts` runs. So the normal run never meets the empty-seed spec, and the empty-seed run meets nothing else.
- Readers. The student is `world.accounts.student`; the fellow is `listWorld`'s `teacher`; the admin is `listWorld`'s `writer` (an admin with a person); the fixture admin (`world.accounts.admin`, no person) is used for the header check. `beforeAll` logs in each of them. PR C's `portalWorld` has courses and loners of its own, so a check names rows by id or title, never by the count of a whole list, except `teacher`'s Courses list, which holds only `listWorld`'s 4 courses.
- Matrix: role x locale x 1440/390, as phase 1a's Matrix rule. Exemptions (phase 1a Deviation 19 pattern): a student opens Courses only in "a student gets not found on Courses" (role); "Show more moves focus" and the keyboard walk run at 1440 and 390 in English only (one client code path, no locale branch).

- [ ] **Step 1: Nav landing** **[verify]** in `e2e/portal-shell.e2e.test.ts`: each Articles and Courses item lands on its page, 200, with the `h1` of the role, role x locale x 1440/390. Run `verify.sh --e2e-only <branch> <sha> e2e/portal-shell.e2e.test.ts`: PASS. Commit.
- [ ] **Step 2: Rows, groups and the header** **[verify]** (`e2e/portal-lists.e2e.test.ts`; `test.describe.configure({ mode: 'serial', timeout: 300_000 })`; `holdSpacesMode` held `on` in `beforeAll`):
  - "every row has a slot, a badge and a next-action line": on the student's Articles, the teacher's Courses and the writer's All articles, each `li` in a group section has the slot, at least one badge and the next-action line.
  - "the group order holds": the `h2`s in the spec's order for the role.
  - "Needs you holds the rows that wait on the reader": the student's `changes_requested` and `published_edits_returned` rows are in Needs you; the writer's Needs you holds the student's `submitted`, `published_edits` and `published_removal` rows.
  - "a live course with edits waiting shows two badges" (teacher).
  - "header buttons open the admin create pages": **New article** `href` is `/admin/collections/articles/create`; **Propose a course** for the teacher and the writer; none for the fixture admin, who has no person.
  - "a course row has no applicant link and no Participants link".
  - "each list's title is its H1 — CILAS": the document `<title>` of both pages, per role and locale.
  - "a student gets not found on Courses" (status 404 on a hard load).
  Run `verify.sh --e2e-only <branch> <sha> e2e/portal-lists.e2e.test.ts`: PASS. Commit.
- [ ] **Step 3: Chips, search and Show more** **[verify]**, same file:
  - "Published shows 50 rows and Show more" (student): with 60 bulk rows, Needs you shows its rows; Published shows 50 rows and **Show more**.
  - "Show more moves focus to the first new row" (U7): keyboard only, Tab to **Show more**, Enter; the URL holds `published=2` and, after the focus moves, no `focus`; page 2 is the last page, so **Show more** is gone; the 51st row's link is focused and still focused when the network is idle; the live region says "{n} more rows." once.
  - "filter chips and search show above 6 rows and stay under a filter": the student (more than 6 rows) sees them; a chip click sets `show` and the current chip has `aria-current="true"`; on `?show=needsYou` (2 rows) the chips and the search still show and **All** goes back; a search with 1 hit keeps them; a search with no match shows "No results for "{q}"." and **Clear search**.
  - "a small list has no chips and no search" (the teacher's Courses: 4 rows).
  - "a keyboard walk reaches every part of $list" (the student's Articles, the teacher's Courses): from the top, Tab reaches the skip link, the nav, the chips and the search when they show, the first row link, and **Show more** when it shows, in that order; each stop's `outline-style` is not `none`.
  Run: PASS. Commit.
- [ ] **Step 4: Accessibility and layout** **[verify]**, same file:
  - "the row link is 44x44 under a coarse pointer": a context with `hasTouch: true`; if Chromium does not match `(pointer: coarse)` there, record it in the commit and assert 24x24.
  - "axe finds no violation on the lists": for each list route, `axeCounts(page)` equals `known(route, role, locale, width)`, which is `{}` for the list shapes (C1's tags; light and dark at 1440; a list with a search open).
  - "reflow at 320 and 720" (student, English and Arabic): `scrollWidth <= innerWidth`.
  - "lists load with spaces off" (`set('off')` then `set('on')` in `finally`; one role per list).
  Run: PASS. Commit.
- [ ] **Step 5: Empty-seed e2e** **[verify]** (`e2e/portal-lists.empty.e2e.test.ts`, the Runner need; `verify.sh --e2e-only --db empty <branch> <sha> e2e/portal-lists.empty.e2e.test.ts`, or the runner's equivalent). The only empty-state e2e: the normal seed has none. It logs in with `EMPTY_ACCOUNTS` and writes nothing. Role x locale x 1440/390: "an empty list shows its role's empty state": the student and the fellow on Articles ("You have no articles yet. …", **Write an article** with `href` exactly `/admin/collections/articles/create`), the fellow on Courses (**Propose a course** with `href` exactly `/admin/collections/courses/create`), the admin on All articles ("No one has written an article yet.", no button) and All courses ("No courses yet.", **Open dashboard** with `href` exactly `/admin`); no chips and no search. "axe finds no violation on the empty lists". If the runner cannot run it, write so in the commit and stop for the Runner need. Run: PASS. Commit.

### Task L7: Review, full suite, open PR 1b-2b

**Skills:** ux-auditor, better-interface, then break-ui; code-review, then security-review.

**Interfaces:** Consumes L1, L4 to L6. Produces PR 1b-2b.

- [ ] **Step 1: Screen reviews** on the Mac: `verify.sh --keep --no-tests <branch> <sha>` keeps the app running; a scratch script (not committed) runs `portalWorld` and `listWorld` against the runner's database and prints the accounts. ux-auditor and better-interface on both lists, as each role, 1440 and 390, English and Arabic, light, dark, more contrast.
- [ ] **Step 2: break-ui** with the `agent-browser` CLI, headless, against the kept app: a 120-character Arabic title, a Latin title in an Arabic row, 0 rows, 1 row, 7 rows (chips appear), 60 rows, a filter with 2 rows, a course with no cycle and no type, a row with two badges at 320px. `agent-browser close` when done. Screenshots and findings in a PR comment.
- [ ] **Step 3: code-review** (spec Lists, Status model, Navigation as the issue), then **security-review**. Write in the PR: the pages read through `loadList` only (1b-2a's gated reads); `listKindOf` refuses a student on Courses before any read; links in rows are admin URLs only; the URL params are parsed to fixed values (`parseListParams`: `show` to three chips, page counts 1 to 20, `focus` to three paged groups, `q` trimmed and cut to 100 characters, then a `like` value whose `%` and `_` only widen a match over rows the reader may read); no new projection; `rg -l "@/portal/" src/lib src/components src/i18n` prints nothing.
- [ ] **Step 4:** Fix. **[verify]** the full suite. Per-PR step 5. Open `feat(portal): Articles and Courses lists (portal phase 1b, PR 2b)`.
