# Portal phase 0: security baseline. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Payload access rules match what the portal will show, before any portal page ships. Every access rule has a name that says what it allows. A committed audit prints those names and fails on a rule with no name. A non-admin cannot write `legacy_url`, `slug`, `space-preferences.digest_sent_at`, or a media file that is not a photo.

**Architecture:** PR A names every access function in `src/` (a codemod for three repeated arrows, named rules for the rest, and factories that name what they return). PR B walks the sanitized Payload config, prints one row per collection, global and data field with the name of each rule, and fails on a rule with no name. A Vitest file snapshot keeps the rows. PR C closes the field holes with field access and a slug hook. PR D adds one `beforeOperation` hook on media that checks the uploaded bytes for non-admins.

**Tech stack:** Payload 3.91.0 (Postgres adapter), Vitest (`node` project, `*.int.test.ts` and `*.unit.test.ts`), TypeScript 5.7.3 (the codemod uses its parser), sharp 0.35.5, pnpm.

**Source of truth:** `docs/superpowers/specs/2026-11-18-portal-design.md`, sections "Security baseline (phase 0)", "Migrations", "Tests" and the phase 0 block in "Phases". The spec wins over the research file. The owner decisions of 2026-11-18 (the access-rule naming PR, and the slug that follows the title until the first publish) change the plan as this file says. The PDF question is still open (Open question 1).

**Status of the code in this plan.** The code of PR A (Tasks 1 to 4), the audit of PR B (Tasks 7 and 8) and the first version of the slug hook of Task 12 were applied to a scratch copy of HEAD 5199dfd7 and run against the local database:

- PR A: `tsgo --noEmit` exit 0, `oxlint` clean, `src/access.unit.test.ts` and `src/collections/space-access.unit.test.ts` 71 passed. The codemod printed `replaced 72`. The completeness check printed `slots 223, unnamed 0`.
- PR B: `scripts/access-audit.int.test.ts` 7 passed, with `problems` empty on the real config. The snapshot has 1209 rows for 53 entities, and `oxfmt --check` keeps it as written.
- Task 12, first version of the hook: a probe test (not committed) passed 7 of 8 cases. The failed case was a publish of a publication, refused by Payload validation (`Introduction > Kind`), not by the slug rule. The plan publishes an article instead. A second probe showed that an Arabic retitle moved the slug to `anwan-arby`; the hook now follows the default locale only, and the same probe then kept `english-…` through an Arabic retitle and an Arabic publish.

PR C Tasks 10, 11 and 13 and all of PR D were not run. These changes of review rounds 2 and 3 were not run either (round 3: the publish check of the slug hook and its test, Task 12; round 4: the publish check now rests on the unique index, and the step order of Task 12): the `ownNotifications` rename (Task 3), the frozen `adminWritesOnly` (Tasks 2 and 4), the `sourceSetsAccess` helper and `scripts/access-audit.unit.test.ts` (Task 7), and the guards and three new tests of the slug hook (Task 12: no assignment without an English title, and the uniqueness check). Each "Expected" line for them is a prediction. When a run differs, find out why before you change the plan's code.

---

## Open questions for the owner

1. **PDF uploads to `media` from non-admins (blocks PR D only).** Today any signed-in account can store any file type in `media`, except the active types that Payload refuses (`src/collections/Media.ts` sets no `upload.mimeTypes`). The non-admin code paths that create media:

   | Path                        | Where                                                                                                                                                                                                                                                                                                                                        | File types today                                                       |
   | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
   | Profile form, server action | `src/lib/profile.ts:203` (`saveProfile`, called from `src/lib/profile-actions.ts`)                                                                                                                                                                                                                                                           | JPEG, PNG, WebP up to 5 MB, by claimed type (`src/lib/profile.ts:174`) |
   | Avatar upload route         | `src/lib/profile.ts:282` (`saveProfilePhoto`, called from `src/app/(frontend)/api/profile-photo/route.ts`)                                                                                                                                                                                                                                   | JPEG, PNG, WebP up to 5 MB, by claimed type (`src/lib/profile.ts:266`) |
   | `/admin` upload fields      | Articles `cover_image` (`src/collections/Articles.ts:81`), Publications `cover_image` (`src/collections/Publications.ts:65`), Courses cover (`src/collections/Courses.ts:181`), People photo (`src/collections/People.ts:59`, own person)                                                                                                    | any type                                                               |
   | `/admin` rich text          | The Lexical default features hold `UploadFeature` (`@payloadcms/richtext-lexical`, `dist/lexical/config/server/default.js`), and `src/lexical/default-features.ts:10` keeps them: Articles body (`Articles.ts:125`), Courses descriptions (`Courses.ts:223`, `:402`), Publications intro (`Publications.ts:76`), People bio (`People.ts:72`) | any type, PDF included                                                 |
   | `/admin` SEO meta image     | `seoPlugin({ uploadsCollection: 'media' })` (`src/payload.config.ts:392`) on courses, publications and articles (`src/lib/seo.ts:17`)                                                                                                                                                                                                        | any type                                                               |
   | REST and GraphQL            | `POST /api/media`, `createMedia`: `create: isAuthenticated` (`src/collections/Media.ts:19`)                                                                                                                                                                                                                                                  | any type                                                               |

   Not media: space post files and event covers go to `space-files` (`src/lib/spaces-write.ts:193`), and application files to `submission-files` (`src/forms/submit-with-files.ts:120`). The MCP tools are admin only. `src/emails/issue.ts:67` and `src/forms/application-context.ts:19` only read media.

   So yes: a non-admin flow can send a PDF to `media` today (the `/admin` rich text, upload fields, SEO image, and REST). `src/security-media.int.test.ts` asserts that a member uploads `tiny.pdf` (since commit fbca97df). Data from the local clone of production: 785 media rows, 780 `image/webp` and 5 `application/pdf`. Four PDFs have a `legacy_url` (the archive import). One (id 358, `مقال_فريدة_مقار.pdf`, 2026-10-13) has none. Media has no creator column, so who uploaded it is not known. The site's `RichTextField` renders an `upload` node as nothing (`src/components/RichTextField.tsx:235`); other renderers were not checked.

   The owner chooses:
   - (a) **Photos only for non-admins (recommended).** PR D as written. A non-admin who needs a PDF on a page asks an admin. `space-files` belongs to space posts, so sending article or course PDFs there is a new feature with its own access rules, not phase 0. If the owner wants it, it is a later task.
   - (b) **Keep PDFs allowed for non-admins.** PR D then accepts a photo, or a PDF that the bytes prove (`%PDF-` header) up to a size limit the owner sets. Task 16 changes `isPhotoUpload` into a rule with two branches and adds a PDF row to the tests.

   PR D does not start until the owner answers. PR A, B and C do not depend on it.

2. **Rules that `src/` cannot name.** The owner asked the audit to fail on every unnamed rule. 28 rules come from Payload or a plugin while Payload sanitizes the config, after `src/` has run: the auth fields of `users` (16), the key fields of `payload-mcp-api-keys` (4), and the internal `payload-kv` and `payload-jobs` collections (8). `src/` cannot rename them. The audit lists them by place in an `UPSTREAM` table with their source text and prints a label such as `payload:auth`. It fails when such a rule changes, gets a name, or goes away. That is a deviation from "fail on every unnamed rule"; the owner confirms it.

## PR split

Phase 0 ships as four stacked PRs. Each PR has one mechanism, so its reviewer reads one kind of change.

| PR                        | Branch                        | Base                          | Tasks      | What it proves                                                                                                                 |
| ------------------------- | ----------------------------- | ----------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A. Name every access rule | `portal/phase-0-access-names` | `main`                        | 1 to 6     | Every access function in `src/` has an intent name. No behavior changes: the int suite stays green.                            |
| B. Access audit           | `portal/phase-0-audit`        | `portal/phase-0-access-names` | 7, 8, 9    | The audit prints every rule by name and fails on a rule with no name. The snapshot is the baseline of today.                   |
| C. Field access fixes     | `portal/phase-0-field-access` | `portal/phase-0-audit`        | 10 to 15   | `legacy_url`, `slug`, `generateSlug` and `digest_sent_at` refuse non-admin writes. The snapshot diff shows exactly those rows. |
| D. Media photos only      | `portal/phase-0-media`        | `portal/phase-0-field-access` | 16, 17, 18 | A non-admin stores only a photo. Admin uploads and the profile photo path work as today. Waits for Open question 1.            |

Order: A, then B, then C, then D. Merge in that order.

**Why A comes first.** The audit of B fails on an unnamed rule, so B cannot merge while 107 rules have no name. A is a refactor with no behavior change, so its review is "same behavior, better names". (Principle: Sequence Work into Verifiable Units. Each PR ends in a state its own checks prove.)

**How a later PR follows an earlier one.** Each PR branches from the head of the PR before it. PR C commits the regenerated `scripts/access-audit.snapshot.json` with each fix, so the snapshot test passes in every commit (Tasks 11, 12 and 13). When the PR below merges, rebase onto `main`, run the audit again, check that the snapshot does not change, and set the base to `main`. For PR B after PR A merges:

```bash
git fetch origin
git rebase --onto origin/main portal/phase-0-access-names   # the local branch still points at the last commit of PR A
pnpm audit:access
git status --short scripts/access-audit.snapshot.json   # expect no output
gh pr edit portal/phase-0-audit --base main
git push --force-with-lease
```

PR C does the same after PR B merges (replace `portal/phase-0-access-names` with `portal/phase-0-audit` and the PR branch with `portal/phase-0-field-access`). PR D does the same after PR C merges. PR A has no snapshot; it rebases with `git rebase origin/main` if `main` moves.

## Access rule naming guide

Every PR of this phase, and every later change, follows these rules. Task 5 puts their short form in `AGENTS.md`.

1. **No inline arrow in an `access` block.** Every value is a named function or a factory call.
2. **The name says what it allows.** It names who passes or which rows match: `isAdmin`, `anyone`, `nobody`, `adminOrSelf`, `ownAccountRows`, `adminOrOwnAccountRows`, `filesOnReadablePosts`. Not `rule1`, not `check`, not `own`-alone when another `own` could exist.
3. **One name, one rule.** Two functions never share a name. Reuse the shared rule instead of a copy with the same body.
4. **Placement follows the untangle rules.** A rule that two or more collections use lives in `src/access.ts`. A rule one collection owns is a module-local `const` typed `Access` or `FieldAccess` in that collection's file, after the imports.
5. **Factories name what they return.** A factory lives in `src/access.ts` and wraps its result in `named(rule, '<factory>', [args])`. The name prints as `factory(arg,arg)`: a function argument prints its own name, a `Where` its JSON, an option set to `true` its key alone, an array its items joined by `|`. Example: `adminPublishes(isAdminOrOwn(ownsVia(authors),while={"_status":{"in":["draft","published"]}}))`.
6. **The admin-only write pair is `adminWritesOnly`.** A field that only an admin sets has `access: adminWritesOnly`, or `{ read: ..., ...adminWritesOnly }`.
7. **Rules from Payload or a plugin.** When the config can override a plugin rule (a `...collection.access` spread, an override option), set it to a named rule in `src/`. Only a rule that Payload adds while it sanitizes the config goes into `UPSTREAM` in `scripts/access-audit.ts`.

## Deviations from the spec, and why

1. **Test paths.** The spec names `tests/int/portal-access.int.spec.ts` and `tests/int/field-access-audit.snapshot.json`. This repo cannot run them:
   - `vitest.config.mts` includes only `**/*.{int,unit}.test.{ts,tsx}`. A `.int.spec.ts` file never runs.
   - The lint rule `landmines-structure/test-file-names` refuses `.spec.ts`.
   - The lint rule `landmines-structure/colocated-tests` requires a test beside the module it tests.
   - No `tests/` folder exists. Int tests live beside their subject, for example `src/security-media.int.test.ts`.

   So the plan uses `src/portal-access.int.test.ts` (it imports `@/payload.config`, like `src/security-media.int.test.ts`), and `scripts/access-audit.int.test.ts` with `scripts/access-audit.snapshot.json` beside `scripts/access-audit.ts` (like `scripts/course-reader-snapshot.ts` and its test). The spec name `portal-access` stays.

2. **The audit covers collections and globals, not only fields.** Of the 245 access slots in `src/`, 170 are collection or global rules. A field-only audit could not enforce PR A. So the audit is named `access-audit`, prints one row per collection and global (`field: "*"`) and one per data field, and runs as `pnpm audit:access`.

3. **Slug scope.** The spec names `slug` on articles, courses and publications. The plan locks `slug` in the shared wrapper `src/fields/slug.ts`, so the lock covers all 8 collections that use it: articles, courses, publications, people, places, programmes, newsletters, events. Places, programmes, newsletters and events take `create` and `update` from `isAdmin`, so the lock changes nothing for them. People is the exception: a signed-in person may update their own person row (`src/collections/People.ts:28-32`), so today a member can change their own person slug and take another URL. That is the same hole. Task 10 adds a People row to the tests. No non-admin code writes a slug: every MCP tool that writes is an `adminTool` (`src/plugins/mcp/tools/course.ts`, `article.ts`, `form.ts`), `src/lib/profile.ts` does not write `slug`, and the other files in `src` that pass `overrideAccess: false` only read `slug`.

4. **The audit script prints nothing by itself.** `scripts/access-audit.ts` exports the walk. `pnpm audit:access` runs the audit test with `--update`, and the snapshot file is the printout. The config loads only through the test environment (Decision D2). When the audit finds a problem, the test fails and the command exits non-zero.

## Decisions

Problems first, then each fix above the problems it solves.

**Problems.**

- P1. A field with no access function accepts any value from any caller that collection access lets in (`legacy_url`, `slug`, `digest_sent_at`).
- P2. A new rule, or a new field with no rule, does not show in review.
- P3. Payload's `slugField` has a second write path, the `generateSlug` checkbox: when it is `true` on an update, the slug follows the title again.
- P4. The photo rule (`PHOTO_TYPES`, `PHOTO_MAX_BYTES`) is written twice in `src/lib/profile.ts` (lines 174 and 266). A media check would be a third copy.
- P5. Payload trusts the claimed type of an upload until it reads the bytes. After the WebP conversion (`formatOptions` in `src/collections/Media.ts`), `mimeType` and `filesize` describe the converted file, not the upload.
- P6. A non-admin can create media from a remote URL with no `req.file` (`getExternalUploadSource` in `node_modules/payload/dist/collections/operations/create.js`). When `req.file` exists, Payload uses it and ignores a URL (`node_modules/payload/dist/uploads/generateFileData.js:51,65`).
- P7. 107 of the 245 access slots in `src/` have no usable name: 89 inline arrows (an arrow in an object literal takes its key as its name, so `update: () => false` is named `update`), 17 factory calls and 1 const made by a factory (`readCourse`), whose functions have an empty name. A reader of the audit cannot tell what such a rule allows.
- P8. The same rule is written many times: `() => false` 58 times, `({ req }) => isAdminUser(req.user)` 13 times (the body of `isAdmin`), the own-account Where 7 times, and the pair `{ create: adminOnlyField, update: adminOnlyField }` 12 times plus once with `read`.
- P9. Payload's own `generateSlug` hook stops following the title after the document has more than 2 versions, and stores `false` on any create that had a title, so a draft slug does not follow later title changes.

**Fixes.**

- **D1. Field access, not hooks, for `legacy_url`, `slug`, `generateSlug`, `digest_sent_at`.** Solves P1, P3. Payload applies field write access in `beforeValidate` only (`node_modules/payload/dist/fields/hooks/beforeValidate/promise.js:218-231`; `beforeChange/promise.js` has no access check). It deletes the non-admin value, and the `beforeChange` hook then gets the stored value as `value`. Collection `beforeChange` hooks (such as the review hook that sets `_status: 'published'` on approval, `src/lib/review-hooks.ts:175-180`) run before the field `beforeChange` hooks (`node_modules/payload/dist/collections/operations/utilities/update.js`, "beforeChange - Fields"). So the slug hook sees the final `_status`, and field access drops a hand-written slug while generation keeps running.
- **D2. One audit walk, one snapshot, one regenerate command.** Solves P2. `scripts/access-audit.ts` is a pure function of the sanitized config. The test compares its output with `toMatchFileSnapshot` and asserts `problems` is empty. `pnpm audit:access` runs that same test with `--update`.
- **D3. The audit fails on an unnamed rule.** Solves P2, P7. A rule is unnamed when its name is empty, equals its operation key, or holds the word `anonymous` (what `named()` prints for an unnamed argument). It also fails when one name holds two rules with different source text, and when a name with no `(` holds two different function objects (a factory that forgot `named()`). Rules that Payload adds while it sanitizes the config are listed in `UPSTREAM` by place and source text (Open question 2). A changed, newly named or missing entry fails too. A second test, `scripts/access-audit.unit.test.ts`, checks that `src/` sets no rule on a field that `UPSTREAM` lists: the source text `()=>false` of such an entry is also the text of an inline arrow, so without that check a rule from `src/` could pass as Payload's.
- **D4. Each field reports its own rule.** A rule on a group covers its whole subtree in Payload. The audit prints each field's own rule, so a child of `courses.registration` prints `open` under a parent that prints `adminOnlyField`. The rows keep the parent above its children.
- **D5. One server predicate `isPhotoUpload` reads the bytes.** Solves P4, P5. `src/lib/photo-upload.ts` checks the size of the bytes and reads the format with `sharp(data).metadata()`. `src/lib/profile.ts` and the media hook both call it. It is not in `src/lib/profile-limits.ts`, because the browser form imports that file and sharp is Node only.
- **D6. The media check is a `beforeOperation` hook on create.** Solves P5, P6. `beforeOperation` runs before `generateFileData`, so `req.file` is still the upload as sent. A non-admin create with no `req.file` throws, which closes the remote URL path. The hook returns early for `overrideAccess: true`, for admins and for anonymous callers; the collection `create` access then throws `Forbidden` for anonymous callers.
- **D7. Shared rules in `src/access.ts`, local rules beside their collection, factories name their output.** Solves P7, P8. `nobody`, `ownAccountRows`, `signedInOwnAccountRows`, `adminOrOwnAccountRows` and `adminWritesOnly` join `src/access.ts`. A codemod replaces the three repeated arrows (`() => false`, `() => true`, `({ req }) => isAdminUser(req.user)`) with `nobody`, `anyone` and `isAdmin`. Rules one collection owns become module-local named constants. `named()` gives each factory's rule the name `factory(args)`. `ownsVia` is named too, so `isAdminOrOwn(ownsVia(fellows),versions)` shows the owner field. The `while` option is a `Where`, so it prints as JSON: exact, and with no table of constant names to keep in step.
- **D8. Red tests are not a commit.** The access test file of PR C is red for the new rows until Task 13. Task 10 writes the file and runs it red, but does not commit it. Task 13, the last fix, commits it when the whole file passes.
- **D9. The slug follows the title while the document has never been published (Task 12). The owner confirmed this on 2026-11-18.** Solves P9. A `beforeChange` hook on the `generateSlug` checkbox replaces Payload's. On create, and on an update in the default locale while the checkbox is `true`, it sets the slug from the English title. It sets nothing when the document has no English title (an update in another locale leaves the slug as it is), and on an update it keeps the current slug when another row already holds the computed slug (the slug is `unique`). It returns `false` (fixed) at the first publish, when an admin writes a different slug, and on any create in a collection without drafts. An admin can set the slug at any time; a non-admin can never hand-write it. The checkbox is the stored state, so no column and no version count are needed. Caveat: Payload stored `generate_slug = false` on every create that had a title, so a draft made before PR C keeps its slug until an admin changes it. A data fix would be a separate script after phase 0, with the owner's approval. The uniqueness count reads the main table, the table of the unique index. Payload skips the main table on a draft save (`collections/operations/utilities/update.js`, `if (!isSavingDraft)`), so two drafts can hold the same slug until one of them is published. The hook does not copy that rule: at the publish, the unique index refuses the second publish, and Payload turns the violation (code 23505) into a `ValidationError` that names the field `slug` ("Value must be unique", `@payloadcms/drizzle` `upsertRow/handleUpsertError.js`). A count in the hook would be a second copy of the index rule, so the hook has none. The publish signal is the `_status` the caller sends (an admin publish, or the review hook that approves); the hook uses it only to fix the slug. Recovery: an admin opens the document, writes a different slug in the `slug` field, and publishes again; a non-admin cannot write the slug, so the error reaches the admin who approves. Limit: the count reads the main-table slug of the other row. For a draft that was never published, that is its create-time slug, so a stale slug can block a retitle: the retitled draft keeps its own slug on that save. The next title change counts again, so this heals itself; the unique index stays the last guard.

