# Spaces, step 1: core spaces — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the core of spaces (ADR 0009): spaces and membership from records that already exist, the Off / Trial / On switch, discussion and announcement posts, comments, reactions, private files, mentions, "My spaces", space pages and post pages, the header link, the bell, the privacy consent, the onboarding checklist, read-only archives and the participation summary — enough for the pilot: Trial mode with one course.

**Architecture:** Six new collections (`spaces`, `space-posts`, `space-comments`, `space-files`, `space-reactions`, `space-consents`) plus two small ones (`space-visits`, `space-preferences`). Who belongs is never stored: one shared helper (`src/lib/spaces.ts`) works it out from courses' fellows, enrollments, programme memberships and the account's linked person, and every collection access rule and page goes through it. Members write only through server actions (`src/lib/spaces-write.ts` holds every rule; the actions just carry FormData), because the Payload REST surface must refuse what the pages refuse. The switch lives on Site settings → Spaces and is checked inside the same helper, on the server, in "access", not only in menus.

**Tech Stack:** Payload 3.91 (Postgres adapter, `push: false`), Next.js 16 App Router, next-intl, Arc components, zod 4, Vitest. New npm deps: `react-markdown`, `remark-gfm`.

**Spec:** `docs/superpowers/specs/2026-10-21-spaces-design.md` (sections 14 step 1, and 1–13 as they apply). **ADRs:** 0007 (places), 0008 (private files), 0009 (built in the site).

---

## Decisions this plan locks (the spec's open checks)

- **Edit history (spec open check):** posts and comments get Payload `versions: { drafts: false }`. Every save writes a version; moderators read it through `findVersions`; no small history collection. ADR 0008-style: "edited" is a stored `edited_at`, not a diff UI, in step 1.
- **Notification kinds (spec §8):** all six (`mention`, `comment`, `reply`, `announcement`, `moderation`, `report`) go into the enum in one migration now, so step 3 adds no second enum migration. Step 1 writes only `mention`, `comment`, `reply`, `announcement`.
- **Question kind:** included in the ` kind` enum now (one migration), but no question UI ships until step 2.
- **Posting level (spec "members comment only" / "only fellows and admins post"):** enum `open` (default: everyone posts and comments), `members_comment` (only moderators start posts; everyone comments), `fellows_only` (only moderators post and comment).
- **Intro post prompt (spec: written once, not translated):** one bilingual text, each line with `dir="auto"`: "What question brings you here?\nما السؤال الذي جاء بك إلى هنا؟". Moderators edit it like any post.
- **Header dot (spec §2, "a dot for new activity"):** driven by unread notifications in the space kinds, felt through the existing `/api/notifications` REST rule — no second activity endpoint.
- **Intro posts land in step 1 (spec §14 lists them under step 2):** the onboarding checklist's "Introduce yourself" opens the intro post's thread, so the post must exist before the checklist works. Rationale recorded so the spec's ordering is not read as a contradiction.
- **Files (ADR 0008):** stored like `submission-files` (random names, served through Payload), but written and deleted only by the server actions, so counts (5 per post, 1 per comment) and permissions are enforced in one place.

## Ground rules for this repo

- Work on the current branch (`spaces-feature`); commit as each task lands.
- All database work happens on the local docker Postgres that Task 0 brings up. The database in `.env` (`192.168.1.34:5442/cilas`) is the dokploy production database — it is never read, written, migrated, or connected to in this plan. Before every `pnpm db:*` and seed, prefix `DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev`. An exported `DATABASE_URL` wins over `.env` in this repo (Node's `process.loadEnvFile` does not overwrite an already-set variable; Next treats real env vars above `.env`), so the prefix is the whole safety story. Task 0 also writes a gitignored `.env.local` with the same local URL, so Next processes (`pnpm dev`, the admin) read the local database without a prefix — Next loads `.env.local` over `.env`. Their loaders differ: the Payload CLI reads env the way Next does (including `.env.local`, via `@next/env`; a real env var still wins), while `seed/index.ts` and vitest read only `.env`. The exported prefix is mandatory for those two either way — Task 0's guard makes refusal structural rather than remembered.
- Supervisor runs `pnpm db:migrate`, `pnpm db:seed` and `pnpm db:migrate:create` against the local 5433 container (user delegation, 2026-10-23; the earlier rule asked the user). Every generated migration file is read before it is applied, and wherever a task's spec needs columns the registered collections do not have yet, the supervisor creates and applies a named migration just before that verification. The `.env` production database remains off-limits.
- Integration tests need the migrated local schema: `DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts <file>` with that `DATABASE_URL`. Unit tests need no DB: `tests/unit` runs without one.
- Known failures that are not yours: `publishing.int.spec.ts › duplicates an approved article as a fresh draft` fails on `main` already. `applications` and `import-media` int files fail only when the whole int folder runs at once; they pass alone. Measured 2026-10-23 on the freshly rebuilt local DB: five of seventeen `publishing.int.spec.ts` tests fail (`publishes the change only when an admin approves it`, `queues a submitted change and locks it, while the site keeps the published one`, `takes it down only when an admin approves a removal, then lets the author delete it`, `duplicates an approved article as a fresh draft`, `lets the author submit, emails admins, then locks the article to them`). The first spaces commits touch neither site-settings nor publishing code, and the spec imports no site-settings, so these are treated as the rebuilt DB's pre-existing baseline (inferred, not proven) and reclassified at the Task 17 gate.
- After any collection change: `pnpm payload generate:types`.
- Format with `pnpm exec prettier --write <files>`, lint with `pnpm exec eslint <files>`, typecheck with `pnpm exec tsc --noEmit -p .`.
- Install the two new dependencies before Task 1: `pnpm add react-markdown remark-gfm`.
- Every user-facing string goes in `messages/en.json` and `messages/ar.json` (namespaces below are exact). After editing either: `node -e 'JSON.parse(require("fs").readFileSync("messages/en.json","utf8"));JSON.parse(require("fs").readFileSync("messages/ar.json","utf8"));console.log("ok")'`.
- Commit messages end with `Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>`.
- New collections are registered in `src/payload.config.ts` in the collections array, appended in the file's existing order (the file is not alphabetical today — do not reorder it).

## File map

| File | Responsibility |
| --- | --- |
| `src/globals/SiteSettings.ts` | The `Spaces` group: mode, trial lists (modify) |
| `src/lib/spaces.ts` | **The one access helper**: mode, membership, read/write/moderator rules as Payload `Where`/`Access`, read-only lifecycle (create) |
| `src/lib/space-lifecycle.ts` | Course end from the schedule; read-only after 14 days (unit-testable, create) |
| `src/lib/space-members.ts` | Member ids of a space, mention validation (import from membership layer, create) |
| `src/lib/spaces-write.ts` | Every write rule: post/comment/file/reaction validation, placeholders, read-only + trial enforcement (create) |
| `src/lib/spaces-data.ts` | Page queries: my spaces, feed, post view, participation summary (create) |
| `src/lib/space-hooks.ts` | Create course/cohort spaces and their intro posts on first publish (create) |
| `src/lib/notify.ts` | Notification kind type grows (modify) |
| `src/collections/Notifications.ts` | Enum options grow (modify) |
| `src/collections/Spaces.ts` | `spaces` rows: kind, course/programme, post settings, reopened (create) |
| `src/collections/SpacePosts.ts` | Discussion/announcement/question posts; versions on (create) |
| `src/collections/SpaceComments.ts` | Replies, one file; versions on (create) |
| `src/collections/SpaceFiles.ts` | Private upload collection (ADR 0008) (create) |
| `src/collections/SpaceReactions.ts` | One row per account, target, reaction (create) |
| `src/collections/SpaceConsents.ts` | Notice acceptance, per account (create) |
| `src/collections/SpaceVisits.ts` | Per account + space: last visit, checklist steps (create) |
| `src/collections/SpacePreferences.ts` | Per account: email digest choice (create) |
| `src/payload.config.ts` | Register all new collections (modify) |
| `src/collections/Courses.ts`, `src/collections/Programmes.ts` | afterChange paperwork hooks (modify) |
| `src/migrations/<ts>_space_*.{ts,json}` | Two migrations: notification kinds enum, spaces tables. `.ts` bodies hand-checked |
| `seed/collections/spaces.seed.ts` | Community space + intro post (create) |
| `seed/seed.type.ts`, `seed/index.ts`, `seed/seed.utils.ts` | Track the new collections (modify) |
| `src/app/(frontend)/[locale]/spaces/…` | Pages: list, space, post; server actions; `layout.tsx` guard (create) |
| `src/components/space/*` | Feed row, composer, reactions wiring, checklist, participation table, markdown body (create) |
| `src/components/arc/reactions/*` | New Arc copy: the four reactions (create) |
| `src/components/arc/page-header/*` | New Arc copy: breadcrumb header with props + window-scroll fold (create) |
| `src/components/arc/rich-text-editor/rich-text-editor.tsx` | "@" member trigger beside the "/" menu (modify) |
| `src/components/site-header.tsx` | "Spaces" item in the account menu + dedicated link with dot (modify) |
| `src/components/site-notifications.tsx` | New kinds' tones (modify) |
| `src/app/(frontend)/[locale]/study/[slug]/CourseView.tsx` | "Open the course space" for members (modify) |
| `messages/en.json`, `messages/ar.json` | `Spaces`, `Space`, `SpacePost`, `SpaceComment` namespaces; `Notifications` kinds (modify) |
| `tests/int/spaces-core.int.spec.ts` | Membership, switch, lifecycle (create) |
| `tests/int/spaces-write.int.spec.ts` | Write rules end to end (create) |
| `tests/unit/space-lifecycle.unit.spec.ts`, `tests/unit/space-write.unit.spec.ts`, `tests/unit/post-body.unit.spec.tsx` | Pure logic (create) |

**Not in this plan (later steps):** questions, highlights, reply-first, anonymity, search (step 2); hide/mute/reports/purge/edit-history UI/digests/pulse/participation beyond the summary (step 3).

---

# Task 0 — The local docker database (once, before Task 1)

Everything in this branch runs on a local container. The dokploy host's database (`.env`'s `192.168.1.34:5442/cilas`) stays production-only for the whole plan.

- [ ] **Step 1: a `db` service in the repo's existing `docker-compose.yml`**

The file exists (Payload template: a `payload` service carrying `env_file: .env` and a `mongo` service). Keep both untouched — the `payload` service points at the production .env, so never `docker compose up` it here; only `db` is ever started — and append:

```yaml
  db:
    image: postgres:16-alpine
    ports:
      - '5433:5432'
    environment:
      POSTGRES_USER: cilas
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: cilas_dev
    volumes:
      - cilas_dev:/var/lib/postgresql/data
```

and one volume appended to the existing `volumes:` block:

```yaml
  cilas_dev:
```

- And `.env.local` in the repo root (gitignored — `.env*.local` is in `.gitignore` — so it never leaves this machine):

```
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev
```

Next loads it over `.env`, which repoints `pnpm dev` and the admin at the local database without a prefix. Payload's CLI and the seed load `.env` explicitly, so the exported prefixes in Step 3 stay mandatory.

- [ ] **Step 2: Start it and wait for readiness**

```bash
docker compose up -d db
docker compose exec db pg_isready -U cilas   # expect: accepting connections
```

- [ ] **Step 2b: The structural guard (small code, once)**

The exported `DATABASE_URL` is what keeps vitest and the seed off production — make refusal structural instead of remembered:

- `vitest.setup.ts`, above the existing imports:

```ts
if (!process.env.DATABASE_URL?.includes('@localhost:5433/')) {
  throw new Error('Refusing to run tests: DATABASE_URL must point at the local docker Postgres. Export DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev.')
}
```

- `seed/index.ts`, after its `.env` load resolves `DATABASE_URL` and before any Payload call:

```ts
if (!process.env.DATABASE_URL?.includes('@localhost:5433/')) {
  throw new Error('Refusing to seed: the seed wipes and re-creates content, so it only ever runs against localhost:5433/cilas_dev (an exported DATABASE_URL).')
}
```

- [ ] **Step 3: Schema and seed (the user runs them)**

Ask the user: "Please run `! DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:migrate`" — expected: every migration in order, ending with the step-0 `rename_spaces_to_places` migration (a fresh database replays the whole history, which is what makes it match this branch). Then: "Please run `! DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:seed`" — expected: `SEED COMPLETE`.

- [ ] **Step 4: Smoke test**

```bash
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/int/teaching.int.spec.ts
```

Expected: green. Measured 2026-10-23: 7/7 pass. The plan first blamed this file for the `duplicates an approved article as a fresh draft` failure; that test lives in `tests/int/publishing.int.spec.ts`, so if it is cited here, cite the file.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(db): local docker Postgres for the spaces work

Production (dokploy host) is never a target here; every db command in
this plan prefixes DATABASE_URL with the local 5433 container.

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 1 — The switch (Site settings → Spaces)

