# People and Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate public `people` from login `users`, add `memberships`, point fellows and governance at people, rename the `ciliasian` role to `member`, and fix the course-ownership access bug.

**Architecture:** A new `people` collection holds every public profile. `users` keeps only authentication, roles, and an optional `person` link (ADR 0001). Ownership checks go from `req.user.person` to the document's people fields. The `fellow` role is synced to whichever user is linked to a person who teaches a course. Reverse lists (courses taught, memberships, board terms) are Payload `join` fields, not afterRead hooks.

**Tech Stack:** Payload 3.90.2, Postgres adapter (`push: true` in dev), Next 16, vitest (unit + int), pnpm.

**Spec:** `docs/schema.md` (People section), `CONTEXT.md` (Person, User, Fellow, CILASian, Membership), `docs/adr/0001-people-separate-from-users.md`.

---

## Roadmap (this is plan 1 of 6)

Each plan ships working software on its own and is written just before it starts:

1. **People and identity** (this plan)
2. Shared shapes: `schedule` + `expandSchedule()`, `registration`, `pricing` (ADR 0002)
3. Time, place and teaching: spaces, cycles, programmes, courses, enrollments (ADR 0003)
4. Publishing: articles review, credits, publications, press, partners, events, newsletters, email adapter (ADR 0005)
5. Plugins: redirects and SEO
6. Archive import pipeline (ADR 0004)

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/access.ts` | modify | `Ownership` type, `personOf`, fixed `isAdminOrOwnAndDraft`, `readTiers` |
| `src/fields/social.ts` | create | Shared social-link fields and URL validator |
| `src/lib/fellow-role.ts` | create | Fellow-role rules shared by course and user hooks |
| `src/collections/People.ts` | create | Public profiles, with joins to courses, memberships, governance |
| `src/collections/Memberships.ts` | create | A person's role in a programme |
| `src/collections/Users.ts` | modify | Auth, roles and `person` only, plus the link hook |
| `src/collections/Courses.ts` | modify | `fellows` → people; hooks use `src/lib/fellow-role.ts` |
| `src/collections/Governance.ts` | modify | `person`, `title`, terms, `order` |
| `src/collections/Events.ts` | modify | `fellows` → people (reshaped later, in plan 4) |
| `src/payload.config.ts` | modify | Register People and Memberships |
| `seed/*` | modify | Seed people and link users |
| `tests/unit/access.unit.spec.ts` | create | Ownership and tier rules |
| `tests/unit/fellow-role.unit.spec.ts` | rewrite | Course hooks keyed by person |
| `tests/unit/user-link.unit.spec.ts` | create | Linking a user to a person syncs `fellow` |
| `tests/int/people.int.spec.ts` | create | Joins and the membership unique index against Postgres |
| `tests/int/seed-localization.int.spec.ts` | rewrite | Locale passes now write to people |

---

### Task 0: Preflight

**Files:** none

- [ ] **Step 1: Make sure the working tree is clean**

Run: `git status --short`
Expected: no output. If `seed/*`, `CourseView.tsx` or `study-filters.tsx` show as modified, **stop and ask the owner** to commit or stash that work-in-progress first. Every later task edits `seed/*`.

- [ ] **Step 2: Record the baseline**

Run: `pnpm test:int`
Expected: all tests pass. If any fail, write down which ones before continuing so they aren't blamed on this plan.

- [ ] **Step 3: Record the type-check baseline**

Run: `pnpm exec tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: a number. Save the full output to the scratchpad. Later "no errors" checks mean "no errors beyond this baseline".

> **Database warning.** `DATABASE_URL` points at a remote Neon database, and `push: true` syncs the schema whenever Payload boots (int tests, `pnpm dev`, seeding). From Task 2 to Task 9 the schema drops user columns and renames an enum value. A push like that asks for interactive confirmation and may abort or exit when there's no terminal. **Don't boot Payload against the database between Task 2 and Task 10.** Only `pnpm generate:types`, `tsc` and the unit tests are safe, because they don't connect. Task 10 rebuilds the database in one step, after the owner confirms it is disposable.

---

### Task 1: Fix the course-ownership bug

`isAdminOrOwnAndDraft` returns `owned(req.user) && { _status: … }`. A Where object is always truthy, so the expression evaluates to just `{ _status: { equals: 'draft' } }`. The ownership constraint is dropped, and **any fellow can update or delete any draft course**.

**Files:**
- Modify: `src/access.ts`
- Create: `tests/unit/access.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/access.unit.spec.ts`:

```ts
import type { Access } from 'payload'
import { describe, expect, it } from 'vitest'

import { isAdminOrOwnAndDraft, ownsViaFellows, readTiers } from '@/access'
import type { User } from '@/payload-types'

const user = (roles: User['roles'], extra: Record<string, unknown> = {}): User =>
  ({ id: 7, email: 'probe@cilas.test', roles, ...extra }) as unknown as User

const run = (access: Access, u: User | null) => access({ req: { user: u } } as never)

describe('isAdminOrOwnAndDraft', () => {
  const rule = isAdminOrOwnAndDraft(ownsViaFellows, { allow: ['fellow'] })

  it('lets admins edit anything', () => {
    expect(run(rule, user(['admin']))).toBe(true)
  })

  it('refuses anonymous visitors', () => {
    expect(run(rule, null)).toBe(false)
  })

  it('refuses roles outside allow', () => {
    expect(run(rule, user(['member']))).toBe(false)
  })

  it('keeps ownership AND draft for a fellow', () => {
    expect(run(rule, user(['fellow']))).toEqual({
      and: [{ fellows: { contains: 7 } }, { _status: { equals: 'draft' } }],
    })
  })

  it('refuses when ownership cannot be expressed', () => {
    const never = isAdminOrOwnAndDraft(() => false)
    expect(run(never, user(['fellow']))).toBe(false)
  })
})

describe('readTiers', () => {
  it('skips the owner branch when ownership cannot be expressed', () => {
    const rule = readTiers(() => false)
    expect(run(rule, user(['member']))).toEqual({
      or: [{ tier: { in: ['community', 'public'] } }],
    })
  })
})
```

- [ ] **Step 2: Run the test to make sure it fails**

Run: `pnpm exec vitest run tests/unit/access.unit.spec.ts`
Expected: FAIL on "keeps ownership AND draft for a fellow" (it receives `{ _status: { equals: 'draft' } }`). The `member` cases also fail type-checking until Task 2, which is fine: vitest doesn't type-check.

- [ ] **Step 3: Implement**

In `src/access.ts`, replace the constraints block and the two rules that use it:

```ts
/* ============================================================= constraints */