---

## Before you start (every task)

- [ ] Use the worktree of the PR. Install dependencies: `pnpm install`.
- [ ] Start the local services, these two only. Never run a bare `docker compose up`: `docker-compose.yml` forbids starting the `payload` service, because it carries the production `.env`. Database: `docker compose -p cilas up -d db` (Postgres on `localhost:5433`). Always pass `-p cilas`: `docker-compose.yml` has no `name:`, so without it Compose names the project after the folder. In a worktree that makes a second project that clashes on port 5433, or starts an empty `cilas_dev` volume with no schema. The real database is the container `cilas-db-1` of project `cilas`. Object storage, which the media tests and every test that creates a media row need: `docker compose -p cilas-storage --env-file .env.storage.local -f docker-compose.storage.yml up -d --wait` (RustFS, see `docs/local-object-storage.md`). `.env.storage.local` is gitignored, so a new worktree does not have it: copy it from the main checkout (`/Users/salah/Developer/cilas/.env.storage.local`) first.
- [ ] Check that the real database runs: `docker ps --filter name=cilas-db-1 --format '{{.Names}} {{.Status}} {{.Ports}}'`. Expected: one line, `cilas-db-1 Up …` with `0.0.0.0:5433->5432/tcp`. No line, or a container with another name on 5433: stop. Do not start a new database project; tell the owner.
- [ ] Export the test database: `export DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev`. `vitest.setup.ts` refuses any other host.
- [ ] Put the local `R2_*` values in `.env.development.local` (see `testing/README.md`, "Environment"). `testing/local-env.ts` refuses a storage host that is not local.
- [ ] Check that the local database has no pending migration: `pnpm payload migrate:status`. Do not run a migration. Phase 0 has none. If a step seems to need one, stop and tell the owner.
- [ ] Test code rules (`testing/README.md`, `.oxlintrc.json`): no comments in test files, no annotated return types, no `vi.mock` or other test doubles, no fixed sleeps or retries. Lint each file you touch: `pnpm exec oxlint <files>`. It prints nothing when the file is clean.
- [ ] Your shell may alias `cp` and `rm` to their `-i` forms. Use `command cp` and `command rm` in scripts, so no step waits for a prompt.
- [ ] Commit trailer for every commit: the implementer writes the trailer of the model that did the work, for example `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. The commit author is the git user. The trailer lines in the commit commands below use that example; replace the model name when another model does the work.

## File map

| File                                                                                                                                                                                                                  | PR   | Change                  | Responsibility                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/access.ts`                                                                                                                                                                                                       | A    | Modify                  | `named()`, factories that name their rules, `nobody`, the own-account rules, `adminWritesOnly`.           |
| `src/access.unit.test.ts`                                                                                                                                                                                             | A    | Modify                  | The names that the factories give.                                                                        |
| 18 files in `src/collections`, `src/plugins/mcp/oauth.ts`                                                                                                                                                             | A    | Modify (codemod)        | `() => false`, `() => true`, `({ req }) => isAdminUser(req.user)` become `nobody`, `anyone`, `isAdmin`.   |
| `src/collections/{People,Users,Notifications,SpacePosts,SpaceComments,SpaceFiles,SpaceReactions,SpaceRsvps,SpaceVotes,SpaceConsents,SpacePreferences,SpaceVisits}.ts`, `src/payload.config.ts`, `src/plugins/llms.ts` | A    | Modify                  | Named rules for the remaining inline arrows and plugin defaults.                                          |
| `src/collections/{Articles,Courses}.ts`, `src/forms/application-fields.ts`, `src/fields/{review,tier}.ts`                                                                                                             | A    | Modify                  | The 13 literal admin-only pairs become `adminWritesOnly`.                                                 |
| `AGENTS.md`                                                                                                                                                                                                           | A, B | Modify                  | One line of the naming guide under the untangle rules; B adds the audit command.                          |
| `scripts/access-audit.ts`                                                                                                                                                                                             | B    | Create                  | Walk the sanitized config, return rows and problems. Pure.                                                |
| `scripts/access-audit.int.test.ts`                                                                                                                                                                                    | B    | Create                  | Anchor checks, the failure cases, and the file snapshot.                                                  |
| `scripts/access-audit.unit.test.ts`                                                                                                                                                                                   | B    | Create                  | `UPSTREAM` lists no field whose rule `src/` sets.                                                         |
| `scripts/access-audit.snapshot.json`                                                                                                                                                                                  | B, C | Create, then regenerate | The committed audit.                                                                                      |
| `package.json`                                                                                                                                                                                                        | B    | Modify                  | Script `audit:access`.                                                                                    |
| `src/portal-access.int.test.ts`                                                                                                                                                                                       | C, D | Create, then extend     | The spec's phase 0 table through the Local API.                                                           |
| `src/fields/import.ts`                                                                                                                                                                                                | C    | Modify                  | `legacy_url` gets `adminWritesOnly`.                                                                      |
| `src/fields/slug.ts`                                                                                                                                                                                                  | C    | Modify                  | `slug` and `generateSlug` get `adminWritesOnly`; the hook that follows the title until the first publish. |
| `src/collections/SpacePreferences.ts`                                                                                                                                                                                 | C    | Modify                  | `digest_sent_at` gets `update: nobody`.                                                                   |
| `src/lib/photo-upload.ts`                                                                                                                                                                                             | D    | Create                  | `isPhotoUpload`: the one photo rule, read from the bytes.                                                 |
| `src/collections/Media.ts`                                                                                                                                                                                            | D    | Modify                  | `beforeOperation` hook: non-admins create photos only.                                                    |
| `src/lib/profile.ts`                                                                                                                                                                                                  | D    | Modify                  | Both photo checks call `isPhotoUpload`.                                                                   |
| `src/lib/profile.int.test.ts`                                                                                                                                                                                         | D    | Modify                  | A member saves a real PNG through the media rule.                                                         |
| `src/security-media.int.test.ts`                                                                                                                                                                                      | D    | Modify                  | Active content and the PDF run as an admin.                                                               |

---

# PR A. Name every access rule

Branch from `origin/main`, then carry the spec and the plan. The spec commit `fa9d9c0a` is on the local `main` only: `origin/main` does not hold it. PR A must carry it with the plan commits, so every later PR finds both in its history. Do not take `8ca46b8e`: it is an unrelated chore commit (it removes `.opencode-snap.json`) and must not ride along. The `git rev-list` below lists the commits of `orchestrate/portal-phase-0` that touch the plan, oldest first, and that leaves `8ca46b8e` out by construction.

```bash
git fetch origin
git switch -c portal/phase-0-access-names origin/main
git cherry-pick fa9d9c0a $(git rev-list --reverse fa9d9c0a..orchestrate/portal-phase-0 -- docs/superpowers/plans/2026-11-18-portal-phase-0-security-baseline.md)
git log --oneline origin/main..HEAD
```

Expected: eight commits, newest first as `git log` prints them: `docs(portal): apply review round 4 to phase 0 plan`, `docs(portal): apply review round 3 to phase 0 plan`, `docs(portal): apply review round 2 to phase 0 plan`, two `docs(portal): phase 0 plan adds the access-rule naming PR`, `docs(portal): apply review round 1 to phase 0 plan`, `docs(portal): phase 0 security baseline plan`, and the spec commit `docs(portal): design spec, research and deferred collaboration proposal`. The picks touch only `docs/`, so a conflict can come only from a change of `origin/main` under `docs/superpowers`. Resolve it by keeping the newest plan text: `git checkout --theirs docs/superpowers/plans/2026-11-18-portal-phase-0-security-baseline.md`, then `git add` it and `git cherry-pick --continue`. (During a cherry-pick, `--theirs` is the commit being applied.) If a pick comes out empty, `git cherry-pick --skip` it.

**Inventory (measured with the counter of Task 5, Step 1, at HEAD 5199dfd7).** `src/` has 245 access slots in `access: { ... }` literals: 170 collection or global rules, 75 field rules. 138 already hold a named function. 107 do not: 89 inline arrows, 17 factory calls (`isAdminOrOwn`, `adminPublishes`, `readTiers`, `publishedOrOwn`, `throughRelation`), and 1 const made by a factory (`readCourse`). A runtime walk of the sanitized config finds 141 unnamed rules: the 107 (109 rows, because `lockFields` in `src/plugins/mcp/oauth.ts` puts one arrow on 3 fields), 4 plugin defaults that `src/` can override, and the 28 rules of Open question 2. After PR A, all 107 slots are named, the 4 plugin defaults are named, and 28 remain for `UPSTREAM`.

### Task 1: Factories name the rules they return

**Skills:** tdd, payload (`.agents/skills/payload/SKILL.md`, then `reference/ACCESS-CONTROL.md`).

**Files:**

- Modify: `src/access.ts`
- Modify: `src/access.unit.test.ts`

- [ ] **Step 1: Write the failing tests**

Add this block at the end of `src/access.unit.test.ts`. Every name it imports is already in the file's import list:

```ts
describe('rule names', () => {
  it('names a factory rule after the factory and its arguments', () => {
    expect(ownsViaAuthors.name).toBe('ownsVia(authors)')
    expect(isAdminOrOwn(ownsViaFellows, { versions: true }).name).toBe(
      'isAdminOrOwn(ownsVia(fellows),versions)',
    )
    expect(
      isAdminOrOwn(ownsViaEditors, { allow: ['member', 'fellow'], draft: true, while: WITH_OWNER })
        .name,
    ).toBe(
      'isAdminOrOwn(ownsVia(editors),allow=member|fellow,draft,while={"review.status":{"in":["draft","changes_requested"]}})',
    )
    expect(adminPublishes(canAuthor).name).toBe('adminPublishes(canAuthor)')
    expect(publishedOrOwn(ownsViaEditors).name).toBe('publishedOrOwn(ownsVia(editors))')
    expect(readTiers(undefined, { drafts: true }).name).toBe('readTiers(drafts)')
    expect(readTiers(ownsViaAuthors).name).toBe('readTiers(ownsVia(authors))')
    expect(throughRelation('course', readTiers(ownsViaFellows, { drafts: true })).name).toBe(
      'throughRelation(course,readTiers(ownsVia(fellows),drafts))',
    )
  })

  it('gives rules from different arguments different names', () => {
    expect(isAdminOrOwn(ownsViaAuthors, { while: OWNER_EDITS }).name).not.toBe(
      isAdminOrOwn(ownsViaAuthors, { while: WITH_OWNER }).name,
    )
    expect(isAdminOrOwn(ownsViaAuthors).name).not.toBe(isAdminOrOwn(ownsViaEditors).name)
  })

  it('prints an unnamed argument as anonymous, which the access audit refuses', () => {
    expect(adminPublishes(() => true).name).toBe('adminPublishes(anonymous)')
  })
})
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `pnpm test:int src/access.unit.test.ts`
Expected: FAIL, 3 failed. The first fails on `expect(ownsViaAuthors.name).toBe('ownsVia(authors)')` with a received value of `""`. The other 67 tests pass.

- [ ] **Step 3: Add `named()` and use it in each factory**

In `src/access.ts`, add this section directly above the `/* ===...=== constraints */` comment line:

```ts
/* ============================================================== rule names */

/**
 * A factory's rule is named after the factory and its arguments, so the
 * access audit (scripts/access-audit.ts) tells two such rules apart. A
 * function argument prints its own name, a Where its JSON, and an option set
 * to `true` its key alone.
 */
const describe = (value: unknown): string => {
  if (typeof value === 'function') return value.name || 'anonymous'
  if (Array.isArray(value)) return value.map(describe).join('|')
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value)
}

const optionsOf = (options: Record<string, unknown>): string[] =>
  Object.entries(options)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key, value]) => (value === true ? key : `${key}=${describe(value)}`))

const named = <Rule extends (...args: never[]) => unknown>(
  rule: Rule,
  factory: string,
  args: unknown[],
): Rule =>
  Object.defineProperty(rule, 'name', { value: `${factory}(${args.map(describe).join(',')})` })
```

Replace `ownsVia` with:

```ts
export const ownsVia = (field: 'fellows' | 'authors' | 'editors' | 'person'): Ownership => {
  const owns: Ownership = (user) => {
    const person = personOf(user)
    return person === null
      ? false
      : { [field]: { [field === 'person' ? 'equals' : 'contains']: person } }
  }
  return named(owns, 'ownsVia', [field])
}
```

Replace `isAdminOrOwn` (keep its doc comment) with:

```ts
export const isAdminOrOwn = (
  owned: Ownership,
  options: { allow?: Role[]; while?: Where; draft?: boolean; versions?: boolean } = {},
): Access => {
  const { allow, while: constraint, draft = false, versions = false } = options
  const rule: Access = ({ req }) => {
    if (isAdminUser(req.user)) return true
    if (!req.user || (allow && !hasRole(req.user, ...allow))) return false
    const owns = owned(req.user)
    if (!owns) return false
    if (versions) return appendVersionToQueryKey(owns)
    if (draft)
      return { and: [owns, { _status: { equals: 'draft' } }, ...(constraint ? [constraint] : [])] }
    return constraint ? { and: [owns, constraint] } : owns
  }
  return named(rule, 'isAdminOrOwn', [owned, ...optionsOf(options)])
}
```

Replace `adminPublishes` (keep its doc comment) with:

```ts
export const adminPublishes = (access: Access): Access => {
  const rule: Access = (args) => {
    const data = args.data as { _status?: unknown } | undefined
    if (data?._status === 'published' && !isAdminUser(args.req.user)) return false
    return access(args)
  }
  return named(rule, 'adminPublishes', [access])
}
```

Replace `publishedOrOwn` (keep its doc comment) with:

```ts
export const publishedOrOwn = (owned: Ownership): Access => {
  const rule: Access = ({ req }) => {
    if (isAdminUser(req.user)) return true
    const published: Where = { _status: { equals: 'published' } }
    const owns = req.user ? owned(req.user) : false
    return owns ? { or: [published, owns] } : published
  }
  return named(rule, 'publishedOrOwn', [owned])
}
```

Replace `readTiers` (keep its doc comment) with:

```ts
export const readTiers = (
  owned?: Ownership,
  { drafts = false }: { drafts?: boolean } = {},
): Access => {
  const rule: Access = ({ req }): Where | boolean => {
    const published: Where = drafts ? { _status: { equals: 'published' } } : {}

    // Whoever may edit the document must be able to read it back for live preview.
    if (req.user && isAdminUser(req.user)) return true

    if (!req.user) {
      return drafts
        ? { and: [{ tier: { equals: 'public' } }, published] }
        : { tier: { equals: 'public' } }
    }

    const visible: Where[] = [
      drafts
        ? { and: [{ tier: { in: ['community', 'public'] } }, published] }
        : { tier: { in: ['community', 'public'] } },
    ]
    const owns = owned?.(req.user)
    if (owns) visible.push(owns)
    return { or: visible }
  }
  return named(rule, 'readTiers', [...(owned ? [owned] : []), ...optionsOf({ drafts })])
}
```

Replace `throughRelation` (keep its doc comment) with:

```ts
export const throughRelation = (field: string, access: Access): Access => {
  const rule: Access = async (args) => {
    const result = await access(args)
    return typeof result === 'boolean' ? result : prefixWhere(result, field)
  }
  return named(rule, 'throughRelation', [field, access])
}
```

The bodies are the old bodies, unchanged. Only the return is wrapped. `ownList` is a list filter (`BaseFilter`), not an access rule, so it stays as it is.

- [ ] **Step 4: Run the tests and see them pass**

Run: `pnpm exec oxfmt src/access.ts && pnpm test:int src/access.unit.test.ts`
Expected: PASS, `Tests  70 passed (70)`.

- [ ] **Step 5: Lint and typecheck**

Run: `pnpm exec oxlint src/access.ts src/access.unit.test.ts && pnpm typecheck`
Expected: no lint output, typecheck exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/access.ts src/access.unit.test.ts
git commit -m "refactor(access): factories name the rules they return

A rule from isAdminOrOwn, adminPublishes, publishedOrOwn, readTiers,
throughRelation or ownsVia now has a name such as
isAdminOrOwn(ownsVia(fellows),versions), so the access audit can show what
it allows. The bodies do not change.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 2: Shared rules and the codemod for repeated arrows

**Skills:** payload (`reference/ACCESS-CONTROL.md`). Principle: Build the Lever. The codemod is the artifact a reviewer reruns.

**Files:**

- Modify: `src/access.ts`
- Modify (codemod): `src/collections/{Courses,InvitationLog,Media,Notifications,PushSubscriptions,SpaceComments,SpaceConsents,SpaceFiles,SpacePosts,SpacePreferences,SpaceReactions,SpaceRsvps,SpaceVisits,SpaceVotes,Spaces,SubmissionFiles,Users}.ts`, `src/plugins/mcp/oauth.ts`

- [ ] **Step 1: Add the shared rules to `src/access.ts`**

After `export const anyone: Access = () => true`, add:

```ts
/** No one through the API. Server code writes with overrideAccess. */
export const nobody = () => false
```

Directly above the line `/** admin + super_admin. Gates write on the editorial collections. */`, add:

```ts
/** The rows of the signed-in account. An anonymous reader matches none. */
export const ownAccountRows: Access = ({ req }) => ({
  account: { equals: (req.user as { id?: number })?.id ?? null },
})

/** The rows of the signed-in account. An anonymous caller is refused. */
export const signedInOwnAccountRows: Access = ({ req }) =>
  req.user ? { account: { equals: (req.user as { id: number }).id } } : false

/** Admins: every row. Others: the rows of their own account. */
export const adminOrOwnAccountRows: Access = ({ req }) =>
  isAdminUser(req.user) || { account: { equals: (req.user as { id?: number })?.id ?? null } }
```

After `export const adminOnlyField: FieldAccess = ({ req }) => isAdminUser(req.user)`, add:

```ts
/** The pair of write rules for a field that only an admin sets. Frozen: many fields share this one object. */
export const adminWritesOnly = Object.freeze({ create: adminOnlyField, update: adminOnlyField })
```

`nobody` has no type annotation on purpose: `() => false` is assignable to both `Access` and `FieldAccess`, and the codemod puts it in both kinds of block. The two own-account rules keep the exact bodies of the arrows they replace: `ownAccountRows` gives an anonymous reader a Where that matches nothing, `signedInOwnAccountRows` refuses them. These are two behaviors, so they are two names. `adminWritesOnly` is frozen because every field that uses it holds the same object. Payload reads a field's `access` and never writes into it (`node_modules/payload/dist/fields/config/sanitize.js` only sets `{}` on a field that has none), so the freeze is safe. A field that needs another key spreads it: `{ read: adminOnlyField, ...adminWritesOnly }`.

- [ ] **Step 2: Write the codemod to a temporary file**

```bash
codemod="$(mktemp -d)/name-access-rules.mjs"
cat > "$codemod" <<'EOF'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const ts = createRequire(join(process.cwd(), 'package.json'))('typescript')

