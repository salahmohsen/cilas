# Portal phase 0: security baseline. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Payload access rules match what the portal will show, before any portal page ships. A non-admin cannot write `legacy_url`, `slug`, `space-preferences.digest_sent_at`, or a media file that is not a photo. A committed audit of every field rule shows each new field in review.

**Architecture:** A pure walk of the sanitized Payload config prints the field rule names. A Vitest file snapshot keeps them. The fixes are field access (`adminOnlyField`) on `legacy_url`, `slug` and `generateSlug`, and `update: () => false` on `digest_sent_at`. Media gets one `beforeOperation` hook that checks the uploaded bytes for non-admins. One int test file proves each refusal through the Local API with `overrideAccess: false`.

**Tech stack:** Payload 3.91.0 (Postgres adapter), Vitest (`node` project, `*.int.test.ts`), sharp 0.35.5, pnpm.

**Source of truth:** `docs/superpowers/specs/2026-11-18-portal-design.md`, sections "Security baseline (phase 0)", "Migrations", "Tests" and the phase 0 block in "Phases". The spec wins over the research file.

**Status of the code in this plan:** nobody ran it. The plan was written from the source of Payload 3.91.0 and of this repo. Each "Expected" line is a prediction. When a run differs, find out why before you change the plan's code.

---

## PR split

Phase 0 ships as three stacked PRs. Each PR has one mechanism, so its reviewer reads one kind of change.

| PR                    | Branch                        | Base                          | Tasks      | What it proves                                                                                                                 |
| --------------------- | ----------------------------- | ----------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A. Field access audit | `portal/phase-0-audit`        | `main`                        | 1, 2, 3    | The audit names every field rule. The snapshot is the baseline of today.                                                       |
| B. Field access fixes | `portal/phase-0-field-access` | `portal/phase-0-audit`        | 4 to 9     | `legacy_url`, `slug`, `generateSlug` and `digest_sent_at` refuse non-admin writes. The snapshot diff shows exactly those rows. |
| C. Media photos only  | `portal/phase-0-media`        | `portal/phase-0-field-access` | 10, 11, 12 | A non-admin stores only a photo. Admin uploads and the profile photo path work as today.                                       |

Order: A, then B, then C. Merge in that order.

**Why three PRs, not the suggested two.** The suggested PR B held two mechanisms. Field access shows in the audit snapshot. The media check is a collection hook, and the snapshot cannot show it. The media change also touches `src/lib/profile.ts` and `src/security-media.int.test.ts`. Apart, each PR has one diff that its tests explain. (Principle: Sequence Work into Verifiable Units. Each PR ends in a state its own tests check.)

**How PR B updates the snapshot of PR A.** PR B branches from the head of PR A. Task 8 runs `pnpm audit:field-access`, which rewrites `scripts/field-access-audit.snapshot.json`. A script in Task 8 compares the old and new rows and must print exactly the 30 changed rows listed there. When PR A merges, rebase PR B onto `main`, run `pnpm audit:field-access` again, check that the snapshot does not change, and set the base of the PR to `main`:

```bash
git fetch origin
git rebase --onto origin/main portal/phase-0-audit   # the local branch still points at the last commit of PR A
pnpm audit:field-access
git status --short scripts/field-access-audit.snapshot.json   # expect no output
gh pr edit portal/phase-0-field-access --base main
git push --force-with-lease
```

PR C does the same after PR B merges. PR C does not change the snapshot (Task 10, Step 6 proves it).

## Deviations from the spec, and why

1. **Test paths.** The spec names `tests/int/portal-access.int.spec.ts` and `tests/int/field-access-audit.snapshot.json`. This repo cannot run them:
   - `vitest.config.mts` includes only `**/*.{int,unit}.test.{ts,tsx}`. A `.int.spec.ts` file never runs.
   - The lint rule `landmines-structure/test-file-names` refuses `.spec.ts`.
   - The lint rule `landmines-structure/colocated-tests` requires a test beside the module it tests.
   - No `tests/` folder exists. Int tests live beside their subject, for example `src/security-media.int.test.ts`.

   So the plan uses `src/portal-access.int.test.ts` (it imports `@/payload.config`, like `src/security-media.int.test.ts`), and `scripts/field-access-audit.int.test.ts` with `scripts/field-access-audit.snapshot.json` beside `scripts/field-access-audit.ts` (like `scripts/course-reader-snapshot.ts` and its test). The spec name `portal-access` stays.

2. **Slug scope.** The spec names `slug` on articles, courses and publications. The plan locks `slug` in the shared wrapper `src/fields/slug.ts`, so the lock covers all 8 collections that use it: articles, courses, publications, people, places, programmes, newsletters, events. Places, programmes, newsletters and events take `create` and `update` from `isAdmin` (checked in each collection file), so the lock changes nothing for them. People is the exception: a signed-in person may update their own person row (`src/collections/People.ts:28-32`), so today a member can change their own person slug and take another URL. That is the same hole. Task 4 adds a People row to the tests. No non-admin code writes a slug: every MCP tool that writes is an `adminTool` (`src/plugins/mcp/tools/course.ts`, `article.ts`, `form.ts`), `src/lib/profile.ts` does not write `slug`, and the other files in `src` that pass `overrideAccess: false` only read `slug`.
3. **"The slug follows the title".** See Open question 1. The plan keeps the behavior of Payload's `slugField` and pins it in a test.
4. **The audit script prints nothing by itself.** `scripts/field-access-audit.ts` exports the walk. `pnpm audit:field-access` runs the snapshot test with `--update`, and the snapshot file is the printout. So the config loads only through the test environment (Decision D2).

## Open questions for the owner