/**
 * How a user owns a document. The relationship field differs per collection,
 * so ownership is supplied as a constraint builder rather than hardcoded.
 * `false` means this user cannot own anything here (e.g. an account with no
 * linked person), and callers must treat it as "no ownership path".
 */
export type Ownership = (user: User) => Where | false

export const ownsViaFellows: Ownership = (user) => ({ fellows: { contains: user.id } })
export const ownsViaAuthor: Ownership = (user) => ({ author: { equals: user.id } })
```

```ts
export const isAdminOrOwnAndDraft =
  (owned: Ownership, { allow }: { allow?: Role[] } = {}): Access =>
  ({ req }) => {
    if (isAdminUser(req.user)) return true
    if (!req.user) return false
    if (allow && !hasRole(req.user, ...allow)) return false

    const owns = owned(req.user)
    if (!owns) return false

    // Both constraints must hold. `owns && { _status }` would evaluate to the
    // second object alone and drop ownership entirely.
    return { and: [owns, { _status: { equals: 'draft' } }] }
  }
```

In `readTiers`, change the signature to `(owned?: Ownership, …)` and replace `if (owned) visible.push(owned(req.user))` with:

```ts
    const owns = owned?.(req.user)
    if (owns) visible.push(owns)
```

- [ ] **Step 4: Run the test to make sure it passes**

Run: `pnpm exec vitest run tests/unit/access.unit.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/access.ts tests/unit/access.unit.spec.ts
git commit -m "fix(access): keep the ownership constraint on draft edits"
```

---

### Task 2: Rename the `ciliasian` role to `member`

`member` is the permission to write articles. Being a CILASian is a cohort fact that comes from memberships (CONTEXT.md).

**Files:**
- Modify: `src/collections/Users.ts`, `src/collections/Courses.ts`, `tests/unit/fellow-role.unit.spec.ts`, `tests/int/seed-localization.int.spec.ts`, `seed/collections/users.seed.ts`, and any other file the grep finds

- [ ] **Step 1: Find every occurrence**

Run: `grep -rn "ciliasian" src seed tests`
Expected: hits in `Users.ts` (default and option), `Courses.ts` (revoke fallback), both test files, and the seed data.

- [ ] **Step 2: Replace them**

In `src/collections/Users.ts`, the option and default become:

```ts
          defaultValue: 'member',
```
```ts
            { label: 'Member', value: 'member' },
```

Everywhere else, replace the string `'ciliasian'` with `'member'`:

```bash
grep -rl "ciliasian" src seed tests | xargs sed -i '' "s/'ciliasian'/'member'/g"
```

Also rename the test title `'falls back to ciliasian when fellow was the only role'` to `'falls back to member when fellow was the only role'`.

- [ ] **Step 3: Regenerate the types**

Run: `pnpm generate:types`
Expected: `src/payload-types.ts` lists `'member'` in `User['roles']`, and `grep -c ciliasian src/payload-types.ts` prints `0`.

- [ ] **Step 4: Run the unit tests**

Run: `pnpm exec vitest run tests/unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src seed tests
git commit -m "refactor(users): rename the ciliasian role to member"
```

---

### Task 3: Shared social fields and the People collection

**Files:**
- Create: `src/fields/social.ts`, `src/collections/People.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 0: Add `personOf` to `src/access.ts`**

Add it under the primitives. People (this task), Users (Task 4) and ownership (Task 5) all use it.

```ts
/**
 * The person a signed-in account acts as, or null when the account is not
 * linked. `person` arrives as an id, or populated when depth > 0.
 */
export const personOf = (
  user: { person?: number | { id: number } | null } | Record<string, unknown> | null | undefined,
): number | null => {
  const person = (user as { person?: unknown } | null | undefined)?.person
  if (typeof person === 'number') return person
  if (person && typeof person === 'object' && typeof (person as { id?: unknown }).id === 'number') {
    return (person as { id: number }).id
  }
  return null
}
```

- [ ] **Step 1: Extract the social fields**

Create `src/fields/social.ts`:

```ts
import type { Field } from 'payload'

export const SOCIAL_PLATFORMS = ['facebook', 'x', 'youtube', 'instagram', 'linkedin'] as const

export const httpUrl = (value: unknown): true | string =>
  typeof value === 'string' && /^https?:\/\/\S+$/.test(value)
    ? true
    : 'Enter a full URL starting with https:// or http://'

/**
 * Where to find and follow someone. `website` owns the primary link; each
 * social entry is one platform, one URL.
 */
export const socialFields: Field = {
  label: 'Social',
  type: 'group',
  fields: [
    { name: 'website', type: 'text', admin: { placeholder: 'https://…' } },
    {
      name: 'social_links',
      type: 'array',
      label: 'Social media',
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: SOCIAL_PLATFORMS.map((v) => ({
            label: v.charAt(0).toUpperCase() + v.slice(1),
            value: v,
          })),
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          admin: { placeholder: 'https://…' },
          validate: httpUrl,
        },
      ],
    },
  ],
}
```