const RULES = new Map([
  ['()=>false', 'nobody'],
  ['()=>true', 'anyone'],
  ['({req})=>isAdminUser(req.user)', 'isAdmin'],
])
const ACCESS_IMPORT = /import \{([^}]*)\} from '@\/access'\n/

const withImports = (text, used) => {
  const match = text.match(ACCESS_IMPORT)
  const names = match ? match[1].split(',').map((name) => name.trim()).filter(Boolean) : []
  for (const name of used) if (!names.includes(name)) names.push(name)
  const rest = match ? text.replace(ACCESS_IMPORT, '') : text
  const kept = /\bisAdminUser\b/.test(rest) ? names : names.filter((name) => name !== 'isAdminUser')
  const line = `import { ${kept.join(', ')} } from '@/access'\n`
  if (match) return text.replace(ACCESS_IMPORT, line)
  const payloadImport = text.match(/^import [^\n]* from 'payload'\n/m)
  if (!payloadImport) return line + text
  const at = payloadImport.index + payloadImport[0].length
  return `${text.slice(0, at)}\n${line}${text.slice(at)}`
}

const files = execFileSync(
  'rg',
  ['--files', 'src', '-g', '*.ts', '-g', '!*.test.ts', '-g', '!payload-types.ts', '-g', '!src/migrations/**'],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')

let total = 0
for (const file of files.sort()) {
  const text = readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const edits = []
  const visit = (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === 'access' &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isArrowFunction(property.initializer)) continue
        const name = RULES.get(property.initializer.getText(source).replace(/\s+/g, ''))
        if (name) edits.push({ start: property.initializer.getStart(source), end: property.initializer.getEnd(), name })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!edits.length) continue
  let next = text
  for (const { start, end, name } of edits.sort((a, b) => b.start - a.start)) {
    next = next.slice(0, start) + name + next.slice(end)
  }
  writeFileSync(file, withImports(next, new Set(edits.map(({ name }) => name))))
  total += edits.length
  console.log(`${file} ${edits.length}`)
}
console.log(`replaced ${total}`)
EOF
```

The codemod touches only arrows that are the value of a key in an `access: { ... }` literal, and only the three exact bodies. A trailing comment on the same line stays. It adds the new names to the file's `@/access` import (or adds the import after the `payload` import), and drops `isAdminUser` from that import when no other use is left.

- [ ] **Step 3: Run the codemod**

Run: `node "$codemod"`
Expected output, exactly:

```
src/collections/Courses.ts 1
src/collections/InvitationLog.ts 3
src/collections/Media.ts 1
src/collections/Notifications.ts 8
src/collections/PushSubscriptions.ts 4
src/collections/SpaceComments.ts 6
src/collections/SpaceConsents.ts 4
src/collections/SpaceFiles.ts 3
src/collections/SpacePosts.ts 10
src/collections/SpacePreferences.ts 3
src/collections/SpaceReactions.ts 3
src/collections/SpaceRsvps.ts 3
src/collections/SpaceVisits.ts 4
src/collections/SpaceVotes.ts 3
src/collections/Spaces.ts 6
src/collections/SubmissionFiles.ts 2
src/collections/Users.ts 7
src/plugins/mcp/oauth.ts 1
replaced 72
```

That is 58 `nobody`, 1 `anyone` (media read) and 13 `isAdmin`. If a count differs, `git diff` the file and find the arrow the codemod missed or added before you go on.

- [ ] **Step 4: Format, lint, typecheck**

Run: `pnpm exec oxfmt $(git diff --name-only) && pnpm exec oxlint $(git diff --name-only) && pnpm typecheck`
Expected: no lint output, typecheck exit code 0. oxfmt splits the long one-line import of `src/collections/Courses.ts` back into lines.

- [ ] **Step 5: Run the access tests**

Run: `pnpm test:int src/access.unit.test.ts src/collections/space-access.unit.test.ts src/collections/space-files.int.test.ts src/collections/user-link.int.test.ts src/security-media.int.test.ts`
Expected: every file passes. `nobody`, `anyone` and `isAdmin` return what the arrows returned.

- [ ] **Step 6: Commit**

```bash
git add src/access.ts src/collections src/plugins/mcp/oauth.ts
git commit -m "refactor(access): name the repeated inline rules

A codemod replaces 72 inline arrows in access blocks: () => false becomes
nobody (58), () => true becomes anyone (1), and the body of isAdmin becomes
isAdmin (13). src/access.ts adds nobody, ownAccountRows,
signedInOwnAccountRows, adminOrOwnAccountRows and adminWritesOnly. No rule
changes what it returns.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 3: Named rules for the remaining arrows and the plugin defaults

**Skills:** payload (`reference/ACCESS-CONTROL.md`, `reference/PLUGIN-DEVELOPMENT.md`).

**Files:**

- Modify: `src/collections/{SpacePosts,SpaceComments,SpaceFiles,SpaceReactions,SpaceRsvps,SpaceVotes,SpaceConsents,SpacePreferences,SpaceVisits,People,Users,Notifications}.ts`
- Modify: `src/payload.config.ts`, `src/plugins/llms.ts`

Each step below gives the exact text after Task 2. "After the imports" means directly after the last top-level `import` statement of the file, with one blank line before the new code.

- [ ] **Step 1: The space content reads**

`src/collections/SpacePosts.ts`. Replace `import type { CollectionConfig } from 'payload'` with `import type { Access, CollectionConfig } from 'payload'`. Replace `    read: async ({ req }) => contentWhere(req.payload, req.user, ['id'], req.context),` with `    read: readablePosts,`. After the imports, add:

```ts
/** The posts of the spaces the reader may see (contentWhere, src/lib/spaces.ts). */
const readablePosts: Access = async ({ req }) =>
  contentWhere(req.payload, req.user, ['id'], req.context)
```

`src/collections/SpaceComments.ts`. Replace `import type { CollectionConfig } from 'payload'` with `import type { Access, CollectionConfig } from 'payload'`. Replace `    read: ({ req }) => contentWhere(req.payload, req.user, ['post'], req.context),` with `    read: commentsOnReadablePosts,`. After the imports, add:

```ts
/** Comments on the posts the reader may see. */
const commentsOnReadablePosts: Access = ({ req }) =>
  contentWhere(req.payload, req.user, ['post'], req.context)
```

`src/collections/SpaceFiles.ts`. Replace `import { APIError, type CollectionConfig } from 'payload'` with `import { APIError, type Access, type CollectionConfig } from 'payload'`. Replace `    read: ({ req }) => contentWhere(req.payload, req.user, ['post', 'comment.post'], req.context),` with `    read: filesOnReadablePosts,`. After the imports, add:

```ts
/** Files on the posts, and on the comments of the posts, the reader may see. */
const filesOnReadablePosts: Access = ({ req }) =>
  contentWhere(req.payload, req.user, ['post', 'comment.post'], req.context)
```

- [ ] **Step 2: Reactions, answers and votes**

`src/collections/SpaceReactions.ts`. Replace `import type { CollectionConfig, Where } from 'payload'` with `import type { Access, CollectionConfig } from 'payload'`. Replace `import { isAdminUser, personOf, nobody, isAdmin } from '@/access'` with `import { adminOrOwnAccountRows, nobody, isAdmin } from '@/access'`. Replace `    read: ({ req }) => contentWhere(req.payload, req.user, ['post', 'comment.post']),` with `    read: reactionsOnReadablePosts,`. Replace:

```ts
    delete: ({ req }) => {
      if (isAdminUser(req.user)) return true
      const own: Where = { account: { equals: (req.user as { id?: number })?.id ?? null } }
      void personOf // not used here: the reaction belongs to the account
      return own
    },
```

with `    delete: adminOrOwnAccountRows,`. After the imports, add:

```ts
/** Reactions on the posts, and on the comments of the posts, the reader may see. */
const reactionsOnReadablePosts: Access = ({ req }) =>
  contentWhere(req.payload, req.user, ['post', 'comment.post'])
```

`src/collections/SpaceRsvps.ts`. Replace `import type { CollectionConfig, Where } from 'payload'` with `import type { Access, CollectionConfig } from 'payload'`. Replace `import { isAdminUser, nobody, isAdmin } from '@/access'` with `import { adminOrOwnAccountRows, nobody, isAdmin } from '@/access'`. Replace `    read: ({ req }) => contentWhere(req.payload, req.user, ['post']),` with `    read: rsvpsOnReadablePosts,`. Replace:

```ts
    delete: ({ req }) => {
      if (isAdminUser(req.user)) return true
      const own: Where = { account: { equals: (req.user as { id?: number })?.id ?? null } }
      return own
    },
```

with `    delete: adminOrOwnAccountRows,`. After the imports, add:

```ts
/** Answers to the event posts the reader may see. */
const rsvpsOnReadablePosts: Access = ({ req }) => contentWhere(req.payload, req.user, ['post'])
```

`src/collections/SpaceVotes.ts`. Replace `import type { CollectionConfig, Where } from 'payload'` with `import type { Access, CollectionConfig } from 'payload'`. Replace `import { isAdminUser, nobody, isAdmin } from '@/access'` with `import { adminOrOwnAccountRows, isAdminUser, nobody, isAdmin } from '@/access'`. Replace the whole `read: async ({ req }) => { ... },` entry (its 12 lines, from `    read: async ({ req }) => {` to the `    },` before `    create: isAdmin,`) with `    read: votesOnReadablePostsHidingAnonymous,`. Keep the three comment lines above it. Replace the `delete` entry, the same 5 lines as in `SpaceRsvps.ts`, with `    delete: adminOrOwnAccountRows,`. After the imports, add:

```ts
/**
 * Votes on the posts the reader may see. On an anonymous vote, only the
 * voter's own rows.
 */
const votesOnReadablePostsHidingAnonymous: Access = async ({ req }) => {
  const where = await contentWhere(req.payload, req.user, ['post'])
  if (where === true && isAdminUser(req.user)) return true
  if (!where) return false
  const own = { account: { equals: (req.user as { id?: number })?.id ?? null } }
  return {
    and: [
      ...(where === true ? [] : [where]),
      { or: [{ 'post.vote_anonymous': { not_equals: true } }, own] },
    ],
  }
}
```

The `delete` rules of reactions, answers and votes had the same body (the `void personOf` line did nothing), so all three now use `adminOrOwnAccountRows`.

- [ ] **Step 3: Consents, preferences and visits**

`src/collections/SpaceConsents.ts`. Replace `import { isAdminUser, nobody, isAdmin } from '@/access'` with `import { adminOrOwnAccountRows, nobody, isAdmin } from '@/access'`. Replace:

```ts
    read: ({ req }) =>
      isAdminUser(req.user)
        ? true
        : { account: { equals: (req.user as { id?: number })?.id ?? null } },
```

with `    read: adminOrOwnAccountRows,`.

`src/collections/SpacePreferences.ts` and `src/collections/SpaceVisits.ts`, in each file: replace `import { nobody } from '@/access'` with `import { nobody, ownAccountRows, signedInOwnAccountRows } from '@/access'`. Replace `    read: ({ req }) => ({ account: { equals: (req.user as { id?: number })?.id ?? null } }),` with `    read: ownAccountRows,`. Replace:

```ts
    update: ({ req }) =>
      req.user ? { account: { equals: (req.user as { id: number }).id } } : false,
```

with `    update: signedInOwnAccountRows,`.

- [ ] **Step 4: People and users**

`src/collections/People.ts`. Replace `import type { CollectionConfig } from 'payload'` with `import type { Access, CollectionConfig } from 'payload'`. Replace:

```ts
    update: ({ req }) => {
      if (isAdminUser(req.user)) return true
      const person = personOf(req.user)
      return person === null ? false : { id: { equals: person } }
    },
```

with `    update: adminOrOwnPerson,`. After the imports, add:

```ts
/** Admins: every person. A signed-in account: the person it is linked to. */
const adminOrOwnPerson: Access = ({ req }) => {
  if (isAdminUser(req.user)) return true
  const person = personOf(req.user)
  return person === null ? false : { id: { equals: person } }
}
```

`src/collections/Users.ts`. In the `import type { ... } from 'payload'` block, add `  Access,` as the first name. Replace:

```ts
    read: ({ req }) =>
      isAdminUser(req.user) ? true : req.user ? { id: { equals: req.user.id } } : false,
```

with `    read: adminOrSelf,`. After the imports, add:

```ts
/** Admins: every account. A signed-in account: itself. */
const adminOrSelf: Access = ({ req }) =>
  isAdminUser(req.user) ? true : req.user ? { id: { equals: req.user.id } } : false
```

- [ ] **Step 5: Notifications**

`src/collections/Notifications.ts` holds a module-local rule called `own`. That name does not say what it allows (guide rule 2), and another `own` could appear. Replace:

```ts
const own: Access = ({ req }) => (req.user ? { recipient: { equals: req.user.id } } : false)
```

with:

```ts
/** The notifications addressed to the signed-in account. An anonymous caller is refused. */
const ownNotifications: Access = ({ req }) =>
  req.user ? { recipient: { equals: req.user.id } } : false
```

In the `access` block of the collection (after Task 2 it reads `access: { read: own, update: own, delete: own, create: nobody },`), replace `read: own, update: own, delete: own` with `read: ownNotifications, update: ownNotifications, delete: ownNotifications`. `rg -n "\bown\b" src/collections/Notifications.ts` must print nothing but comment lines.

- [ ] **Step 6: Forms, and the plugin defaults that the config can name**

The runtime walk found four plugin rules with no name that the config can set itself: the form submissions `create` (the form builder's `() => true`), the `update` of the import and export collections (the plugin's `() => false`), and the `read` of the llms.txt settings global (`() => true`). Setting them to the named rule with the same result changes no behavior.

In `src/payload.config.ts`:

Replace `import { buildConfig } from 'payload'` with `import { buildConfig, type Access } from 'payload'`.
Replace `import { adminOnlyField, anyone, isAdmin } from './access'` with `import { adminOnlyField, anyone, isAdmin, nobody } from './access'`.
Replace `          read: (args) => isAdmin(args) || { template: { not_equals: true } },` with `          read: adminOrNonTemplateForms,`.

Replace:

```ts
        access: { read: isAdmin, update: isAdmin, delete: isAdmin },
        admin: { defaultColumns: ['form', 'courses', 'target', 'status', 'createdAt'] },
```

with:

```ts
        // A visitor submits a form: the plugin's own create rule, named.
        access: { create: anyone, read: isAdmin, update: isAdmin, delete: isAdmin },
        admin: { defaultColumns: ['form', 'courses', 'target', 'status', 'createdAt'] },
```

In both `overrideExportCollection` and `overrideImportCollection`, replace:

```ts
        access: { ...collection.access, read: isAdmin, create: isAdmin, delete: isAdmin },
```

with:

```ts
        access: {
          ...collection.access,
          read: isAdmin,
          create: isAdmin,
          update: nobody,
          delete: isAdmin,
        },
```

Directly above `export default buildConfig({`, add:

```ts
/** Admins: every form. Others: the forms that are not templates. */
const adminOrNonTemplateForms: Access = (args) =>
  isAdmin(args) || { template: { not_equals: true } }
```

In `src/plugins/llms.ts`: replace `import { isAdmin } from '@/access'` with `import { anyone, isAdmin } from '@/access'`, and replace `{ ...g, label: 'AI site summary', access: { ...g.access, update: isAdmin } }` with `{ ...g, label: 'AI site summary', access: { ...g.access, read: anyone, update: isAdmin } }`.

- [ ] **Step 7: Format, lint, typecheck**

Run: `pnpm exec oxfmt $(git diff --name-only) && pnpm exec oxlint $(git diff --name-only) && pnpm typecheck`
Expected: no lint output, typecheck exit code 0.

- [ ] **Step 8: Run the tests of the touched collections**

Run: `pnpm test:int src/collections src/people.int.test.ts src/form-emails.int.test.ts src/user-locks.int.test.ts src/lib/space-email.int.test.ts`
Expected: every file passes.

- [ ] **Step 9: Commit**

```bash
git add src/collections src/payload.config.ts src/plugins/llms.ts
git commit -m "refactor(access): name every remaining access rule

Each rule that one collection owns becomes a named const beside it
(readablePosts, commentsOnReadablePosts, filesOnReadablePosts,
reactionsOnReadablePosts, rsvpsOnReadablePosts,
votesOnReadablePostsHidingAnonymous, adminOrOwnPerson, adminOrSelf,
adminOrNonTemplateForms, ownNotifications). The own-account rules of the space collections
use the shared ones. Four plugin defaults (form submission create, import
and export update, llms.txt settings read) are set to the named rule with
the same result.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 4: The literal admin-only pairs become `adminWritesOnly`

**Skills:** payload.

**Files:**

- Modify: `src/collections/Articles.ts`, `src/collections/Courses.ts`, `src/forms/application-fields.ts`, `src/fields/review.ts`, `src/fields/tier.ts`

`rg -c "create: adminOnlyField, update: adminOnlyField" src` finds 13 lines: 12 exact pairs and one triple with `read` (`src/forms/application-fields.ts:139`).

- [ ] **Step 1: Replace the pairs and fix the imports**

```bash
files="src/collections/Articles.ts src/collections/Courses.ts src/forms/application-fields.ts src/fields/review.ts src/fields/tier.ts"
sed -i '' \
  -e 's/access: { create: adminOnlyField, update: adminOnlyField }/access: adminWritesOnly/' \
  -e 's/access: { read: adminOnlyField, create: adminOnlyField, update: adminOnlyField }/access: { read: adminOnlyField, ...adminWritesOnly }/' \
  $files
sed -i '' 's/^  adminOnlyField,$/  adminWritesOnly,/' src/collections/Articles.ts src/collections/Courses.ts
sed -i '' "s/^import { adminOnlyField } from '@\/access'$/import { adminWritesOnly } from '@\/access'/" src/fields/review.ts src/fields/tier.ts
sed -i '' "s/^import { adminOnlyField } from '@\/access'$/import { adminOnlyField, adminWritesOnly } from '@\/access'/" src/forms/application-fields.ts
```

`sed -i ''` is the macOS form. On Linux, write `sed -i` with no empty argument. Articles and Courses use `adminOnlyField` only in these pairs, so it leaves their import. `application-fields.ts` still uses it alone (`{ update: adminOnlyField }`, `{ read: adminOnlyField }`), so it keeps it.

- [ ] **Step 2: Check the sweep**

Run: `rg -n "create: adminOnlyField" src`
Expected: one line only, the definition `src/access.ts: export const adminWritesOnly = Object.freeze({ create: adminOnlyField, update: adminOnlyField })`.

- [ ] **Step 3: Format, lint, typecheck, test**

Run: `pnpm exec oxfmt $files && pnpm exec oxlint $files && pnpm typecheck && pnpm test:int src/teaching.int.test.ts src/collections/fellow-role.int.test.ts src/applications.unit.test.ts`
Expected: no lint output, typecheck exit code 0, every file passes.

- [ ] **Step 4: Commit**

```bash
git add $files
git commit -m "refactor(access): one adminWritesOnly for the admin-only field pair

Thirteen fields wrote { create: adminOnlyField, update: adminOnlyField } by
hand. They now share adminWritesOnly from src/access.ts. The rule functions
are the same, so no field changes what it allows.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 5: Prove that every rule has a name, and record the guide