1. **The slug stops following the title after the first save with a title.** Payload's `generateSlug` hook (`node_modules/payload/dist/fields/baseFields/slug/generateSlug.js`) sets the slug from the title on create and stores the `generateSlug` checkbox as `false` when a slug exists. On later updates it does not change the slug. A draft created with no title (autosave) gets its slug from the first title, then stops. So after phase 0 an owner gets "the slug is set once from the first title", not "the slug follows every title change". An owner cannot fix a stale slug; an admin can. To make the slug follow every title until an admin sets it, the code needs a stored "an admin set the slug" fact. That is a new column, so a migration. The spec says phase 0 has no migration, so the plan does not add it. The owner decides: accept "set once from the first title" (the plan's default, pinned by a test in Task 4), or plan a migration for a later phase. If the owner wants the migration, the owner creates it with `pnpm db:migrate:create` and approves it before it runs.
2. **A member can no longer upload a PDF to `media`.** Today `src/security-media.int.test.ts` asserts that a member uploads `tiny.pdf`. The spec flips this: non-admin files that are not photos go to `space-files`. Task 10 changes that test so the PDF upload runs as an admin. A fellow who pastes a PDF or a GIF into rich text in `/admin` gets an error after PR C. Confirm that this is the intended effect.
3. **The audit reports inline rules as `inline`.** See "Decisions", D3. If the owner wants every field rule named, that is a sweep of about 40 inline rules in 15 collections, in its own PR.

## Decisions

Problems first, then each fix above the problems it solves.

**Problems.**

- P1. A field with no access function accepts any value from any caller that collection access lets in (`legacy_url`, `slug`, `digest_sent_at`).
- P2. A new field with no rule does not show in review.
- P3. Payload's `slugField` has a second write path, the `generateSlug` checkbox: when it is `true` on an update, the slug follows the title again.
- P4. The photo rule (`PHOTO_TYPES`, `PHOTO_MAX_BYTES`) is written twice in `src/lib/profile.ts` (lines 174 and 266). A media check would be a third copy.
- P5. Payload trusts the claimed type of an upload until it reads the bytes. `generateFileData` stores PDF bytes claimed as `image/png` as a PDF. After the WebP conversion (`formatOptions` in `src/collections/Media.ts`), `mimeType` and `filesize` describe the converted file, not the upload.
- P6. A non-admin can create media from a remote URL with no `req.file` (`getExternalUploadSource` in `node_modules/payload/dist/collections/operations/create.js`). When `req.file` exists, Payload uses it and ignores a URL (`node_modules/payload/dist/uploads/generateFileData.js:51,65`), so a check of `req.file` cannot be bypassed by also sending a URL.

**Fixes.**

- **D1. Field access, not hooks, for `legacy_url`, `slug`, `generateSlug`, `digest_sent_at`.** Solves P1, P3. Payload applies field write access in `beforeValidate` (`node_modules/payload/dist/fields/hooks/beforeValidate/promise.js:218-231`). It deletes the non-admin value and fills the stored value back. The `generateSlug` hook runs later, in `beforeChange` (`.../fields/hooks/beforeChange/promise.js:59`), and writes `data.slug` from the title. So field access drops a hand-written slug and keeps generation. A hook that drops the value would be a second mechanism for the same rule, and the audit could not show it. `generateSlug` gets the same `adminOnlyField`, so a non-admin cannot switch generation back on.
- **D2. One audit walk, one snapshot, one regenerate command.** Solves P2. `scripts/field-access-audit.ts` is a pure function of the sanitized config. The test compares its output with `toMatchFileSnapshot`. `pnpm audit:field-access` runs that same test with `--update`. The regenerate command uses the test environment, so no second way to load the config exists.
- **D3. Inline rules print `inline`.** Solves P2 without a sweep. JavaScript names an arrow in an object literal after its key: `({ update: () => false }).update.name` is `"update"` (checked with `node -e`). So the audit treats a function whose name is empty or equals its operation key as unnamed and prints `inline`. Failing the audit on an unnamed rule would force a rename of about 40 inline rules in 15 collections before phase 0, and the spec itself prescribes `update: () => false`. A new field still shows as a new row, and a change from `open` to `inline` or back still shows. The role write tests, not the snapshot, prove what each rule allows.
- **D4. Each field reports its own rule.** A rule on a group covers its whole subtree in Payload. The audit prints each field's own rule, so a child of `courses.registration` prints `open` under a parent that prints `adminOnlyField`. The rows keep the parent above its children, so a reader sees both.
- **D5. One server predicate `isPhotoUpload` reads the bytes.** Solves P4, P5. `src/lib/photo-upload.ts` checks the size of the bytes and reads the format with `sharp(data).metadata()`. `src/lib/profile.ts` and the media hook both call it. It is not in `src/lib/profile-limits.ts`, because the browser form imports that file and sharp is Node only.
- **D6. The media check is a `beforeOperation` hook on create.** Solves P5, P6. `beforeOperation` runs before `generateFileData`, so `req.file` is still the upload as sent. A non-admin create with no `req.file` throws, which closes the remote URL path. The hook skips `overrideAccess: true` (seeds, the importer) and admins, so every admin upload works as today.

---

## Before you start (every task)