- [ ] **Step 2: Create People**

Create `src/collections/People.ts`. Its joins are added later, once the fields they point at reference `people`: `courses` in Task 5, `governance` in Task 7 and `memberships` in Task 8. A join on a field that points elsewhere fails config validation.

```ts
import type { CollectionConfig } from 'payload'

import { anyone, isAdmin, isAdminUser, personOf } from '@/access'
import { slugField } from '@/fields/slug'
import { socialFields } from '@/fields/social'

/**
 * Everyone who appears on the site: fellows, CILASians, authors, advisors,
 * speakers. Most never log in; a `users` account may link to one person
 * (ADR 0001).
 */
export const People: CollectionConfig = {
  slug: 'people',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
  },
  access: {
    read: anyone,
    create: isAdmin,
    // A signed-in person may keep their own profile current.
    update: ({ req }) => {
      if (isAdminUser(req.user)) return true
      const person = personOf(req.user)
      return person === null ? false : { id: { equals: person } }
    },
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    slugField({ useAsSlug: 'name' }),
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      admin: { position: 'sidebar' },
    },
    {
      label: 'Profile',
      type: 'group',
      fields: [{ name: 'bio', type: 'richText', localized: true }],
    },
    socialFields,
  ],
}
```

- [ ] **Step 3: Register People**

In `src/payload.config.ts`, add `import { People } from './collections/People'` and insert `People` after `Users` in `collections`.

- [ ] **Step 4: Type-check**

Run: `pnpm generate:types && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/access.ts src/fields/social.ts src/collections/People.ts src/payload.config.ts src/payload-types.ts
git commit -m "feat(people): public profiles separate from login accounts"
```

---

### Task 4: Slim Users down to auth and add the person link

**Files:**
- Modify: `src/access.ts`, `src/collections/Users.ts`, `seed/super-admin.ts`

- [ ] **Step 1: Rewrite `src/collections/Users.ts`**

Profile fields move to People. The `courses` virtual field and its afterRead hook are removed; `people.courses` replaces them.

```ts
import { isAdmin } from '@/access'
import type { CollectionConfig } from 'payload'

/** Login accounts. Public profiles live in `people` (ADR 0001). */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'person', 'roles'],
    hidden: (ctx) => !ctx.user?.roles.includes('super_admin') && !ctx.user?.roles.includes('admin'),
  },
  auth: true,
  access: {
    update: isAdmin,
  },
  fields: [
    {
      // At most one account per person.
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      unique: true,
      admin: { position: 'sidebar' },
    },
    {
      label: 'Roles',
      type: 'group',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'roles',
          type: 'select',
          required: true,
          defaultValue: 'member',
          hasMany: true,
          options: [
            { label: 'Super Admin', value: 'super_admin' },
            { label: 'Admin', value: 'admin' },
            { label: 'Fellow', value: 'fellow' },
            { label: 'Member', value: 'member' },
            { label: 'Non-Degree-Seeking Student', value: 'non_degree_seeking' },
          ],
        },
      ],
    },
  ],
}
```

- [ ] **Step 2: Remove `name` from the super-admin seed**

In `seed/super-admin.ts`, delete the line `name: 'Salah Mohsen',` from the `payload.create` data.

- [ ] **Step 3: Type-check**

Run: `pnpm generate:types && pnpm exec tsc --noEmit`
Expected: errors only in `seed/` (the user seeds still write `name` and `bio`) and in `tests/int/seed-localization.int.spec.ts`. Task 9 fixes both. Any error under `src/` must be fixed now.

- [ ] **Step 4: Commit**

```bash
git add src/collections/Users.ts src/payload-types.ts seed/super-admin.ts
git commit -m "refactor(users): auth and roles only, linked to an optional person"
```

---

### Task 5: Fellows are people; the fellow role follows the linked user

**Files:**
- Create: `src/lib/fellow-role.ts`
- Modify: `src/access.ts`, `src/collections/Courses.ts`, `src/collections/Events.ts`, `src/collections/People.ts`
- Rewrite: `tests/unit/fellow-role.unit.spec.ts`
- Modify: `tests/unit/access.unit.spec.ts`

- [ ] **Step 1: Write the failing tests**

Replace `tests/unit/fellow-role.unit.spec.ts` entirely:

```ts
import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { propagateFellowRole, revokeDeletedCourseFellows } from '@/collections/Courses'
import type { Course, User } from '@/payload-types'

type Role = User['roles'][number]
type Account = { id: number; person: number | null; roles: Role[] }

/**
 * The two payload calls the hooks make, stubbed:
 *   find users  -> the account linked to a person
 *   find courses -> whether that person is still listed on another course
 * `teaching` is the set of person ids listed on some other course.
 */
const stubPayload = (accounts: Account[], teaching: number[] = []) => {
  const updates: Array<{ id: number; data: { roles: Role[] } }> = []

  const payload = {
    find: vi.fn(async ({ collection, where }: { collection: string; where: any }) => {
      if (collection === 'users') {
        const docs = accounts.filter((a) => a.person === where.person.equals)
        return { docs, totalDocs: docs.length }
      }
      const person = where.and[0].fellows.contains
      return { docs: [], totalDocs: teaching.includes(person) ? 1 : 0 }
    }),
    update: vi.fn(async ({ id, data }: { id: number; data: { roles: Role[] } }) => {
      updates.push({ id, data })
      const account = accounts.find((a) => a.id === id)
      if (account) account.roles = data.roles
      return { id, ...data }
    }),
  }

  return { payload: payload as unknown as Payload, updates }
}

const course = (id: number, fellows: Array<number | { id: number }>): Course =>
  ({ id, fellows }) as unknown as Course

type ChangeArgs = Parameters<typeof propagateFellowRole>[0]
const onChange = (payload: Payload, doc: Course, previousDoc: Course): ChangeArgs =>
  ({ collection: {}, context: {}, data: {}, doc, previousDoc, operation: 'update', req: { payload } }) as unknown as ChangeArgs

type DeleteArgs = Parameters<typeof revokeDeletedCourseFellows>[0]
const onDelete = (payload: Payload, doc: Course): DeleteArgs =>
  ({ collection: {}, context: {}, doc, req: { payload } }) as unknown as DeleteArgs

// Person 50 is linked to account 5.
const linked = (roles: Role[]): Account[] => [{ id: 5, person: 50, roles }]

describe('propagateFellowRole', () => {
  it('grants fellow to the account of a newly listed person', async () => {
    const { payload, updates } = stubPayload(linked(['member']))
    await propagateFellowRole(onChange(payload, course(1, [50]), course(1, [])))
    expect(updates).toEqual([{ id: 5, data: { roles: ['member', 'fellow'] } }])
  })

  it('does nothing for a person with no account', async () => {
    const { payload, updates } = stubPayload([])
    await propagateFellowRole(onChange(payload, course(1, [50]), course(1, [])))
    expect(updates).toEqual([])
  })

  it('does not duplicate a role the account already holds', async () => {
    const { payload, updates } = stubPayload(linked(['member', 'fellow']))
    await propagateFellowRole(onChange(payload, course(1, [50]), course(1, [])))
    expect(updates).toEqual([])
  })

  it('keeps every other role when granting', async () => {
    const { payload, updates } = stubPayload(linked(['super_admin']))
    await propagateFellowRole(onChange(payload, course(1, [50]), course(1, [])))
    expect(updates[0].data.roles).toEqual(['super_admin', 'fellow'])
  })

  it('revokes fellow when removed from their only course', async () => {
    const { payload, updates } = stubPayload(linked(['member', 'fellow']))
    await propagateFellowRole(onChange(payload, course(1, []), course(1, [50])))
    expect(updates).toEqual([{ id: 5, data: { roles: ['member'] } }])
  })

  it('keeps fellow when still listed on another course', async () => {
    const { payload, updates } = stubPayload(linked(['member', 'fellow']), [50])
    await propagateFellowRole(onChange(payload, course(1, []), course(1, [50])))
    expect(updates).toEqual([])
  })

  it('falls back to member when fellow was the only role', async () => {
    const { payload, updates } = stubPayload(linked(['fellow']))
    await propagateFellowRole(onChange(payload, course(1, []), course(1, [50])))
    expect(updates).toEqual([{ id: 5, data: { roles: ['member'] } }])
  })

  it('ignores a save that changes nothing', async () => {
    const { payload, updates } = stubPayload(linked(['fellow']))
    await propagateFellowRole(onChange(payload, course(1, [50]), course(1, [50])))
    expect(updates).toEqual([])
  })

  it('accepts fellows as populated people, not just ids', async () => {
    const { payload, updates } = stubPayload(linked(['member']))
    await propagateFellowRole(onChange(payload, course(1, [{ id: 50 }]), course(1, [])))
    expect(updates).toEqual([{ id: 5, data: { roles: ['member', 'fellow'] } }])
  })
})

describe('revokeDeletedCourseFellows', () => {
  it('revokes fellow when the course is deleted', async () => {
    const { payload, updates } = stubPayload(linked(['member', 'fellow']))
    await revokeDeletedCourseFellows(onDelete(payload, course(1, [50])))
    expect(updates).toEqual([{ id: 5, data: { roles: ['member'] } }])
  })

  it('keeps fellow when another course still lists them', async () => {
    const { payload, updates } = stubPayload(linked(['member', 'fellow']), [50])
    await revokeDeletedCourseFellows(onDelete(payload, course(1, [50])))
    expect(updates).toEqual([])
  })
})
```

Append to `tests/unit/access.unit.spec.ts`:

```ts
describe('ownsViaFellows', () => {
  it('owns through the linked person id', () => {
    expect(ownsViaFellows(user(['fellow'], { person: 42 }))).toEqual({ fellows: { contains: 42 } })
  })

  it('accepts a populated person', () => {
    expect(ownsViaFellows(user(['fellow'], { person: { id: 42 } }))).toEqual({
      fellows: { contains: 42 },
    })
  })

  it('owns nothing without a linked person', () => {
    expect(ownsViaFellows(user(['fellow']))).toBe(false)
  })
})
```

In the same file, change the Task 1 expectation `'keeps ownership AND draft for a fellow'` to use a linked person:

```ts
  it('keeps ownership AND draft for a fellow', () => {
    expect(run(rule, user(['fellow'], { person: 42 }))).toEqual({
      and: [{ fellows: { contains: 42 } }, { _status: { equals: 'draft' } }],
    })
  })
```

- [ ] **Step 2: Run the tests to make sure they fail**

Run: `pnpm exec vitest run tests/unit`
Expected: FAIL. The hooks still call `findByID` on users (the stub has none), and `ownsViaFellows` still returns `user.id`.

- [ ] **Step 3: Implement**

Create `src/lib/fellow-role.ts`:

```ts
import type { Payload } from 'payload'

import type { Role } from '@/access'
import type { User } from '@/payload-types'

/**
 * `fellow` is held by an account exactly while its linked person is listed on
 * at least one course. Courses list people; accounts are found through
 * `users.person`. A person with no account is simply skipped.
 */

/** Adds or removes `fellow`, never leaving roles empty (the field is required). */
export const withFellowRole = (roles: Role[], fellow: boolean): Role[] => {
  const rest = roles.filter((role) => role !== 'fellow')
  if (fellow) return [...rest, 'fellow']
  return rest.length > 0 ? rest : ['member']
}

/** `fellows` arrives as ids, or as populated people when depth > 0. */
export const toPersonIds = (fellows: Array<number | { id: number }> | null | undefined): number[] =>
  (fellows ?? [])
    .map((fellow) => (typeof fellow === 'object' ? fellow.id : fellow))
    .filter((id): id is number => typeof id === 'number')

export const accountOf = async (payload: Payload, person: number): Promise<User | null> => {
  const res = await payload.find({
    collection: 'users',
    where: { person: { equals: person } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs[0] as User | undefined) ?? null
}

/** Whether a person is listed on any course other than `exceptCourseId`. */
export const teaches = async (
  payload: Payload,
  person: number,
  exceptCourseId?: number,
): Promise<boolean> => {
  const res = await payload.find({
    collection: 'courses',
    where: {
      and: [
        { fellows: { contains: person } },
        ...(exceptCourseId === undefined ? [] : [{ id: { not_equals: exceptCourseId } }]),
      ],
    },
    limit: 1,
    depth: 0,
    // courses.read is tiered by `tier`, `_status` and ownership.
    overrideAccess: true,
  })
  return res.totalDocs > 0
}

export const grantFellow = async (payload: Payload, person: number): Promise<void> => {
  const account = await accountOf(payload, person)
  if (!account || account.roles.includes('fellow')) return

  await payload.update({
    collection: 'users',
    id: account.id,
    data: { roles: withFellowRole(account.roles, true) },
    // users.update is admin-only.
    overrideAccess: true,
  })
}

/** The course being saved or deleted is excluded so it cannot vouch for itself. */
export const revokeIfUnteaching = async (
  payload: Payload,
  person: number,
  exceptCourseId: number,
): Promise<void> => {
  if (await teaches(payload, person, exceptCourseId)) return

  const account = await accountOf(payload, person)
  if (!account || !account.roles.includes('fellow')) return

  await payload.update({
    collection: 'users',
    id: account.id,
    data: { roles: withFellowRole(account.roles, false) },
    overrideAccess: true,
  })
}
```

In `src/collections/Courses.ts`:
1. Delete `toIds`, `grantFellow` and `revokeIfUnteaching`.
2. Import `{ grantFellow, revokeIfUnteaching, toPersonIds }` from `@/lib/fellow-role`.
3. In both hooks, replace `toIds(` with `toPersonIds(`.
4. Change the `fellows` field to `relationTo: 'people'`.
5. Update the comment above `propagateFellowRole` to say fellows are people and the role lands on the linked account.

```ts
    {
      name: 'fellows',
      type: 'relationship',
      relationTo: 'people',
      hasMany: true,
      admin: {
        position: 'sidebar',
      },
    },
```

In `src/collections/Events.ts`, change the `fellows` field to `relationTo: 'people'` too. Event read access uses `ownsViaFellows`, which now yields a person id. Plan 4 reshapes this field into `speakers[]`.

Now that `courses.fellows` points at people, append the join to `People.fields` in `src/collections/People.ts`:

```ts
    {
      // Derived from courses.fellows; never stored on the person.
      name: 'courses',
      type: 'join',
      collection: 'courses',
      on: 'fellows',
      admin: { allowCreate: false, defaultColumns: ['title', 'cycle', 'course_type'] },
    },
```

In `src/access.ts`, ownership goes through the person:

```ts
export const ownsViaFellows: Ownership = (user) => {
  const person = personOf(user)
  return person === null ? false : { fellows: { contains: person } }
}
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `pnpm generate:types && pnpm exec vitest run tests/unit`
Expected: PASS (all of access, fellow-role).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fellow-role.ts src/access.ts src/collections/Courses.ts src/collections/Events.ts src/collections/People.ts src/payload-types.ts tests/unit
git commit -m "feat(courses): fellows are people; the fellow role follows the linked account"
```

---

### Task 6: Linking an account to a person syncs `fellow`

Without this, someone who taught in 2016 and creates an account in 2027 would never get `fellow`, because the course hook only runs when a course changes.

**Files:**
- Modify: `src/collections/Users.ts`
- Create: `tests/unit/user-link.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/user-link.unit.spec.ts`:

```ts
import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { syncFellowRoleOnLink } from '@/collections/Users'
import type { User } from '@/payload-types'

type Role = User['roles'][number]
type Args = Parameters<typeof syncFellowRoleOnLink>[0]

/** `teaching` = person ids listed on at least one course. */
const call = (data: Partial<User>, originalDoc: Partial<User> | undefined, teaching: number[]) => {
  const payload = {
    find: vi.fn(async ({ where }: { where: any }) => ({
      docs: [],
      totalDocs: teaching.includes(where.and[0].fellows.contains) ? 1 : 0,
    })),
  } as unknown as Payload
  return syncFellowRoleOnLink({ data, originalDoc, req: { payload } } as unknown as Args)
}

const roles = (r: Role[]) => r

describe('syncFellowRoleOnLink', () => {
  it('grants fellow when linked to a person who teaches', async () => {
    const out = await call({ person: 50 }, { roles: roles(['member']), person: null }, [50])
    expect(out.roles).toEqual(['member', 'fellow'])
  })

  it('leaves roles alone when the person does not teach', async () => {
    const out = await call({ person: 50 }, { roles: roles(['member']), person: null }, [])
    expect(out.roles).toBeUndefined()
  })

  it('revokes fellow when unlinked', async () => {
    const out = await call({ person: null }, { roles: roles(['member', 'fellow']), person: 50 }, [50])
    expect(out.roles).toEqual(['member'])
  })

  it('ignores saves that do not touch person', async () => {
    const out = await call({ roles: roles(['admin']) }, { roles: roles(['member']), person: 50 }, [50])
    expect(out).toEqual({ roles: ['admin'] })
  })

  it('uses roles from the same save when present', async () => {
    const out = await call({ person: 50, roles: roles(['admin']) }, undefined, [50])
    expect(out.roles).toEqual(['admin', 'fellow'])
  })
})
```