**Skills:** payload (`reference/ACCESS-CONTROL.md`). Principle: Build the Lever. The counter is the artifact a reviewer reruns.

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Run the completeness check**

The audit of PR B does not exist yet, so this one-off counter checks the source. Write it to a temporary file and run it:

```bash
check="$(mktemp -d)/check-access-names.mjs"
cat > "$check" <<'EOF'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const ts = createRequire(join(process.cwd(), 'package.json'))('typescript')

const NAMING_FACTORIES = new Set(['adminPublishes', 'isAdminOrOwn', 'publishedOrOwn', 'readTiers', 'throughRelation'])

const files = execFileSync(
  'rg',
  ['--files', 'src', '-g', '*.ts', '-g', '!*.test.ts', '-g', '!payload-types.ts', '-g', '!src/migrations/**'],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')

let slots = 0
const problems = []
for (const file of files.sort()) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const consts = new Map()
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      consts.set(node.name.text, node.initializer)
    }
    ts.forEachChild(node, collect)
  }
  collect(source)
  const where = (node) => `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`
  const check = (node, property) => {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      problems.push(`${where(property)} inline rule`)
    } else if (ts.isCallExpression(node)) {
      const factory = node.expression.getText(source)
      if (!NAMING_FACTORIES.has(factory)) problems.push(`${where(property)} rule from ${factory}()`)
    } else if (ts.isIdentifier(node) && consts.has(node.text) && ts.isCallExpression(consts.get(node.text))) {
      check(consts.get(node.text), property)
    }
  }
  const visit = (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === 'access' &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue
        slots += 1
        check(property.initializer, property)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
for (const problem of problems) console.log(problem)
console.log(`slots ${slots}, unnamed ${problems.length}`)
EOF
node "$check"
```

Expected: one line, `slots 223, unnamed 0`. There were 245 slots: the sweep of Task 4 folded 13 literal objects into `adminWritesOnly` (26 slots fewer), and Task 3 added 4 plugin slots. Every factory call left is one of the five naming factories, which Task 1 tests. Any other line names a file and line to fix.

- [ ] **Step 2: Record the naming rule in `AGENTS.md` and commit it**

In `AGENTS.md`, directly after the paragraph that starts with `**Special cases.**`, add this paragraph (one blank line before and after):

```markdown
**Access rules.** Every access function has a name that says what it allows (`isAdmin`, `nobody`, `adminOrOwnAccountRows`), never an inline arrow. A rule that two or more collections use lives in `src/access.ts`; a rule one collection owns is a named const beside it. A factory lives in `src/access.ts` and names its rule with `named()`. A field only an admin sets uses `adminWritesOnly`.
```

Commit it now, so that the reviews of Task 6 read the guide with the code:

```bash
git add AGENTS.md
git commit -m "docs(agents): access rules have intent names

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Run the whole int suite**

Run: `pnpm test:int`
Expected: every file passes. PR A changes no behavior, so a failure is a regression of this PR until shown otherwise.

### Task 6: Review PR A, then open it

**Skills:** code-review, then security-review.

The branch also carries the spec and the plan as docs commits (Branch setup, above). The two reviews read the code and the guide, so they leave `docs/` out of the diff: `git diff origin/main...HEAD -- . ':(exclude)docs'`.

- [ ] **Step 1: Code review.** Run the `code-review` skill on that diff. The question for this PR: does each named rule return exactly what the arrow it replaced returned? Fix each finding that is real. After a fix, run Task 5, Step 1 again (write the counter file again from that step if your shell is new: the temporary file is gone) and Task 5, Step 3.
- [ ] **Step 2: Security review.** Run the `security-review` skill on the same diff. The questions: did any rule widen (an `isAdmin` that was `isAdminUser` of another value, an own-account rule that now matches more rows)? Did the plugin overrides keep the plugin's result (`create: anyone` on form submissions, `update: nobody` on import and export, `read: anyone` on the llms.txt settings)? Does the frozen `adminWritesOnly` stop any field from loading (`pnpm typecheck` and the int suite pass)?
- [ ] **Commit the review fixes.** Commit each fix on its own, with the trailer:

```bash
git add <the files of the fix>
git commit -m "fix(<area>): <the finding, in one line>

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

If the reviews find nothing, write "Code review and security review: no findings" in the PR body. Make no empty commit.

- [ ] **Step 3: Open the PR.** `git push -u origin portal/phase-0-access-names`, then `gh pr create --base main --title "Portal phase 0: name every access rule" --body-file <file>`. The body gives the inventory (245 slots, 107 unnamed: 89 inline, 17 factory calls, 1 factory const), the codemod and its output (`replaced 72`), the named local rules (including `ownNotifications`), the 4 plugin overrides, the result of Task 5, Step 1 (`slots 223, unnamed 0`), and says that no behavior changes and the int suite passes. It also says that the PR carries six docs commits (the spec, and the plan with its review rounds) that change no code. End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

# PR B. Access audit

Branch: `git switch -c portal/phase-0-audit portal/phase-0-access-names`.

### Task 7: The audit walk names every rule and reports problems

**Skills:** tdd, payload (`.agents/skills/payload/SKILL.md`, then `reference/FIELD-TYPE-GUARDS.md` and `reference/ACCESS-CONTROL.md`, "Field Access Control").

**Files:**

- Create: `scripts/access-audit.int.test.ts`
- Create: `scripts/access-audit.ts`
- Create: `scripts/access-audit.unit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/access-audit.int.test.ts`:

```ts
import type { SanitizedConfig } from 'payload'
import { describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { auditAccess, UPSTREAM } from './access-audit'

const namedAs = <Rule extends (...args: never[]) => unknown>(name: string, rule: Rule) =>
  Object.defineProperty(rule, 'name', { value: name })

const probe = (...fields: { name: string; access: Record<string, unknown> }[]) =>
  auditAccess({
    collections: [
      { slug: 'probe', access: {}, fields: fields.map((field) => ({ type: 'text', ...field })) },
    ],
    globals: [],
  } as unknown as SanitizedConfig).problems.filter((problem) =>
    problem.startsWith('collection:probe'),
  )

describe('access audit', () => {
  it('names every rule of the config and finds no problem', async () => {
    const { rows, problems } = auditAccess(await config)
    const rules = (entity: string, field: string) =>
      rows.find((row) => row.entity === entity && row.field === field)?.rules

    expect(problems).toEqual([])
    expect(rules('collection:articles', 'tier')).toEqual({
      create: 'adminOnlyField',
      read: 'open',
      update: 'adminOnlyField',
    })
    expect(rules('collection:articles', 'review.review_note')).toMatchObject({
      create: 'adminOnlyField',
      update: 'adminOnlyField',
    })
    expect(rules('collection:articles', 'title')).toEqual({
      create: 'open',
      read: 'open',
      update: 'open',
    })
    expect(rules('collection:enrollments', 'assessment')).toEqual({
      create: 'open',
      read: 'assessor',
      update: 'assessor',
    })
    expect(rules('collection:space-preferences', 'account')).toMatchObject({ update: 'nobody' })
    expect(rules('collection:courses', 'registration')).toMatchObject({
      create: 'adminOnlyField',
      update: 'adminOnlyField',
    })
    expect(rules('collection:courses', 'registration.mode')).toMatchObject({
      create: 'open',
      update: 'open',
    })
    expect(rules('collection:articles', '*')).toMatchObject({
      read: 'readTiers(ownsVia(authors),drafts)',
      update:
        'adminPublishes(isAdminOrOwn(ownsVia(authors),while={"_status":{"in":["draft","published"]}}))',
    })
    expect(rules('collection:users', 'salt')).toEqual({
      create: 'payload:auth',
      read: 'open',
      update: 'payload:auth',
    })
    expect(rules('global:site-settings', '*')).toMatchObject({ read: 'isAdmin', update: 'isAdmin' })
    expect(
      rows.some((row) => row.entity === 'collection:courses' && row.field === 'applicants'),
    ).toBe(false)
  })

  it('fails on a rule with no name', () => {
    expect(probe({ name: 'value', access: { update: () => false } })).toEqual([
      'collection:probe value update: unnamed rule',
    ])
  })

  it('fails on a factory rule built from an unnamed rule', () => {
    expect(
      probe({
        name: 'value',
        access: { update: namedAs('adminPublishes(anonymous)', () => true) },
      }),
    ).toEqual(['collection:probe value update: unnamed rule'])
  })

  it('fails when one name holds two different rules', () => {
    expect(
      probe(
        { name: 'one', access: { update: namedAs('ownRows', () => true) } },
        { name: 'two', access: { update: namedAs('ownRows', () => false) } },
      ),
    ).toEqual([
      'collection:probe two update: ownRows also names a different rule at collection:probe one update',
    ])
  })

  it('fails when a factory leaves its inner name on two rules', () => {
    const factory = () => namedAs('inner', () => true)
    expect(
      probe(
        { name: 'one', access: { update: factory() } },
        { name: 'two', access: { update: factory() } },
      ),
    ).toEqual([
      'collection:probe two update: inner names two functions; a factory must name its rules',
    ])
  })

  it('fails on an UPSTREAM entry the config no longer has', () => {
    const { problems } = auditAccess({ collections: [], globals: [] } as unknown as SanitizedConfig)
    expect(problems).toHaveLength(UPSTREAM.length)
    expect(problems).toContain(
      'collection:users salt create: no such rule; remove it from UPSTREAM',
    )
  })
})
```

The anchors cover a field in an unnamed collapsible (`tier`), a field in a named group (`review.review_note`), a field with no rule, a named field rule (`assessor`), a rule from Task 2 (`nobody`), a group rule and its child, two factory rules, an `UPSTREAM` rule, a global, and a `ui` field that holds no data (`courses.applicants`). The probe tests build a one-collection config by hand and prove each failure the owner asked for: an unnamed rule, an `anonymous` argument, one name on two rules, and a factory that forgot `named()`. The last test proves that a stale `UPSTREAM` entry fails. (A fixture, not a test double: no module is replaced.)

- [ ] **Step 2: Run the test and see it fail**

Run: `pnpm test:int scripts/access-audit.int.test.ts`
Expected: FAIL. The error says that `./access-audit` cannot be resolved.

- [ ] **Step 3: Write the walk**

Create `scripts/access-audit.ts`:

```ts
import type { Block, Field, SanitizedConfig } from 'payload'
import { fieldAffectsData, tabHasName } from 'payload/shared'

/**
 * The access audit (docs/superpowers/specs/2026-11-18-portal-design.md,
 * "Security baseline"). One row per collection, global and data field, with
 * the name of each access rule. No rule is called: many depend on the
 * document. The naming guide is in AGENTS.md.
 *
 * A field with no rule for an operation prints `open`: the rule of its
 * collection decides. A rule on a group or array covers its subtree in
 * Payload; each row shows only the field's own rule, and the parent row
 * comes first.
 *
 * Regenerate the committed snapshot with `pnpm audit:access`.
 */

const FIELD_OPERATIONS = ['create', 'read', 'update'] as const
const ENTITY_OPERATIONS = [
  'admin',
  'create',
  'read',
  'readDrafts',
  'readVersions',
  'update',
  'delete',
  'unlock',
]

type Rule = (...args: never[]) => unknown
type Rules = Record<string, unknown> | undefined
type Entry = { path: string; access: Rules }
type Upstream = { entity: string; field: string; operation: string; label: string; source: string }

export type AccessRow = { entity: string; field: string; rules: Record<string, string> }

const CLOSED = '()=>false'

const closed = (entity: string, field: string, operations: string[], label: string): Upstream[] =>
  operations.map((operation) => ({ entity, field, operation, label, source: CLOSED }))

/**
 * Rules that Payload or a plugin adds while it sanitizes the config, after
 * src/ has run, so src/ cannot name them. Each entry holds the rule's source
 * without whitespace: an upgrade that changes the rule fails the audit.
 */
export const UPSTREAM: Upstream[] = [
  ...[
    'resetPasswordToken',
    'resetPasswordExpiration',
    'salt',
    'hash',
    'resetPasswordRequestedAt',
    'loginAttempts',
    'lockUntil',
  ].flatMap((field) => closed('collection:users', field, ['create', 'update'], 'payload:auth')),
  ...closed('collection:users', 'sessions', ['update'], 'payload:auth'),
  {
    entity: 'collection:users',
    field: 'sessions',
    operation: 'read',
    label: 'payload:ownSessions',
    source: '({doc,req:{user}})=>{returnuser?.id===doc?.id;}',
  },
  ...closed('collection:payload-mcp-api-keys', 'user', ['create', 'update'], 'plugin-mcp:keyOwner'),
  ...closed('collection:payload-mcp-api-keys', 'apiKey', ['read'], 'payload:apiKey'),
  ...closed('collection:payload-mcp-api-keys', 'apiKeyIndex', ['read'], 'payload:apiKey'),
  ...closed(
    'collection:payload-kv',
    '*',
    ['create', 'read', 'update', 'delete'],
    'payload:internal',
  ),
  ...closed(
    'collection:payload-jobs',
    '*',
    ['create', 'read', 'update', 'delete'],
    'payload:internal',
  ),
]

const sourceOf = (rule: Rule) => rule.toString().replace(/\s+/g, '')

const isNamed = (rule: Rule, operation: string) =>
  rule.name !== '' && rule.name !== operation && !/\banonymous\b/.test(rule.name)

const blocksOf = (references: (Block | string)[], config: SanitizedConfig) =>
  references.flatMap((reference) => {
    if (typeof reference !== 'string') return [reference]
    const block = config.blocks?.find(({ slug }) => slug === reference)
    return block ? [block] : []
  })

const entries = (fields: Field[], prefix: string, config: SanitizedConfig): Entry[] =>
  fields.flatMap((field): Entry[] => {
    if (field.type === 'tabs')
      return field.tabs.flatMap((tab) =>
        tabHasName(tab)
          ? [
              { path: `${prefix}${tab.name}`, access: (tab as { access?: Rules }).access },
              ...entries(tab.fields, `${prefix}${tab.name}.`, config),
            ]
          : entries(tab.fields, prefix, config),
      )
    if (field.type === 'row' || field.type === 'collapsible')
      return entries(field.fields, prefix, config)
    if (field.type === 'group' && !('name' in field && field.name))
      return entries(field.fields, prefix, config)
    if (!fieldAffectsData(field)) return []
    const self: Entry = { path: `${prefix}${field.name}`, access: field.access as Rules }
    if (field.type === 'group' || field.type === 'array')
      return [self, ...entries(field.fields, `${self.path}.`, config)]
    if (field.type === 'blocks')
      return [
        self,
        ...blocksOf(field.blockReferences ?? field.blocks, config).flatMap((block) =>
          entries(block.fields, `${self.path}.${block.slug}.`, config),
        ),
      ]
    return [self]
  })

/**
 * The paths of the fields in `fields` whose own access holds a function. The
 * test of UPSTREAM runs it on what src/ defines, so that a rule from src/ does
 * not pass as a rule that Payload added.
 */
export const sourceSetsAccess = (fields: Field[]) =>
  entries(fields, '', { blocks: [] } as unknown as SanitizedConfig)
    .filter(({ access }) => Object.values(access ?? {}).some((rule) => typeof rule === 'function'))
    .map(({ path }) => path)

export const auditAccess = (config: SanitizedConfig) => {
  const rows: AccessRow[] = []
  const problems: string[] = []
  const upstream = new Map(
    UPSTREAM.map((entry) => [`${entry.entity} ${entry.field} ${entry.operation}`, entry]),
  )
  const met = new Set<string>()
  const names = new Map<string, { source: string; where: string; rules: Set<Rule> }>()

  const label = (entity: string, field: string, operation: string, value: unknown) => {
    if (typeof value !== 'function') return 'open'
    const rule = value as Rule
    const where = `${entity} ${field} ${operation}`
    const known = upstream.get(where)
    if (known) {
      met.add(where)
      if (known.source !== sourceOf(rule) || isNamed(rule, operation))
        problems.push(`${where}: the rule no longer matches UPSTREAM`)
      return known.label
    }
    if (!isNamed(rule, operation)) {
      problems.push(`${where}: unnamed rule`)
      return 'unnamed'
    }
    const seen = names.get(rule.name)
    if (!seen) {
      names.set(rule.name, { source: sourceOf(rule), where, rules: new Set([rule]) })
    } else if (seen.source !== sourceOf(rule)) {
      problems.push(`${where}: ${rule.name} also names a different rule at ${seen.where}`)
    } else if (!rule.name.includes('(') && !seen.rules.has(rule)) {
      problems.push(`${where}: ${rule.name} names two functions; a factory must name its rules`)
    }
    seen?.rules.add(rule)
    return rule.name
  }

  const audit = (entity: string, access: Rules, fields: Field[]) => {
    const operations = [
      ...ENTITY_OPERATIONS,
      ...Object.keys(access ?? {})
        .filter((operation) => !ENTITY_OPERATIONS.includes(operation))
        .sort(),
    ].filter((operation) => typeof access?.[operation] === 'function')
    rows.push({
      entity,
      field: '*',
      rules: Object.fromEntries(
        operations.map((operation) => [
          operation,
          label(entity, '*', operation, access?.[operation]),
        ]),
      ),
    })
    for (const { path, access: own } of entries(fields, '', config))
      rows.push({
        entity,
        field: path,
        rules: Object.fromEntries(
          FIELD_OPERATIONS.map((operation) => [
            operation,
            label(entity, path, operation, own?.[operation]),
          ]),
        ),
      })
  }

  for (const collection of config.collections)
    audit(`collection:${collection.slug}`, collection.access as Rules, collection.fields)
  for (const global of config.globals)
    audit(`global:${global.slug}`, global.access as Rules, global.fields)
  for (const where of upstream.keys())
    if (!met.has(where)) problems.push(`${where}: no such rule; remove it from UPSTREAM`)

  return { rows, problems }
}
```

`fieldAffectsData` and `tabHasName` come from `payload/shared`. The main `payload` entry does not export them (a run that imports them from `payload` fails with "does not provide an export named 'fieldAffectsData'").

- [ ] **Step 4: Run the test and see it pass**

Run: `pnpm test:int scripts/access-audit.int.test.ts`
Expected: PASS, `Tests  6 passed (6)`.