- [ ] Use the worktree of the PR. Install dependencies: `pnpm install`.
- [ ] Start the local services: `docker compose up -d`. Postgres listens on `localhost:5433`, RustFS serves the local bucket.
- [ ] Export the test database: `export DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev`. `vitest.setup.ts` refuses any other host.
- [ ] Put the local `R2_*` values in `.env.development.local` (see `testing/README.md`, "Environment"). `testing/local-env.ts` refuses a storage host that is not local.
- [ ] Check that the local database has no pending migration: `pnpm payload migrate:status`. Do not run a migration. Phase 0 has none. If a step seems to need one, stop and tell the owner.
- [ ] Test code rules (`testing/README.md`, `.oxlintrc.json`): no comments in test files, no annotated return types, no `vi.mock` or other test doubles, no fixed sleeps or retries. Lint each file you touch: `pnpm exec oxlint <files>`. It prints nothing when the file is clean.
- [ ] Commit trailer for every commit: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. If another model does the task, write that model's name. The commit author is the git user.

## File map

| File                                       | PR   | Change                  | Responsibility                                                       |
| ------------------------------------------ | ---- | ----------------------- | -------------------------------------------------------------------- |
| `scripts/field-access-audit.ts`            | A    | Create                  | Walk the sanitized config, return one row per field. Pure.           |
| `scripts/field-access-audit.int.test.ts`   | A    | Create                  | Anchor checks of the walk, and the file snapshot.                    |
| `scripts/field-access-audit.snapshot.json` | A, B | Create, then regenerate | The committed audit.                                                 |
| `package.json`                             | A    | Modify                  | Script `audit:field-access`.                                         |
| `src/portal-access.int.test.ts`            | B, C | Create, then extend     | The spec's phase 0 table through the Local API.                      |
| `src/fields/import.ts`                     | B    | Modify                  | `legacy_url` gets `adminOnlyField` on create and update.             |
| `src/fields/slug.ts`                       | B    | Modify                  | `slug` and `generateSlug` get `adminOnlyField` on create and update. |
| `src/collections/SpacePreferences.ts`      | B    | Modify                  | `digest_sent_at` gets `update: () => false`.                         |
| `src/lib/photo-upload.ts`                  | C    | Create                  | `isPhotoUpload`: the one photo rule, read from the bytes.            |
| `src/collections/Media.ts`                 | C    | Modify                  | `beforeOperation` hook: non-admins create photos only.               |
| `src/lib/profile.ts`                       | C    | Modify                  | Both photo checks call `isPhotoUpload`.                              |
| `src/security-media.int.test.ts`           | C    | Modify                  | Active content and the PDF run as an admin.                          |

---

# PR A. Field access audit

Branch: `git switch -c portal/phase-0-audit origin/main`.

### Task 1: The audit walk names known rules

**Skills:** tdd, payload (`.agents/skills/payload/SKILL.md`, then `reference/FIELD-TYPE-GUARDS.md` and `reference/ACCESS-CONTROL.md`, "Field Access Control").

**Files:**

- Create: `scripts/field-access-audit.int.test.ts`
- Create: `scripts/field-access-audit.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/field-access-audit.int.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { fieldAccessRows } from './field-access-audit'

describe('field access audit', () => {
  it('names the rule of fields whose rules are known', async () => {
    const rows = fieldAccessRows(await config)
    const row = (collection: string, field: string) =>
      rows.find((r) => r.collection === collection && r.field === field)

    expect(row('articles', 'tier')).toEqual({
      collection: 'articles',
      field: 'tier',
      create: 'adminOnlyField',
      update: 'adminOnlyField',
      read: 'open',
    })
    expect(row('articles', 'review.review_note')).toMatchObject({
      create: 'adminOnlyField',
      update: 'adminOnlyField',
    })
    expect(row('articles', 'title')).toMatchObject({ create: 'open', update: 'open', read: 'open' })
    expect(row('enrollments', 'assessment')).toMatchObject({
      create: 'open',
      update: 'assessor',
      read: 'assessor',
    })
    expect(row('space-preferences', 'account')).toMatchObject({ create: 'open', update: 'inline' })
    expect(row('courses', 'registration')).toMatchObject({
      create: 'adminOnlyField',
      update: 'adminOnlyField',
    })
    expect(row('courses', 'registration.mode')).toMatchObject({ create: 'open', update: 'open' })
    expect(rows.some((r) => r.collection === 'courses' && r.field === 'applicants')).toBe(false)
  })
})
```

The anchors cover a top-level field, a field in an unnamed collapsible (`tier`), a field in a named group (`review.review_note`), a named rule (`assessor`), an inline rule, a group rule and its child, and a `ui` field that holds no data (`courses.applicants`).

- [ ] **Step 2: Run the test and see it fail**

Run: `pnpm test:int scripts/field-access-audit.int.test.ts`
Expected: FAIL. The error says that `./field-access-audit` cannot be resolved.

- [ ] **Step 3: Write the walk**

Create `scripts/field-access-audit.ts`:

```ts
import {
  fieldAffectsData,
  tabHasName,
  type Block,
  type Field,
  type FieldAccess,
  type SanitizedConfig,
} from 'payload'

/**
 * Phase 0 field-access audit (docs/superpowers/specs/2026-11-18-portal-design.md,
 * "Security baseline"). One row per field of every collection, with the name
 * of the field's own access function for create, update and read. No access
 * function is called: many depend on the document.
 *
 * - `open`: the field has no function for that operation.
 * - `inline`: an anonymous function. JavaScript names an arrow in an object
 *   literal after its key, so a name equal to the operation counts as none.
 * - A rule on a group or array covers its subtree in Payload; each row shows
 *   only the field's own rule, and the parent row comes first.
 *
 * Regenerate the committed snapshot with `pnpm audit:field-access`.
 */

const OPERATIONS = ['create', 'update', 'read'] as const
type Operation = (typeof OPERATIONS)[number]
type FieldRules = Partial<Record<Operation, FieldAccess>>
type Entry = { path: string; access?: FieldRules }

export type FieldAccessRow = { collection: string; field: string } & Record<Operation, string>

const ruleName = (rule: FieldAccess | undefined, operation: Operation) => {
  if (!rule) return 'open'
  return rule.name && rule.name !== operation ? rule.name : 'inline'
}

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
              { path: `${prefix}${tab.name}`, access: (tab as { access?: FieldRules }).access },
              ...entries(tab.fields, `${prefix}${tab.name}.`, config),
            ]
          : entries(tab.fields, prefix, config),
      )
    if (field.type === 'row' || field.type === 'collapsible')
      return entries(field.fields, prefix, config)
    if (field.type === 'group' && !('name' in field && field.name))
      return entries(field.fields, prefix, config)
    if (!fieldAffectsData(field)) return []
    const self: Entry = { path: `${prefix}${field.name}`, access: field.access as FieldRules }
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

export const fieldAccessRows = (config: SanitizedConfig): FieldAccessRow[] =>
  config.collections.flatMap((collection) =>
    entries(collection.fields, '', config).map(({ path, access }) => ({
      collection: collection.slug,
      field: path,
      create: ruleName(access?.create, 'create'),
      update: ruleName(access?.update, 'update'),
      read: ruleName(access?.read, 'read'),
    })),
  )
```

- [ ] **Step 4: Run the test and see it pass**

Run: `pnpm test:int scripts/field-access-audit.int.test.ts`
Expected: PASS, `Test Files  1 passed (1)`, `Tests  1 passed (1)`.

If an anchor fails, print the rows of that collection and read the field tree of the collection file. Fix the walk. Do not weaken an anchor. If `assessor` or `adminOnlyField` prints as `open`, the walk reads the wrong object: check `field.access` on the sanitized field with a one-off `console.log` in the test, then remove the log.

- [ ] **Step 5: Lint and typecheck**

Run: `pnpm exec oxlint scripts/field-access-audit.ts scripts/field-access-audit.int.test.ts && pnpm typecheck`
Expected: no lint output, and the typecheck exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/field-access-audit.ts scripts/field-access-audit.int.test.ts
git commit -m "feat(audit): name the access rule of every field

Walks the sanitized Payload config and reports, per collection and field,
the name of the field's own create, update and read rule: open, a function
name, or inline for an anonymous arrow (an arrow in an object literal takes
its key as its name, so that name counts as none). No rule is called.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Commit the snapshot and the regenerate command

**Skills:** tdd, payload.

**Files:**

- Modify: `scripts/field-access-audit.int.test.ts`
- Create: `scripts/field-access-audit.snapshot.json`
- Modify: `package.json` (the `scripts` block)

- [ ] **Step 1: Add the snapshot test**

Add this test inside the `describe` block of `scripts/field-access-audit.int.test.ts`, after the first test:

```ts
it('matches the committed snapshot', async () => {
  const rows = fieldAccessRows(await config)
  await expect(`${JSON.stringify(rows, null, 2)}\n`).toMatchFileSnapshot(
    './field-access-audit.snapshot.json',
  )
})
```

- [ ] **Step 2: Add the regenerate script**

In `package.json`, add this line in `scripts`, after `"test:int"`:

```json
    "audit:field-access": "cross-env NODE_OPTIONS=--no-deprecation vitest run --config ./vitest.config.mts --project node scripts/field-access-audit.int.test.ts --update",
```

- [ ] **Step 3: Run the test in CI mode and see it fail**

Run: `CI=1 pnpm test:int scripts/field-access-audit.int.test.ts`
Expected: FAIL on `matches the committed snapshot`. Vitest does not write a new file snapshot when `CI` is set, so a missing snapshot fails. This shows that CI fails when someone forgets the snapshot.

- [ ] **Step 4: Generate the snapshot**

Run: `pnpm audit:field-access`
Expected: PASS, and `scripts/field-access-audit.snapshot.json` exists.

- [ ] **Step 5: Check the snapshot by hand**

Run:

```bash
node -e '
const rows = require("./scripts/field-access-audit.snapshot.json");
const by = (c, f) => rows.find((r) => r.collection === c && r.field === f);
console.log(rows.length, new Set(rows.map((r) => r.collection)).size);
for (const [c, f] of [["articles","legacy_url"],["articles","slug"],["articles","generateSlug"],["space-preferences","digest_sent_at"],["media","legacy_url"],["people","slug"]]) console.log(JSON.stringify(by(c, f)));
'
```

Expected: a row count, then `31` or more collections (31 in `src/payload.config.ts` plus plugin collections). Each of the six rows prints with `"create":"open","update":"open"`. These are the holes PR B closes.

- [ ] **Step 6: Check that the formatter keeps the file as it is**

Run: `pnpm exec oxfmt --check scripts/field-access-audit.snapshot.json && pnpm test:int scripts/field-access-audit.int.test.ts`
Expected: oxfmt reports no change, and the test passes.

If oxfmt reports a change, the pre-commit hook would rewrite the file and break the snapshot. Then add `"scripts/field-access-audit.snapshot.json"` to `ignorePatterns` in `.oxfmtrc.json`, and run this step again.

- [ ] **Step 7: Run the test in CI mode and see it pass**

Run: `CI=1 pnpm test:int scripts/field-access-audit.int.test.ts`
Expected: PASS, `Tests  2 passed (2)`.

- [ ] **Step 8: Commit**