- [ ] **Step 2: Run the test to make sure it fails**

Run: `pnpm exec vitest run tests/unit/user-link.unit.spec.ts`
Expected: FAIL with "syncFellowRoleOnLink is not a function" (it doesn't exist yet).

- [ ] **Step 3: Implement**

In `src/collections/Users.ts`, add the imports and the hook, and register it:

```ts
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { isAdmin, personOf, type Role } from '@/access'
import { teaches, withFellowRole } from '@/lib/fellow-role'
import type { User } from '@/payload-types'

/**
 * Keeps `fellow` true to the linked person when the link itself changes. The
 * course hooks cover the other direction (a course listing a person).
 * beforeChange, so the role lands in the same write as the link.
 */
export const syncFellowRoleOnLink: CollectionBeforeChangeHook<User> = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!('person' in data)) return data

  const before = personOf(originalDoc)
  const after = personOf(data)
  if (before === after) return data

  const isTeaching = after !== null && (await teaches(req.payload, after))
  const current = (data.roles ?? originalDoc?.roles ?? ['member']) as Role[]
  if (current.includes('fellow') === isTeaching) return data

  return { ...data, roles: withFellowRole(current, isTeaching) }
}
```

Add to the `Users` config:

```ts
  hooks: {
    beforeChange: [syncFellowRoleOnLink],
  },
```

- [ ] **Step 4: Run the test to make sure it passes**

Run: `pnpm exec vitest run tests/unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Users.ts tests/unit/user-link.unit.spec.ts
git commit -m "feat(users): linking an account to a teaching person grants fellow"
```

---

### Task 7: Governance points at people

**Files:**
- Modify: `src/collections/Governance.ts`, `src/collections/People.ts`

- [ ] **Step 1: Rewrite `src/collections/Governance.ts`**

```ts
import type { CollectionConfig } from 'payload'

import { anyone, hasRole, isAdmin } from '../access'

/** Board of advisors and board of trustees, one row per person per term. */
export const Governance: CollectionConfig = {
  slug: 'governance',
  admin: {
    hidden: ({ user }) => !hasRole(user, 'super_admin'),
    defaultColumns: ['person', 'role', 'term_from', 'term_to'],
  },
  defaultSort: 'order',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'person', type: 'relationship', relationTo: 'people', required: true, index: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'Advisor', value: 'advisor' },
        { label: 'Trustee', value: 'trustee' },
      ],
    },
    // Their position elsewhere, e.g. "Dean of Liberal Arts, Leiden University College".
    { name: 'title', type: 'text', localized: true },
    // "Chairman", "Secretary", "Treasurer"
    { name: 'board_role', type: 'text', admin: { condition: (d) => d.role === 'trustee' } },
    // "curriculum design and university partnerships"
    { name: 'advises_on', type: 'text', localized: true, admin: { condition: (d) => d.role === 'advisor' } },
    {
      type: 'row',
      fields: [
        { name: 'term_from', type: 'number', min: 2012, max: 2100, admin: { width: '50%' } },
        // Empty while serving.
        { name: 'term_to', type: 'number', min: 2012, max: 2100, admin: { width: '50%' } },
      ],
    },
    { name: 'order', type: 'number', admin: { position: 'sidebar' } },
  ],
}
```

- [ ] **Step 2: Add the join on People**

Append to `People.fields` in `src/collections/People.ts`:

```ts
    {
      name: 'governance',
      type: 'join',
      collection: 'governance',
      on: 'person',
      admin: { allowCreate: false, defaultColumns: ['role', 'term_from', 'term_to'] },
    },
```

- [ ] **Step 3: Type-check**

Run: `pnpm generate:types && pnpm exec tsc --noEmit`
Expected: errors only in `seed/` (Task 9).

- [ ] **Step 4: Commit**

```bash
git add src/collections/Governance.ts src/collections/People.ts src/payload-types.ts
git commit -m "feat(governance): board terms point at people"
```

---

### Task 8: Memberships

**Files:**
- Create: `src/collections/Memberships.ts`, `tests/int/people.int.spec.ts`
- Modify: `src/collections/People.ts`, `src/payload.config.ts`

- [ ] **Step 1: Write the failing integration test**

Create `tests/int/people.int.spec.ts`:

```ts
// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

let payload: Payload
const created: Array<{ collection: 'people' | 'programmes' | 'memberships'; id: number }> = []

const track = <T extends { id: number }>(collection: (typeof created)[number]['collection'], doc: T): T => {
  created.push({ collection, id: doc.id })
  return doc
}

describe('people and memberships', () => {
  let personId: number
  let programmeId: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    personId = track('people', await payload.create({ collection: 'people', data: { name: 'Membership Probe' }, overrideAccess: true })).id
    programmeId = track('programmes', await payload.create({ collection: 'programmes', data: { title: 'Probe Programme' } as never, overrideAccess: true })).id
  })

  afterAll(async () => {
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
    }
    await payload.destroy()
  })

  it('lists a membership on the person through the join', async () => {
    track('memberships', await payload.create({
      collection: 'memberships',
      data: { person: personId, programme: programmeId, role: 'visiting_fellow' },
      overrideAccess: true,
    }))

    const person = await payload.findByID({ collection: 'people', id: personId, overrideAccess: true })
    expect(person.memberships?.docs).toHaveLength(1)
  })

  it('refuses a second membership for the same person and programme', async () => {
    await expect(
      payload.create({
        collection: 'memberships',
        data: { person: personId, programme: programmeId, role: 'student' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
```

If `programmes` requires more fields than `title`, add them to that `create` call. Run `grep -n "required: true" src/collections/Programmes.ts` to check.

- [ ] **Step 2: Don't run it yet**

This test boots Payload, which would push a half-migrated schema (see the Task 0 warning). It runs in Task 10 Step 3, after the database rebuild. For now, check only that it compiles once Step 3 is done.

- [ ] **Step 3: Implement**

Create `src/collections/Memberships.ts`:

```ts
import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/access'

/**
 * A person's place in one programme's community. Every membership makes that
 * person a CILASian of that programme (CONTEXT.md). Taking a single course is
 * an enrollment, not a membership.
 */
export const Memberships: CollectionConfig = {
  slug: 'memberships',
  admin: {
    defaultColumns: ['person', 'programme', 'role'],
  },
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  indexes: [{ fields: ['person', 'programme'], unique: true }],
  fields: [
    { name: 'person', type: 'relationship', relationTo: 'people', required: true, index: true },
    { name: 'programme', type: 'relationship', relationTo: 'programmes', required: true, index: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'student',
      options: [
        { label: 'Student', value: 'student' },
        { label: 'Residential fellow', value: 'residential_fellow' },
        { label: 'Visiting fellow', value: 'visiting_fellow' },
      ],
    },
    // e.g. "coordinates the field of Social Sciences"
    { name: 'title', type: 'text', localized: true },
    { name: 'note', type: 'textarea' },
  ],
}
```

Append to `People.fields`:

```ts
    {
      name: 'memberships',
      type: 'join',
      collection: 'memberships',
      on: 'person',
      admin: { allowCreate: true, defaultColumns: ['programme', 'role'] },
    },
```

Register it in `src/payload.config.ts`: `import { Memberships } from './collections/Memberships'`, and add `Memberships` after `People`.

- [ ] **Step 4: Type-check**

Run: `pnpm generate:types && pnpm exec tsc --noEmit`
Expected: no new errors outside `seed/` and `tests/int/seed-localization.int.spec.ts` (Task 9 fixes those).

- [ ] **Step 5: Commit**

```bash
git add src/collections/Memberships.ts src/collections/People.ts src/payload.config.ts src/payload-types.ts tests/int/people.int.spec.ts
git commit -m "feat(memberships): a person's place in a programme community"
```

---

### Task 9: Events fellows and seeds

**Files:**
- Modify: `src/collections/Events.ts`, `seed/seed.type.ts`, `seed/seed.utils.ts`, `seed/collections/users.seed.ts`, `seed/collections/courses.seed.ts`, `seed/collections/events.seed.ts`, `seed/collections/governance.seed.ts`, `seed/index.ts`
- Rewrite: `tests/int/seed-localization.int.spec.ts`

- [ ] **Step 1: Confirm event fellows already point at people**

Run: `grep -n "relationTo: 'people'" src/collections/Events.ts`
Expected: one hit (from Task 5). If there's none, make that change now.

- [ ] **Step 2: Seed types**

In `seed/seed.type.ts`:

1. Replace `UserSeed` with an explicit shape. The `User` type no longer has `name` or `bio`.
2. Add `people` to the seed context.

```ts
/**
 * One fixture person. Every fixture person also gets a login account, keyed by
 * `email`, so local development can sign in as anyone.
 */
export type UserSeed = {
  email: string
  name: string
  /** Arabic name, written in a follow-up `locale: 'ar'` update. */
  name_ar: string
  /** Stored as plain text here; converted to Lexical by the seeder. */
  bio: string
  bio_ar: string
  roles: User['roles']
  password?: string
}
```

```ts
export type SeedContext = {
  users: IdMap
  /** Fixture emails, resolved to person ids. */
  people: IdMap
  cycles: IdMap
  courses: IdMap
  programmes: IdMap
  /** Article-collection titles, resolved to ids. */
  articleCollections: IdMap
}

export const createSeedContext = (): SeedContext => ({
  users: {},
  people: {},
  cycles: {},
  courses: {},
  programmes: {},
  articleCollections: {},
})
```

`GovernanceSeed.email`'s comment becomes: `/** The linked person must already exist in usersData. */`

- [ ] **Step 3: Seed utils**

In `seed/seed.utils.ts`:
- `getOrCreateUser` creates `data: { email, password: password ?? DEFAULT_PASSWORD, roles }`, with no `name` and no `bio`. Remove `bio` and `name` from its destructuring.
- Add `'people'` and `'memberships'` to `CONTENT_COLLECTIONS`. Accounts survive the reset, and their `person` link is restored by `seedUsers`.

- [ ] **Step 4: Seed people and link accounts**

Replace `seedUsers` and `linkFellows` in `seed/collections/users.seed.ts`:

```ts
/**
 * Each fixture becomes a person (public profile) and an account linked to it.
 * People are wiped by resetContent and recreated; accounts are matched by email
 * and survive, so a real account's password is never touched.
 *
 * The account's roles are written before courses exist, so the users hook
 * strips `fellow` here; the Courses hook grants it back as seedCourses lists
 * each person.
 */
export const seedUsers = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const seed of usersData) {
    const personId = await getOrCreateId(payload, 'people', { name: { equals: seed.name } }, () =>
      payload.create({
        collection: 'people',
        data: { name: seed.name, bio: lexical(seed.bio) },
        overrideAccess: true,
      }),
    )
    await payload.update({
      collection: 'people',
      id: personId,
      data: { name: seed.name_ar, bio: lexical(seed.bio_ar, 'rtl') },
      locale: 'ar',
      overrideAccess: true,
    })
    ctx.people[seed.email] = personId

    const userId = await getOrCreateUser(payload, seed)
    await payload.update({
      collection: 'users',
      id: userId,
      data: { roles: seed.roles, person: personId },
      overrideAccess: true,
    })
    ctx.users[seed.email] = userId

    console.log('person:', seed.name)
  }
}

/** Fails fast if a course lists someone who was never seeded. */
export const linkFellows = async (_payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const course of coursesData) {
    for (const email of course.fellows) {
      if (ctx.people[email] === undefined) {
        throw new Error(`seed: course fellow "${email}" not seeded before courses`)
      }
    }
  }
}
```

Add `getOrCreateId` to the import from `'../seed.utils'`.

- [ ] **Step 5: Resolve fellows and board members as people**

- `seed/collections/courses.seed.ts:375`: `fellows: requireIds(ctx.people, fellows),`
- `seed/collections/events.seed.ts:48`: `...(fellows ? { fellows: requireIds(ctx.people, fellows) } : {}),`
- `seed/collections/governance.seed.ts`: the loop body becomes:

```ts
        const { email, role, ...detail } = member
        const personId = requireId(ctx.people, email)

        await getOrCreateId(payload, 'governance', { person: { equals: personId } }, () =>
            payload.create({
                collection: 'governance',
                data: { person: personId, role, ...detail },
                overrideAccess: true,
            }),
        )
```

`articles.seed.ts:328` keeps `ctx.users`. Article authors stay accounts until plan 4 introduces credits.

- [ ] **Step 6: Rewrite the localization test for people**

Replace `tests/int/seed-localization.int.spec.ts`:

```ts
// @vitest-environment node
// Server-side: touches the database.
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { lexical } from '../../seed/seed.utils'

/**
 * Regression cover for the seeder's localized profile fields: a person is
 * created in English, then gets an Arabic pass. Both locales must survive.
 */
let payload: Payload
let personId: number

const bioText = (bio: unknown): string => {
  const root = (bio as { root?: { children?: Array<{ children?: Array<{ text?: string }> }> } })?.root
  return root?.children?.[0]?.children?.[0]?.text ?? ''
}

describe('seed localization', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const person = await payload.create({
      collection: 'people',
      data: { name: 'Probe Fellow', bio: lexical('English bio.') },
      overrideAccess: true,
    })
    personId = person.id
    await payload.update({
      collection: 'people',
      id: personId,
      data: { name: 'زميل الاختبار', bio: lexical('سيرة ذاتية بالعربية.', 'rtl') },
      locale: 'ar',
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'people', id: personId, overrideAccess: true })
    await payload.destroy()
  })

  it('keeps name and bio in English and Arabic', async () => {
    const person = (await payload.findByID({
      collection: 'people',
      id: personId,
      depth: 0,
      locale: 'all',
      overrideAccess: true,
    })) as unknown as { name: { en: string; ar: string }; bio: { en: unknown; ar: unknown } }

    expect(person.name).toEqual({ en: 'Probe Fellow', ar: 'زميل الاختبار' })
    expect(bioText(person.bio.en)).toBe('English bio.')
    expect(bioText(person.bio.ar)).toBe('سيرة ذاتية بالعربية.')
  })
})
```

- [ ] **Step 7: Type-check everything**

Run: `pnpm generate:types && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/collections/Events.ts src/payload-types.ts seed tests/int/seed-localization.int.spec.ts
git commit -m "feat(seed): seed people and link fixture accounts to them"
```

---

### Task 10: Reset, verify end to end, update the spec

**Files:**
- Modify: `docs/schema.md`

- [ ] **Step 1: Rebuild the dev database**

> **Warning:** `pnpm db:reset` deletes every generated migration in `src/migrations`, recreates one from the current schema, and reseeds. All dev content is replaced. Run it only against the local or dev database and never against production.

Run: `pnpm db:reset`
Expected: ends with `SEED COMPLETE`, with no `seed: no id for` errors.

- [ ] **Step 2: Check the fellow role landed through people**

Run:

```bash
pnpm exec tsx -e "
process.loadEnvFile('.env')
const { getPayload } = await import('payload')
const { default: config } = await import('./src/payload.config')
const p = await getPayload({ config })
const u = await p.find({ collection: 'users', where: { email: { equals: 'shadi.jamal@cilas.test' } }, depth: 1, overrideAccess: true })
console.log(u.docs[0].roles, typeof u.docs[0].person === 'object' && u.docs[0].person?.name)
process.exit(0)
"
```
Expected: `[ 'member', 'fellow' ] Shadi Jamal`. The seed sets `['fellow']`, the link hook replaces it with `['member']` because no course exists yet, and then `propagateFellowRole` adds `fellow` back. If the output is `[ 'member' ]` alone, the course hook isn't finding the account through `users.person`.

- [ ] **Step 3: Run the whole suite**

Run: `pnpm test:int && pnpm lint`
Expected: all pass (including `tests/int/people.int.spec.ts` from Task 8); lint clean. If "refuses a second membership" passes without a throw, the compound unique index wasn't created. Check `\d memberships` in psql.

- [ ] **Step 4: Smoke-test the admin**

Run: `pnpm dev`. Open `/admin/collections/people`, open Shadi Jamal, and check that the **Courses** join lists their fall 2025 course. Open `/admin/collections/users` and check that accounts show email and person only.

- [ ] **Step 5: Mark the spec sections done**

In `docs/schema.md`, delete the `people`, `users`, `governance` and `memberships` sections. They now exist in code, and the spec says to delete sections once the code matches. Leave `partners` (plan 4) and `enrollments` (plan 3).

- [ ] **Step 6: Commit**

```bash
git add docs/schema.md
git commit -m "docs(schema): people, users, governance and memberships are implemented"
```