If `problems` is not empty, it lists each rule by place. A rule from `src/` means PR A missed it: name it there (in a fix commit on PR A's branch if PR A is still open) and do not widen `UPSTREAM`. A row of `UPSTREAM` that "no longer matches" means the Payload version changed the rule: read the new source in `node_modules/payload/dist` and update the entry.

- [ ] **Step 5: Check that `src/` sets no rule on an `UPSTREAM` field**

An `UPSTREAM` entry matches a rule by its source text. The text `()=>false` is also the text of an inline arrow in `src/`, so a rule that `src/` put on one of those fields would pass as Payload's. Function identity cannot tell them apart: Payload builds its auth fields anew on each call (`node_modules/payload/dist/auth/baseFields`), so no shared function exists to compare with. This test checks the source side instead. It lives in its own file, which never imports `@/payload.config`, so `Users` is still the object that `src/` wrote, not the one Payload sanitized.

Create `scripts/access-audit.unit.test.ts`:

```ts
import type { CollectionConfig } from 'payload'
import { describe, expect, it } from 'vitest'

import { Users } from '@/collections/Users'
import { overrideApiKeyCollection } from '@/plugins/mcp/api-keys'

import { sourceSetsAccess, UPSTREAM } from './access-audit'

const listed = (entity: string) =>
  new Set(UPSTREAM.filter((entry) => entry.entity === entity).map((entry) => entry.field))

describe('UPSTREAM lists only rules that Payload adds', () => {
  it('finds a rule that src puts on a field', () => {
    expect(
      sourceSetsAccess([{ name: 'salt', type: 'text', access: { create: () => false } }]),
    ).toEqual(['salt'])
    expect(sourceSetsAccess([{ name: 'salt', type: 'text', access: {} }])).toEqual([])
  })

  it('src sets no rule on a field of users that UPSTREAM lists', () => {
    expect(
      sourceSetsAccess(Users.fields).filter((path) => listed('collection:users').has(path)),
    ).toEqual([])
  })

  it('the API key override sets no rule on a field that UPSTREAM lists', () => {
    const fields = ['user', 'apiKey', 'apiKeyIndex'].map((name) => ({ name, type: 'text' }))
    const overridden = overrideApiKeyCollection({
      slug: 'payload-mcp-api-keys',
      fields,
    } as unknown as CollectionConfig)
    expect(
      sourceSetsAccess(overridden.fields).filter((path) =>
        listed('collection:payload-mcp-api-keys').has(path),
      ),
    ).toEqual([])
  })
})
```

The first test is the probe: it puts an inline `() => false` on `salt` and expects the helper to find it. The other two run the helper on what `src/` defines. The `payload-kv` and `payload-jobs` entries have no field in `src/` to check: `src/` declares no collection with those slugs, and the audit does not walk config-level `jobs.access` (PR B body, Task 9).

Run: `pnpm test:int scripts/access-audit.unit.test.ts`
Expected: PASS, `Tests  3 passed (3)`. If the second test lists a Payload auth field such as `salt`, a module that `Users` imports loaded the config and Payload merged its own fields into the array. Stop and report it. Do not remove the check.

- [ ] **Step 6: Lint and typecheck**

Run: `pnpm exec oxfmt scripts/access-audit.ts scripts/access-audit.int.test.ts scripts/access-audit.unit.test.ts && pnpm exec oxlint scripts/access-audit.ts scripts/access-audit.int.test.ts scripts/access-audit.unit.test.ts && pnpm typecheck`
Expected: no lint output, typecheck exit code 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/access-audit.ts scripts/access-audit.int.test.ts scripts/access-audit.unit.test.ts
git commit -m "feat(audit): name every access rule and fail on unnamed ones

Walks the sanitized Payload config and reports, per collection, global and
data field, the name of each access rule. It fails on a rule with no name,
on one name for two rules, and on a factory that leaves its inner name.
Rules that Payload adds during sanitize are listed in UPSTREAM by place and
source, and a change to them fails too. A unit test checks that src/ sets
no rule on a field that UPSTREAM lists. No rule is called.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 8: Commit the snapshot and the regenerate command

**Skills:** tdd, payload.

**Files:**

- Modify: `scripts/access-audit.int.test.ts`
- Create: `scripts/access-audit.snapshot.json`
- Modify: `package.json` (the `scripts` block)
- Modify: `AGENTS.md`

- [ ] **Step 1: Add the snapshot test**

Add this test inside the `describe` block of `scripts/access-audit.int.test.ts`, after the first test:

```ts
it('matches the committed snapshot', async () => {
  const { rows } = auditAccess(await config)
  await expect(`${JSON.stringify(rows, null, 2)}\n`).toMatchFileSnapshot(
    './access-audit.snapshot.json',
  )
})
```

- [ ] **Step 2: Add the regenerate script**

In `package.json`, add this line in `scripts`, after `"test:int"`:

```json
    "audit:access": "cross-env NODE_OPTIONS=--no-deprecation vitest run --config ./vitest.config.mts --project node scripts/access-audit.int.test.ts --update",
```

- [ ] **Step 3: Run the test in CI mode and see it fail**

Run: `CI=1 pnpm test:int scripts/access-audit.int.test.ts`
Expected: FAIL on `matches the committed snapshot`, `Tests  1 failed | 6 passed (7)`. Vitest does not write a new file snapshot when `CI` is set, so CI fails when someone forgets the snapshot.

- [ ] **Step 4: Generate the snapshot**

Run: `pnpm audit:access`
Expected: PASS, `Tests  7 passed (7)`, and `scripts/access-audit.snapshot.json` exists.

- [ ] **Step 5: Check the snapshot by hand**

Run:

```bash
node -e '
const rows = require("./scripts/access-audit.snapshot.json");
const by = (e, f) => rows.find((r) => r.entity === e && r.field === f).rules;
console.log(rows.length, new Set(rows.map((r) => r.entity)).size);
for (const [e, f] of [["collection:articles","legacy_url"],["collection:articles","slug"],["collection:articles","generateSlug"],["collection:space-preferences","digest_sent_at"],["collection:media","legacy_url"],["collection:people","slug"],["collection:media","*"]]) console.log(e, f, JSON.stringify(by(e, f)));
'
```

Expected (measured on the scratch copy):

```
1209 53
collection:articles legacy_url {"create":"open","read":"open","update":"open"}
collection:articles slug {"create":"open","read":"open","update":"open"}
collection:articles generateSlug {"create":"open","read":"open","update":"open"}
collection:space-preferences digest_sent_at {"create":"open","read":"open","update":"open"}
collection:media legacy_url {"create":"open","read":"open","update":"open"}
collection:people slug {"create":"open","read":"open","update":"open"}
collection:media * {"create":"isAuthenticated","read":"anyone","update":"isAdmin","delete":"isAdmin","unlock":"defaultUnlockAccess"}
```

53 entities are 46 collections and 7 globals. The six field rows are the holes PR C closes. `grep -c '"unnamed"' scripts/access-audit.snapshot.json` prints `0`.

- [ ] **Step 6: Check that the formatter keeps the file as it is**

Run: `pnpm exec oxfmt --check scripts/access-audit.snapshot.json && pnpm test:int scripts/access-audit.int.test.ts`
Expected: oxfmt reports "All matched files use the correct format", and the test passes.

If oxfmt reports a change, the pre-commit hook would rewrite the file and break the snapshot. Then add `"scripts/access-audit.snapshot.json"` to `ignorePatterns` in `.oxfmtrc.json`, and run this step again.

- [ ] **Step 7: Run the test in CI mode and see it pass**

Run: `CI=1 pnpm test:int scripts/access-audit.int.test.ts`
Expected: PASS, `Tests  7 passed (7)`.

- [ ] **Step 8: Add the audit command to the guide**

In `AGENTS.md`, at the end of the `**Access rules.**` paragraph that Task 5 added, append this sentence: `` `pnpm audit:access` regenerates `scripts/access-audit.snapshot.json` and fails on a rule with no name. ``

- [ ] **Step 9: Commit**

```bash
git add scripts/access-audit.int.test.ts scripts/access-audit.snapshot.json package.json AGENTS.md
git commit -m "test(audit): commit the access snapshot

A changed rule name, a new open field, a new field or a new collection
changes the snapshot, so it shows in review. pnpm audit:access regenerates
it through the same test, which also fails on an unnamed rule.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

If Step 6 changed `.oxfmtrc.json`, add it to the same commit.

### Task 9: Review PR B, then open it

**Skills:** code-review, then security-review.

- [ ] **Step 1: Code review.** Run the `code-review` skill on `git diff portal/phase-0-access-names...HEAD`. Fix each finding that is real. Re-run Task 8, Step 7 after a fix.
- [ ] **Step 2: Security review.** Run the `security-review` skill on the same diff. The questions for this PR: can the audit miss a rule? Check the walk against each container type in `reference/FIELD-TYPE-GUARDS.md`: tabs (named and unnamed), row, collapsible, group (named and unnamed), array, blocks, and `blockReferences`. Can an entry of `UPSTREAM` hide a rule from `src/`? (Each entry names a field that only Payload adds. `scripts/access-audit.unit.test.ts` checks that for the `users` fields and the API key override.)
- [ ] **Step 3: Full checks.** Run: `pnpm lint && pnpm typecheck && CI=1 pnpm test:int scripts/access-audit.int.test.ts`. Expected: no lint errors, typecheck exit code 0, `Tests  7 passed (7)`.
- [ ] **Commit the review fixes.** Commit each fix on its own, with the trailer:

```bash
git add <the files of the fix>
git commit -m "fix(<area>): <the finding, in one line>

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

If the reviews find nothing, write "Code review and security review: no findings" in the PR body. Make no empty commit.

- [ ] **Step 4: Open the PR.** `git push -u origin portal/phase-0-audit`, then `gh pr create --base portal/phase-0-access-names --title "Portal phase 0: access audit" --body-file <file>`. The body says what the audit prints, how to regenerate it, the four failure rules (Decision D3), the 28 `UPSTREAM` rules and why (Open question 2), and the six open field rows that PR C closes. It also says: "The audit does not walk the block fields inside Lexical `BlocksFeature`. The rich-text guard of phase 5 owns them." And: "The audit does not walk config-level `jobs.access`. `src/payload.config.ts` has no `jobs` key today, so no rule is missed. A `jobs` key added later is not covered until the walk is extended." And: "`scripts/access-audit.unit.test.ts` keeps a rule that `src/` sets from passing as an `UPSTREAM` rule. It covers the `users` fields and the API key override. `payload-kv` and `payload-jobs` have no field in `src/` to check." End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

# PR C. Field access fixes

Branch: `git switch -c portal/phase-0-field-access portal/phase-0-audit`.

### Task 10: Write the portal access tests (red for the new rows)

**Skills:** tdd, payload (`reference/QUERIES.md`, "Access control in Local API"; `reference/ACCESS-CONTROL.md`, "Field Access Control").

**Files:**

- Create: `src/portal-access.int.test.ts`

Rules the tests follow (from the spec):

- "Dropped": the write succeeds, and the stored value does not change. Each dropped row also changes the title in the same call and reads the new title back. That is the positive control: the call reached the store.
- "Throws": the call throws, and nothing is stored. Each throws row reads the store after the call.
- A non-admin write to a drafts collection saves a draft. The test reads the stored document with `draft: true` and `overrideAccess: true`.
- Collection access that returns `false` throws `Forbidden`. Only field access drops a value.
- The slug is not a "dropped" row: it follows the title until the first publish (Decision D9), so a title change moves the slug, and the positive control would move it too. Task 12 adds the slug rows in their own block.

- [ ] **Step 1: Write the test file**

Create `src/portal-access.int.test.ts`:

```ts
import { Forbidden, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

import { RUN, createTracker, uniq, uniqEmail, uniqPath } from '../testing/payload.fixture'

type Role = 'fellow' | 'member'
type Owned = 'articles' | 'courses' | 'publications'

let payload: Payload
const { track, cleanup } = createTracker()
const accounts = {} as Record<Role | 'admin', User>
const people = {} as Record<Role | 'student', number>
let cycleId: number
let taughtCourse: number
let otherCourse: number

let serial = 0
const fresh = (base: string) => uniq(`${base}-${(serial += 1)}`)

const actingAs = (user?: User) => ({ overrideAccess: false as const, ...(user ? { user } : {}) })

const at = (doc: object, path: string) =>
  path
    .split('.')
    .reduce<unknown>((value, key) => (value as Record<string, unknown> | null)?.[key], doc)

const nest = (path: string, value: unknown) =>
  path.split('.').reduceRight<unknown>((inner, key) => ({ [key]: inner }), value) as Record<
    string,
    unknown
  >

const stored = (collection: Owned, id: number) =>
  payload.findByID({ collection, id, draft: true, depth: 0, overrideAccess: true })

const ownDraft = async (collection: Owned, user: User, data: Record<string, unknown> = {}) =>
  track(
    collection,
    await payload.create({
      collection,
      data: { title: fresh(`Portal ${collection}`), ...data } as never,
      draft: true,
      ...actingAs(user),
    }),
  )

const makePerson = async (name: string) =>
  track(
    'people',
    await payload.create({ collection: 'people', data: { name: uniq(name), slug: uniq(name) } }),
  ).id

const makeAccount = async (roles: User['roles'], person?: number) =>
  track(
    'users',
    await payload.create({
      collection: 'users',
      data: {
        email: uniqEmail(`portal-${roles.join('-')}`),
        password: crypto.randomUUID(),
        roles,
        ...(person ? { person } : {}),
      },
    }),
  )

const lexical = (text: string) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: null,
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: null,
        textFormat: 0,
        textStyle: '',
        children: [
          { type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 },
        ],
      },
    ],
  },
})

const OWNERS: [Owned, Role][] = [
  ['articles', 'fellow'],
  ['articles', 'member'],
  ['publications', 'fellow'],
  ['publications', 'member'],
  ['courses', 'fellow'],
]

const DROPPED: { collection: Owned; roles: Role[]; field: string; value: () => unknown }[] = [
  { collection: 'articles', roles: ['fellow', 'member'], field: 'tier', value: () => 'public' },
  {
    collection: 'articles',
    roles: ['fellow', 'member'],
    field: 'published_date',
    value: () => '2030-01-01T00:00:00.000Z',
  },
  { collection: 'articles', roles: ['fellow', 'member'], field: 'featured', value: () => true },
  {
    collection: 'articles',
    roles: ['fellow', 'member'],
    field: 'review.review_note',
    value: () => 'Claimed note',
  },
  {
    collection: 'articles',
    roles: ['fellow', 'member'],
    field: 'legacy_url',
    value: () => `/${fresh('claimed-article')}`,
  },
  {
    collection: 'publications',
    roles: ['fellow', 'member'],
    field: 'review.review_note',
    value: () => 'Claimed note',
  },
  {
    collection: 'publications',
    roles: ['fellow', 'member'],
    field: 'legacy_url',
    value: () => `/${fresh('claimed-publication')}`,
  },
  { collection: 'courses', roles: ['fellow'], field: 'tier', value: () => 'public' },
  { collection: 'courses', roles: ['fellow'], field: 'cycle', value: () => cycleId },
  {
    collection: 'courses',
    roles: ['fellow'],
    field: 'registration',
    value: () => ({ mode: 'closed' }),
  },
  {
    collection: 'courses',
    roles: ['fellow'],
    field: 'pricing_override',
    value: () => ({ options: [{ amount: 100, default: true }] }),
  },
  {
    collection: 'courses',
    roles: ['fellow'],
    field: 'review.review_note',
    value: () => 'Claimed note',
  },
  {
    collection: 'courses',
    roles: ['fellow'],
    field: 'legacy_url',
    value: () => `/${fresh('claimed-course')}`,
  },
]

const DROPPED_CASES = DROPPED.flatMap((row) => row.roles.map((role) => ({ ...row, role })))

describe('portal access, phase 0', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    people.fellow = await makePerson('portal-fellow')
    people.member = await makePerson('portal-member')
    people.student = await makePerson('portal-student')
    accounts.admin = await makeAccount(['admin'])
    accounts.fellow = await makeAccount(['fellow', 'member'], people.fellow)
    accounts.member = await makeAccount(['member'], people.member)
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: uniq('Portal place'), slug: uniq('portal-place'), city: uniq('Portal city') },
      }),
    )
    cycleId = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2089, place: place.id },
      }),
    ).id
    taughtCourse = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: { title: uniq('Taught course'), course_type: 'THEMATIC', fellows: [people.fellow] },
        draft: true,
      }),
    ).id
    otherCourse = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: { title: uniq('Other course'), course_type: 'THEMATIC' },
        draft: true,
      }),
    ).id
  })

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  describe('owned drafts', () => {
    it.each(DROPPED_CASES)(
      '$collection as $role: a write to $field is dropped',
      async ({ collection, role, field, value }) => {
        const user = accounts[role]
        const doc = await ownDraft(collection, user)
        const before = at(await stored(collection, doc.id), field)
        const title = fresh('Retitled')
        await payload.update({
          collection,
          id: doc.id,
          data: { title, ...nest(field, value()) } as never,
          draft: true,
          ...actingAs(user),
        })
        const after = await stored(collection, doc.id)
        expect(after.title).toBe(title)
        expect(at(after, field)).toEqual(before)
      },
    )

    it.each(DROPPED_CASES)(
      '$collection as $role: $field given on create is dropped',
      async ({ collection, role, field, value }) => {
        const user = accounts[role]
        const plain = await stored(collection, (await ownDraft(collection, user)).id)
        const given = await stored(
          collection,
          (await ownDraft(collection, user, nest(field, value()))).id,
        )
        expect(at(given, field)).toEqual(at(plain, field))
      },
    )

    it.each(OWNERS)(
      '%s as %s: a create takes the slug from the title and drops a hand-written slug',
      async (collection, role) => {
        const doc = await ownDraft(collection, accounts[role], {
          title: `Slug Probe ${collection} ${role} ${RUN}`,
          slug: fresh('hand-written'),
        })
        expect((await stored(collection, doc.id)).slug).toBe(
          `slug-probe-${collection}-${role}-${RUN}`,
        )
      },
    )

    it.each(['articles', 'courses', 'publications'] as const)(
      'admin: %s keeps a hand-written slug and legacy_url',
      async (collection) => {
        const slug = uniq(`admin-${collection}`)
        const legacy = uniqPath(`admin-${collection}`)
        const doc = await ownDraft(collection, accounts.admin, { slug, legacy_url: legacy })
        const after = await stored(collection, doc.id)
        expect(after.slug).toBe(slug)
        expect(after.legacy_url).toBe(legacy)
      },
    )

    it.each([
      ['articles', 'fellow'],
      ['articles', 'member'],
      ['courses', 'fellow'],
    ] as [Owned, Role][])(
      '%s as %s: a publish throws Forbidden and the document stays a draft',
      async (collection, role) => {
        const user = accounts[role]
        const doc = await ownDraft(collection, user)
        await expect(
          payload.update({
            collection,
            id: doc.id,
            data: { _status: 'published' } as never,
            ...actingAs(user),
          }),
        ).rejects.toThrow(Forbidden)
        expect((await stored(collection, doc.id))._status).toBe('draft')
      },
    )
  })

  describe('people, own person', () => {
    it('member: a write to their own slug is dropped', async () => {
      const before = await payload.findByID({
        collection: 'people',
        id: people.member,
        depth: 0,
        overrideAccess: true,
      })
      const name = uniq('Renamed member')
      await payload.update({
        collection: 'people',
        id: people.member,
        data: { name, slug: uniq('claimed-person') },
        ...actingAs(accounts.member),
      })
      const after = await payload.findByID({
        collection: 'people',
        id: people.member,
        depth: 0,
        overrideAccess: true,
      })
      expect(after.name).toBe(name)
      expect(after.slug).toBe(before.slug)
    })
  })

  describe('enrollments', () => {
    it('fellow: writes to person, course, status, slot and source of a taught course are dropped', async () => {
      const enrollment = track(
        'enrollments',
        await payload.create({
          collection: 'enrollments',
          data: {
            person: people.student,
            course: taughtCourse,
            status: 'applied',
            source: 'admin',
          },
        }),
      )
      await payload.update({
        collection: 'enrollments',
        id: enrollment.id,
        data: {
          person: people.member,
          course: otherCourse,
          status: 'accepted',
          slot: 'evening',
          source: 'backfill',
          assessment: lexical('Strong reading'),
        },
        ...actingAs(accounts.fellow),
      })
      const after = await payload.findByID({
        collection: 'enrollments',
        id: enrollment.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(after).toMatchObject({
        person: people.student,
        course: taughtCourse,
        status: 'applied',
        source: 'admin',
      })
      expect(after.slot ?? null).toBeNull()
      expect(at(after, 'assessment.root.children')).toEqual(lexical('Strong reading').root.children)
    })

    it('member: an own assessment write throws, and a read returns no assessment', async () => {
      const enrollment = track(
        'enrollments',
        await payload.create({
          collection: 'enrollments',
          data: {
            person: people.member,
            course: otherCourse,
            status: 'accepted',
            source: 'admin',
            assessment: lexical('Written by a fellow'),
          },
        }),
      )
      await expect(
        payload.update({
          collection: 'enrollments',
          id: enrollment.id,
          data: { assessment: lexical('Written by the student') },
          ...actingAs(accounts.member),
        }),
      ).rejects.toThrow(Forbidden)
      const own = await payload.findByID({
        collection: 'enrollments',
        id: enrollment.id,
        depth: 0,
        ...actingAs(accounts.member),
      })
      expect(own.id).toBe(enrollment.id)
      expect(own).not.toHaveProperty('assessment')
      const after = await payload.findByID({
        collection: 'enrollments',
        id: enrollment.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(at(after, 'assessment.root.children')).toEqual(
        lexical('Written by a fellow').root.children,
      )
    })
  })

  describe('space-preferences, own row', () => {
    it.each(['fellow', 'member'] as Role[])(
      '%s: a write to digest_sent_at is dropped, and their own choices still save',
      async (role) => {
        const account = accounts[role]
        const row = track(
          'space-preferences',
          await payload.create({
            collection: 'space-preferences',
            data: {
              account: account.id,
              digest: 'weekly',
              digest_sent_at: '2030-01-05T14:00:00.000Z',
            },
          }),
        )
        await payload.update({
          collection: 'space-preferences',
          id: row.id,
          data: { digest_sent_at: '2031-01-01T00:00:00.000Z', stop_all_email: true },
          ...actingAs(account),
        })
        const after = await payload.findByID({
          collection: 'space-preferences',
          id: row.id,
          overrideAccess: true,
        })
        expect(after.stop_all_email).toBe(true)
        expect(after.digest_sent_at).toBe('2030-01-05T14:00:00.000Z')
      },
    )
  })

  describe('form-submissions', () => {
    it.each(['fellow', 'member', 'anonymous'] as const)(
      '%s: find throws Forbidden',
      async (who) => {
        await expect(
          payload.find({
            collection: 'form-submissions',
            ...actingAs(who === 'anonymous' ? undefined : accounts[who]),
          }),
        ).rejects.toThrow(Forbidden)
      },
    )
  })

  describe('anonymous', () => {
    it.each(['articles', 'courses', 'publications'] as const)(
      'a create of %s throws, and nothing is stored',
      async (collection) => {
        const title = uniq(`Anonymous ${collection}`)
        await expect(
          payload.create({ collection, data: { title } as never, draft: true, ...actingAs() }),
        ).rejects.toThrow(Forbidden)
        const { totalDocs } = await payload.count({
          collection,
          where: { title: { equals: title } },
          overrideAccess: true,
        })
        expect(totalDocs).toBe(0)
      },
    )

    it('an update of an article throws, and the title stays', async () => {
      const doc = await ownDraft('articles', accounts.member)
      await expect(
        payload.update({
          collection: 'articles',
          id: doc.id,
          data: { title: fresh('Anonymous edit') },
          draft: true,
          ...actingAs(),
        }),
      ).rejects.toThrow(Forbidden)
      expect((await stored('articles', doc.id)).title).toBe(doc.title)
    })

    it('a create of an enrollment or a space preference throws', async () => {
      await expect(
        payload.create({
          collection: 'enrollments',
          data: { person: people.student, course: otherCourse, status: 'applied', source: 'admin' },
          ...actingAs(),
        }),
      ).rejects.toThrow(Forbidden)
      await expect(
        payload.create({
          collection: 'space-preferences',
          data: { account: accounts.member.id, digest: 'off' },
          ...actingAs(),
        }),
      ).rejects.toThrow(Forbidden)
      const { totalDocs } = await payload.count({
        collection: 'enrollments',
        where: { person: { equals: people.student }, course: { equals: otherCourse } },
        overrideAccess: true,
      })
      expect(totalDocs).toBe(0)
    })
  })
})
```

Notes for the implementer:

- `accounts` is filled in `beforeAll`, so a test reads `accounts[role]` inside its body, never at module load.
- The tracker deletes the `people` row of each tracked user, and `space-preferences` rows by account. The places, cycles, courses, enrollments and owned drafts are tracked directly.
- If a create needs a field the plan does not set, read the collection and add the smallest value. Do not use `overrideAccess: true` on the call under test.
- An admin publish or approval may log "Review email ... failed" when the local Resend key is not valid. That log is not a test failure.

- [ ] **Step 2: Run the tests and see the new rows fail**

Run: `pnpm test:int src/portal-access.int.test.ts`
Expected: FAIL. Exactly 18 tests fail (the spec's "new" rows, and the People row from Deviation 3):

- `$collection as $role: a write to legacy_url is dropped`: 5 cases (articles fellow and member, publications fellow and member, courses fellow).
- `$collection as $role: legacy_url given on create is dropped`: the same 5 cases.
- `a create takes the slug from the title and drops a hand-written slug`: 5 cases.
- `space-preferences`: 2 cases.
- `people`: 1 case.

Every other test passes now. These are the spec's "guard" rows, and the admin test that pins today's behavior. If a guard row fails, stop. The access rule differs from the spec. Read the rule in `src/access.ts` or the collection, and report the difference to the owner before you change code.

- [ ] **Step 3: Lint and typecheck**

Run: `pnpm exec oxlint src/portal-access.int.test.ts && pnpm typecheck`
Expected: no lint output, and the typecheck exits with code 0. Vitest does not check types, so this step is the only type check of the test file.

- [ ] **Step 4: Do not commit the file yet**

Leave `src/portal-access.int.test.ts` in the working tree, uncommitted (Decision D8). It is red for the new rows until Task 13. Do not use `git stash` for it; it stays as an untracked file while Tasks 11 and 12 run `git add` on their own files only. Before each commit in Tasks 11 and 12, run `git status --short` and check that the test file is still listed as untracked (`??`) and that nothing else is left over.

### Task 11: `legacy_url` is admin-only

**Skills:** tdd, payload.

**Files:**

- Modify: `src/fields/import.ts`
- Modify: `scripts/access-audit.snapshot.json` (regenerated)

- [ ] **Step 1: Use `adminWritesOnly` for `legacy_url`**

Replace the content of `src/fields/import.ts` with:

```ts
import type { Field } from 'payload'

import { adminWritesOnly } from '@/access'

/**
 * Provenance for archive imports (docs/schema.md, Archive import). The
 * importer upserts by `legacy_url`; a page that yields several documents
 * gives each a fragment, e.g. `/fall-cycle-2024.html#melancholia-in-the-city`.
 * Redirects from the old site resolve through it too, so only an admin sets
 * it: an owner could otherwise claim an old URL on a draft. The importer runs
 * with overrideAccess.
 */
export const importFields = (): Field[] => [
  {
    name: 'legacy_url',
    type: 'text',
    unique: true,
    index: true,
    access: adminWritesOnly,
    admin: { hidden: true },
  },
]
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test:int src/portal-access.int.test.ts`
Expected: the 10 `legacy_url` cases (update and create) pass. The 5 slug create cases, the 2 `space-preferences` cases and the `people` case still fail.

- [ ] **Step 3: Run the tests that read `legacy_url`**

Run: `pnpm test:int src/lib/import-redirects.int.test.ts seed/import.int.test.ts && pnpm exec vitest run src/fields/shape-fields.unit.test.ts`
Expected: all pass. The importer and the redirects write with `overrideAccess: true`.

- [ ] **Step 4: Regenerate the audit snapshot**

Run: `pnpm audit:access`
Expected: PASS. Then run: `git diff -U0 scripts/access-audit.snapshot.json | grep -c '^+.*"create": "adminOnlyField"'`
Expected: `13` (`legacy_url` in 13 collections, `open` to `adminOnlyField` for create and update), and no other row changes.

- [ ] **Step 5: Run the snapshot test in CI mode and the type check**

Run: `CI=1 pnpm test:int scripts/access-audit.int.test.ts && pnpm typecheck`
Expected: PASS, `Tests  7 passed (7)`, and exit code 0 from the typecheck.

- [ ] **Step 6: Commit**

```bash
git add src/fields/import.ts scripts/access-audit.snapshot.json
git commit -m "fix(access): only admins write legacy_url

Redirects from the old site resolve through legacy_url, so an owner could
claim an unused old URL on a draft. The importer writes with overrideAccess.
The audit snapshot shows 13 rows closed.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 12: Only admins write `slug` and `generateSlug`

**Skills:** tdd, payload (`reference/FIELDS.md`, "Slug field helper"; `reference/HOOKS.md`, "Field hooks").

**Files:**

- Modify: `src/fields/slug.ts`
- Modify: `src/portal-access.int.test.ts` (still uncommitted)
- Modify: `scripts/access-audit.snapshot.json` (regenerated)

The owner confirmed the slug behavior (Decision D9): the slug follows the title until the first publish, then it is fixed. Both fields take `adminWritesOnly`, and a hook replaces Payload's own.

- [ ] **Step 1: Add the slug tests**

In `src/portal-access.int.test.ts`, add `import { slugify } from '@/lib/slugify'` to the `@/` imports. Then add this `describe` block inside `describe('portal access, phase 0', ...)`, after `describe('owned drafts', ...)`:

```ts
describe('slug follows the title until the first publish', () => {
  const retitle = (collection: Owned, id: number, user: User, data: Record<string, unknown>) =>
    payload.update({ collection, id, data: data as never, draft: true, ...actingAs(user) })

  const arabicDraft = async (title: string) =>
    track(
      'articles',
      await payload.create({
        collection: 'articles',
        locale: 'ar',
        data: { title } as never,
        draft: true,
        ...actingAs(accounts.member),
      }),
    )

  it.each(['articles', 'publications'] as const)(
    '%s as member: a draft slug follows each title change',
    async (collection) => {
      const doc = await ownDraft(collection, accounts.member, {
        title: `First ${collection} ${RUN}`,
      })
      expect((await stored(collection, doc.id)).slug).toBe(`first-${collection}-${RUN}`)
      await retitle(collection, doc.id, accounts.member, { title: `Second ${collection} ${RUN}` })
      expect((await stored(collection, doc.id)).slug).toBe(`second-${collection}-${RUN}`)
    },
  )

  it.each(['articles', 'publications'] as const)(
    '%s as member: a hand-written slug on update is dropped',
    async (collection) => {
      const doc = await ownDraft(collection, accounts.member, {
        title: `Hand ${collection} ${RUN}`,
      })
      await retitle(collection, doc.id, accounts.member, { slug: fresh('claimed') })
      expect((await stored(collection, doc.id)).slug).toBe(`hand-${collection}-${RUN}`)
    },
  )

  it.each(['articles', 'publications'] as const)(
    '%s: a slug an admin sets stays when the owner retitles',
    async (collection) => {
      const doc = await ownDraft(collection, accounts.member)
      const chosen = fresh(`chosen-${collection}`)
      await retitle(collection, doc.id, accounts.admin, { slug: chosen })
      await retitle(collection, doc.id, accounts.member, { title: fresh('Owner title') })
      expect((await stored(collection, doc.id)).slug).toBe(chosen)
    },
  )

  it('articles: after the first publish, a title change keeps the slug', async () => {
    const doc = await ownDraft('articles', accounts.member, { title: `Before ${RUN}` })
    await retitle('articles', doc.id, accounts.member, { title: `Published ${RUN}` })
    await payload.update({
      collection: 'articles',
      id: doc.id,
      data: { _status: 'published' } as never,
      ...actingAs(accounts.admin),
    })
    await retitle('articles', doc.id, accounts.member, { title: `After ${RUN}` })
    const live = await payload.findByID({
      collection: 'articles',
      id: doc.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(live.slug).toBe(`published-${RUN}`)
    expect((await stored('articles', doc.id)).slug).toBe(`published-${RUN}`)
  })

  it('articles: a title change in Arabic leaves the slug, and so does a publish from Arabic', async () => {
    const doc = await ownDraft('articles', accounts.member, { title: `English ${RUN}` })
    await payload.update({
      collection: 'articles',
      id: doc.id,
      locale: 'ar',
      data: { title: 'عنوان عربي' } as never,
      draft: true,
      ...actingAs(accounts.member),
    })
    expect((await stored('articles', doc.id)).slug).toBe(`english-${RUN}`)
    await payload.update({
      collection: 'articles',
      id: doc.id,
      locale: 'ar',
      data: { _status: 'published' } as never,
      ...actingAs(accounts.admin),
    })
    await retitle('articles', doc.id, accounts.member, { title: `Changed ${RUN}` })
    expect((await stored('articles', doc.id)).slug).toBe(`english-${RUN}`)
  })

  it('articles: a draft made only in Arabic gets a slug from its title', async () => {
    const title = `عنوان ${RUN}`
    const doc = await arabicDraft(title)
    expect((await stored('articles', doc.id)).slug).toBe(slugify(title))
  })

  it('articles: an update in English with no English title keeps the slug, and a later English title moves it', async () => {
    const title = `مقالة ${RUN}`
    const doc = await arabicDraft(title)
    await retitle('articles', doc.id, accounts.member, { tags: [{ tag: 'probe' }] })
    expect((await stored('articles', doc.id)).slug).toBe(slugify(title))
    await retitle('articles', doc.id, accounts.member, { title: `Later English ${RUN}` })
    expect((await stored('articles', doc.id)).slug).toBe(`later-english-${RUN}`)
  })

  it('articles: a title that gives a slug another article holds leaves the slug, and the next title moves it', async () => {
    const holder = await ownDraft('articles', accounts.member, { title: `Taken ${RUN}` })
    const doc = await ownDraft('articles', accounts.member, { title: `Free ${RUN}` })
    await retitle('articles', doc.id, accounts.member, { title: `Taken ${RUN}` })
    expect((await stored('articles', doc.id)).slug).toBe(`free-${RUN}`)
    expect((await stored('articles', holder.id)).slug).toBe(`taken-${RUN}`)
    await retitle('articles', doc.id, accounts.member, { title: `Third ${RUN}` })
    expect((await stored('articles', doc.id)).slug).toBe(`third-${RUN}`)
  })

  it('articles: a publish that repeats a published slug is refused until an admin sets another slug', async () => {
    const first = await ownDraft('articles', accounts.member, { title: `Alpha ${RUN}` })
    const second = await ownDraft('articles', accounts.member, { title: `Beta ${RUN}` })
    const shared = `Shared ${RUN}`
    await retitle('articles', first.id, accounts.member, { title: shared })
    await retitle('articles', second.id, accounts.member, { title: shared })
    const publish = (id: number) =>
      payload.update({
        collection: 'articles',
        id,
        data: { _status: 'published' } as never,
        ...actingAs(accounts.admin),
      })
    await publish(first.id)
    expect((await stored('articles', first.id)).slug).toBe(`shared-${RUN}`)
    await expect(publish(second.id)).rejects.toMatchObject({
      data: { errors: [{ path: 'slug' }] },
    })
    const chosen = fresh('after-clash')
    await retitle('articles', second.id, accounts.admin, { slug: chosen })
    await publish(second.id)
    expect((await stored('articles', second.id)).slug).toBe(chosen)
    expect((await stored('articles', first.id)).slug).toBe(`shared-${RUN}`)
  })
})
```

Articles have autosave drafts, publications have drafts without autosave, so the block covers both paths. The publish tests use an article: a publication publish needs its introduction fields (Payload refused a probe with "The following field is invalid: Introduction > Kind"). The two Arabic titles carry `RUN`, so a second run does not meet the slug of the first. The uniqueness test makes the article that holds the slug with a create, not a retitle: a create writes the main table, which is the table of the unique index and the table the hook counts; a draft retitle writes only the versions table. The last test uses that same fact the other way round: two drafts are created with different titles (a create writes the main table, so the creates do not clash), then both are retitled to one title (a draft retitle writes only the versions table, so both drafts now hold the slug `shared-…` and the hook finds no other main-table row that holds it). The first publish writes the main table and passes. The second publish meets the unique index. Payload turns that violation into a `ValidationError` whose `data.errors` has `path: 'slug'` (message "Value must be unique"), and the test asserts that error, not a message of this hook. If the run shows that the error does not resolve to path `slug`, restore the hook count: in the wrapper of Step 3, when `data._status === 'published'` and `otherRowHolds(finalSlug, args)` is true, throw a `ValidationError` on `slug` with the message "Another document uses this slug. An admin can set a different slug.", assert that message in the test, and say so in the PR body. The fallback code, in `src/fields/slug.ts`: add `ValidationError` back to the `payload` import, and wrap the returned hook so it reads `const decide = async (args: SlugHookArgs) => { …the body above… }`, then:

```ts
  return async (args) => {
    const keepFollowing = await decide(args)
    const { collection, data, originalDoc } = args
    if (data?._status !== 'published') return keepFollowing
    const finalSlug: unknown = data.slug || originalDoc?.slug
    if (typeof finalSlug === 'string' && (await otherRowHolds(finalSlug, args)))
      throw new ValidationError({
        collection: collection?.slug,
        errors: [
          { path: 'slug', message: 'Another document uses this slug. An admin can set a different slug.' },
        ],
        req: args.req,
      })
    return keepFollowing
  } An admin then writes another slug on the second draft, and its publish passes.

- [ ] **Step 2: Run the slug tests and see them fail**

Run: `pnpm test:int src/portal-access.int.test.ts -t "slug follows the title"`
Expected: FAIL on 8 of 12 cases.

- `a draft slug follows each title change` (2) and `after the first publish, a title change keeps the slug` (1) fail because Payload's hook stored `generateSlug = false` at create, so the slug stays the slug of the first title (`before-…`).
- `a hand-written slug on update is dropped` (2) fails because the slug is not locked yet.
- `an update in English with no English title` (1) and `a title that gives a slug another article holds` (1) fail on their last lines. Payload's stored `false` never lets a later English title move the slug.
- `a publish that repeats a published slug is refused` (1) fails because the draft retitles do not move the slug (both drafts keep their create-time slug), so the second publish passes and `rejects` sees no error. (The hook has no publish check of its own; the index is what refuses the second publish once the slugs match.)

The admin-set cases (2), the Arabic retitle case (1) and the Arabic-only create case (1) pass now. The Arabic-only create case and the "keeps the slug" lines of the last two cases guard the branches of the new hook. The code of Step 3 without its guards fails them: assigning a `null` slug wipes the Arabic slug, and a retitle to a taken title moves the slug to `taken-…` in the draft (a draft save does not reach the unique index, so only a later publish would fail).

- [ ] **Step 3: Lock the fields and replace the follow hook**

Replace the content of `src/fields/slug.ts` with:

```ts
import type { CollectionSlug, Field, FieldHook, RowField } from 'payload'
import { slugField as payloadSlugField } from 'payload'

import { adminWritesOnly } from '@/access'
import { slugify } from '@/lib/slugify'

type SlugHookArgs = Parameters<FieldHook>[0]

const slugOf = (value: unknown) => slugify(typeof value === 'string' ? value : '') || null

const otherRowHolds = async (slug: string, { collection, originalDoc, req }: SlugHookArgs) =>
  collection !== null &&
  (
    await req.payload.count({
      collection: collection.slug as CollectionSlug,
      where: {
        slug: { equals: slug },
        ...(originalDoc?.id === undefined ? {} : { id: { not_equals: originalDoc.id } }),
      },
      overrideAccess: true,
      req,
    })
  ).totalDocs > 0

/**
 * The slug follows the title while the document has never been published.
 * The `generateSlug` checkbox holds that state: it stays true until the first
 * publish, or until an admin writes a slug by hand. A collection without
 * drafts has no publish step, so its slug is fixed when the document is
 * created. The slug follows the title of the default locale only: an edit
 * in another locale leaves it as it is. A document with no title in the
 * default locale gets no new slug, and an update that would take a slug that
 * another row holds keeps the current one (the slug is unique). The hook has
 * no publish check: a draft save skips the main table, so two drafts can hold
 * one slug, and the unique index refuses the second publish with a field error
 * on `slug` (Payload turns the violation into a ValidationError). An admin
 * recovers by setting a different slug. This replaces Payload's own hook,
 * which stops following the title after two versions.
 */
const followTitleUntilPublished = (useAsSlug: string): FieldHook =>
  async (args) => {
    const { collection, data, operation, originalDoc, req, value } = args
    if (!data) return value
    const given: unknown = data.slug
    const changed = typeof given === 'string' && given !== '' && given !== originalDoc?.slug
    const publishing = data._status === 'published'
    const { localization } = req.payload.config
    if (operation === 'update' && localization && req.locale !== localization.defaultLocale)
      return changed || publishing ? false : value
    const fromTitle = slugOf(data[useAsSlug] ?? originalDoc?.[useAsSlug])
    if ((changed && given !== fromTitle) || (operation === 'update' && !value)) return false
    if (fromTitle && fromTitle !== originalDoc?.slug) {
      const taken = operation === 'update' && (await otherRowHolds(fromTitle, args))
      data.slug = taken ? originalDoc?.slug : fromTitle
    }
    return Boolean(collection?.versions?.drafts) && !publishing
  }

const lock = (row: RowField, useAsSlug: string): RowField => ({
  ...row,
  fields: row.fields.map((field): Field => {
    const locked = { ...field, access: adminWritesOnly } as Field
    if (locked.type !== 'checkbox' || locked.name !== 'generateSlug') return locked
    return {
      ...locked,
      hooks: { ...locked.hooks, beforeChange: [followTitleUntilPublished(useAsSlug)] },
    }
  }),
})

/**
 * Payload's built-in slug field, bound to this project's slugify.
 *
 * The built-in gives the lock/unlock toggle in the admin, the `generateSlug`
 * checkbox, a unique index and an index for lookups. This project adds a
 * slugify that survives Arabic titles (the default keeps ASCII `\w` only),
 * the rule of when the slug follows the title (followTitleUntilPublished),
 * and field access: only an admin writes the slug or its checkbox, so an
 * owner cannot claim a URL by hand.
 *
 * @see https://payloadcms.com/docs/fields/text#slug-field
 */
export const slugField: typeof payloadSlugField = (args = {}) =>
  payloadSlugField({
    // Payload calls this with `{ valueToSlugify, data, req }`; our helper is
    // plain and synchronous, so unwrap the source value. Return undefined
    // (not '') when there is nothing to slugify: two draft rows with slug ''
    // would hit the unique index.
    slugify: ({ valueToSlugify }) => slugify(valueToSlugify) || undefined,
    ...args,
    overrides: (row) =>
      lock(args.overrides?.(row) ?? row, args.fieldToUse ?? args.useAsSlug ?? 'title'),
  })
```

How it works, step by step:

- Field access runs in `beforeValidate` (Decision D1). A non-admin's `slug` and `generateSlug` are dropped there, so in this hook `data.slug` is the stored slug or nothing, and `value` is the stored checkbox.
- `changed` is true only for a slug that differs from the stored one. Only an admin's slug survives field access. In the default locale, a changed slug that equals the title's slug is not hand-set: the admin form sends the title's slug while it follows the title.
- The title is localized (`src/collections/Articles.ts:79`) and the slug is not. An update in another locale (Arabic) leaves the slug as it is, and still fixes it at a publish or when an admin changes it. Without this check, a probe moved the slug of an English draft to `anwan-arby` after an Arabic retitle.
- On create, and on an update while the checkbox is `true`, the hook sets the slug from the title. It returns `true` (keep following) only for a draft in a drafts collection. At a publish (the review hook sets `_status: 'published'` before field hooks run), in a collection without drafts (people, places), or on a hand-set slug, it returns `false`: fixed.
- A draft made only in Arabic gets its slug on create. The locale check applies to updates only, so the create branch runs, and `slugOf` romanizes the Arabic title with the project's slugify. Payload's own hook is replaced, so this slug comes from this hook, not from Payload's generation.
- `fromTitle` is `null` when the document has no title in the default locale (an Arabic-only draft that an English update touches without a title). The hook then assigns nothing. Assigning `null` would wipe the stored slug.
- The slug is `unique`, and it now follows each retitle during autosave (every 2000 ms, `src/collections/Articles.ts:60`). On an update, when the computed slug differs from the stored one, the hook counts the other rows that hold it (`overrideAccess: true`, so an owner's own access filter does not hide them, and `req`, so the count joins the transaction). When one exists, the hook sets `data.slug` back to the stored slug. That also covers an admin form that sends the title's slug while another row holds it. The count runs only when the slug would change.
- A create has no stored slug to keep and no id to exclude. It does not count, so a title that another row already holds is refused by the unique index as it is today (prediction, not run).
- The count reads the main table, the table of the unique index. Payload skips the main table on a draft save, so two drafts can hold the same slug until one is published (Decision D9). The first article of the uniqueness test is made with a create for that reason. Because the count reads the main table, the main-table slug of a never-published draft is its create-time slug. A stale create-time slug can therefore block a retitle of another draft: that draft keeps its own slug on that save, and the next title change counts again.
- The hook has no publish check. The `_status` the caller sends (an admin publish, or the review hook on approval) only fixes the slug: `publishing` makes the hook return `false`. When two drafts hold one slug, the second publish meets the unique index, and Payload turns the violation (code 23505) into a `ValidationError` that names the field `slug` ("Value must be unique"; `@payloadcms/drizzle` `upsertRow/handleUpsertError.js`). A count in the hook would copy the index rule, so the plan leaves it to the index. Recovery: the admin writes another slug in the `slug` field and publishes again (the last slug test). A non-admin cannot write the slug, so the error reaches the admin who approves. If the run shows that the error does not resolve to path `slug`, restore the hook count as Step 1 says.
- `useAsSlug` comes from the caller: people and places pass `useAsSlug: 'name'`.
- The `generate_slug` column exists already. No migration.

`overrides` comes after `...args`, and it runs the caller's `overrides` first and locks the result. No caller passes `overrides` today (`rg "slugField\(" src`).

- [ ] **Step 4: Run the tests**

Run: `pnpm test:int src/portal-access.int.test.ts`
Expected: the slug block passes, the 5 slug create cases and the `people` case pass. Only the 2 `space-preferences` cases fail.

- [ ] **Step 5: Run the other tests that make slugs**

Run: `pnpm test:int src/teaching.int.test.ts src/mcp-drafts.int.test.ts src/people.int.test.ts src/lib/profile.int.test.ts`
Expected: all pass. These create documents as admins or with `overrideAccess`, or never write `slug`. A test that asserts an admin draft keeps its first slug after a title change would now fail: such a test pins the old behavior. Report it to the owner before you change it.

The whole suite runs in Step 10, after the snapshot is regenerated.

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm typecheck && pnpm exec oxlint src/fields/slug.ts src/portal-access.int.test.ts`
Expected: exit code 0, no lint output.

- [ ] **Step 7: Check by hand that a fellow can still make and autosave a draft in `/admin`**

The `slug` field is `required` and uses the custom `SlugField` component (`@payloadcms/next/client#SlugField`). After this task a fellow cannot write it, so the admin form must still work for them. The int tests use the Local API, which does not run the form, so this step is manual.

1. Start the app against the local database: `pnpm dev`.
2. As an admin, open `http://localhost:3000/admin/collections/users`. Create a user with roles `fellow` and `member`, linked to an existing person, with a known password. Sign out.
3. Sign in at `http://localhost:3000/admin` as that fellow.
4. Open `http://localhost:3000/admin/collections/articles/create`.
   Expected: the `slug` field in the sidebar is read-only (no editable input, no lock toggle that works), and no error toast shows.
5. Type the title `Fellow Draft Probe`. Wait for the autosave status in the header to read "Draft saved" (the first autosave creates the document, and the URL changes to `/admin/collections/articles/<id>`).
   Expected: no toast that says a field is invalid, and no `slug` required error.
6. Change the title to `Fellow Draft Probe Two`, wait for a second autosave, reload the page.
   Expected: the `slug` field shows `fellow-draft-probe-two`.
7. Check the stored row: `psql "$DATABASE_URL" -c "select id, title, slug, generate_slug from articles where title like 'Fellow Draft Probe%'"`
   Expected: one row, with the slug of step 6, and `generate_slug` is `t`.
8. Repeat steps 4 to 7 on `http://localhost:3000/admin/collections/courses/create` with the title `Fellow Course Probe`. Courses have the same slug field and a fellow can create them.
9. As an admin. Sign out, and sign in as an admin. Open the article of step 5. Change the title to `Admin Retitle Probe` and wait for the autosave.
   Expected: the slug follows, `admin-retitle-probe`. (The admin form sends the slug; a slug equal to the title's slug is not hand-set.)
10. Unlock the slug field, type `admin-chosen-probe`, save the draft. Then change the title to `Admin Second Probe` and wait for the autosave.
    Expected: the slug stays `admin-chosen-probe`, and `generate_slug` in the row is `f`.
11. Clean up as an admin: delete both probe documents in `/admin` (or `psql "$DATABASE_URL" -c "delete from articles where title like 'Fellow Draft Probe%' or title like 'Admin % Probe'"` and the same for `courses`), and delete the test user. Stop `pnpm dev`.

If step 4 or 5 fails (the form refuses to save, or the slug shows a required error), stop. Do not weaken the lock to make the form pass. Report the exact message to the owner: the `SlugField` component may need `admin.readOnly` handling, and that is a design change.

- [ ] **Step 8: Regenerate the audit snapshot**

Run: `pnpm audit:access`
Expected: PASS. Then run: `git diff -U0 scripts/access-audit.snapshot.json | grep -c '^+.*"create": "adminOnlyField"'`
Expected: `16` (`slug` and `generateSlug` in 8 collections: people, courses, programmes, articles, places, newsletters, publications, events). No other row changes in this commit. The hook is not access, so it adds no row to the snapshot.

- [ ] **Step 9: Run the snapshot test in CI mode**

Run: `CI=1 pnpm test:int scripts/access-audit.int.test.ts`
Expected: PASS, `Tests  7 passed (7)`.

- [ ] **Step 10: Run the whole suite**

The hook runs on every save of 8 collections, so a file this task did not name can fail. Step 3 changed 16 snapshot rows and Step 8 regenerated them, so the audit snapshot test passes now.

Run: `pnpm test:int`
Expected: every file passes, except the 2 `space-preferences` cases of `src/portal-access.int.test.ts`, which Task 13 closes. The run covers the Step 3 code plus the untracked red file, which vitest runs because it is on disk. The commit does not contain that file, so the committed tree has no red test. A failure in any other file is a regression of this task: find the cause before you commit.

- [ ] **Step 11: Commit**

```bash
git add src/fields/slug.ts scripts/access-audit.snapshot.json
git commit -m "fix(access): only admins write the slug; it follows the title until published

An owner could claim a future slug on a draft. slug and generateSlug now
take adminWritesOnly. Field access runs in beforeValidate, so a non-admin's
slug is dropped before the generateSlug hook runs. That hook now follows the
title on every save while the document has never been published, and fixes
the slug at the first publish or when an admin sets it. The generateSlug
column holds that state, so no migration. The hook sets nothing when the
document has no title in the default locale, and keeps the current slug when
another row holds the computed one. At a publish, a slug that another row
holds is refused by the unique index with a field error on slug, and an
admin sets a different slug.

The wrapper serves 8 collections. Only people has a non-admin writer (the
own person row), which had the same hole. The audit snapshot shows 16 rows
closed.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 13: `digest_sent_at` is not writable through the API

**Skills:** tdd, payload.

**Files:**

- Modify: `src/collections/SpacePreferences.ts` (the `digest_sent_at` field)
- Modify: `scripts/access-audit.snapshot.json` (regenerated)
- Commit: `src/portal-access.int.test.ts` (written in Tasks 10 and 12, committed here, Decision D8)

- [ ] **Step 1: Add the field access**

In `src/collections/SpacePreferences.ts`, replace the `digest_sent_at` field with:

```ts
    {
      // Claimed before a digest is sent, so a retry or an overlapping run
      // cannot send it twice. The digest job writes it with SQL
      // (src/lib/space-digest.ts), past field access; the owner's update
      // stays open for the other fields.
      name: 'digest_sent_at',
      type: 'date',
      access: { update: nobody },
      admin: { readOnly: true },
    },
```

`nobody` is in the file's `@/access` import since Task 3. Do not change the collection `access`. The owner's `update` stays open.

- [ ] **Step 2: Run the tests**

Run: `pnpm test:int src/portal-access.int.test.ts`
Expected: PASS, every test.

- [ ] **Step 3: Run the digest tests**

Run: `pnpm test:int src/lib/space-email.int.test.ts`
Expected: PASS. `claimDigest` and `releaseDigest` write `digest_sent_at` with `payload.db.pool.query` (`src/lib/space-digest.ts:170-191`), so field access does not reach them.

- [ ] **Step 4: Regenerate the audit snapshot**

Run: `pnpm audit:access`
Expected: PASS. Then run: `git diff -U0 scripts/access-audit.snapshot.json | grep -c '^+.*"update": "nobody"'`
Expected: `1`. No other row changes in this commit.

- [ ] **Step 5: Run the snapshot test in CI mode, the type check and the lint**

Run: `CI=1 pnpm test:int scripts/access-audit.int.test.ts src/portal-access.int.test.ts && pnpm typecheck && pnpm exec oxlint src/portal-access.int.test.ts src/collections/SpacePreferences.ts`
Expected: PASS for both files, exit code 0, no lint output.

- [ ] **Step 6: Commit the last fix with the access tests**

Every test of the file passes now, so the commit is green.

```bash
git add src/collections/SpacePreferences.ts scripts/access-audit.snapshot.json src/portal-access.int.test.ts
git commit -m "fix(access): owners cannot write digest_sent_at

The owner may update their preference row, so they could set the claim
time and skip their digests. The digest job writes it with SQL.

This commit also adds the phase 0 access table (src/portal-access.int.test.ts):
the spec's rows through the Local API with overrideAccess: false. Dropped rows
change the title in the same call as the positive control. It is committed
here, after the three fixes it covers, so that no commit of the PR is red.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 14: Check the whole snapshot diff against PR B

**Skills:** tdd, payload.

**Files:** none. Tasks 11, 12 and 13 committed the snapshot with each fix. This task checks the sum.

- [ ] **Step 1: Check that the snapshot is current**

Run: `CI=1 pnpm test:int scripts/access-audit.int.test.ts`
Expected: PASS, `Tests  7 passed (7)`. If it fails, `pnpm audit:access` shows a drift that no commit carried; find out why before you commit the regenerated file.

- [ ] **Step 2: Check that exactly 30 rows changed against PR B**

Run:

```bash
before=$(mktemp)
git show portal/phase-0-audit:scripts/access-audit.snapshot.json > "$before"
BEFORE="$before" node -e '
const fs = require("fs");
const a = JSON.parse(fs.readFileSync(process.env.BEFORE, "utf8"));
const b = JSON.parse(fs.readFileSync("scripts/access-audit.snapshot.json", "utf8"));
const key = (r) => `${r.entity} ${r.field}`;
const old = new Map(a.map((r) => [key(r), r]));
let changed = 0;
for (const r of b) {
  const o = old.get(key(r));
  if (!o) console.log("NEW", key(r));
  else if (JSON.stringify(o.rules) !== JSON.stringify(r.rules)) { changed++; console.log("CHANGED", key(r), JSON.stringify(o.rules), "->", JSON.stringify(r.rules)); }
}
console.log("rows", a.length, b.length, "changed", changed);
'
command rm "$before"
```

Expected: no `NEW` line, the same row count before and after, and `changed 30`:

- `legacy_url` in 13 collections (governance, memberships, people, press, programmes, courses, places, articles, publications, cycles, newsletters, events, media): create and update `open -> adminOnlyField`.
- `slug` and `generateSlug` in 8 collections (people, courses, programmes, articles, places, newsletters, publications, events): create and update `open -> adminOnlyField`. That is 16 rows.
- `collection:space-preferences digest_sent_at`: update `open -> nobody`.

Any other change is a bug. Find it before you go on.

- [ ] **Step 3: Check that each fix commit is green**

Run: `git rebase --exec 'CI=1 pnpm test:int scripts/access-audit.int.test.ts' portal/phase-0-audit`
Expected: every commit of PR C passes the snapshot test, and the rebase ends with no stop. (The commits do not change, because the exec only runs a test.) The snapshot test does not show a break in another collection's tests. Task 12, Step 5 ran the whole `pnpm test:int` before the slug commit, the commit that touches 8 collections, and Task 15, Step 3 runs it again on the last commit. The `legacy_url` and `digest_sent_at` commits touch no hook, and their own test files ran in Tasks 11 and 13.

### Task 15: Review PR C, then open it

**Skills:** code-review, then security-review.

- [ ] **Step 1: Code review.** Run the `code-review` skill on `git diff portal/phase-0-audit...HEAD`. Fix each real finding. Re-run Task 13, Step 5 and Task 14, Step 2 after a fix.
- [ ] **Step 2: Security review.** Run the `security-review` skill on the same diff. The questions for this PR: can a non-admin still set `slug` through `generateSlug`, through a duplicate, or through the admin form? Can a non-admin move a published document's slug by unpublishing or by an edit that the review hook holds as a draft? Can a non-admin set `legacy_url` on any of the 13 collections? Does any non-admin code path write these fields with `overrideAccess: false`? (`rg "overrideAccess: false" src` and read each hit that writes a collection with these fields.) A non-admin duplicate keeps the title, so its slug collides with the source's unique slug; record what the admin form shows in that case. Also check the publish path of Decision D9: make two drafts with different titles, retitle both to one title (two autosaves), publish the first, then publish the second as an admin. Expected: the unique index refuses the second publish with a field error on `slug` ("Value must be unique"). The recovery: the admin unlocks the slug field, writes another slug, and publishes again; the publish passes. Delete both probe documents after.
- [ ] **Step 3: Full checks.** Run: `pnpm lint && pnpm typecheck && pnpm test:int`. Expected: no lint errors, typecheck exit code 0, every test file passes. PR C changes field access and a hook that every collection with a slug runs, so it runs the whole suite, as Task 5, Step 3 and Task 18, Step 4 do.
- [ ] **Commit the review fixes.** Commit each fix on its own, with the trailer:

```bash
git add <the files of the fix>
git commit -m "fix(<area>): <the finding, in one line>

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

If the reviews find nothing, write "Code review and security review: no findings" in the PR body. Make no empty commit.

- [ ] **Step 4: Open the PR.** `git push -u origin portal/phase-0-field-access`, then `gh pr create --base portal/phase-0-audit --title "Portal phase 0: close legacy_url, slug and digest_sent_at" --body-file <file>`. The body lists the 30 snapshot rows, the People broadening (Deviation 3), and the slug behavior (Decision D9), including the caveat that existing drafts keep their slug and the publish rule: the unique index refuses a repeat slug at the publish, with a field error on `slug`, and an admin sets a different slug. End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

# PR D. Media photos only

Branch: `git switch -c portal/phase-0-media portal/phase-0-field-access`.

**Gate.** Do not start PR D until the owner has answered Open question 1. The tasks below are option (a). If the owner chose (b), stop and ask for the PDF size limit before you change Task 16.

### Task 16: Non-admins store only photos in `media`

**Skills:** tdd, payload (`reference/HOOKS.md`, "Collection hooks"; `reference/ADAPTERS.md`, "Storage adapters").

**Files:**

- Modify: `src/portal-access.int.test.ts`
- Create: `src/lib/photo-upload.ts`
- Modify: `src/collections/Media.ts`
- Modify: `src/security-media.int.test.ts`

- [ ] **Step 1: Add the media rows to the portal access tests**

In `src/portal-access.int.test.ts`, add these imports at the top:

```ts
import { readFile } from 'node:fs/promises'

import { PHOTO_MAX_BYTES } from '@/lib/profile-limits'
```

Add this `describe` block inside `describe('portal access, phase 0', ...)`, after `describe('anonymous', ...)`:

```ts
describe('media create', () => {
  const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

  const file = (name: string) => readFile(new URL(`../testing/files/${name}`, import.meta.url))

  const upload = (
    who: User | undefined,
    alt: string,
    name: string,
    mimetype: string,
    data: Buffer,
  ) =>
    payload
      .create({
        collection: 'media',
        data: { alt },
        file: { name: `${RUN}-${name}`, mimetype, data, size: data.length },
        ...actingAs(who),
      })
      .then((media) => track('media', media))

  const storedWithAlt = async (alt: string) =>
    (await payload.count({ collection: 'media', where: { alt: { equals: alt } } })).totalDocs

  it.each(['fellow', 'member'] as Role[])(
    '%s: a PDF throws, and nothing is stored',
    async (role) => {
      const alt = uniq(`Portal pdf ${role}`)
      const pdf = await file('tiny.pdf')
      await expect(
        upload(accounts[role], alt, 'tiny.pdf', 'application/pdf', pdf),
      ).rejects.toThrow()
      expect(await storedWithAlt(alt)).toBe(0)
    },
  )

  it.each(['fellow', 'member'] as Role[])(
    '%s: PDF bytes that claim to be image/png throw, and nothing is stored',
    async (role) => {
      const alt = uniq(`Portal lie ${role}`)
      const pdf = await file('tiny.pdf')
      await expect(upload(accounts[role], alt, 'lie.png', 'image/png', pdf)).rejects.toThrow()
      expect(await storedWithAlt(alt)).toBe(0)
    },
  )

  it.each(['fellow', 'member'] as Role[])(
    '%s: a PNG larger than PHOTO_MAX_BYTES throws, and nothing is stored',
    async (role) => {
      const alt = uniq(`Portal big ${role}`)
      const big = Buffer.concat([await file('pixel.png'), Buffer.alloc(PHOTO_MAX_BYTES)])
      await expect(upload(accounts[role], alt, 'big.png', 'image/png', big)).rejects.toThrow()
      expect(await storedWithAlt(alt)).toBe(0)
    },
  )

  it.each(['fellow', 'member'] as Role[])(
    '%s: a GIF throws, and nothing is stored',
    async (role) => {
      const alt = uniq(`Portal gif ${role}`)
      await expect(upload(accounts[role], alt, 'pixel.gif', 'image/gif', GIF)).rejects.toThrow()
      expect(await storedWithAlt(alt)).toBe(0)
    },
  )

  it.each(['fellow', 'member'] as Role[])('%s: a small PNG is stored', async (role) => {
    const alt = uniq(`Portal png ${role}`)
    await upload(accounts[role], alt, 'pixel.png', 'image/png', await file('pixel.png'))
    expect(await storedWithAlt(alt)).toBe(1)
  })

  it('admin: a PDF is stored', async () => {
    const alt = uniq('Portal pdf admin')
    await upload(accounts.admin, alt, 'tiny.pdf', 'application/pdf', await file('tiny.pdf'))
    expect(await storedWithAlt(alt)).toBe(1)
  })

  it('anonymous: a PNG throws Forbidden, and nothing is stored', async () => {
    const alt = uniq('Portal png anonymous')
    const png = await file('pixel.png')
    await expect(upload(undefined, alt, 'pixel.png', 'image/png', png)).rejects.toThrow(Forbidden)
    expect(await storedWithAlt(alt)).toBe(0)
  })
})
```

`GIF` is a real 1 by 1 GIF (43 bytes). sharp reads it as format `gif`, so the test proves the format check and not a failed parse of junk bytes. The helper tracks each stored row, so the red run of Step 2 leaves nothing behind. Each test reads its file before the call, so the call's promise is awaited at once and never rejects unhandled.

- [ ] **Step 2: Run the media tests and see them fail**

Run: `pnpm test:int src/portal-access.int.test.ts -t "media create"`
Expected: FAIL on the 8 non-admin refusal cases (PDF, lie, big and GIF, each for fellow and member): the upload is stored today. The small PNG, admin PDF and anonymous cases pass.

- [ ] **Step 3: Write the photo rule**

Create `src/lib/photo-upload.ts`:

```ts
import sharp from 'sharp'

import { PHOTO_MAX_BYTES, PHOTO_TYPES } from '@/lib/profile-limits'

/**
 * Whether an uploaded file is a photo that a non-admin may store: at most
 * PHOTO_MAX_BYTES, and one of PHOTO_TYPES as read from the bytes, not from
 * the type the client claims. The profile form keeps the same limits in the
 * browser (src/lib/profile-limits.ts); sharp is Node only, so this stays here.
 */
export const isPhotoUpload = async ({ data }: { data: Buffer }) => {
  if (data.length > PHOTO_MAX_BYTES) return false
  const format = await sharp(data)
    .metadata()
    .then(
      (metadata) => metadata.format,
      () => undefined,
    )
  return format !== undefined && PHOTO_TYPES.includes(`image/${format}`)
}
```

sharp names the formats `jpeg`, `png` and `webp`, so `image/${format}` matches `PHOTO_TYPES`. sharp refuses a PDF or HTML buffer, which counts as "not a photo". It reads an SVG as `svg` and a GIF as `gif`, which `PHOTO_TYPES` does not hold. When the server runs with `useTempFiles`, Payload gives `req.file.tempFilePath` and an empty `data`; the hook refuses that case with its own message before `isPhotoUpload` runs (`rg useTempFiles src` shows whether the repo uses it; today it should print nothing).

- [ ] **Step 4: Add the hook to Media**

In `src/collections/Media.ts`:

Replace the imports at the top (after PR A they are `import type { CollectionConfig } from 'payload'`, then `import { isAdmin, isAuthenticated, anyone } from '@/access'`, then the `importFields` and `revalidate` imports) with:

```ts
import { APIError, type CollectionBeforeOperationHook, type CollectionConfig } from 'payload'

import { anyone, isAdmin, isAdminUser, isAuthenticated } from '@/access'

import { importFields } from '@/fields/import'
import { isPhotoUpload } from '@/lib/photo-upload'
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from '@/lib/profile-limits'
import { revalidateAfterChange, revalidateAfterDelete } from '@/lib/revalidate'

const PHOTO_RULE = `Upload a ${PHOTO_TYPES.map((type) => type.replace('image/', '').toUpperCase()).join(', ')} image of ${PHOTO_MAX_BYTES / 1024 / 1024} MB or less. Ask an admin to add other files.`

/**
 * A non-admin uploads photos only: covers, profile photos and pasted images.
 * The check reads `req.file` before Payload converts it to WebP, because after
 * that the stored type and size describe the converted file. A create with no
 * file (a remote URL) is refused too, and so is a file with no bytes in memory
 * (a temp-file upload). Admins, and seeds and the importer (overrideAccess),
 * upload anything Payload accepts. An anonymous caller returns here too:
 * beforeOperation runs before the collection access check, which throws
 * Forbidden for them.
 */
const photosOnlyForNonAdmins: CollectionBeforeOperationHook = async ({
  operation,
  overrideAccess,
  req,
}) => {
  if (operation !== 'create' || overrideAccess || !req.user || isAdminUser(req.user)) return
  if (!req.file) throw new APIError(PHOTO_RULE, 400, undefined, true)
  if (!req.file.data?.length) {
    throw new APIError(
      'The server could not read the uploaded file. Try a smaller photo.',
      400,
      undefined,
      true,
    )
  }
  if (await isPhotoUpload(req.file)) return
  throw new APIError(PHOTO_RULE, 400, undefined, true)
}
```

In the `Media` config, replace `hooks` with:

```ts
  hooks: {
    beforeOperation: [photosOnlyForNonAdmins],
    afterChange: [revalidateAfterChange('media')],
    afterDelete: [revalidateAfterDelete('media')],
  },
```

Leave `access`, `fields` and `upload` as they are. `photosOnlyForNonAdmins` is a hook, not an access rule, so the access audit does not list it.

- [ ] **Step 5: Run the media tests and see them pass**

Run: `pnpm test:int src/portal-access.int.test.ts`
Expected: PASS, every test.

- [ ] **Step 6: Confirm that the audit snapshot does not change**

Run: `CI=1 pnpm test:int scripts/access-audit.int.test.ts`
Expected: PASS, `Tests  7 passed (7)`. The hook is not access, so no row changes.

- [ ] **Step 7: Update the existing media security test**

The old test uploaded a PDF as a member. After this change a member cannot. Run the active-content refusals and the PDF as an admin, so the test still proves Payload's own type restriction, which applies to admins too. Replace the content of `src/security-media.int.test.ts` with:

```ts
import { readFile } from 'node:fs/promises'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

import { RUN } from '../testing/payload.fixture'

describe('public media uploads', () => {
  let payload: Payload
  const created: number[] = []
  const admin = { id: -1, collection: 'users', roles: ['admin'] } as User
  const member = { id: -2, collection: 'users', roles: ['member'] } as User
  const upload = async (user: User, name: string, mimetype: string, data: Buffer) => {
    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Security upload probe' },
      file: { name: name.replace(/(\.[^.]+)$/, `-${RUN}$1`), mimetype, data, size: data.length },
      user,
      overrideAccess: false,
    })
    created.push(media.id)
    return media
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
  })
  afterAll(async () => {
    for (const id of created) await payload.delete({ collection: 'media', id })
    await payload?.destroy()
  })

  it.each([
    ['probe.html', 'text/html', '<script>alert(document.domain)</script>'],
    [
      'probe.svg',
      'image/svg+xml',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)"/>',
    ],
  ])('refuses active content in %s, even from an admin', async (name, mimetype, body) => {
    await expect(upload(admin, name, mimetype, Buffer.from(body))).rejects.toThrow()
  })

  it.each([
    [admin, 'pixel.png', 'image/png'],
    [admin, 'tiny.pdf', 'application/pdf'],
    [member, 'pixel.png', 'image/png'],
  ])('preserves supported uploads (%#: %s)', async (user, name, mimetype) => {
    const data = await readFile(new URL(`../testing/files/${name}`, import.meta.url))
    expect((await upload(user, name, mimetype, data)).id).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 8: Run the media security test**

Run: `pnpm test:int src/security-media.int.test.ts`
Expected: PASS, `Tests  5 passed (5)`.

- [ ] **Step 9: Lint and typecheck**

Run: `pnpm exec oxlint src/lib/photo-upload.ts src/collections/Media.ts src/portal-access.int.test.ts src/security-media.int.test.ts && pnpm typecheck`
Expected: no lint output, typecheck exit code 0.

- [ ] **Step 10: Commit**

```bash
git add src/lib/photo-upload.ts src/collections/Media.ts src/portal-access.int.test.ts src/security-media.int.test.ts
git commit -m "fix(media): non-admins upload photos only

A non-admin create must carry a JPEG, PNG or WebP of at most 5 MB, read from
the bytes before Payload converts the file to WebP. A create with no file
(a remote URL) or with no bytes in memory is refused. Admins, seeds and the
importer are unchanged; an anonymous caller still gets Forbidden from the
collection access.

security-media: a member may no longer upload a PDF, so the PDF and the
active-content refusals run as an admin, which still proves Payload's own
type restriction.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 17: The profile photo uses the same rule

**Skills:** tdd.

**Files:**

- Modify: `src/lib/profile.ts` (imports at line 21, checks at lines 174 and 266)
- Modify: `src/lib/profile.int.test.ts` (one success test)

- [ ] **Step 1: Run the profile tests first**

Run: `pnpm test:int src/lib/profile.int.test.ts`
Expected: PASS. This is the baseline. `refuses a photo of the wrong type or size` and `refuses a photo alone of the wrong type or size` cover the rule.

- [ ] **Step 2: Add the success test**

In `src/lib/profile.int.test.ts`, add this test after `refuses a photo alone of the wrong type or size, and removes the photo`. It is the one test that a real photo passes the new media hook through `saveProfilePhoto`, which creates the media row as the member with `overrideAccess: false`:

```ts
it('saves a real PNG photo through the media rule', async () => {
  const data = await readFile(new URL('../../testing/files/pixel.png', import.meta.url))
  const result = await saveProfilePhoto(payload, me, {
    data,
    mimetype: 'image/png',
    name: `photo-${RUN}.png`,
    size: data.length,
  })
  const stored = await payload.find({
    collection: 'media',
    where: { filename: { contains: `photo-${RUN}` } },
    overrideAccess: true,
  })
  stored.docs.forEach((media) => track('media', media))
  expect(result.ok).toBe(true)
  expect(stored.totalDocs).toBe(1)
  expect((await readProfile(payload, me))?.photo).not.toBeNull()
})
```

Run: `pnpm test:int src/lib/profile.int.test.ts -t "saves a real PNG photo"`
Expected: PASS now (the member's PNG passes the old check and the new media hook). It is a guard: it must still pass after Step 3. If it fails with `error: 'photo'` after Task 16, the media hook refuses a real photo: read `req.file` in the hook before you change anything else.

- [ ] **Step 3: Replace both checks**

In `src/lib/profile.ts`:

Change the import at line 21 from:

```ts
import { HTTP_URL, LINKS_MAX, NAME_MAX, PHOTO_MAX_BYTES, PHOTO_TYPES } from '@/lib/profile-limits'
```

to:

```ts
import { isPhotoUpload } from '@/lib/photo-upload'
import { HTTP_URL, LINKS_MAX, NAME_MAX } from '@/lib/profile-limits'
```

Replace the check at lines 173-176:

```ts
// The size comes from the bytes, not from what the client claims.
if (photo && (!PHOTO_TYPES.includes(photo.mimetype) || photo.data.length > PHOTO_MAX_BYTES)) {
  return { ok: false, error: 'photo' }
}
```

with:

```ts
if (photo && !(await isPhotoUpload(photo))) return { ok: false, error: 'photo' }
```

Replace the check at lines 266-268:

```ts
if (photo && (!PHOTO_TYPES.includes(photo.mimetype) || photo.data.length > PHOTO_MAX_BYTES)) {
  return { ok: false, error: 'photo' }
}
```

with:

```ts
if (photo && !(await isPhotoUpload(photo))) return { ok: false, error: 'photo' }
```

Both functions are already `async`.

- [ ] **Step 4: Run the profile tests again**

Run: `pnpm test:int src/lib/profile.int.test.ts`
Expected: PASS, the count of Step 1 plus the one new test. The GIF case (`GIF89a` bytes) fails the format check, and the large cases fail the size check.

- [ ] **Step 5: Check that no other copy of the rule is left**

Run: `rg "PHOTO_TYPES|PHOTO_MAX_BYTES" src`
Expected: only `src/lib/profile-limits.ts` (the values), `src/lib/photo-upload.ts` (the server rule), `src/collections/Media.ts` (the error message), `src/components/image-upload/avatar-upload.tsx` (the browser picker) and `src/portal-access.int.test.ts`.

- [ ] **Step 6: Lint, typecheck, commit**

Run: `pnpm exec oxlint src/lib/profile.ts src/lib/profile.int.test.ts && pnpm typecheck`
Expected: no lint output, typecheck exit code 0.

```bash
git add src/lib/profile.ts src/lib/profile.int.test.ts
git commit -m "refactor(profile): check the photo with isPhotoUpload

The profile server held the photo rule twice; the media hook needed a third
copy. One server rule now reads the format from the bytes. A test proves that a
member saves a real PNG through the media hook.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 18: Review PR D and the whole phase, then open PR D

**Skills:** code-review, then security-review.

- [ ] **Step 1: Code review.** Run the `code-review` skill on `git diff portal/phase-0-field-access...HEAD`. Fix each real finding. Re-run Task 16, Step 5 and Task 17, Step 4 after a fix.
- [ ] **Step 2: Security review of the phase.** Run the `security-review` skill on `git diff origin/main...HEAD` (all four PRs). The questions:
  - Can a non-admin store a non-photo in `media` through REST multipart, GraphQL, a remote URL, or a duplicate? (`update` and `delete` on media stay admin-only.)
  - Does every row of the spec's phase 0 table have a passing test in `src/portal-access.int.test.ts`?
  - Did any admin path lose an ability it had? (Admin uploads, admin slugs, the importer, the digest job.)
  - Does `pnpm audit:access` still report no problem?
- [ ] **Step 3: Full checks.** Run: `pnpm lint && pnpm typecheck && pnpm test:int src/portal-access.int.test.ts scripts/access-audit.int.test.ts src/security-media.int.test.ts src/lib/profile.int.test.ts src/lib/space-email.int.test.ts`. Expected: no lint errors, typecheck exit code 0, every file passes.
- [ ] **Step 4: Run the whole int suite once.** Run: `pnpm test:int`. Expected: every file passes. A failure in a file this phase did not touch is a regression of this phase until shown otherwise.
- [ ] **Commit the review fixes.** Commit each fix on its own, with the trailer:

```bash
git add <the files of the fix>
git commit -m "fix(<area>): <the finding, in one line>

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

If the reviews find nothing, write "Code review and security review: no findings" in the PR body. Make no empty commit.

- [ ] **Step 5: Open the PR.** `git push -u origin portal/phase-0-media`, then `gh pr create --base portal/phase-0-field-access --title "Portal phase 0: non-admins upload photos only" --body-file <file>`. The body names the rule, the byte check, the remote URL and no-bytes refusals, the `security-media` change, and the owner's answer to Open question 1 with the non-admin paths it affects. End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Phase 0 ends when

- `src/portal-access.int.test.ts` passes. It holds every row of the spec's table, plus the People slug row and the slug block.
- `scripts/access-audit.snapshot.json` is committed and `scripts/access-audit.int.test.ts` passes with `CI=1`, with no problem reported.
- Every access function in `src/` has a name (Task 5, Step 1 prints `unnamed 0`).
- No migration was created or applied.

## Spec coverage

| Spec item                                                                                                                                | Task                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Field access audit script, snapshot, snapshot test                                                                                       | 7, 8 (extended to collection and global rules, Deviation 2)                                                    |
| Owner decision: name every access rule, fail on unnamed                                                                                  | 1 to 6, 7                                                                                                      |
| `legacy_url` admin-only on create and update                                                                                             | 11                                                                                                             |
| `slug` cannot be set by a non-admin, generation still runs                                                                               | 12 (tests in 10 and 12)                                                                                        |
| Owner decision: slug follows the title until the first publish                                                                           | 12                                                                                                             |
| `space-preferences.digest_sent_at` read-only through the API, owner update stays open                                                    | 13 (tests in 10)                                                                                               |
| `courses.fellows` stays open                                                                                                             | No change. The audit row shows `open`.                                                                         |
| `media` create: photo types and size for non-admins                                                                                      | 16, 17 (after Open question 1)                                                                                 |
| Jobs, `/api/mcp`, `form-submissions`                                                                                                     | No change. `form-submissions` is a guard row in 10; its plugin create rule gets a name in 3.                   |
| Test table rows (articles, publications, enrollments x2, courses, space-preferences, publish, media, form-submissions), anonymous writes | 10, 16                                                                                                         |
| No migration                                                                                                                             | Checked in "Before you start" and "Phase 0 ends when". The slug hook uses the existing `generate_slug` column. |
| Review: code-review, then security-review                                                                                                | 6, 9, 15, 18                                                                                                   |