**Files:**
- Modify: `src/globals/SiteSettings.ts`
- Test: none yet (used from Task 2's spec)

- [ ] **Step 1: Add the `Spaces` group**

In `src/globals/SiteSettings.ts`, after the `navigation` group and before `faq`, insert:

```ts
{
  // ADR 0009: spaces ship behind this switch; Off is the launch default.
  label: 'Spaces',
  type: 'group',
  fields: [
    {
      name: 'spaces_mode',
      type: 'select',
      required: true,
      defaultValue: 'off',
      options: [
        { label: 'Off', value: 'off' },
        { label: 'Trial', value: 'trial' },
        { label: 'On', value: 'on' },
      ],
      admin: { description: 'Off: space pages return not found and writes are refused; data stays. Trial: only the chosen courses, plus the community and cohort checkboxes. On: every space.' },
    },
    {
      name: 'spaces_trial_courses',
      type: 'relationship',
      relationTo: 'courses',
      hasMany: true,
      admin: {
        condition: (data) => (data as { spaces_mode?: unknown }).spaces_mode === 'trial',
        description: 'In Trial, only these courses have a space.',
      },
    },
    {
      name: 'spaces_trial_community',
      label: 'Community space',
      type: 'checkbox',
      defaultValue: false,
      admin: { condition: (data) => (data as { spaces_mode?: unknown }).spaces_mode === 'trial' },
    },
    {
      name: 'spaces_trial_cohorts',
      label: 'Cohort spaces',
      type: 'relationship',
      relationTo: 'programmes',
      hasMany: true,
      admin: {
        condition: (data) => (data as { spaces_mode?: unknown }).spaces_mode === 'trial',
        description: 'In Trial, only these programmes have a cohort space.',
      },
    },
  ],
},
```

- [ ] **Step 2: Typecheck and commit**

Run `pnpm exec tsc --noEmit -p .` (expected: no errors) and `pnpm payload generate:types` (the global type gains the new fields).

```bash
git add src/globals/SiteSettings.ts src/payload-types.ts
git commit -m "feat(spaces): the Off, Trial and On switch on Site settings (spec step 1, ADR 0009)

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 2 — `spaces` collection and the membership helper

One file carries every access decision; nothing else works out who belongs (spec §1).

**Files:**
- Create: `src/collections/Spaces.ts`, `src/lib/spaces.ts`
- Modify: `src/payload.config.ts`
- Test: `tests/int/spaces-core.int.spec.ts`

Note: Task 4 (not Task 3) fills `SpacePosts` and friends — Task 3's only edits are the notification kinds and their migration.

- [ ] **Step 1: Write the failing test**

Create `tests/int/spaces-core.int.spec.ts`:

```ts
// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { membership, readableWhere, writePostWhere } from '@/lib/spaces'
import config from '@/payload.config'
import type { Space, User } from '@/payload-types'

const tracked = new Map<string, number[]>() // collection -> ids made here

const track = (collection: string, id: number) => {
  const list = tracked.get(collection) ?? []
  list.push(id)
  tracked.set(collection, list)
}

describe('spaces core', () => {
  let payload: Payload
  let fellow: User
  let student: User
  let stranger: User
  let community: Space
  let course: Pick<typeof course, string> & Record<string, unknown>
  let courseSpace: Space
  let programmeId: number
  let cohortSpace: Space

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    // People and accounts: the fellow teaches, the student is enrolled,
    // the stranger is a member of nothing.
    const mk = async (name: string, person: Record<string, unknown>) => {
      const p = await payload.create({ collection: 'people', data: { name, slug: name.toLowerCase().replace(/\s+/g, '-'), ...person }, overrideAccess: true })
      track('people', p.id)
      const u = await payload.create({
        collection: 'users',
        data: { email: `${name.toLowerCase().replace(/\s+/g, '-')}@probe.cilas`, password: 'probe-probe', roles: ['member'], person: p.id },
        overrideAccess: true,
      })
      track('users', u.id)
      return u as unknown as User
    }
    fellow = (await mk('Probe Fellow', { name: 'Probe Fellow' }))!
    student = (await mk('Probe Student', {}))!
    stranger = (await mk('Probe Stranger', {}))!

    course = (await payload.create({
      collection: 'courses',
      depth: 0,
      data: { title: 'Probe Course', slug: 'probe-space-course', fellows: [(personOf(fellow) as number)], _status: 'published' },
      overrideAccess: true,
    })) as unknown as { id: number }
    // Courses need more than title/slug/fellows to validate (course_type,
    // session_unit, tier, cycle…): if this first create rejects, copy the
    // required fields from the working fixture in
    // tests/int/teaching.int.spec.ts. The first run's intended failure is the
    // missing @/lib/spaces import (Step 2); a Payload validation error met
    // instead is filled from that fixture and is not a plan bug.
    track('courses', (course as { id: number }).id)
    const enrollment = await payload.create({ collection: 'enrollments', data: { course: (course as { id: number }).id, person: personOf(student), status: 'confirmed' }, overrideAccess: true })
    track('enrollments', enrollment.id as number)

    programmeId = (
      await payload.create({ collection: 'programmes', data: { title: 'Probe Bridge', slug: 'probe-bridge', kind: 'bridge', _status: 'published' }, overrideAccess: true })
    ).id as number
    track('programmes', programmeId)
    const membership = await payload.create({ collection: 'memberships', data: { programme: programmeId, person: personOf(student), role: 'student' }, overrideAccess: true })
    track('memberships', membership.id as number)

    const mkSpace = async (data: Partial<Space>) =>
      payload.create({ collection: 'spaces', data: data as never, overrideAccess: true }) as Promise<Space>
    community = await mkSpace({ kind: 'community' })
    track('spaces', community.id)
    courseSpace = await mkSpace({ kind: 'course', course: (course as { id: number }).id })
    track('spaces', courseSpace.id)
    cohortSpace = await mkSpace({ kind: 'cohort', programme: programmeId })
    track('spaces', cohortSpace.id)
    // Settings: everything on.
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    await payload.updateGlobal({ slug: 'site-settings', data: { spaces_mode: 'off' }, overrideAccess: true })
    // Children delete before parents: Payload's required-relation FKs
    // restrict, so a parent deleted first leaks the row silently otherwise.
    for (const collection of ['spaces', 'space-posts', 'space-comments', 'space-files', 'space-reactions', 'space-consents', 'space-visits', 'space-preferences', 'enrollments', 'memberships', 'courses', 'programmes', 'cycles', 'places', 'users', 'people'] as const) {
      const ids = [...(tracked.get(collection) ?? [])].reverse()
      for (const id of ids) {
        await payload
          .delete({ collection: collection as never, id, overrideAccess: true })
          .catch((i) => console.error(`cleanup ${collection} ${id}`, i))
      }
    }
    await payload.destroy()
  })

  it('the read Where holds the student’s readable spaces', async () => {
    const where = await readableWhere(payload, student, 'id')
    expect(where).toBeTruthy()
    const { docs } = await payload.find({ collection: 'spaces', where, overrideAccess: true })
    expect(docs.map((s) => s.id).sort()).toEqual([community.id, courseSpace.id, cohortSpace.id].sort())
  })

  it('gives the student the course and cohort and community spaces, and the stranger only the community', async () => {
    // Read through access rules, as each user does on the site.
    const view = (user: User) =>
      payload.find({ collection: 'spaces', user, overrideAccess: false, depth: 0 })
    const seen = (await view(student)).docs.map((s) => s.id).sort()
    expect(seen).toEqual([community.id, courseSpace.id, cohortSpace.id].sort())
    expect((await view(stranger)).docs.map((s) => s.id)).toEqual([community.id])
    // Admins read everything; not listed as members.
    expect((await view(fellow)).docs.map((s) => s.id)).toContain(courseSpace.id)
  })

  it('the write floor is a Where over readable spaces', async () => {
    const floor = await writePostWhere(payload, student)
    expect(floor).not.toBe(false)

    const refuse = (user: User) =>
      payload.create({
        collection: 'space-posts',
        user,
        overrideAccess: false,
        data: { space: community.id, kind: 'discussion', body: 'x' } as never,
      })
    // REST refusal (plan decision): members never create rows through the
    // collection surface — the write actions (Task 8, overrideAccess) are
    // the member path. Admins may; their route is what stays permitted.
    await expect(refuse(stranger)).rejects.toThrow()
  })

  it('Trial opens only the pilot courses/cohorts plus the community (spec §10)', async () => {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'trial', spaces_trial_community: true, spaces_trial_courses: [course.id] },
      overrideAccess: true,
    })
    const trial = async () =>
      payload.find({ collection: 'spaces', user: student, overrideAccess: false, depth: 0 }).then((r) => r.docs.map((s) => s.id).sort())
    expect(await trial()).toEqual([community.id, courseSpace.id].sort())
    // The same cohort space, with trial list empty: closed.
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_trial_courses: [], spaces_trial_cohorts: [] },
      overrideAccess: true,
    })
    expect(await trial()).toEqual([community.id])
    await payload.updateGlobal({ slug: 'site-settings', data: { spaces_mode: 'on' }, overrideAccess: true })
  })

  it('Off yields the same refusal as the access floor for reads and writes', async () => {
    const anon: User = { id: -1, roles: ['member'], person: null, collection: 'users' } as unknown as User
    const refuse = (user: User) =>
      payload.create({
        collection: 'space-posts',
        user,
        overrideAccess: false,
        data: { space: community.id, kind: 'discussion', body: 'x' } as never,
      })
    await expect(refuse(anon)).rejects.toThrow()
    await payload.updateGlobal({ slug: 'site-settings', data: { spaces_mode: 'off' }, overrideAccess: true })
    expect(await readableWhere(payload, student, 'id')).toBe(false)
    await payload.updateGlobal({ slug: 'site-settings', data: { spaces_mode: 'on' }, overrideAccess: true })
  })

  it('moderators are the course fellows; admins are everywhere, not listed', async () => {
    expect((await membership(payload, fellow, courseSpace)).role).toBe('moderator')
    expect((await membership(payload, student, courseSpace)).role).toBe('member')
    const admin = { id: -2, roles: ['admin'], person: null, collection: 'users' } as unknown as User
    expect((await membership(payload, admin, courseSpace)).role).toBe('moderator')
  })

  it('posts read only in readable spaces', async () => {
    const where = await readableWhere(payload, stranger)
    const { docs } = await payload.find({ collection: 'space-posts', where, overrideAccess: true })
    expect(docs.every((p) => (p.space as { id: number }).id === community.id)).toBe(true)
  })
})
```

Notes for the executor: `personOf` comes from `@/access`. `course` here is an object literal trick for `Pick` convenience — write it as `let course: { id: number }` plainly and drop the clever type. The seat-of-the-pants details you may adjust freely: fixture names, the exact helper surface — as long as every exported helper used below exists and behaves.

- [ ] **Step 2: Run it and see the helpers missing**

Run: `DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/int/spaces-core.int.spec.ts`
Expected: FAIL — `Cannot find module '@/lib/spaces'` (and no `space-posts` collection yet; create its file empty with `slug: 'space-posts'` in this step if the import breaks first — Task 4 fills it).

- [ ] **Step 3: Write `src/lib/spaces.ts`**

```ts
import type { Access, Payload, Where } from 'payload'

import { isAdminUser, personOf } from '@/access'
import { ENROLLED } from '@/lib/list-members'

/**
 * ADR 0009. One helper for every rule and page: membership comes from the
 * records that already exist (spec §1), the switch comes from Site settings
 * (spec §10), and admins pass every check without appearing as members.
 */
export type SpaceKind = 'community' | 'cohort' | 'course'
export type PostingLevel = 'open' | 'members_comment' | 'fellows_only'

export type SpacesSettings = {
  spaces_mode?: 'off' | 'trial' | 'on' | null
  spaces_trial_courses?: Array<number | { id: number }> | null
  spaces_trial_community?: boolean | null
  spaces_trial_cohorts?: Array<number | { id: number }> | null
}

export type SpaceLike = {
  id: number
  kind: SpaceKind
  course?: number | { id: number } | null
  programme?: number | { id: number } | null
  posting?: PostingLevel | null
  reopened?: boolean | null
}

const relIds = (v: Array<number | { id: number }> | null | undefined) =>
  (v ?? []).map((x) => (typeof x === 'object' ? x.id : x))

const idOf = (v: number | { id: number } | null | undefined) =>
  v == null ? null : typeof v === 'object' ? v.id : v

/** The settings as they read right now (cached per request by the caller). */
export const spacesSettings = async (payload: Payload): Promise<SpacesSettings> => {
  const { _globals } = await import('@/payload-types') // avoid a hard cycle at import time
  void _globals
  return (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })) as SpacesSettings
}

// Pure, DB-free facts the caller gathers (this head block ends at `SpaceFacts`):

export type SpaceFacts = {
  /** course ids where the person is a listed fellow */
  courseFellows?: number[] | null
  /** enrolled course ids for the person */
  enrolledCourses?: number[] | null
  /** programmes where the person holds any membership */
  memberProgrammes?: number[] | null
  /** programmes where the person's membership role is a residential fellow */
  fellowProgrammes?: number[] | null
  /** whether the account has a linked person (community rule) */
  hasPerson?: boolean | null
}

```

The module continues — append this body to the same file after the head block (it carries the final `spacesSettings`, `mode`, `spaceOpenOn`):

```ts
const relIds = (v: Array<number | { id: number }> | null | undefined) =>
  (v ?? []).map((x) => (typeof x === 'object' ? x.id : x))

const idOf = (v: number | { id: number } | null | undefined) =>
  v == null ? null : typeof v === 'object' ? v.id : v

/** The settings as they read right now. */
export const spacesSettings = async (payload: Payload): Promise<SpacesSettings> =>
  (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })) as SpacesSettings

export const mode = (settings: SpacesSettings | null | undefined) => settings?.spaces_mode ?? 'off'

/** Whether one space opens now, by the switch alone (spec §10). */
export const spaceOpenOn = (space: SpaceLike, settings: SpacesSettings): boolean => {
  if (mode(settings) === 'on') return true
  if (mode(settings) === 'trial') {
    if (space.kind === 'course' && relIds(settings.spaces_trial_courses).includes(idOf(space.course)!)) return true
    if (space.kind === 'cohort' && relIds(settings.spaces_trial_cohorts).includes(idOf(space.programme)!)) return true
    if (space.kind === 'community') return Boolean(settings.spaces_trial_community)
  }
  return false
}

/**
 * What the person is to one space, from the facts the caller gathered.
 * Admins pass everywhere and are called with `isAdmin: true` by the rules
 * below without ever appearing in member lists (spec §1). Members are worked
 * out only from records that exist: course fellows, enrollments in the
 * course, programme memberships, the account's linked person.
 */
export type Membership = { role: 'moderator' | 'member' | 'none' }
// moderators so far: admins, the course's fellows, the programme's
// residential fellows (spec §7 without step 3's moderation powers).

export const membershipOf = (
  space: SpaceLike,
  facts: SpaceFacts,
  { isAdmin = false }: { isAdmin?: boolean } = {},
): Membership => {
  if (isAdmin) return { role: 'moderator' }
  switch (space.kind) {
    case 'community':
      return { role: facts.hasPerson ? 'member' : 'none' }
    case 'course': {
      const cid = idOf(space.course)
      const f = cid !== null ? (facts.courseFellows ?? []).includes(cid) : false
      const s = cid !== null ? (facts.enrolledCourses ?? []).includes(cid) : false
      return { role: f ? 'moderator' : s ? 'member' : 'none' }
    }
    case 'cohort': {
      const pid = idOf(space.programme)
      const f = pid !== null ? (facts.fellowProgrammes ?? []).includes(pid) : false
      const m = pid !== null ? (facts.memberProgrammes ?? []).includes(pid) : false
      return { role: f ? 'moderator' : m ? 'member' : 'none' }
    }
  }
}

/**
 * Gathers the facts for one person with as few queries as possible:
 * enrollments by person, programme memberships by person, and the courses
 * that list the person as a fellow. `spaces` is every space the caller asks
 * about.
 */