```bash
git add scripts/field-access-audit.int.test.ts scripts/field-access-audit.snapshot.json package.json
git commit -m "test(audit): commit the field access snapshot

A changed rule name, a new open field or a new field changes the snapshot,
so it shows in review. pnpm audit:field-access regenerates it through the
same test, so it uses the test environment.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If Step 6 changed `.oxfmtrc.json`, add it to the same commit.

### Task 3: Review PR A, then open it

**Skills:** code-review, then security-review.

- [ ] **Step 1: Code review.** Run the `code-review` skill on `git diff origin/main...HEAD`. Fix each finding that is real. Re-run Task 2, Step 7 after a fix.
- [ ] **Step 2: Security review.** Run the `security-review` skill on the same diff. The question for this PR: can the audit miss a field? Check the walk against each container type in `reference/FIELD-TYPE-GUARDS.md`: tabs (named and unnamed), row, collapsible, group (named and unnamed), array, blocks, and `blockReferences`.
- [ ] **Step 3: Full checks.** Run: `pnpm lint && pnpm typecheck && pnpm test:int scripts/field-access-audit.int.test.ts`. Expected: no lint errors, typecheck exit code 0, `Tests  2 passed (2)`.
- [ ] **Commit the review fixes.** Commit each fix on its own, with the trailer:

```bash
git add <the files of the fix>
git commit -m "fix(<area>): <the finding, in one line>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If the reviews find nothing, write "Code review and security review: no findings" in the PR body. Make no empty commit.

- [ ] **Step 4: Open the PR.** `git push -u origin portal/phase-0-audit`, then `gh pr create --base main --title "Portal phase 0: field access audit" --body-file <file>`. The body says what the audit prints, how to regenerate it, the `inline` rule (Decision D3), and the six open rows that PR B closes. End the body with the attribution line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

# PR B. Field access fixes

Branch: `git switch -c portal/phase-0-field-access portal/phase-0-audit`.

### Task 4: Write the portal access tests (red for the new rows)

**Skills:** tdd, payload (`reference/QUERIES.md`, "Access control in Local API"; `reference/ACCESS-CONTROL.md`, "Field Access Control").

**Files:**

- Create: `src/portal-access.int.test.ts`

Rules the tests follow (from the spec):

- "Dropped": the write succeeds, and the stored value does not change. Each dropped row also changes the title in the same call and reads the new title back. That is the positive control: the call reached the store.
- "Throws": the call throws, and nothing is stored. Each throws row reads the store after the call.
- A non-admin write to a drafts collection saves a draft. The test reads the stored document with `draft: true` and `overrideAccess: true`.
- Collection access that returns `false` throws `Forbidden`. Only field access drops a value.

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
    collection: 'articles',
    roles: ['fellow', 'member'],
    field: 'slug',
    value: () => fresh('claimed-article'),
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
  {
    collection: 'publications',
    roles: ['fellow', 'member'],
    field: 'slug',
    value: () => fresh('claimed-publication'),
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
  { collection: 'courses', roles: ['fellow'], field: 'slug', value: () => fresh('claimed-course') },
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

    it.each(DROPPED_CASES.filter(({ field }) => field !== 'slug'))(
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

    it.each(OWNERS)(
      '%s as %s: a later title change keeps the first slug',
      async (collection, role) => {
        const user = accounts[role]
        const doc = await ownDraft(collection, user, {
          title: `First Title ${collection} ${role} ${RUN}`,
        })
        await payload.update({
          collection,
          id: doc.id,
          data: { title: fresh('Second Title') } as never,
          draft: true,
          ...actingAs(user),
        })
        expect((await stored(collection, doc.id)).slug).toBe(
          `first-title-${collection}-${role}-${RUN}`,
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

- [ ] **Step 2: Run the tests and see the new rows fail**

Run: `pnpm test:int src/portal-access.int.test.ts`
Expected: FAIL. Exactly 23 tests fail (the spec's "new" rows, and the People row from Deviation 2):

- `$collection as $role: a write to legacy_url is dropped`: 5 cases (articles fellow and member, publications fellow and member, courses fellow).
- `$collection as $role: a write to slug is dropped`: the same 5 cases.
- `$collection as $role: legacy_url given on create is dropped`: the same 5 cases.
- `a create takes the slug from the title and drops a hand-written slug`: 5 cases.
- `space-preferences`: 2 cases.
- `people`: 1 case.

Every other test passes now. These are the spec's "guard" rows, and the slug and admin tests that pin today's behavior. If a guard row fails, stop. The access rule differs from the spec. Read the rule in `src/access.ts` or the collection, and report the difference to the owner before you change code.

- [ ] **Step 3: Lint and typecheck**

Run: `pnpm exec oxlint src/portal-access.int.test.ts && pnpm typecheck`
Expected: no lint output, and the typecheck exits with code 0. Vitest does not check types, so this step is the only type check of the test file.

- [ ] **Step 4: Commit the red tests**

```bash
git add src/portal-access.int.test.ts
git commit -m "test(portal): phase 0 access table, red for the new rows

The spec's phase 0 table through the Local API with overrideAccess: false.
Dropped rows change the title in the same call as the positive control.
legacy_url, slug, digest_sent_at and the own person slug fail today; the
guard rows pass.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: `legacy_url` is admin-only

**Skills:** tdd, payload.

**Files:**

- Modify: `src/fields/import.ts`

- [ ] **Step 1: Add the field access**

Replace the content of `src/fields/import.ts` with:

```ts
import type { Field } from 'payload'

import { adminOnlyField } from '@/access'

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
    access: { create: adminOnlyField, update: adminOnlyField },
    admin: { hidden: true },
  },
]
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test:int src/portal-access.int.test.ts`
Expected: the 10 `legacy_url` cases (update and create) pass. The 10 `slug` cases, the 2 `space-preferences` cases and the `people` case still fail.

- [ ] **Step 3: Run the tests that read `legacy_url`**

Run: `pnpm test:int src/lib/import-redirects.int.test.ts seed/import.int.test.ts && pnpm exec vitest run src/fields/shape-fields.unit.test.ts`
Expected: all pass. The importer and the redirects write with `overrideAccess: true`.

- [ ] **Step 4: Commit**

```bash
git add src/fields/import.ts
git commit -m "fix(access): only admins write legacy_url

Redirects from the old site resolve through legacy_url, so an owner could
claim an unused old URL on a draft. The importer writes with overrideAccess.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Only admins write `slug` and `generateSlug`

**Skills:** tdd, payload (`reference/FIELDS.md`, "Slug field helper").

**Files:**

- Modify: `src/fields/slug.ts`

- [ ] **Step 1: Lock both fields of the slug row**

Replace the content of `src/fields/slug.ts` with:

```ts
import type { Field } from 'payload'
import { slugField as payloadSlugField } from 'payload'

import { adminOnlyField } from '@/access'
import { slugify } from '@/lib/slugify'

const adminWrites = { create: adminOnlyField, update: adminOnlyField }

/**
 * Payload's built-in slug field, bound to this project's slugify.
 *
 * The built-in already provides everything a slug needs: a lock/unlock toggle so
 * an editor can override the generated value, a `generateSlug` checkbox that
 * stops regeneration once a slug is hand-written, a unique index and an index
 * for lookups. The only thing it needs from us is a slugify that survives
 * Arabic titles, which the default (ASCII `\w` only) does not.
 *
 * Only an admin writes the slug or its `generateSlug` checkbox, so an owner
 * cannot claim a URL by hand. Payload applies field access in beforeValidate;
 * the checkbox's beforeChange hook then fills the slug from the title, so
 * generation still runs for everyone.
 *
 * @see https://payloadcms.com/docs/fields/text#slug-field
 */
export const slugField: typeof payloadSlugField = (args = {}) =>
  payloadSlugField({
    // Payload calls this with `{ valueToSlugify, data, req }`; our helper is
    // plain and synchronous, so unwrap the source value.
    slugify: ({ valueToSlugify }) => {
      // Return null (not '') when there is nothing to slugify: autosaved
      // drafts are created before any title exists, and two draft rows with
      // slug '' would hit the unique index. Multiple NULLs are allowed.
      return slugify(valueToSlugify) || undefined
    },
    ...args,
    overrides: (row) => ({
      ...row,
      fields: row.fields.map((field) => ({ ...field, access: adminWrites }) as Field),
    }),
  })
```

`overrides` comes after `...args`, so a caller cannot remove the lock by accident. No caller passes `overrides` today (`rg "slugField\(" src`).

- [ ] **Step 2: Run the tests**

Run: `pnpm test:int src/portal-access.int.test.ts`
Expected: the 10 `slug` cases and the `people` case pass. Only the 2 `space-preferences` cases fail.

- [ ] **Step 3: Run the other tests that make slugs**

Run: `pnpm test:int src/teaching.int.test.ts src/mcp-drafts.int.test.ts src/people.int.test.ts src/lib/profile.int.test.ts`
Expected: all pass. These create documents as admins or with `overrideAccess`, or never write `slug`.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/fields/slug.ts
git commit -m "fix(access): only admins write slug and generateSlug

An owner could claim a future slug on a draft. Field access runs in
beforeValidate and the generateSlug hook fills the slug in beforeChange, so
the title still makes the slug for every caller. generateSlug is locked too:
switched back on, it makes the slug follow the title again.

The wrapper serves 8 collections. Only people has a non-admin writer (the
own person row), which had the same hole.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: `digest_sent_at` is not writable through the API

**Skills:** tdd, payload.

**Files:**

- Modify: `src/collections/SpacePreferences.ts` (the `digest_sent_at` field, lines 63-69)

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
      access: { update: () => false },
      admin: { readOnly: true },
    },
```

Do not change the collection `access`. The owner's `update` stays open.

- [ ] **Step 2: Run the tests**

Run: `pnpm test:int src/portal-access.int.test.ts`
Expected: PASS, every test.

- [ ] **Step 3: Run the digest tests**

Run: `pnpm test:int src/lib/space-email.int.test.ts`
Expected: PASS. `claimDigest` and `releaseDigest` write `digest_sent_at` with `payload.db.pool.query` (`src/lib/space-digest.ts:170-191`), so field access does not reach them.

- [ ] **Step 4: Commit**

```bash
git add src/collections/SpacePreferences.ts
git commit -m "fix(access): owners cannot write digest_sent_at

The owner may update their preference row, so they could set the claim
time and skip their digests. The digest job writes it with SQL.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Regenerate the audit snapshot

**Skills:** tdd, payload.

**Files:**

- Modify: `scripts/field-access-audit.snapshot.json`

- [ ] **Step 1: See the snapshot test fail**

Run: `pnpm test:int scripts/field-access-audit.int.test.ts`
Expected: FAIL on `matches the committed snapshot`. The diff shows `adminOnlyField` and `inline` where the snapshot has `open`.

- [ ] **Step 2: Regenerate**

Run: `pnpm audit:field-access`
Expected: PASS.

- [ ] **Step 3: Check that only the expected rows changed**

Run:

```bash
git show HEAD:scripts/field-access-audit.snapshot.json > /tmp/audit-before.json
node -e '
const fs = require("fs");
const [a, b] = ["/tmp/audit-before.json", "scripts/field-access-audit.snapshot.json"].map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const key = (r) => `${r.collection} ${r.field}`;
const old = new Map(a.map((r) => [key(r), r]));
let changed = 0;
for (const r of b) {
  const o = old.get(key(r));
  if (!o) console.log("NEW", key(r));
  else if (JSON.stringify(o) !== JSON.stringify(r)) { changed++; console.log("CHANGED", key(r), o.create, o.update, "->", r.create, r.update); }
}
console.log("rows", a.length, b.length, "changed", changed);
'
```

Expected: no `NEW` line, the same row count before and after, and `changed 30`:

- `legacy_url` in 13 collections (governance, memberships, people, press, programmes, courses, places, articles, publications, cycles, newsletters, events, media): `open open -> adminOnlyField adminOnlyField`.
- `slug` and `generateSlug` in 8 collections (people, courses, programmes, articles, places, newsletters, publications, events): `open open -> adminOnlyField adminOnlyField`. That is 16 rows.
- `space-preferences digest_sent_at`: `open open -> open inline`.

Any other change is a bug. Find it before you commit.

- [ ] **Step 4: Run the snapshot in CI mode**

Run: `CI=1 pnpm test:int scripts/field-access-audit.int.test.ts`
Expected: PASS, `Tests  2 passed (2)`.

- [ ] **Step 5: Commit**

```bash
git add scripts/field-access-audit.snapshot.json
git commit -m "test(audit): legacy_url, slug and digest_sent_at are closed

30 rows change: legacy_url in 13 collections, slug and generateSlug in 8,
and digest_sent_at. No other row changes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Review PR B, then open it

**Skills:** code-review, then security-review.

- [ ] **Step 1: Code review.** Run the `code-review` skill on `git diff portal/phase-0-audit...HEAD`. Fix each real finding. Re-run Task 7, Step 2 and Task 8, Step 4 after a fix.
- [ ] **Step 2: Security review.** Run the `security-review` skill on the same diff. The questions for this PR: can a non-admin still set `slug` through `generateSlug`, through a duplicate, or through the admin form? Can a non-admin set `legacy_url` on any of the 13 collections? Does any non-admin code path write these fields with `overrideAccess: false`? (`rg "overrideAccess: false" src` and read each hit that writes a collection with these fields.)
- [ ] **Step 3: Full checks.** Run: `pnpm lint && pnpm typecheck && pnpm test:int src/portal-access.int.test.ts scripts/field-access-audit.int.test.ts src/lib/space-email.int.test.ts src/teaching.int.test.ts src/people.int.test.ts`. Expected: no lint errors, typecheck exit code 0, all test files pass.
- [ ] **Commit the review fixes.** Commit each fix on its own, with the trailer:

```bash
git add <the files of the fix>
git commit -m "fix(<area>): <the finding, in one line>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If the reviews find nothing, write "Code review and security review: no findings" in the PR body. Make no empty commit.

- [ ] **Step 4: Open the PR.** `git push -u origin portal/phase-0-field-access`, then `gh pr create --base portal/phase-0-audit --title "Portal phase 0: close legacy_url, slug and digest_sent_at" --body-file <file>`. The body lists the 30 snapshot rows, the People broadening (Deviation 2), and Open question 1 (the slug is set once from the first title). End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

# PR C. Media photos only

Branch: `git switch -c portal/phase-0-media portal/phase-0-field-access`.

### Task 10: Non-admins store only photos in `media`

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

  it('anonymous: a PNG throws, and nothing is stored', async () => {
    const alt = uniq('Portal png anonymous')
    const png = await file('pixel.png')
    await expect(upload(undefined, alt, 'pixel.png', 'image/png', png)).rejects.toThrow()
    expect(await storedWithAlt(alt)).toBe(0)
  })
})
```

The helper tracks each stored row, so the red run of Step 2 leaves nothing behind. Each test reads its file before the call, so the call's promise is awaited at once and never rejects unhandled.

- [ ] **Step 2: Run the media tests and see them fail**

Run: `pnpm test:int src/portal-access.int.test.ts -t "media create"`
Expected: FAIL on the 6 non-admin refusal cases (PDF, lie, big, each for fellow and member): the upload is stored today. The small PNG, admin PDF and anonymous cases pass.

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

sharp names the formats `jpeg`, `png` and `webp`, so `image/${format}` matches `PHOTO_TYPES`. sharp refuses a PDF or HTML buffer, which counts as "not a photo". It reads an SVG as `svg` and a GIF as `gif`, which `PHOTO_TYPES` does not hold.

- [ ] **Step 4: Add the hook to Media**

In `src/collections/Media.ts`:

Replace the imports at the top with:

```ts
import { APIError, type CollectionBeforeOperationHook, type CollectionConfig } from 'payload'

import { isAdmin, isAdminUser, isAuthenticated } from '@/access'

import { importFields } from '@/fields/import'
import { isPhotoUpload } from '@/lib/photo-upload'
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from '@/lib/profile-limits'
import { revalidateAfterChange, revalidateAfterDelete } from '@/lib/revalidate'

const PHOTO_RULE = `Upload a ${PHOTO_TYPES.map((type) => type.replace('image/', '').toUpperCase()).join(', ')} image of ${PHOTO_MAX_BYTES / 1024 / 1024} MB or less. Other files go in a space's files.`

/**
 * A non-admin uploads photos only: covers, profile photos and pasted images.
 * The check reads `req.file` before Payload converts it to WebP, because after
 * that the stored type and size describe the converted file. A create with no
 * file (a remote URL) is refused too. Admins, and seeds and the importer
 * (overrideAccess), upload anything Payload accepts.
 */
const photosOnlyForNonAdmins: CollectionBeforeOperationHook = async ({
  operation,
  overrideAccess,
  req,
}) => {
  if (operation !== 'create' || overrideAccess || isAdminUser(req.user)) return
  if (req.file && (await isPhotoUpload(req.file))) return
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

Leave `access`, `fields` and `upload` as they are.

- [ ] **Step 5: Run the media tests and see them pass**

Run: `pnpm test:int src/portal-access.int.test.ts`
Expected: PASS, every test.

- [ ] **Step 6: Confirm that the audit snapshot does not change**

Run: `pnpm test:int scripts/field-access-audit.int.test.ts`
Expected: PASS. The hook is not field access, so no row changes.

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
(a remote URL) is refused. Admins, seeds and the importer are unchanged.

security-media: a member may no longer upload a PDF, so the PDF and the
active-content refusals run as an admin, which still proves Payload's own
type restriction.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: The profile photo uses the same rule

**Skills:** tdd, payload.

**Files:**

- Modify: `src/lib/profile.ts` (imports at line 21, checks at lines 174 and 266)

- [ ] **Step 1: Run the profile tests first**

Run: `pnpm test:int src/lib/profile.int.test.ts`
Expected: PASS. This is the baseline. `refuses a photo of the wrong type or size` and `refuses a photo alone of the wrong type or size` cover the rule.

- [ ] **Step 2: Replace both checks**

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

Replace the check at line 173-176:

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

- [ ] **Step 3: Run the profile tests again**

Run: `pnpm test:int src/lib/profile.int.test.ts`
Expected: PASS, the same count as Step 1. The GIF case (`GIF89a` bytes) fails the format check, and the large cases fail the size check.

- [ ] **Step 4: Check that no other copy of the rule is left**

Run: `rg "PHOTO_TYPES|PHOTO_MAX_BYTES" src`
Expected: only `src/lib/profile-limits.ts` (the values), `src/lib/photo-upload.ts` (the server rule), `src/collections/Media.ts` (the error message), `src/components/image-upload/avatar-upload.tsx` (the browser picker) and `src/portal-access.int.test.ts`.

- [ ] **Step 5: Lint, typecheck, commit**

Run: `pnpm exec oxlint src/lib/profile.ts && pnpm typecheck`
Expected: no lint output, typecheck exit code 0.

```bash
git add src/lib/profile.ts
git commit -m "refactor(profile): check the photo with isPhotoUpload

The profile server held the photo rule twice; the media hook needed a third
copy. One server rule now reads the format from the bytes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Review PR C and the whole phase, then open PR C

**Skills:** code-review, then security-review.

- [ ] **Step 1: Code review.** Run the `code-review` skill on `git diff portal/phase-0-field-access...HEAD`. Fix each real finding. Re-run Task 10, Step 5 and Task 11, Step 3 after a fix.
- [ ] **Step 2: Security review of the phase.** Run the `security-review` skill on `git diff origin/main...HEAD` (all three PRs). The questions:
  - Can a non-admin store a non-photo in `media` through REST multipart, GraphQL, a remote URL, or a duplicate? (`update` and `delete` on media stay admin-only.)
  - Does every row of the spec's phase 0 table have a passing test in `src/portal-access.int.test.ts`?
  - Did any admin path lose an ability it had? (Admin uploads, admin slugs, the importer, the digest job.)
- [ ] **Step 3: Full checks.** Run: `pnpm lint && pnpm typecheck && pnpm test:int src/portal-access.int.test.ts scripts/field-access-audit.int.test.ts src/security-media.int.test.ts src/lib/profile.int.test.ts src/lib/space-email.int.test.ts`. Expected: no lint errors, typecheck exit code 0, every file passes.
- [ ] **Step 4: Run the whole int suite once.** Run: `pnpm test:int`. Expected: every file passes. A failure in a file this phase did not touch is a regression of this phase until shown otherwise.
- [ ] **Commit the review fixes.** Commit each fix on its own, with the trailer:

```bash
git add <the files of the fix>
git commit -m "fix(<area>): <the finding, in one line>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If the reviews find nothing, write "Code review and security review: no findings" in the PR body. Make no empty commit.

- [ ] **Step 5: Open the PR.** `git push -u origin portal/phase-0-media`, then `gh pr create --base portal/phase-0-field-access --title "Portal phase 0: non-admins upload photos only" --body-file <file>`. The body names the rule, the byte check, the remote URL refusal, the `security-media` change, and Open question 2. End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Phase 0 ends when

- `src/portal-access.int.test.ts` passes. It holds every row of the spec's table, plus the People slug row.
- `scripts/field-access-audit.snapshot.json` is committed and `scripts/field-access-audit.int.test.ts` passes with `CI=1`.
- No migration was created or applied.

## Spec coverage

| Spec item                                                                                                                                | Task                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Field access audit script, snapshot, snapshot test                                                                                       | 1, 2                                                   |
| `legacy_url` admin-only on create and update                                                                                             | 5                                                      |
| `slug` cannot be set by a non-admin, generation still runs                                                                               | 6 (tests in 4)                                         |
| `space-preferences.digest_sent_at` `update: () => false`, owner update stays open                                                        | 7 (tests in 4)                                         |
| `courses.fellows` stays open                                                                                                             | No change. The audit row shows `open`.                 |
| `media` create: photo types and size for non-admins                                                                                      | 10, 11                                                 |
| Jobs, `/api/mcp`, `form-submissions`                                                                                                     | No change. `form-submissions` is a guard row in 4.     |
| Test table rows (articles, publications, enrollments x2, courses, space-preferences, publish, media, form-submissions), anonymous writes | 4, 10                                                  |
| No migration                                                                                                                             | Checked in "Before you start" and "Phase 0 ends when". |
| Review: code-review, then security-review                                                                                                | 3, 9, 12                                               |