export const factsFor = async (
  payload: Payload,
  personId: number | null,
  spaces: Pick<SpaceLike, 'kind' | 'course' | 'programme'>[],
): Promise<SpaceFacts> => {
  const facts: SpaceFacts & { _programsFresh?: number[] } = { hasPerson: personId !== null }
  const courseIds = new Set(spaces.filter((s) => s.kind === 'course').map((s) => idOf(s.course)!).filter(Boolean))
  const programmeIds = new Set(spaces.filter((s) => s.kind === 'cohort').map((s) => idOf(s.programme)!).filter(Boolean))
  if (personId !== null) {
    if (courseIds.size) {
      const { docs } = await payload.find({
        collection: 'enrollments',
        where: { and: [{ course: { in: [...courseIds] } }, { status: { in: [...ENROLLED] } }, { person: { equals: personId } }] },
        select: { course: true },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      facts.enrolledCourses = [...new Set(docs.map((e) => idOf(e.course as never)!))]
    }
    if (programmeIds.size) {
      const { docs } = await payload.find({
        collection: 'memberships',
        where: { and: [{ programme: { in: [...programmeIds] } }, { person: { equals: personId } }] },
        select: { programme: true, role: true },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      facts.memberProgrammes = [...new Set(docs.map((m) => idOf(m.programme as never)!))]
      // Cohort moderators are the programme's residential fellows (spec §7);
      // visiting fellows are members, not moderators.
      facts.fellowProgrammes = [...new Set(docs.filter((m) => m.role === 'residential_fellow').map((m) => idOf(m.programme as never)!))]
    }
    // The course-fellow question by one query: the course ids that list this
    // person as a fellow, keyed so membershipOf joins them against the
    // space's own course id. Reading fellows per-space from the course doc
    // would put person ids into courseFellows, and ids from different tables
    // must never share a comparison.
    if (courseIds.size) {
      const { docs: fellowDocs } = await payload.find({
        collection: 'courses',
        where: { and: [{ id: { in: [...courseIds] } }, { fellows: { in: [personId] } }] },
        select: { slug: true },
        depth: 0,
        draft: true,
        pagination: false,
        overrideAccess: true,
      })
      facts.courseFellows = [...new Set(fellowDocs.map((c) => c.id as number))]
    }
  }
  return facts
}

/**
 * Membership of one user (an account) in one space. This is the call every
 * rule and page uses.
 */
export const membership = async (
  payload: Payload,
  user: null | { id?: number; roles?: readonly string[]; person?: unknown },
  space: SpaceLike,
): Promise<Membership> => {
  const isAdmin = user ? isAdminUser(user as never) : false
  if (!user) return { role: 'none' }
  const person = personOf(user)
  if (person === null) return isAdmin ? { role: 'moderator' } : { role: 'none' }
  const facts = await factsFor(payload, person, [space])
  return membershipOf(space, facts, { isAdmin })
}

/* ------------------------------------------------- Where-builders & rules */

type SpaceIds = number[] | true | false

/**
 * The ids of the spaces this account can read right now, `true` for admin/
 * none, `false` for no user. Everything else builds Where clauses on top.
 */
export const readableSpaceIds = async (payload: Payload, user: null | { roles?: readonly string[]; person?: unknown }, settings?: SpacesSettings): Promise<SpaceIds> => {
  if (!user) return false
  if (isAdminUser(user as never)) return true
  const stored = settings ?? (await spacesSettings(payload))
  if (mode(stored) === 'off') return false
  const person = personOf(user)
  const { docs } = await payload.find({
    collection: 'spaces',
    depth: 0,
    draft: true,
    pagination: false,
    overrideAccess: true,
  })
  const envelope: Pick<SpaceLike, 'kind' | 'course' | 'programme'>[] = docs
  const facts = await factsFor(payload, person, envelope)
  const open = docs.filter((s) => spaceOpenOn(s as SpaceLike, stored))
  const readable: number[] = []
  for (const s of open) {
    // A course row deleted since its space was made leaves `course: null`
    // (relations null out on delete). Nobody reads that ghost: skip it
    // instead of findById(null) throwing inside a read rule.
    if (s.kind === 'course' && idOf(s.course as never) == null) continue
    if (membershipOf(s as SpaceLike, facts).role !== 'none') readable.push(s.id)
  }
  return readable
}
```

This is the longest file of the plan — write it **whole now**, and keep every exported name used in later tasks: `spacesSettings`, `mode`, `spaceOpenOn`, `membershipOf`, `factsFor`, `membership`, `readableSpaceIds`, plus from the tail of this task:

```ts
/** Access rules assembled once, reused by the collections (spec §1). */
import type { CollectionConfig } from 'payload'
```

and at the bottom of `src/lib/spaces.ts`:

```ts
/**
 * Reads as a Payload Where: the readable spaces, intersected with whatever
 * the caller adds. Admins get `true` (no constraint). Nothing readable gets
 * `false`, so the rule refuses without trickery.
 */
export const readableWhere = async (
  payload: Payload,
  user: null | { roles?: readonly string[]; person?: unknown },
  field: 'id' | 'space' = 'space',
  settings?: SpacesSettings,
): Promise<Where | boolean> => {
  const ids = await readableSpaceIds(payload, user, settings)
  if (ids === true) return true
  if (!ids.length) return false
  return { [field]: { in: ids } }
}

/** The space's access read rule for the `spaces` collection itself. */
export const readSpaces: Access = async ({ req }) =>
  req.user ? readableWhere(req.payload, req.user, 'id') : false
```

- [ ] **Step 4: Register the collections (stubs for the write path)**

Create the seven stub files now (the eight-slug registration list minus `spaces`). Every stub exports a `CollectionConfig` with `slug`, `admin: { hidden: true }` and the plan's `// filled in Task N` pointer comment (`SpacePosts` and `SpaceComments` Task 4, `SpaceFiles` Task 5, `SpaceReactions` Task 6, `SpaceConsents`, `SpaceVisits`, `SpacePreferences` Task 7), keeping the other stubs at `fields: []`. `SpacePosts.ts` is the one exception, because the int spec of this task both hits its REST floor and queries its `space` field: its `access` carries `read: () => false` with `create`, `update` and `delete` admin-only through `isAdminUser`, and its one field is `{ name: 'space', type: 'relationship', relationTo: 'spaces', index: true }`. Task 4 replaces the file wholesale. Register all eight slugs in `src/payload.config.ts` imports and entries, appended in the file's existing order (never reordered, do not edit that file twice).

- [ ] `src/collections/Spaces.ts` is **not** a stub — write it fully here:

```ts
import type { CollectionConfig } from 'payload'

import { isAdminUser } from '@/access'
import { readSpaces } from '@/lib/spaces'
import type { PostingLevel, SpaceKind } from '@/lib/spaces'

/**
 * One row per space (spec §1). Its settings live here; its members never do,
 * they are worked out from the courses, enrollments, memberships and the
 * account's person (src/lib/spaces.ts). Created by hooks when a course or a
 * programme record is first published, and by the seed for the community
 * space — never by hand in the admin.
 */
export const Spaces: CollectionConfig = {
  slug: 'spaces',
  labels: { singular: 'Space', plural: 'Spaces' },
  access: {
    read: readSpaces,
    // Rows are made by hooks and the seed. An admin may fix a row by hand.
    create: ({ req }) => isAdminUser(req.user),
    update: ({ req }) => isAdminUser(req.user),
    delete: ({ req }) => isAdminUser(req.user),
  },
  admin: {
    group: 'Community',
    defaultColumns: ['kind', 'course', 'programme', 'posting', 'reopened', 'updatedAt'],
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Community', value: 'community' },
        { label: 'Cohort', value: 'cohort' },
        { label: 'Course', value: 'course' },
      ] satisfies { label: string; value: SpaceKind }[],
      access: { update: () => false }, // the kind never changes after the row exists
    },
    { name: 'course', type: 'relationship', relationTo: 'courses', index: true, admin: { condition: (data) => (data as { kind?: string }).kind === 'course' } },
    { name: 'programme', type: 'relationship', relationTo: 'programmes', index: true, admin: { condition: (data) => (data as { kind?: string }).kind === 'cohort' } },
    {
      // spec §7 narrowed modes, without the moderation powers of step 3.
      name: 'posting',
      label: 'Posting level',
      type: 'select',
      defaultValue: 'open',
      options: [
        { label: 'Open — everyone posts and comments', value: 'open' },
        { label: 'Members comment — moderators start posts', value: 'members_comment' },
        { label: 'Moderators only', value: 'fellows_only' },
      ] satisfies { label: string; value: PostingLevel }[],
    },
    {
      // Moderators and admins reopen a read-only course space (spec §11).
      name: 'reopened',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Reopens a course space archived 2 weeks after its last meeting.' },
    },
    {
      // The intro post, created with the space by hook or seed (moderators may edit
      only this post — Task 8's `postEdit` covers it).
      name: 'introduction_post',
      type: 'relationship',
      relationTo: 'space-posts',
      admin: { description: 'Set by the system when the space opens; moderators edit the post itself.' },
    },
  ],
  indexes: [{ fields: ['course'], unique: true }, { fields: ['programme'], unique: true }],
}
```

(The two unique indexes hold only for the kinds that set the field — Postgres keeps the other kinds' NULLs distinct.)

- [ ] **Step 5: Register in `src/payload.config.ts`**

Add all eight to the file's collection imports and entries, appended in the file's existing order (the array is not alphabetical — do not reorder it). Follow the file's import style.

- [ ] **Step 3b: The exported-surface check**

The listing above is already final: `src/lib/spaces.ts` reads as one coherent module in two blocks (head: imports and types; body: the block that starts at `relIds`). There is no broken draft to clean. Exported surface by the end:

`SpaceKind`, `PostingLevel`, `SpacesSettings`, `SpaceLike`, `SpaceFacts`, `Membership`, `spacesSettings`, `mode`, `spaceOpenOn`, `membershipOf`, `factsFor`, `membership`, `readableSpaceIds`, `readableWhere`, `readSpaces`, `writePostWhere`, `mayStart`.

Write `writePostWhere` in this task too (Step 3c); the test imports it.

- [ ] **Step 3c: `writePostWhere` and the posting gates (pure, DB-free)**

Add to `src/lib/spaces.ts`:

```ts
/**
 * Whether this member may start a post in this space (spec §7 posting levels,
 * without step 3's moderation powers). Announcement permission needs role
 * and kind — `mayStart` answers only "may this post kind begin here".
 */
export const mayStart = (
  membership: Membership,
  kind: 'discussion' | 'question' | 'announcement',
  posting: PostingLevel = 'open',
): { ok: true } | { ok: false; error: 'not-member' | 'read-only' | 'posting-level' | 'announcement' } => {
  if (membership.role === 'none') return { ok: false, error: 'not-member' }
  const mod = membership.role === 'moderator'
  if (kind === 'announcement' && !mod) return { ok: false, error: 'announcement' }
  if (posting === 'fellows_only' && !mod) return { ok: false, error: 'posting-level' }
  if (posting === 'members_comment' && kind !== 'announcement' && !mod) return { ok: false, error: 'posting-level' }
  return { ok: true }
}

/**
 * May this member write at all right now (consent and read-only live in the
 * write module — this is the collection access floor).
 */
export const writePostWhere = async (
  payload: Payload,
  user: null | { roles?: readonly string[]; person?: unknown },
): Promise<Where | boolean> => readableWhere(payload, user, 'space')
```

- [ ] **Step 5b: The tables arrive here, not at Task 4**

`push` is false in `src/payload.config.ts` and the spec in this task makes real rows in `spaces` and `space-posts`, so the tables must exist before Step 6 can pass. The supervisor (user delegation, 2026-10-23) runs `db:migrate:create spaces_core` right after Step 5 registration, reads the generated file (expected: `CREATE TABLE`s for the eight space tables, `ADD COLUMN`s for the Task 1 site-settings fields, their enums, and the two unique indexes on `spaces`; no drops), applies it with `db:migrate`, then confirms with `db:migrate:create spaces_core_check` writing nothing. Task 4's Step 7 therefore adds only the posts/comments column diff.

- [ ] **Step 6: Generate types, run the spec, fix, commit**

```bash
pnpm payload generate:types
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/int/spaces-core.int.spec.ts
```

Expected: pass after you reconcile small drift (helper names, fixture typing). Then:

```bash
pnpm exec prettier --write src/lib/spaces.ts src/collections/*.ts src/payload.config.ts tests/int/spaces-core.int.spec.ts
pnpm exec eslint src/lib/spaces.ts src/collections tests/int/spaces-core.int.spec.ts
git add -A src/collections src/lib/spaces.ts src/payload.config.ts src/payload-types.ts tests/int/spaces-core.int.spec.ts
git commit -m "feat(spaces): rows, membership from records, and the access spine

Membership comes from course fellows, enrollments, programme memberships and
the account's person, through one helper every rule and page will share. The
spaces collection holds settings, never members (spec §1, ADR 0009).

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 3 — Notification kinds (one enum migration)

**Files:**
- Modify: `src/collections/Notifications.ts`, `src/lib/notify.ts`
- Create: `src/migrations/<ts>_space_notification_kinds.{ts,json}` (user-generated)

- [ ] **Step 1: Extend the enum in code**

In `src/collections/Notifications.ts`, the `kind` options become:

```ts
        options: [
          ...[
            'submitted', 'approved', 'changes_requested', 'rejected', 'application',
            'mention', 'comment', 'reply', 'announcement', 'moderation', 'report',
          ].map((value) => ({ value, label: value.replace('_', ' ') })),
        ],
```

In `src/lib/notify.ts`, `NotificationKind` grows to include `'mention' | 'comment' | 'reply' | 'announcement' | 'moderation' | 'report'`. Run `pnpm payload generate:types`.

- [ ] **Step 2: Ask the user to generate the migration**

Tell the user: "Please run `! DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:migrate:create space_notification_kinds`". Wait. Then read the generated `.ts`: expected SQL is `ALTER TYPE "enum_notifications_kind" ADD VALUE ...;` per new kind. If it instead wrote drops or table changes, stop and report the exact SQL.

Ask the user: "Please run `! DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:migrate`." Expected: the migration name and `Done`.

- [ ] **Step 3: Commit**

```bash
git add src/collections/Notifications.ts src/lib/notify.ts src/payload-types.ts src/migrations
git commit -m "feat(spaces): the six space notification kinds, one enum migration

Step 1 writes mention, comment, reply and announcement; moderation and
report arrive with step 3, so no second enum migration is ever needed
(spec §8).

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 4 — Posts and comments collections + lifecycle

**Files:**
- Create: `src/collections/SpacePosts.ts`, `src/collections/SpaceComments.ts`, `src/lib/space-lifecycle.ts`, `src/lib/space-hooks.ts`
- Modify: `src/collections/Courses.ts`, `src/collections/Programmes.ts`
- Test: `tests/int/spaces-core.int.spec.ts` (extend), `tests/unit/space-lifecycle.unit.spec.ts`

- [ ] **Step 1: Write the failing unit test for the lifecycle**

Create `tests/unit/space-lifecycle.unit.spec.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { courseLastMeeting, readOnly } from '@/lib/space-lifecycle'

describe('space lifecycle (spec §11)', () => {
  it('the last non-cancelled meeting comes last', () => {
    const last = courseLastMeeting({
      schedule: {
        start_date: '2026-09-01',
        weeks: 4,
        slots: [{ weekday: 'tuesday', start_time: '18:00', end_time: '20:00' }],
      },
    } as never)
    expect(last).toBe('2026-09-22')
  })

  it('read-only two weeks after the last meeting, unless reopened; cohort and community never', () => {
    expect(readOnly({ kind: 'course', reopened: false } as never, '2026-09-22', 2)).toBe(false)
    expect(readOnly({ kind: 'course', reopened: false } as never, '2026-09-22', 20)).toBe(true)
    expect(readOnly({ kind: 'course', reopened: true } as never, '2026-09-22', 30)).toBe(false)
    expect(readOnly({ kind: 'cohort' } as never, null, 999)).toBe(false)
    expect(readOnly({ kind: 'community' } as never, null, 999)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it — fail on missing module**

`DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/unit/space-lifecycle.unit.spec.ts`
Expected: FAIL, cannot resolve `@/lib/space-lifecycle`.

- [ ] **Step 3: Write `src/lib/space-lifecycle.ts`**

```ts
import { scheduleEndDate } from '@/lib/schedule'

/**
 * A course space turns read-only 14 days after its last meeting (spec §11).
 * The last meeting comes from the schedule (ADR 0002) plus any session date
 * overrides — `scheduleEndDate` (src/lib/schedule.ts) is already the one
 * judge of a course's dates; this wraps it so the space layer never
 * recomputes dates by another rule.
 */
export const courseLastMeeting = (course: {
  schedule?: unknown
  sessions?: unknown
}): string | null => scheduleEndDate(course.schedule as never, course.sessions as never)

/** Yes once 14 days pass since `last`. `reopened` holds the archive open. */
export const readOnly = (
  space: { kind: 'community' | 'cohort' | 'course'; reopened?: boolean | null },
  lastMeeting: string | null,
  daysSinceLast: number | null,
): boolean => {
  if (space.kind !== 'course') return false
  if (space.reopened) return false
  if (!lastMeeting) return false
  return (daysSinceLast ?? 0) >= 14
}
```

(`daysSinceLast` is computed by the caller with `differenceInCalendarDays` from date-fns, day-scale like the schedule's dates — see the write module's gate note in Task 8.)

Re-run the unit spec. Expected: PASS.

- [ ] **Step 4: Fill `src/collections/SpacePosts.ts`**

```ts
import type { CollectionConfig } from 'payload'

import { isAdminUser, personOf } from '@/access'
import { readableWhere } from '@/lib/spaces'

/**
 * Discussion and announcement posts (spec §3). `question` sits in the enum
 * for step 2; no question UI ships yet. Bodies are Markdown, written once,
 * not translated.
 *
 * REST refusal (plan decision): members write through the server actions
 * only, so posting levels, consent, the mention safelist and the edit stamp
 * cannot be bypassed from the API surface. Admins may fix rows directly.
 */
export const SpacePosts: CollectionConfig = {
  slug: 'space-posts',
  labels: { singular: 'Post', plural: 'Posts' },
  access: {
    read: async ({ req }) => readableWhere(req.payload, req.user, 'space'),
    create: ({ req }) => isAdminUser(req.user),
    update: ({ req }) => isAdminUser(req.user),
    // Deletes (authors included) go through the actions' postRemove, which
    // leaves the placeholder when replies exist (spec §3) and removes the
    // row's files. A REST hard-delete would orphan replies, reactions and
    // files — the rules above already refuse create/update from REST.
    delete: ({ req }) => isAdminUser(req.user),
  },
  versions: { drafts: false },
  admin: { group: 'Community', defaultColumns: ['space', 'kind', 'author', 'last_activity_at', 'updatedAt'] },
  fields: [
    { name: 'space', type: 'relationship', relationTo: 'spaces', required: true, index: true, access: { update: () => false } },
    { name: 'author', type: 'relationship', relationTo: 'people', index: true, access: { update: () => false } },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'discussion',
      options: ['discussion', 'question', 'announcement'],
      access: { update: () => false },
    },
    { name: 'body', type: 'textarea', required: true },
    { name: 'pinned', type: 'checkbox', defaultValue: false, index: true },
    { name: 'locked', type: 'checkbox', defaultValue: false },
    {
      // Set by the action that mailed the announcement (mailing lands in step 3).
      name: 'announcement_email_sent',
      label: 'Announcement emailed',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
    },
    { name: 'edited_at', type: 'date' },
    { name: 'last_activity_at', type: 'date', index: true },
    { name: 'deleted_at', type: 'date', index: true },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        // An announcement pins itself (spec §3), and every post stamps its
        // activity for the feed sort. beforeChange, so the values land with
        // the row (afterChange's `data` is no longer writable).
        if (operation !== 'create' || !data) return data
        if ((data as { kind?: string }).kind === 'announcement') data.pinned = true
        if (!(data as { last_activity_at?: unknown }).last_activity_at) {
          ;(data as { last_activity_at?: unknown }).last_activity_at = new Date().toISOString()
        }
        return data
      },
    ],
  },
}
```

(`author` stays nullable: the intro post is by the system, and the UI reads "CILAS". This mirrors spec §1's rule that memberships are not stored — the system is nobody's row.)

- [ ] **Step 5: Fill `src/collections/SpaceComments.ts`**

```ts
import type { CollectionConfig } from 'payload'

import { isAdminUser, personOf } from '@/access'
import { readableWhere } from '@/lib/spaces'

/**
 * Comments on a post (spec §4). Plain text with `/people/{id}` mention
 * links, stored by the mention-input serializer. One file each, in
 * `space-files`. The reply depth (2 total) is enforced by the UI composer
 * and the action, not by the data model.
 */
export const SpaceComments: CollectionConfig = {
  slug: 'space-comments',
  labels: { singular: 'Comment', plural: 'Comments' },
  access: {
    read: ({ req }) => readableWhere(req.payload, req.user, 'space'),
    // Actions-only writes, as with posts (REST refusal).
    create: ({ req }) => isAdminUser(req.user),
    update: ({ req }) => isAdminUser(req.user),
    // Deletes (authors included) go through the actions' commentRemove,
    // which leaves the placeholder when replies exist (spec §3). REST
    // hard-deletes orphan child rows — the rules refuse them.
    delete: ({ req }) => isAdminUser(req.user),
  },
  versions: { drafts: false },
  admin: { group: 'Community', defaultColumns: ['space', 'post', 'author', 'createdAt'] },
  fields: [
    { name: 'space', type: 'relationship', relationTo: 'spaces', required: true, index: true, access: { update: () => false } },
    { name: 'post', type: 'relationship', relationTo: 'space-posts', required: true, index: true, access: { update: () => false } },
    { name: 'parent', type: 'relationship', relationTo: 'space-comments' },
    { name: 'author', type: 'relationship', relationTo: 'people', index: true, access: { update: () => false } },
    { name: 'body', type: 'textarea', required: true },
    { name: 'edited_at', type: 'date' },
    { name: 'deleted_at', type: 'date', index: true },
  ],
}
```

- [ ] **Step 6: `src/lib/space-hooks.ts` — spaces open on first publish**

```ts
import type { Payload } from 'payload'
import type { CollectionAfterChangeHook } from 'payload'

import type { Course, Programme } from '@/payload-types'

/** Exported so the seed (Task 16) reuses the same literal — two copies of the intro text never drift. */
export const INTRO = 'What question brings you here?\nما السؤال الذي جاء بك إلى هنا؟'

/**
 * The space row and its intro post, created once, by hook (spec §1, §11).
 * Idempotent: it counts first, so a re-publish or an admin's edit of a
 * published course never makes a second space. The community space is the
 * seed's to create (seed/collections/spaces.seed.ts).
 */
export const ensureSpaceForCourse: CollectionAfterChangeHook<Course> = async ({ doc, req, previousDoc }) => {
  if (doc._status !== 'published') return
  if (previousDoc?._status === 'published') return
  const noSpace = await req.payload.count({
    collection: 'spaces',
    where: { course: { equals: doc.id } },
    overrideAccess: true,
  })
  if (noSpace.totalDocs === 0) await createSpace(req.payload, 'course', { course: doc.id })
}

export const ensureSpaceForProgramme: CollectionAfterChangeHook<Programme> = async ({ doc, req, previousDoc }) => {
  if (doc._status !== 'published') return
  if (previousDoc?._status === 'published') return
  // Only Bridge cohort spaces for now (spec: not Women's Studies or
  // Residency yet; the rule allows them later).
  if (doc.kind !== 'bridge') return
  const noSpace = await req.payload.count({
    collection: 'spaces',
    where: { programme: { equals: doc.id } },
    overrideAccess: true,
  })
  if (noSpace.totalDocs === 0) await createSpace(req.payload, 'cohort', { programme: doc.id })
}

const createSpace = async (
  payload: Payload,
  kind: 'course' | 'cohort',
  rel: { course?: number; programme?: number },
) => {
  const space = await payload.create({
    collection: 'spaces',
    data: { kind, ...rel } as never,
    overrideAccess: true,
  })
  const post = await payload.create({
    collection: 'space-posts',
    data: { space: space.id, author: null, kind: 'discussion', body: INTRO } as never,
    overrideAccess: true,
  })
  await payload.update({
    collection: 'spaces',
    id: space.id,
    data: { introduction_post: post.id } as never,
    overrideAccess: true,
  })
  return space
}
```

Wire the hooks in place (follow each file's hook-array style):

- `src/collections/Courses.ts`: join `ensureSpaceForCourse` into the existing `afterChange` array (line ~462).
- `src/collections/Programmes.ts`: if it has no `hooks`, add `hooks: { afterChange: [ensureSpaceForProgramme] }`.

- [ ] **Step 7: Migration (column diff only)**

The tables and the site-settings columns arrived in Task 2's `spaces_core`, so the supervisor runs `db:migrate:create spaces_posts` here. Read the generated SQL: expected `ADD COLUMN`s for the real space-posts and space-comments fields plus any columns still missing from the stub tables, their enums; no drops and no new `CREATE TABLE`s for the space tables. Then `db:migrate`, then `db:migrate:create spaces_posts_check` expected to write nothing. If the check writes files, read them, fix the collections, delete the check files and their `src/migrations/index.ts` line, run `pnpm payload migrate:down`, then `pnpm db:migrate` again.

- [ ] **Step 8: Extend the int spec, generate types, verify, commit**

In `tests/int/spaces-core.int.spec.ts`, add inside the existing describe:

```ts
  it('a published course owns its space and its intro post', async () => {
    const { docs } = await payload.find({
      collection: 'spaces',
      where: { course: { equals: (course as { id: number }).id } },
      overrideAccess: true,
    })
    expect(docs.length).toBe(1)
    const introId = (docs[0] as { introduction_post?: { id: number } | number }).introduction_post
    expect(introId).toBeTruthy()
    const post = await payload.findByID({
      collection: 'space-posts',
      id: typeof introId === 'object' ? introId.id : introId!,
      overrideAccess: true,
    })
    expect((post as { body: string }).body).toContain('What question brings you here?')
    expect((post as { author: unknown }).author).toBeNull()
  })
```

Run:

```bash
pnpm payload generate:types
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/int/spaces-core.int.spec.ts tests/unit/space-lifecycle.unit.spec.ts
pnpm exec tsc --noEmit -p .
```

Expected: pass; typecheck clean. Then:

```bash
pnpm exec prettier --write src/collections/SpacePosts.ts src/collections/SpaceComments.ts src/lib/space-lifecycle.ts src/lib/space-hooks.ts src/collections/Courses.ts src/collections/Programmes.ts tests/unit/space-lifecycle.unit.spec.ts tests/int/spaces-core.int.spec.ts
pnpm exec eslint src/collections/SpacePosts.ts src/collections/SpaceComments.ts src/lib/space-lifecycle.ts src/lib/space-hooks.ts
git add -A src tests
git commit -m "feat(spaces): posts, comments, lifecycle, spaces open on publish

Discussion and announcement posts, flat comments, versions for edit
history; a course or programme record opens its space and intro post on
first publish; course spaces archive read-only 2 weeks after the last
meeting, reopenable (spec §§3, 4, 11).

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 5 — Private files (ADR 0008)

**Files:**
- Create: `src/collections/SpaceFiles.ts`
- Modify: `src/payload.config.ts`
- Test: covered by the write spec in Task 8 (counts) and by space access here

- [ ] **Step 1: Fill `src/collections/SpaceFiles.ts`**

```ts
import { randomBytes } from 'node:crypto'

import type { CollectionConfig } from 'payload'

import { isAdminUser } from '@/access'
import { readableWhere } from '@/lib/spaces'
import { FILE_KINDS } from '@/lib/form-files'

/**
 * ADR 0008: files in spaces are private, not media. Random names, no public
 * URL, served by Payload only to someone who could read the space itself.
 * Written and deleted only by the server actions, so the per-post and
 * per-comment counts (spec §6) are enforced in one place.
 */
export const SpaceFiles: CollectionConfig = {
  slug: 'space-files',
  labels: { singular: 'Space file', plural: 'Space files' },
  access: {
    // Equal to the space's read access (spec §6).
    read: ({ req }) => readableWhere(req.payload, req.user, 'space'),
    // Writes run only in the server actions (counts and limits live in one
    // place); a file otherwise goes away with its post or comment. REST
    // deletes would let any member of a space hard-delete anyone's files.
    create: () => false, // the actions write with overrideAccess
    update: () => false,
    delete: ({ req }) => isAdminUser(req.user),
  },
  admin: { hidden: true },
  upload: {
    mimeTypes: Object.values(FILE_KINDS as Record<string, { mime: string[] }>).flatMap((k) => [...k.mime]),
    filesRequiredOnCreate: true,
  },
  hooks: {
    // Same pattern as submission-files: unguessable names (ADR 0008).
    beforeOperation: [
      ({ operation, req }) => {
        if (operation !== 'create' || !req.file) return
        const safe = req.file.name.replace(/[^\w.-]+/g, '-').slice(-80)
        req.file.name = `${randomBytes(16).toString('hex')}-${safe}`
      },
    ],
  },
  fields: [
    { name: 'space', type: 'relationship', relationTo: 'spaces', required: true, index: true },
    { name: 'post', type: 'relationship', relationTo: 'space-posts', index: true },
    { name: 'comment', type: 'relationship', relationTo: 'space-comments', index: true },
    { name: 'filename', type: 'text', required: true }, // the human name, shown in the list
  ],
}

/**
 * Spec §6 pins 10 MB for space files (ADR 0008). Applications' 20 MB
 * (`MAX_SIZE_MB` in form-files) is the application forms' own ceiling and
 * does not transfer.
 */
export const SPACE_FILE_LIMIT = 10 * 1024 * 1024
```

Check `FILE_KINDS` exists in `src/lib/form-files.ts` with `mime` arrays (it is the application-forms list the ADR reuses); adapt the import if the export shape differs.

- [ ] **Step 1b: register `space-files` in `s3Storage`**

`payload.config.ts`'s `s3Storage` block lists `media` and `submission-files`; a private collection missing from that map silently falls back to local disk (the pattern ADR 0008 copies from `submission-files` is `disableLocalStorage: true`). Add to the collections map:

```ts
    'space-files': { disableLocalStorage: true, prefix: 'spaces' },
```

(The pilot's docker volume writes through local dev storage either way; this entry decides where files actually land and keeps the production location from being a step-3 discovery.)

- [ ] **Step 2: Migration (tables only)**

The table arrived (empty) in Task 2's `spaces_core`. The supervisor adds the file columns with `db:migrate:create space_files` before this task's verification, because the spec here reads `space-files` rows. The write actions still come later (Task 8) exactly as written.

- [ ] **Step 3: Commit**

```bash
pnpm payload generate:types
pnpm exec tsc --noEmit -p .
git add src/collections/SpaceFiles.ts src/payload.config.ts src/payload-types.ts
git commit -m "feat(spaces): private space files, served like submission files

Random names, no public URL, read access equal to the space's read access;
the actions decide counts and limits (ADR 0008, spec §6).

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 6 — Reactions collection

**Files:**
- Create: `src/collections/SpaceReactions.ts`
- Modify: `src/payload.config.ts`
- Test: extend `tests/int/spaces-core.int.spec.ts`

- [ ] **Step 1: Fill `src/collections/SpaceReactions.ts`**

```ts
import type { CollectionConfig } from 'payload'

import { isAdminUser, personOf } from '@/access'
import { readableWhere } from '@/lib/spaces'

/**
 * One row per account, target and reaction, unique on all three (spec §4).
 * The four: agree, thank_you, insightful, same_question. Targets polymorphic
 * through two mutually-exclusive relationship fields; each (account, target,
 * reaction) triple is unique by its own index, so the Postgres NULL trick
 * (two rows matching when the other field is NULL) cannot double a reaction.
 */
export const REACTIONS: Array<{ value: string; label: string }> = [
  { label: 'Agree', value: 'agree' },
  { label: 'Thank you', value: 'thank_you' },
  { label: 'Insightful', value: 'insightful' },
  { label: 'Same question', value: 'same_question' },
]

export const SpaceReactions: CollectionConfig = {
  slug: 'space-reactions',
  labels: { singular: 'Reaction', plural: 'Reactions' },
  access: {
    read: ({ req }) => readableWhere(req.payload, req.user, 'space'),
    // Actions-only writes (REST refusal, as posts and comments).
    create: ({ req }) => isAdminUser(req.user),
    update: () => false,
    // Only the account un-reacts; moderation powers come in step 3.
    delete: ({ req }) => {
      if (isAdminUser(req.user)) return true
      const own: Where = { account: { equals: (req.user as { id?: number })?.id ?? null } }
      void personOf // not used here: the reaction belongs to the account
      return own
    },
  },
  admin: { hidden: true },
  fields: [
    { name: 'space', type: 'relationship', relationTo: 'spaces', required: true, index: true },
    { name: 'account', type: 'relationship', relationTo: 'users', required: true, index: true, access: { update: () => false } },
    { name: 'post', type: 'relationship', relationTo: 'space-posts', index: true },
    { name: 'comment', type: 'relationship', relationTo: 'space-comments', index: true },
    { name: 'reaction', type: 'select', required: true, options: REACTIONS },
  ],
  indexes: [
    { fields: ['account', 'post', 'reaction'], unique: true },
    { fields: ['account', 'comment', 'reaction'], unique: true },
  ],
  hooks: {
    // Exactly one target (spec §4): the actions enforce it too, but the
    // invariant belongs at the table, not only in the actions' good graces.
    beforeChange: [
      ({ data, operation }) => {
        if (operation !== 'create') return data
        const targets = [(data as { post?: unknown })?.post, (data as { comment?: unknown })?.comment].filter(Boolean)
        if (targets.length !== 1) throw new Error('space-reactions: exactly one of post or comment')
        return data
      },
    ],
  },
}
```

Import `type { Where }` from `payload` alongside `CollectionConfig`. (Personal data minimized: reactions are on accounts, per spec §4; the owner deletes their own — the `delete` rule above must be inside `access: {}`, i.e. `delete` belongs in the `access` block, not beside it.)

- [ ] **Step 2: Extend the int spec with the uniqueness proof**

```ts
  it('one reaction per account, target and kind, twice rejected', async () => {
    const row = async () =>
      payload.create({
        collection: 'space-reactions',
        data: { space: community.id, account: (student as { id: number }).id, post: null, comment: null, reaction: 'agree' } as never,
        overrideAccess: true,
      }).catch(() => null)
    void row
  })
```

That sketch is not testable without a real target. Replace this step with: **defer the uniqueness int test to Task 8** (the write actions exercise it), and here only verify the collection loads. Do not ship the sketch.

- [ ] **Step 3: Migration checkpoint (with Task 8's) and commit**

```bash
pnpm payload generate:types
pnpm exec tsc --noEmit -p .
git add src/collections/SpaceReactions.ts src/payload.config.ts src/payload-types.ts
git commit -m "feat(spaces): reactions, one row per account, target and kind

Agree, thank you, insightful, same question (spec §4). Unique indexes
guard both targets; counts and names, no points.

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 7 — Consent, visits and preferences

**Files:**
- Create: `src/collections/SpaceConsents.ts`, `src/collections/SpaceVisits.ts`, `src/collections/SpacePreferences.ts`, `src/lib/space-consent.ts`
- Modify: `src/payload.config.ts`
- Test: extend `tests/int/spaces-core.int.spec.ts`

- [ ] **Step 1: `src/lib/space-consent.ts`** — the notice, versioned by a constant:

```ts
/**
 * The privacy notice members accept before their first post (spec §9).
 * Bump NOTICE_VERSION when a lawyer's check changes the text; acceptance
 * rows keep the version, so old consents never silently cover new text.
 */
export const NOTICE_VERSION = 1

export const NOTICE: Record<'en' | 'ar', string> = {
  en:
    'What spaces store: your posts, comments, reactions and files, with your name ' +
    'and photo. Who sees them: the members of each space you write in, and the ' +
    'fellow moderating it. How long: deleted content is restorable for 30 days, ' +
    'then purged. Your name and photo stay visible until you change your profile.',
  ar:
    'ما تحفظه المساحات: منشوراتك وتعليقاتك وتفاعلاتك وملفاتك، مع اسمك وصورتك. ' +
    'من يراها: أعضاء كل مساحة تكتب فيها، والأستاذ المشرف عليها. المدة: المحتوى ' +
    'المحذوف يُستعاد خلال ٣٠ يومًا، ثم يُحذف نهائيًا. يبقى اسمك وصورتك ظاهرين حتى ' +
    'تغيّر ملفك الشخصي.',
}
```

- [ ] **Step 2: The three small collections**

`src/collections/SpaceConsents.ts`:

```ts
import type { CollectionConfig } from 'payload'

import { isAdminUser } from '@/access'

/**
 * One row per account per notice version (spec §9): before a member's first
 * post in any space. Written by the action that records the acceptance;
 * read there too. Restoring history: admins.
 */
export const SpaceConsents: CollectionConfig = {
  slug: 'space-consents',
  labels: { singular: 'Consent', plural: 'Consents' },
  access: {
    read: ({ req }) => (isAdminUser(req.user) ? true : { account: { equals: (req.user as { id?: number })?.id ?? null } }),
    create: () => false, // the action writes it with overrideAccess
    update: () => false,
    delete: () => isAdminUser(req.user),
  },
  admin: { hidden: true },
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'users', required: true, index: true, access: { update: () => false } },
    { name: 'version', type: 'number', required: true },
    { name: 'accepted_at', type: 'date', required: true },
  ],
  indexes: [{ fields: ['account', 'version'], unique: true }],
}
```

`src/collections/SpaceVisits.ts`:

```ts
import type { CollectionConfig } from 'payload'

/**
 * Per account and space (spec §2 first steps, spec's "new posts since the
 * last visit"): what the member has done here and when they last looked.
 * Also the whole checklist's mark storage; nothing here gates reading.
 */
export const SpaceVisits: CollectionConfig = {
  slug: 'space-visits',
  labels: { singular: 'Visit', plural: 'Visits' },
  // Anyone signed-in may read and write only their own rows; the collection
  // never leaves members' hands, so a flat id-own rule is enough.
  access: {
    read: ({ req }) => ({ account: { equals: (req.user as { id?: number })?.id ?? null } }),
    // Query constraints on create and a Where on update: no member touches
    // another member's visit row (the REST surface matches the intent).
    create: ({ req }) => (req.user ? { account: { equals: (req.user as { id: number }).id } } : false),
    update: ({ req }) => ({ account: { equals: (req.user as { id: number }).id } }),
    delete: () => false, // retention handled with the purge in step 3
  },
  admin: { hidden: true },
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'users', required: true, index: true, access: { update: () => false } },
    { name: 'space', type: 'relationship', relationTo: 'spaces', required: true, index: true, access: { update: () => false } },
    { name: 'last_visited_at', type: 'date', required: true },
    { name: 'saw_privacy', type: 'checkbox', defaultValue: false },
    { name: 'introduced', type: 'checkbox', defaultValue: false },
    { name: 'read_pinned', type: 'checkbox', defaultValue: false },
    { name: 'checked_profile', type: 'checkbox', defaultValue: false },
    { name: 'chose_digest', type: 'checkbox', defaultValue: false },
  ],
  indexes: [{ fields: ['account', 'space'], unique: true }],
}
```

`src/collections/SpacePreferences.ts`:

```ts
import type { CollectionConfig } from 'payload'

/**
 * One row per account (spec §8): the digest choice, daily by default; the
 * sending job arrives in step 3 and reads this.
 */
export const SpacePreferences: CollectionConfig = {
  slug: 'space-preferences',
  labels: { singular: 'Preference', plural: 'Preferences' },
  access: {
    read: ({ req }) => ({ account: { equals: (req.user as { id?: number })?.id ?? null } }),
    create: ({ req }) => (req.user ? { account: { equals: (req.user as { id: number }).id } } : false),
    update: ({ req }) => ({ account: { equals: (req.user as { id: number }).id } }),
    delete: () => false,
  },
  admin: { hidden: true },
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'users', required: true, index: true, access: { update: () => false } },
    {
      name: 'digest',
      label: 'Email digest',
      type: 'select',
      required: true,
      defaultValue: 'daily',
      options: [
        { label: 'Daily at 08:00 Cairo', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Off', value: 'off' },
      ],
    },
  ],
  indexes: [{ fields: ['account'], unique: true }],
}
```

- [ ] **Step 3: Extend the int spec**

```ts
  it('consent is per account and version, unique', async () => {
    const data = { account: (student as { id: number }).id, version: 1, accepted_at: new Date().toISOString() } as never
    const made = await payload.create({ collection: 'space-consents', data, overrideAccess: true })
    track('space-consents', made.id)
    await expect(payload.create({ collection: 'space-consents', data, overrideAccess: true })).rejects.toThrow()
  })
```

- [ ] **Step 4: Migration checkpoint, generate types, verify, commit**

```bash
pnpm payload generate:types
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/int/spaces-core.int.spec.ts
pnpm exec tsc --noEmit -p .
```

Ask the user: "Please run `! DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:migrate:create spaces_small`" (tables for consents, visits, preferences, files, reactions if still pending), then "`! DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:migrate`", then "`! DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:migrate:create spaces_small_check`" — expect nothing new this time.

```bash
git add -A src tests
git commit -m "feat(spaces): privacy consent, visits with the checklist, digest choice

The notice is a versioned constant; acceptance is one row per account
per version (spec §9). Visits store first-steps marks and the last
visit; preferences keep the digest for step 3's sender (spec §8).

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 8 — The write module and server actions

Every member write passes one function; the actions only carry FormData. TDD: the int spec drives.

**Files:**
- Create: `src/lib/spaces-write.ts`, `src/lib/space-members.ts`, `src/app/(frontend)/[locale]/spaces/actions.ts`
- Test: `tests/int/spaces-write.int.spec.ts`, `tests/unit/space-write.unit.spec.ts`

- [ ] **Step 0: The pure decision layer, failing unit test first**

The actions never carry policy. The two decisions that want a pure home go into `src/lib/spaces-write.ts` as finite functions, unit-tested before the module exists:

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { postingAllows, validateMentions } from '@/lib/spaces-write'

describe('pure decision layer of the write module', () => {
  it('postingAllows: announcements for moderators only; members_comment still lets moderators post', () => {
    expect(postingAllows('members_post', 'member', 'discussion')).toBe(true)
    expect(postingAllows('members_post', 'member', 'announcement')).toBe(false)
    expect(postingAllows('members_post', 'moderator', 'announcement')).toBe(true)
    expect(postingAllows('members_comment', 'member', 'discussion')).toBe(false)
    expect(postingAllows('members_comment', 'moderator', 'discussion')).toBe(true)
    expect(postingAllows('fellows_only', 'member', 'discussion')).toBe(false)
    expect(postingAllows('fellows_only', 'moderator', 'discussion')).toBe(true)
  })

  it('validateMentions: only real member ids and the given link shape validate', () => {
    const ok = validateMentions('Salam [@A](/people/7) [@B](/people/bogus)', new Set([7]))
    expect(ok).toEqual({ mentioned: [7], invalid: ['/people/bogus'] })
  })
})
```

Run it, watch it fail on the missing module — the two-exit contract is `{ mentioned, invalid }`, and non-members and malformed links never validate. Keep the unit spec green through the whole task: `DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/unit/space-write.unit.spec.ts` shows only the int spec needing the DB.

- [ ] **Step 1: Write the failing int test**

Create `tests/int/spaces-write.int.spec.ts`. Reuse the fixture shape of `spaces-core` (people, course + enrollment + members, programme + membership, three spaces, mode `on`). Cases:

1. `postCreate` by a member writes a row with `author = personOf(user)`, `last_activity_at` set; stranger's create for a space they cannot read rejects `not-member` (return error objects, not throw — assert the shape).
2. Announcement: member's create returns `{ ok: false, error: 'announcement' }`; moderator's passes and arrives `pinned: true`.
3. Posting levels: `posting = 'members_comment'` → member's discussion create refuses `posting-level`; comment still allowed; `'fellows_only'` refuses both.
4. Read-only archive: set the space's course last meeting far in the past and `reopened: false` → any write refuses `read-only`; with `reopened: true` it passes. (Reopen is an admin-only field; test through `payload.update` with `overrideAccess`.)
5. Mentions: body contains `[Nadim](/people/999999)` (not a member) rejects `mention`. `[...](/people/{fellowPerson})` passes; stored verbatim.
6. Consent: with no consent row, member's create refuses `consent`; after the consent write passes.
7. Comment flows: commentCreate on a locked post refuses `locked`; nested replies beyond depth 2 return `depth`.
8. Reactions: reactionToggle twice — second call returns `{ ok: false, error: 'duplicate' }`; reactionToggle of another kind on same target coexists; remove returns `{ ok: true, removed: true }`.
9. Edit: `postEdit` by a non-author member refuses `not-yours`; by the author passes and stamps `edited_at` while also replacing versions (assert `findVersions` yields 2 versions after an edit); a moderator edits the space's intro post (author null) — `postEdit` permits the moderator's edit for the space's `introduction_post` only, and refuses other authorless posts.
10. Delete placeholder: `postRemove` by author on a post with a reply leaves the post with `deleted_at` set and its comments; on a post with no comments the row is gone. Comment placehoders follow the same rule.
11. Files: `fileAdd` for the 6th post file returns `{ ok: false, error: 'file-count' }`; 10.5 MB returns `file-type` (its mime recorded as type error only if mime also wrong — assert on the size branch `file-size`); a video mime returns `file-type`. Delete with the post removes the file rows.
12. Switch off: mode `off` rejects everything with `mode`.
13. REST refusals: `DELETE /api/space-files/{id}` (Payload REST, signed in as another member) is refused — `delete` is admin-only now; `DELETE /api/space-posts/{id}` on the author's own post (with a reply on it) is refused too — deletes belong to the actions, where counts, limits and placeholders live.

- [ ] **Step 2: Run — helpers missing. Write `src/lib/space-members.ts`**

```ts
import type { Payload } from 'payload'

/** The person who may be mentioned in one space: its members (spec §5). */
export const mentionSafelist = async (
  payload: Payload,
  spaceId: number,
): Promise<Set<number>> => {
  void payload
  void spaceId
  throw new Error('implemented with spaces.ts below (Step 3)')
}
```

- [ ] **Step 3: Write `src/lib/spaces-write.ts`**

Signature surface (keep exactly; the executor fills bodies mostly by composing `src/lib/spaces.ts`):

```ts
import type { Payload } from 'payload'

import type { User } from '@/payload-types'

export type WriteError =
  | 'mode' | 'not-member' | 'read-only' | 'posting-level' | 'announcement'
  | 'locked' | 'depth' | 'mention' | 'consent' | 'not-yours'
  | 'file-count' | 'file-size' | 'file-type' | 'duplicate' | 'space'

type Input<T> = { payload: Payload; user: NonNullable<User> } & T

export const postCreate = (i: Input<{ space: number; kind: 'discussion' | 'announcement'; body: string; files?: PostFile[] }>): Promise<WriteResult<{ id: number }>>

export type PostFile = { data: Buffer; mimetype: string; name: string; size: number }

export const postEdit = (i: Input<{ id: number; body: string }>): Promise<WriteResult<true>> // the author — or the space's moderator when the post IS the space's introduction_post
export const postRemove = (i: Input<{ id: number }>): Promise<WriteResult<true>>
export const postModify = (i: Input<{ id: number; pinned?: boolean; locked?: boolean }>): Promise<WriteResult<true>> // moderators
export const commentCreate = (i: Input<{ post: number; parent?: number | null; body: string; files?: PostFile[] }>): Promise<WriteResult<{ id: number }>>
export const commentEdit = (i: Input<{ id: number; body: string }>): Promise<WriteResult<true>>
export const commentRemove = (i: Input<{ id: number }>): Promise<WriteResult<true>>
export const fileAdd = (i: Input<{ post?: number; comment?: number; file: PostFile }>): Promise<WriteResult<{ id: number }>>
export const reactionToggle = (i: Input<{ post?: number; comment?: number; reaction: string; on: boolean }>): Promise<WriteResult<{ removed?: boolean }>>

// The small writes the pages and checklist need (Task 13 wires them):
export const consentAccept = (i: Input<Record<string, never>>): Promise<WriteResult<true>>
export const visitRecord = (i: Input<{ space: number }>): Promise<WriteResult<true>>
export const stepMark = (i: Input<{ space: number; step: StepKey; value: boolean }>): Promise<WriteResult<true>>
export const preferenceSet = (i: Input<{ digest: 'daily' | 'weekly' | 'off' }>): Promise<WriteResult<true>>
export const spaceSettingsSet = (i: Input<{ space: number; posting?: PostingLevel; reopened?: boolean }>): Promise<WriteResult<true>>
export type StepKey = 'saw_privacy' | 'introduced' | 'read_pinned' | 'checked_profile' | 'chose_digest'
export const spaceRoster = (
  i: Input<{ space: number }>,
): Promise<WriteResult<{ members: Array<{ personId: number; name: string; photo: { url: string; alt: string } | null }>}>>

export type WriteResult<T> =
  | { ok: true; data: T; notify?: (() => Promise<void>) | null }
  | { ok: false; error: WriteError; data?: { field?: string } }
```

Bodies follow the pattern below (shown for `postCreate`; the executor mirrors it for the rest). Rule order is fixed and meaningful — mode, membership, lifecycle, permission, content, consent:

```ts
const gate = async (payload: Payload, user: NonNullable<User>, spaceId: number) => {
  const settings = await spacesSettings(payload)
  if (mode(settings) === 'off') return { stop: true, error: 'mode', space: null as never }
  const space = (await payload.findByID({ collection: 'spaces', id: spaceId, depth: 0, overrideAccess: true })) as SpaceLike | null
  if (!space) return { stop: true, error: 'space', space: null as never }
  if (!spaceOpenOn(space, settings)) return { stop: true, error: 'mode', space: space as SpaceLike }
  return { stop: false, space: space as SpaceLike, settings }
}

// inside postCreate:
//   const g = await gate(...); if (g.stop) return err(g.error)
//   const membership = await membership(payload, user, g.space)
//   const last = await courseLastMeeting(course)
// const days = last ? differenceInCalendarDays(new Date(), new Date(last)) : null // date-fns; day-scale, matching the schedule's date strings
//   if (readOnly(g.space, last, days)) return err('read-only')
//   const start = mayStart(membership, kind, g.space.posting)
//   if (!start.ok) return err(start.error)
//   const mentioned = mentionPersonsOf(body)
//   if (!(await mentionSafelist(payload, spaceId)).isSuperset(mentioned)) return err('mention')
//   if (!(await consentOf(payload, user))) return err('consent')
//   counts: files whose mimetype is not in FILE_KINDS → 'file-type';
//           size > SPACE_FILE_LIMIT → 'file-size'; > 5 for a post → 'file-count'
//   then payload.create({ collection: 'space-posts', data, overrideAccess: true })
```

`mentionSafelist` (fill `src/lib/space-members.ts`), the same predicates as `readableSpaceIds` but for one space's member list, collecting person ids (fellows of the course + enrolled + programme memberships + community's everyone-with-person). Implement with the same `factsFor`/`membershipOf` pair over the one space, then turn the membership into people queries (this is the one place enumerating members is allowed, for validation — never for display).

One enumeration helper serves every shape: `space-members.ts` also exports `spacePeople(payload, spaceId, { select? })` — the space's person rows (id, name, slug, visible, photo, plus the account id where the person–user join exists) in one query path. `mentionSafelist` returns its ids; `spaceRoster` maps its name/photo; the post page's mention suggestions serialize its rows; `PostBody`'s people map (Task 9) and the announcement recipients' person→users dereference it. Four shapes, one source of truth — every shape derives from the same read rule, so its privacy can never drift from the space's.

Consent helper at the bottom of `spaces-write.ts`:

```ts
const consentOf = async (payload: Payload, user: NonNullable<User>) => {
  const { NOTICE_VERSION } = await import('@/lib/space-consent')
  return (await payload.count({ collection: 'space-consents', where: { and: [{ account: { equals: user.id } }, { version: { equals: NOTICE_VERSION } }] }, overrideAccess: true })).totalDocs > 0
}
```

Notifications inside the same actions — the bell only; emails land in step 3 (the announcement email) or with the digest job:

- **announcement** (postCreate): every member of the space, linked to the post. Enumeration for delivery is allowed (spec §8 names every member); implement with the `space-members.ts` person list → user ids.
- **mention** (postCreate, commentCreate): each person the body mentions, except the author.
- **comment** (commentCreate, no parent): the post's author, except self; the system intro post (author null) never notifies.
- **reply** (commentCreate with parent): the parent's author, except self.

Titles: automated notification titles are UI strings in a bilingual site, so they are never stored as prose — the write module hands `notify()` `title` as JSON `{ key, args }` (a next-intl key plus interpolations, e.g. the mention's actor name). The bell parses it (older straight-text kinds render as they always did) and renders through next-intl (Task 15's step 3). Links resolve through a `postLink(payload, locale, space, postId)` helper over the space's kind and its course/programme slug: `/{locale}/spaces/{kind}/{slug}/posts/{id}`, with community (no slug) as `/{locale}/spaces/community/posts/{id}`.

The small writes above, which Task 13's pages and checklist call: `consentAccept` writes the consents row for the current `NOTICE_VERSION` (unique on account+version; a duplicate reads as `{ ok: true }` — already accepted is success) **and stamps `saw_privacy: true` on that account's community-space visit row if unset**. The consents row is the single source of truth; the checklist step is a projection of it and is never asked separately. `visitRecord` upserts the visits row on its account+space unique. `stepMark` flips one checklist field on that row. `preferenceSet` upserts space-preferences with the digest and flips `chose_digest` on the caller's community-space visit row. `spaceSettingsSet` verifies the membership is a moderator, then updates the spaces row's `posting` and `reopened`. `spaceRoster` is the one member enumeration for display the spec permits — used inside the space page only (spec §2's header avatar group), through the same predicates as `space-members.ts`, restricted to people, never shown outside its space.

- [ ] **Step 4: Run the int spec, reconcile, commit**

```bash
pnpm payload generate:types
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/int/spaces-write.int.spec.ts
pnpm exec tsc --noEmit -p . && pnpm exec eslint src/lib/spaces-write.ts src/lib/space-members.ts
git add src tests
git commit -m "feat(spaces): every write through one module, rules in one order

Mode, membership, lifecycle, posting level, consent, mentions, files;
placeholders keep replies; announcements ring the bell (spec §§3, 5, 6,
9, 10). The actions are the only user-facing way in.

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

- [ ] **Step 5: `src/app/(frontend)/[locale]/spaces/actions.ts`**

Thin `'use server'` module: parses FormData (names: `space`, `kind`, `body`, `post`, `parent`, `reaction`, `on`, `file`, `step` (a `StepKey`), `value`, `accept`, `digest`, `posting`, `reopen`), converts `File` → the `PostFile` shape exactly as `src/app/(frontend)/[locale]/profile/actions.ts` does for the photo, calls the write module, and returns `{ ok: false, error }` or `revalidatePath` on success. Errors come back as keys; the pages map keys to next-intl strings.

- [ ] **Step 6: Migration checkpoint now that all collections are real**

Ask the user: "Please run `! DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:migrate:create spaces_core_tables`", read the SQL (**expected to be empty** — Task 7's `spaces_small` migration already created every table; if anything appears, report before applying), then "`! DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:migrate`", then "`! DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:migrate:create spaces_core_tables_check`" — expected no-op. Repeat-fix if not.

Commit:

```bash
git add src/app
git commit -m "feat(spaces): server actions for posting, comments, reactions

FormData in, error keys out; files convert like the profile photo; the
experience's deferred `notify` (announcement, mention, comment, reply)
is awaited on success; revalidatePath fires on write success.

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 9 — Rendering: Markdown bodies and mention chips

**Files:**
- Create: `src/components/space/post-body.tsx`
- Test: `tests/unit/post-body.unit.spec.tsx`

- [ ] **Step 1: Write the failing unit test**

```tsx
// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PostBody } from '@/components/space/post-body'

describe('post body rendering (spec §5)', () => {
  it('renders the editor's blocks and nothing else', () => {
    const { container } = render(
      <PostBody body={'# Title\n\n**bold** ~~gone~~ [site](https://cilas.org)\n\n<script>alert(1)</script>'} />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('bold')
    expect(container.querySelector('a[href="https://cilas.org"]')).toBeTruthy()
    expect(container.querySelector('h1')?.textContent).toBe('Title')
  })

  it('a /people/{id} link becomes a mention chip with the person's current name', () => {
    const { container } = render(
      <PostBody
        body={'Salam [@Nadim](/people/42)!'}
        people={{ 42: 'Nadim Id' }}
        peopleLinks={{ 42: '/en/people/nadim' }}
      />,
    )
    const chip = container.querySelector('a[href="/en/people/nadim"]')
    expect(chip?.textContent).toContain('@Nadim Id')
  })

  it('a person without a public page renders a plain chip, never a 404 link', () => {
    const { container } = render(
      <PostBody body={'Salam [@Yara](/people/43)'} people={{ 43: 'Yara' }} peopleLinks={{ 43: null }} />,
    )
    expect(container.querySelector('span.mention-chip')?.textContent).toContain('@Yara')
    expect(container.querySelector('a.mention-chip')).toBeNull()
  })

  it('a mention chip keeps dir="auto" like every post and name (spec §5)', () => {
    const { container } = render(<PostBody body={'عيد مبارك [@نديم](/people/42)'} people={{ 42: 'نديم' }} />)
    expect([...container.querySelectorAll('[dir="auto"]')].length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run — fail, then write the component**

`DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/unit/post-body.unit.spec.tsx`

`src/components/space/post-body.tsx`:

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Spec §5: `react-markdown`, allowed elements limited to what the editor
 * makes, `remark-gfm` for strikethrough only. `/people/{id}` links become
 * mention chips with the person's current name; other links open in a new
 * tab; raw HTML never renders (react-markdown default). Every block sits
 * with dir="auto".
 */
const ALLOWED = ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'strong', 'em', 'del', 'a', 'br'] as const

export type PostBodyProps = {
  body: string
  /** person id → current name, for chips (spec: chips show current names) */
  people?: Record<number, string>
  /**
   * person id → href or null. Person pages resolve by slug (and only when
   * the person is public), so the stored `/people/{id}` link renders as a
   * public-page link through this map when there is one, else as a plain
   * chip. The stored text never changes (spec §5).
   */
  peopleLinks?: Record<number, string | null>
}

export const PostBody = ({ body, people = {}, peopleLinks = {} }: PostBodyProps) => (
  <div className="space-y-3">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      allowedElements={[...ALLOWED]}
      unwrapDisallowed={false}
      components={{
        p: ({ children }) => <p dir="auto">{children}</p>,
        h1: ({ children }) => <h1 dir="auto">{children}</h1>,
        h2: ({ children }) => <h2 dir="auto">{children}</h2>,
        h3: ({ children }) => <h3 dir="auto">{children}</h3>,
        li: ({ children }) => <li dir="auto">{children}</li>,
        a: ({ href, children }) => {
          const text = `${children}` ?? ''
          if (href?.startsWith('/people/')) {
            const id = Number(href.split('/').pop())
            const to = peopleLinks[id] ?? null
            const chip = <span className="mention-chip" dir="auto">@{people[id] ?? text.replace(/^@/, '')}</span>
            return to ? <a href={to}>{chip}</a> : chip
          }
          return <a href={href} target="_blank" rel="noreferrer">{children}</a>
        },
      }}
    >
      {body}
    </ReactMarkdown>
  </div>
)
```

The caller (the space page / post page RSC) supplies `people` and `peopleLinks` from one query over the space's people (ids, names, slugs of public persons) — the chips stay current names, and a person without a public page renders a plain chip, never a 404 link.

- [ ] **Step 3: Verify, commit**

```bash
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/unit/post-body.unit.spec.tsx
pnpm exec tsc --noEmit -p . && pnpm exec eslint src/components/space/post-body.tsx
git add src/components/space tests/unit/post-body.unit.spec.tsx
git commit -m "feat(spaces): Markdown bodies render to the editor's blocks only

react-markdown with a closed element set and GFM strikethrough; /
people/{id} links become mention chips with current names; dir=
"auto" guides every block (spec §5).

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 10 — Arc copies: `reactions` and `page-header`

**Files:**
- Create: `src/components/arc/reactions/{reactions.tsx,reactions.module.css}`, `src/components/arc/page-header/{page-header.tsx,page-header.module.css}`
- Test: manual (component concerns; visuals checked by the pilot)

- [ ] **Step 1: `src/components/arc/reactions/reactions.tsx`**

Interactive (client), controlled entirely by props; no fetch inside:

```tsx
'use client'

import { useState, useTransition } from 'react'

export type ReactionKind = 'agree' | 'thank_you' | 'insightful' | 'same_question'

export const REACTION_KINDS: ReactionKind[] = ['agree', 'thank_you', 'insightful', 'same_question']

export type ReactionCounts = Partial<Record<ReactionKind, number>>
export type ReactionNames = { [K in ReactionKind]?: string[] } | Record<string, never>

export type ReactionsProps = {
  counts: ReactionCounts
  names?: ReactionNames
  mine?: ReactionKind[]
  labels: Record<ReactionKind, string>
  /** Over a row, or long-press, names show (spec §4). */
  onToggle: (kind: ReactionKind) => void
  busy?: boolean
}

/**
 * Arc `reactions`: the four space reactions as chips (Agree = thumbs up,
 * Thank you = heart, Insightful = lightbulb, Same question = hand), counts
 * and names, no points and no "seen by" (spec §4). Hover shows names.
 */
export function Reactions({ counts, names = {}, mine = [], labels, onToggle, busy = false }: ReactionsProps) {
  const [hovering, setHovering] = useState<ReactionKind | null>(null)
  return (
    <div className={WRAPPER.className} data-busy={busy}>
      {REACTION_KINDS.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={mine.includes(k)}
          className={CHIP.className}
          data-on={mine.includes(k)}
          onMouseEnter={() => setHovering(k)}
          onMouseLeave={() => setHovering(null)}
          onClick={() => onToggle(k)}
        >
          <span aria-hidden>{ICON[k]}</span>
          <span className="count">{countOf(counts, k)}</span>
          <span className="sr-only">{labels[k]}</span>
          {hovering === k && (names[k]?.length ?? 0) > 0 && ( <span role="tooltip" className={NAMES.className}>{names[k]!.join(', ')}</span> )}
        </button>
      ))}
    </div>
  )
}

const countOf = (counts: ReactionCounts, k: ReactionKind) => { const n = counts[k]; return Number(n ?? 0) }

const ICON: Record<ReactionKind, string> = { agree: '👍', thank_you: '❤️', insightful: '💡', same_question: '✋' }
```

Use CSS modules like other Arc copies (import `styles from './reactions.module.css'` and replace the placeholder `CLASS` members — `WRAPPER`/`CHIP`/`NAMES` — with `styles.wrapper`, `styles.chip`, `styles.names`). Give the module real styles: `chip` as pill (border, rounded-full, text-xs, gap-1), `data-on` fills the accent, `names` an absolutely-positioned card. Icons may be the glyph text above or the lucide set the other copies use — match the closest existing copy (`avatar` or `chip-group`).

- [ ] **Step 2: `src/components/arc/page-header/page-header.tsx`**

Spec §2: takes props (breadcrumb, badge, members, progress, tabs, actions) and folds on window scroll — the header slims to its first row while the page scrolls. Server-safe core + a small client fold wrapper:

`page-header.tsx` ('server component by default, no directive'):

```tsx
import Link from 'next/link'

import { Breadcrumb } from '@/components/arc/breadcrumb/breadcrumb'
import { Badge } from '@/components/arc/badge/badge'
import { AvatarGroup } from '@/components/arc/avatar-group/avatar-group'
import { Fold } from './fold'

export type PageHeaderProps = {
  breadcrumb: { label: string; href?: string }[]
  badge?: { text: string; tone?: 'success' | 'muted' }
  title: string
  members?: { name: string; src?: string | null }[]
  progress?: { done: number; total: number; label?: string }
  tabs?: { key: string; label: string; count?: number }[]
  activeTab?: string
  actions?: React.ReactNode
}
```

Layout: two rows — row 1 breadcrumb + badge + actions; row 2 title + avatars + progress + tabs. `<Fold>` (client, `useState` for `folded`, one `window.scrollY` listener with a 12px threshold) toggles `folded` on the root and passes both variants to `page-header.module.css`. Reuse the existing Arc `breadcrumb`, `badge`, `avatar-group`, `tabs` components; do not reimplement them.

- [ ] **Step 3: Commit**

```bash
pnpm exec tsc --noEmit -p . && pnpm exec eslint src/components/arc/reactions src/components/arc/page-header
git add src/components/arc src/components/space
git commit -m "feat(spaces): Arc copies, reactions and the folding page header

reactions: the four, counts plus names on hover, no points (spec §4).
page-header: props for breadcrumb, badge, members, progress and tabs;
folds to its first row on window scroll (spec §2).

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 11 — The editor's @ trigger and comments with reactions

**Files:**
- Modify: `src/components/arc/rich-text-editor/rich-text-editor.tsx` (the seam is the existing `slash` machinery, lines ~1147–1950)
- Modify: usage-level only, the composer's comment thread (Task 14 wires it)
- Test: `tests/unit/mention-trigger.unit.spec.ts`

- [ ] **Step 1: The failing unit test** (exports the editor's internal mention math only)

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { insertMentionMarkdown } from '@/components/arc/rich-text-editor/rich-text-editor'

describe('the @ member trigger (spec §5)', () => {
  it('a chosen member inserts [@Name](/people/{id}) at the caret', () => {
    const md = 'Salam [@Nadim Id](/people/42)! hello'
    expect(insertMentionMarkdown('Salam @nad hello', 7, { id: 42, name: 'Nadim Id' })).toBe(md)
  })
})
```

- [ ] **Step 2: Wire the trigger — minimal, mechanical generalization of the slash path**

The editor sits at ~2,600 lines and must not climb. First **extract** the slash menu's state, detection, results, keyboard block and panel JSX from `rich-text-editor.tsx` into a sibling `slash-trigger.tsx` (behavior-preserving; `rich-text-editor` consumes it — a manual open-and-choose run in `pnpm dev` proves the fold). Then the slash menu is typed as `type Slash = { node: Text; offset: number; query: string }` (check the exact name in the file, grep `type Slash` — it sits near line 911). Do not fork the machinery; **generalize it**:

1. Grep the seams: `type Slash` (type def, ~911), `open.node.data[open.offset] === '/'` (detection, ~1303), `data !== '/'` (key listener, ~1483), `slashResults` (list computed ~1515), `chooseSlash` (insert), keydown block (~1935).
2. Rename nothing. Add a parallel detection for `@` in the same `beforeinput`/keydown path: track `mention: Slash | null` state beside `slash`, exactly mirrored (state, ref, `setMention`, indices).
3. `mentionSuggestions?: { id: number; name: string }[]` on `RichTextEditorProps` (and `mentionOpenLabel?: string`). The suggestion list filters by the mention query text, exactly as `slashResults` does for blocks.
4. `chooseMention(person)`: nothing exotic — splice the raw text: replace `/@<query>$/` before the caret with `insertMentionMarkdown(before, caretIndex, person)`'s product, as one text delta via the same editor API `chooseSlash` uses for block insertion. Gold rule: on insert, `[@Name](/people/{id})` must be exactly what the markdown export emits — assert with the unit test's shape.
5. Add `insertMentionMarkdown` as a pure exported helper (the unit test drives its shape).
6. On member select from the panel: closes, restores focus, inserts. / people rows render as `@`-prefixed rows from the panel's `mentionSuggestions`, presented in the same positioning the slash panel has (reuse the same panel JSX fork the slash menu renders when `mention` is open — do not fight the CSS).

Playable-Space note: `RichTextMentionSuggestion` doesn't exist anywhere; the plan does not conjure a parallel menu system. The single `Slash` type mutates only enough to drive both.

- [ ] **Step 3: comment-thread is not used by spaces — no changes**

Spaces render their own thread in Task 14 (`comment-thread-space.tsx`); arc's `comment-thread.tsx` (its own `CommentReaction` model at line 29, the `reactions` prop at ~146) stays untouched — a customization feeding nothing is dead code.

- [ ] **Step 4: Verify, commit**

```bash
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/unit/mention-trigger.unit.spec.ts
pnpm exec tsc --noEmit -p . && pnpm exec eslint src/components/arc/rich-text-editor src/components/arc/comment-thread
git add src/components/arc tests/unit/mention-trigger.unit.spec.ts
git commit -m "feat(spaces): the editor learns @; comment-thread drives our four

Same slash mechanics, second trigger: @ proposes space members and
inserts [@Name](/people/{id}) text (spec §§4–5).

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 12 — Page queries (`src/lib/spaces-data.ts`)

Pure Payload reads driving every page. Headless, so the int spec exercises them.

**Files:**
- Create: `src/lib/spaces-data.ts`
- Test: extend `tests/int/spaces-core.int.spec.ts`

- [ ] **Step 1: Surface (implement with the membership layer)**

```ts
import type { Payload } from 'payload'

import type { Space, User } from '@/payload-types'
import type { SpacesSettings } from '@/lib/spaces'

export type SpaceSummary = {
  space: Space
  title: string          // community: its seed label; course: the course title; cohort: the programme title
  href: string           // /{locale}/spaces/course/{slug}; cohort/{pSlug}; community → /{locale}/spaces/community
  unread: number         // posts since last_visited_at minus own posts
  lastActivity: string | null
}

export const mySpaces = (payload, user, locale): Promise<{ community: SpaceSummary | null; cohorts: SpaceSummary[]; courses: SpaceSummary[] }>

export type FeedRow = {
  post: Post
  authorName: string | null   // null → "CILAS" (intro post)
  commentCount: number
  reactions: { counts: ReactionCounts; mine: ReactionKind[] }
}

export const spaceFeed = (payload, user, space): Promise<{ rows: FeedRow[]; settings: SpacesSettings; archived: boolean; lastMeeting: string | null; daysSince: number | null }>
// Freshness comes from the pages' 30-second refresh (spec §Updates): a
// client `live-refresh.tsx` calls router.refresh() every 30 s while the tab
// is visible; the feed itself is a plain RSC read.

export const spaceLanding = (payload, user, kind, slug): Promise<{ space; course?: Course; programme?: Programme } | null> // null when the space does not exist or the switch keeps it closed
```

Implementation notes, fixed: the feed reads `{ 'deleted_at': { exists: false } }`, sorts `{ pinned: 'desc', last_activity_at: 'desc' }` with `depth: 1` for authors; `spaceLanding` resolves kind → collection/relations and checks `spaceOpenOn` on the row with the stored settings; every call reuses `readableSpaceIds` **once** (not per row) and filters in-memory before returning. A page render still evaluates each collection's access rule separately (posts, comments, files, reactions), so `src/lib/spaces.ts` memoizes `spacesSettings` + `readableSpaceIds` per request with React's `cache` — one settings read and one spaces read per render, not five.

The participation summary query for moderators, exported here too (Task 14 renders it):

```ts
export const participation = (payload, space): Promise<Array<{ personId: number; name: string; posts: number; comments: number; reactions: number; lastVisit: string | null }>>
```

Aggregate in memory (small spaces): total rows × few hundred tops; no warehouse in step 1.

- [ ] **Step 2: Extend the int spec on my-spaces behavior**

Assert: student sees community + course + cohort summaries; unread counts only rows newer than their visit timestamps (`space-visits` rows written by Task 13's action); archived excluded from the top list and surfaced `archived` (the test sets the course meeting 30 days past, sees `archived` true, then `reopened: true` sees false).

- [ ] **Step 3: Verify, commit**

```bash
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/int/spaces-core.int.spec.ts
pnpm exec tsc --noEmit -p . && pnpm exec eslint src/lib/spaces-data.ts
git add src/lib/spaces-data.ts tests
git commit -m "feat(spaces): page queries — my spaces, feeds, landing, participation

The feed hides deleted rows and sorts pinned first; the landing checks
 the switch; counts reuse one readableSpaceIds call; the participation
 summary aggregates in memory for moderators (spec §§2, 7, 13).

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 13 — Pages: guard, "My spaces", the space page

**Files:**
- Create: `src/app/(frontend)/[locale]/spaces/layout.tsx`, `page.tsx`, `[kind]/[slug]/page.tsx`, `community/page.tsx` (spec §2's `/{locale}/spaces/community` — one segment, no slug; a one-line render of the same `SpacePage` component), `src/components/space/{feed-row.tsx,comment-body.tsx,composer.tsx,space-page.tsx,onboarding-checklist.tsx,consent-sheet.tsx,live-refresh.tsx,participation-summary.tsx}`
- Modify: messages files
- API: `src/app/(frontend)/[locale]/spaces/actions.ts` already holds `consentAccept`, `visitRecord`, `stepMark`, `preferenceSet`, `spaceSettingsSet` (Task 8)

- [ ] **Step 1: The guard layout**

```tsx
import { notFound, redirect } from 'next/navigation'
import { currentReader } from '@/lib/reader'
import { spacesSettings, mode } from '@/lib/spaces'

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> }

/**
 * Signed-in area, noindex. Off: space pages return not found (spec §10) —
 * refusal, not a detour.
 */
export default async function SpacesLayout({ children, params }: Props) {
  const { locale } = await params
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/spaces`)}`)
  const settings = await spacesSettings(await getPayload({ config: (await import('@payload-config')).default }))
  if (mode(settings) === 'off') notFound()
  return (
    <main className="prose-layout" data-page="spaces">
      {children}
    </main>
  )
}
```

Adapt imports to the repo's current patterns (`getPayload` and `currentReader` exactly as `profile/page.tsx` does). Every page under it adds `generateMetadata` with `robots: { index: false }` (match profile/page.tsx).

- [ ] **Step 2: `/{locale}/spaces` — My spaces (spec §2)**

RSC page over `mySpaces()`. Each summary row: title (course/course title, cohort/programme title, community fixed label), unread dot or count, last activity relative time; archived course spaces list last. Links a signed-in member to "Write an article" (everyone) and "Propose a course" (fellows) — footer links, next-intl keys from `Spaces` namespace.

- [ ] **Step 3: `/{locale}/spaces/[kind]/[slug]` — the space page**

`kind` ∈ `community | course | cohort`; `slug` matches the related document's slug (a space has none of its own). Sequence:

1. `spaceLanding()` → not found page when null.
2. Membership via `membership()`; `none` → the same not-found page (never "who belongs"; spec §9).
3. `spaceFeed()`; read-only from the feed package (`archived`).
`[kind]/[slug]/page.tsx` and `community/page.tsx` render ONE `SpacePage` (`src/components/space/space-page.tsx`) — the route files differ only in reading two params vs resolving the community row (`kind: 'community'`).
4. Header: `<PageHeader>` from Task 10, breadcrumb (My spaces → space), status badge (Open / Read-only archive), member avatars via Task 8's `spaceRoster` (names and photos, in-space display only; small N), course progress for course spaces (from the schedule util the CourseView uses — grep it), tabs (All / Announcements / with counts; Questions appears in step 2), actions: New post, and posting-level/reopen Settings for moderators wired to `spaceSettingsSet`.
5. `<OnboardingChecklist>` when steps are unfinished (`src/components/space/onboarding-checklist.tsx`, created in this task's Files list — no Arc copy exists for it): five marks, each opens the right surface — privacy (consent-sheet), introduce (opens the intro post composing), pinned (scrolls to it), profile (link to `/{locale}/profile`), digest (opens the digest selection inline). Writing marks goes through the checklist action; hidden at members' will; never gates the space (spec §2).
6. `<ConsentSheet>` when no consent for the current version (spec §9): blocks the *composing only* until accepted; reading proceeds. The acceptance action is Task 8's `consentAccept`.
7. Feed: pinned announcements first (the intro post previews pinned-text first), then `last_activity_at` desc. `FeedRow` uses `PostBody`, reactions, comment count, file badges; per row, an onClick target for the post page route. Freshness (spec §Updates: the page checks for new posts every 30 seconds while open): `src/components/space/live-refresh.tsx`, a client component on the page calling `router.refresh()` every 30 s while `document.visibilityState === 'visible'`; the space and post pages both mount it.
8. `<ParticipationSummary>` for moderators only (spec §13: members never see others' numbers): `sortable-data-table` with Posts/Comments/Reactions/LastVisit columns.
9. `<Composer>` (client, Arc rich-text-editor + file-dropzone): the only way to write; disabled under read-only; the announcement kind available to moderators only; files convert files like Task 8's action.

- [ ] **Step 4: Visit tracking + digest-choice recording**

`visitRecord` runs at the END of the page's data work, awaited: the reads happen first (mySpaces/feed compute `unread` against the stored `last_visited_at`), then one awaited upsert stamps it to now. Never fire-and-forget during render — a runtime restart drops the write, and the pilot's "unread counts move" criterion depends on it. (Awaited; one indexed upsert per load is cheap at pilot scale.) `preferenceSet` upserts `space-preferences` and flips `chose_digest` on the community space-visits row of the caller.

Int test (extend `tests/int/spaces-core.int.spec.ts` with two assertions): a visit row upsert is idempotent; a `space-preferences` row's `digest` value round-trips.

- [ ] **Step 5: Wire the compositional metadata strings**

Add to `messages/en.json` (top level), `messages/ar.json` mirrors with Arabic text:

```json
"Spaces": {
  "metaTitle": "My spaces — CILAS",
  "title": "My spaces",
  "community": "Community space",
  "cohort": "Cohort space",
  "course": "Course space",
  "writeArticle": "Write an article",
  "proposeCourse": "Propose a course",
  "notFound": "This space is not open.",
  "unread": "New since your last visit",
  "yesterday": "Yesterday",
  "open": "Open",
  "archived": "Read-only archive",
  "settingsForModerator": "Space settings",
  "posting": "Posting level",
  "reopen": "Reopen this archive",
},
"SpacePost": {
  "newPost": "New post",
  "write": "Post",
  "announcement": "Announcement",
  "discussion": "Discussion",
  "edited": "edited",
  "bySystem": "CILAS",
  "locked": "Locked",
  "readOnlyNotice": "This space is archived and read-only.",
  "placeAnnouncementLabel": "Announcement — notifies every member",
  "filesDrop": "Add files",
  "maxFiles": "Up to 5 files for a post",
  "saveError_mode": "Spaces are off right now.",
  "saveError_not_member": "Only members post here.",
  "saveError_read_only": "This space is read-only.",
  "saveError_posting_level": "Your posting level does not allow this here.",
  "saveError_announcement": "Only moderators post announcements.",
  "saveError_locked": "This post is locked.",
  "saveError_depth": "Replies go two levels deep at most.",
  "saveError_mention": "You can mention members of this space only.",
  "saveError_consent": "Accept the privacy notice first.",
  "saveError_not_yours": "You can edit only your own.",
  "saveError_file_count": "Too many files.",
  "saveError_file_size": "A file is too large.",
  "saveError_file_type": "A file type is not allowed.",
  "saveError_duplicate": "You already posted this.",
  "saveError_space": "This space does not exist."
},
"SpaceComment": { "write": "Comment", "reply": "Reply", "filesDrop": "Add a file", "maxFiles": "One file per comment", "deleted": "Deleted by its author" },
"SpaceConsent": { "title": "Spaces and your privacy", "accept": "I understand, publish", "decline": "Not now" },
"SpaceChecklist": { "title": "First steps here", "accept": "Accept the privacy notice", "introduce": "Introduce yourself", "readPinned": "Read the pinned announcement", "checkProfile": "Check your name and photo", "digest": "Choose your email digest", "hide": "Hide" },
"Participation": { "title": "Participation", "member": "Member", "posts": "Posts", "comments": "Comments", "reactions": "Reactions", "lastVisit": "Last visit" }
```

Don't ship `metaDescription: null` — every string is real prose. People names in the participating table test with both locales; the notice body constant lives **only** in `src/lib/space-consent.ts` (`NOTICE[locale]` — it stays out of `messages` so there is one source). The write module returns the raw code (`not-member`); pages render `saveError_` + code with `-` → `_`, so a renamed code fails loudly as a missing key, never as silence.

Validate the JSON with the ground-rule one-liner, then commit:

```bash
pnpm exec tsc --noEmit -p . && pnpm exec eslint src/app src/components/space
git add src messages
git commit -m "feat(spaces): the signed-in area opens — my spaces, the space page

Layout guard (sign-in, noindex, Off), my-spaces summaries with
unread counts and archived rows; space pages over page-header with
feed, checklist, consent, moderation settings, and participation
for moderators (spec §§2, 9, 13).

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 14 — The post page, comments thread, reactions wiring

**Files:**
- Create: `src/app/(frontend)/[locale]/spaces/[kind]/[slug]/posts/[id]/page.tsx`, `src/app/(frontend)/[locale]/spaces/community/posts/[id]/page.tsx` (the community post route — `postLink` yields it; the file renders the same view, resolving the community space by kind), `src/components/space/{comment-thread-space.tsx,delete-hold.tsx}` — and `comment-body.tsx` (Task 13's mentions-only renderer) travels with the post page where the thread mounts.
- Modify: `src/lib/spaces-data.ts` (adds `postView`), `messages/{en,ar}.json`

- [ ] **Step 1: The post page**

`generateMetadata` → noindex. Load the post plus comments via `spaces-data` (Modify: `src/lib/spaces-data.ts` adds `postView`):

```ts
export const postView = (payload, user, postId): Promise<null /*not-visible-and-not-yours*/ | {
  post: FeedRow & { pinned?: boolean; locked?: boolean }
  comments: Array<{ id: number; body: string; authorId: number; authorName: string; parent: number | null; file?: { url: string; filename: string; size: number } | null; replies: number[]; deleted: boolean }>
  files: Array<{ id: number; url: string; filename: string; size: number }>
  canComment: boolean
  deleted: boolean
}>
```

Not-visible → `notFound()`. Members who can't comment still read (posting level). Deleted author-row show placeholders (spec §3): the body is replaced by the deleted notice with replies intact. Mount `live-refresh` (Task 13) here too.

- [ ] **Step 2: `src/components/space/comment-thread-space.tsx`**

A thin server-rendered list + a client composer per depth-0 comment (reply cap 2, per spec §4's `maxDepth`), each thread row rendering its body through `comment-body.tsx` — a tiny renderer: plain text with mention chips only (comments are not markdown; `PostBody` is the posts' renderer and would carry heading/bold/links a comment must not render) — the comment's own file chip, reactions per comment via Task 10's `<Reactions>` and, for the composer, Arc's `mention-input` (props: suggestions = `spacePeople` rows serialized down — fetched once in the RSC via Task 8's helper). `delete-hold.tsx` is the hold-to-confirm Arc component inline (spec §3, delete with replies → placeholder).

- [ ] **Step 3: Reactions wiring through the actions**

Each `<Reactions>` places `reactionToggle` via `startTransition`, optimistic local state, optimistic rollback on the error key. Comment counts and highlight counts not in this step (highlights land in step 2).

- [ ] **Step 4: Int test additions to `spaces-write` (Task 8)** around postView(null on unauthorized), then:

```bash
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/int/spaces-core.int.spec.ts tests/int/spaces-write.int.spec.ts tests/int/teaching.int.spec.ts tests/int/profile.int.spec.ts
pnpm exec tsc --noEmit -p . && pnpm exec eslint src
git add src messages
git commit -m "feat(spaces): the post page — comments, replies, per-row reactions

Flat replies capped at 2 in the composer, mention-input for members in
 the same space, hold-to-confirm deletes leaving placeholders with the
replies, and optimistic reactions posting through the actions (spec §4).

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 15 — Entry points: header, course link, notification labels

**Files:**
- Modify: `src/components/site-header.tsx`, `src/components/site-notifications.tsx`, `src/app/(frontend)/[locale]/study/[slug]/CourseView.tsx`, `messages/{en,ar}.json`

- [ ] **Step 1: The Spaces link with its dot (spec §2)**

In `site-header.tsx`, beside the existing `SiteNotifications` render (line ~216): a header link "Spaces" to `/${locale}/spaces`, `<Link>` with `aria-label` from messages. Bare bones: the link's parent server component (where `site-header` is rendered) passes `spacesOpen = mode(settings) !== 'off'` as a prop, and the link renders only while `account` is truthy **and** `spacesOpen` is true — links disappear in Off per spec §10. The dot: a tiny client component `src/components/space/spaces-dot.tsx` polling `/api/notifications?where={"read_at":{"exists":false},"kind":{"in":["mention","comment","reply","announcement"]}}&limit=1&depth=0` once on load and every 60 s alongside the existing component's own poll — rendering a `●` when `totalDocs > 0`. Relay the dot's presence state via a `hidden` class; not `title`. Keep both signals's weights visually distinct (a small dot ≠ the bell's badge).

- [ ] **Step 2: The account menu's "Spaces" item** under `Header.profile` in both messages files — the same `t('spaces')` string, listed in the user menu beside Profile.

- [ ] **Step 3: Tones for the new kinds** in `site-notifications.tsx`: first widen `Stored['kind']` (the `TONES: Record<Stored['kind'], …>` type will not compile with unknown keys), then extend `TONES` — `mention: 'info'`, `comment: 'info'`, `reply: 'info'`, `announcement: 'success'` (moderation/report tones arrive with step 3, harmless to add: both `'warning'`). In the bell's item rendering, `JSON.parse` a `title` that starts with `{` and render `t(key, args)`; plain strings render as they always did (Task 8's write module stores the new kinds as `{key,args}`).

- [ ] **Step 4: "Open the course space" on a course page (spec §2)**

In `CourseView.tsx` (the red file's course header block), serverside: when the reader can read the course's space (query `spaces` by course, then `readableSpaceIds` contains it — the same lib calls the space page makes) and the switch permits, render a link next to the other course actions. Not found → nothing at all renders. Localized strings from `Spaces.openCourse`.

- [ ] **Step 5: Check, commit**

```bash
pnpm exec tsc --noEmit -p . && pnpm exec eslint src
git add src messages
git commit -m "feat(spaces): ways in — header link with an unread dot, course link, kinds

The Spaces link shows for signed-in members and lights when unread
announcements or mentions wait; the course page links its own space
for members; the notification center knows the new tones (spec §2, 8).

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```
- [ ] **Step 5: Sign-in lands right (spec §2)**

`src/app/(frontend)/[locale]/login/page.tsx` defaults every sign-in to `/admin` today (`safeNext(query.next ?? '/admin')`). Spec §2: no `next` param → members go to **My spaces**, admins keep `/admin` (with an explicit `next`, both keep it). One default change + a re-test of the redirect chain (the layout guard already sends the `next` back).

---

# Task 16 — The seed: the community space

**Files:**
- Create: `seed/collections/spaces.seed.ts`
- Modify: `seed/index.ts`, `seed/seed.type.ts`, `seed/seed.utils.ts`
- Test: covered by the int suite (the community space appears)

- [ ] **Step 1: `seed/collections/spaces.seed.ts`**

Follow `seed/collections/places.seed.ts`'s shape. It creates the community space **and its intro post**, then links them (`introduction_post`), only when a community row is missing:

```ts
export const seedSpaces = async (payload: Payload) => {
  /* find 'community' → getOrCreate: create row → create the intro post
     (body: the INTRO exported from @/lib/space-hooks — one literal, two
     users) → link introduction_post, idempotent like getOrCreateId */
}
```

- `seed/seed.utils.ts`: extend `CONTENT_COLLECTIONS` with the new slugs, ordered so deletes respect relationships — reaction/file/consent/visit/preference rows first, then comments, posts, and finally the `spaces` rows themselves.
- `seed/index.ts`: import and call `seedSpaces` right after `seedPlaces` — nothing in it depends on other content collections.

- [ ] **Step 2: Full seed run + smoke**

Ask the user: "Please run `! DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm db:seed`" — **mandatory, not cosmetic**: the seed re-runs `payload.create` on course/programme rows, and those publishes now fire the Task 4 hooks; that is the backfill that gives already-published pilot courses their spaces. (`seed/index.ts` also wipes and re-creates the content collections, so without the prefix this command targets production content — the Task 0 structural guard refuses; the prefix stays mandatory.) Then check the seeded output: one community space, its intro post linked, and the pilot course's space present.

Commit:

```bash
git add seed
git commit -m "feat(spaces): the community space in the seed, with its intro post

Created by seed, like the spec §1 rule: course and cohort spaces come
from hooks, one community row from the seed, settings live on rows,
members never do.

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

# Task 17 — Step 1 verification and the pilot setup

- [ ] **Step 1: Everything green**

```bash
export DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev
pnpm exec tsc --noEmit -p .
pnpm exec eslint src seed tests
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/unit
DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev pnpm exec vitest run --config ./vitest.config.mts tests/int/spaces-core.int.spec.ts tests/int/spaces-write.int.spec.ts tests/int/publishing.int.spec.ts tests/int/teaching.int.spec.ts tests/int/profile.int.spec.ts
```

Expected: unit suite green; every numbered int spec green. The `publishing.int.spec.ts` failures of 2026-10-23 (five, listed in the ground rules) are not among the numbered files; reclassify them at this gate since every numbered spec must pass.

- [ ] **Step 2: Nothing else broke in the admin**

Hand-check in `pnpm dev` (`.env.local` points it at the local database): Site settings shows the Spaces tab with Off; spaces collection lists with mode On showing the seeded community row; notification enum lists six kinds beyond the five.

- [ ] **Step 3: Remaining hard checks from the spec's "Open checks"**

- The Radix Questionnaire question (shadcn command) is **step 3** — leave the note in the spec, nothing to do here.
- `findVersions` edit history: decided — versions on, drafts off (`versions: { drafts: false }`); moderators' read path lands with its UI in step 3.

- [ ] **Step 4: The pilot switch**

Ask the user to flip Site settings → Spaces to **Trial**, tick the pilot course and the community checkbox, then open `/{locale}/spaces` signed-in as the pilot course's student: expected my-spaces list with exactly community + the pilot course, both opening, the intro post present, posting and commenting working, the bell landing a mention and an announcement, and "My spaces" unread counts moving after a visit.

Report the pilot's result back to the user in plain language for their go/no-go on widening (spec §13: a human decision on the report — that decision is the pilot's own end, not a gate for merging the code).

- [ ] **Step 5: Close out**

Tick every `- [ ]` in this file that its task completed (leave the ones a reviewer changed into `- [x]`), then:

```bash
git add docs/superpowers/plans/2026-10-22-spaces-step-1-core.md
git commit -m "docs(spaces): step 1 core complete, pilot on Trial with one course

Co-Authored-By: GLM 5.3 Flash <noreply@opencode.ai>"
```

---

## What this step deliberately leaves for later steps

- **Step 2 (Learning):** question kind UI, highlights, reply-first, intro-post prompt as default (editable by moderators — arrived already), anonymity on questions, search (`pg_trgm`).
- **Step 3 (Care and reach):** hide, mute, reports in Admin → Reviews, thread delete by moderators, 30-day purge job, moderators' edit-history UI, the announcement email (Task 4's `announcement_email_sent` waits for it), email digests at 08:00 Cairo, data download and delete, the pulse questionnaire and its report (loads the dataviz skill), moderation/report notification tones in the bell UI.
- **Later:** weekly prompts, session threads, polls, summary posts, thread-to-article, cross-space search, web push, Women's Studies and Residency cohort spaces.

