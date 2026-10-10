# Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the publishing half of the target schema:
- `partners`
- shared `credits[]`
- the article review flow, with email notifications
- `publications` (renamed from `article-collections`)
- reshaped `press` and `events`
- a `newsletters` archive
- a Resend email adapter

It also closes plan 3's draft-leak follow-up.

**Architecture:**
- **Review rules:** the article review state machine is a pure function in `src/lib/review.ts`. A `beforeChange` hook applies it, which makes approval the only way an article is published. An `afterChange` hook emails the admins or the authors.
- **Authors:** authors are people. An account owns an article when its person is among the authors.
- **Events:** events reuse plan 2's schedule, registration and pricing.
- **Email:** it goes through `@payloadcms/email-resend` when `RESEND_API_KEY` is set. Without the key, it goes to Payload's console fallback, so development needs no key.
- **Subscribers:** they stay in Resend Audiences (ADR 0005), so Payload stores none.

**Tech Stack:** Payload 3.90.2, `@payloadcms/email-resend` 3.90.2, Postgres, vitest, pnpm.

**Spec:** `docs/schema.md` (Shared shapes: `credits[]`, Partners, Publishing, the "Still to do" list), `CONTEXT.md` (Tier, Requested tier, Article, Review, Publication, Credit, Press item, Event, Newsletter, Partner), ADR 0005.

**Branch:** work directly on `main`, one commit per task. Don't push.

---

## Roadmap (this is plan 4 of 6)

1. People and identity (done)
2. Shared shapes (done)
3. Time, place and teaching (done)
4. **Publishing** (this plan)
5. Plugins: redirects and SEO
6. Archive import pipeline (ADR 0004)

## Decisions made in this plan

These fill gaps the spec leaves open. Where the grilling session (Q10, Q11, Q17–Q19) already decided something, this list follows it.

**Review**
- **Authors** may make exactly one move: from `draft` or `changes_requested` to `submitted`. Admins may make any move.
- **Approving** sets three things at once:
  - `_status: published`
  - `published_date`, unless it is already set
  - `tier`: the admin's choice if they picked one other than `owner`, otherwise the author's `requested_tier`
- **Every other review state forces `_status: draft`.** So `approved` is the only way to publish, and moving an approved article back to another state unpublishes it.
- **Re-saving an approved article** leaves `_status` as Payload set it, so an admin can still save a draft of edits.
- **Server-side calls with no user** (seeds, imports) are trusted like an admin.
- **A draft save may not change the review status.** Payload decides a draft save from the operation args before any hook runs, and a draft save writes only a version. The main document keeps its old review state and `_status`, so the latest version and the main document would disagree: an approval saved as a draft would email "published" while the article stayed unpublished, and an author's draft-save submit would leave the main document at `draft`, still editable. A `beforeOperation` hook records the draft save in `req.context`, and `applyReview` rejects one that changes the review status with a 400 ("use the main save button").
- **A duplicate starts review again.** A create always reviews from `draft`, because on create `originalDoc` is the duplicate source. Duplicating resets `review.status` to `draft`, and clears `review_note`, `published_date` and `featured`, through field `beforeDuplicate` hooks.

**Article access**
- **Who can write articles:** `member`, `fellow`, `non_degree_seeking` and admins. A non-admin also needs a linked person, since an article is owned through its authors.
- **Who can delete:** the same as edit. Admins always; an author only while the review is `draft` or `changes_requested`.
- **When an author can edit:** only while the review is `draft` or `changes_requested`. Once submitted, the article is locked to them.
- **New articles:** a non-admin's own person is added to `authors` automatically, so they never lock themselves out.

**Notification emails**
- Submitted: to every admin and super admin.
- Approved, changes requested, or rejected: to the accounts linked to the authors. The admin's note goes out only with changes requested or rejected, since it stays on the article afterwards.
- **Server writes are silent.** Only a write by a signed-in account sends mail. A write with no user (the seed, the archive import) sends nothing, and any caller can opt out with `context: { skipReviewEmail: true }`.
- A failed send is logged and never fails the save.

**Credits and article shapes**
- **Credit roles:** the union of the spec's list and the archive evidence from Q19: `author`, `editor`, `translator`, `copy_editor`, `proofreader`, `supervisor`, `coordinator`, `art_director`, `cover_designer`, `illustrator`, `photographer`, `other`. An optional localized `label` names an odd role exactly ("Translation & editing").
- **Article `translation` group:** `original_language`, `original_title`, `original_authors` (→ people), `original_url`, `original_source` (a citation), and `note` ("translated in 2018, not published before"). The translator goes in `credits[]` with the `translator` role.
- **`author` → `authors`:** it is renamed and now points at people. The virtual "Article Collection" field and its `afterRead` lookup are replaced by a `publications` join.

**Publications**
- **`kind`:** `essay_collection`, `translation_booklet`, `research` or `other`.
- **`license`:** `cc_by_nc_sa`, `cc_by_sa`, `cc_by` or `all_rights_reserved`. No version numbers, because the archive contradicts itself on them.
- **`publications` replaces `article-collections` outright.** The database is disposable, so nothing is migrated.

**Press**
- **`kind`:** `coverage`, `interview`, `talk` or `op_ed`.
- **`language`:** shared `LANGUAGE_OPTIONS`: `ar`, `en`, `de`, `fr`, `other`.
- **`authors[]` rows:** each row holds a `person` or a free-text `name`, never neither.
- **`date_precision`:** `day`, `month` or `year`.
- **Dropped:** the slug and logo. The logo belongs to the outlet partner.

**Partners**
- `kind` is `hasMany`, because one organisation can be both funder and co-host.
- Programmes get `partners[]` → partners.

**Events**
- **`event_type`** keeps the old six types and adds `book_discussion`, `music`, `panel`, `open_day`, `residency`, `visit` and `other`.
- **Speakers** are `{ person, role }`, with `role` as localized text ("moderator").
- **Partners** are `{ partner, role }`, with `role` one of `sponsor`, `co_host`, `venue`, `other`.
- **Read access:** events have no owners, so the `owner` tier means admins only.
- **Dropped:** `date`, `end_date`, `start_time`, `recurring`, `frequency`, `recurrence_until`, `location`, `fellows` and `registration_form`.

**Newsletters** have drafts, the public reads published issues, and `readVersions` is limited to admins.

**Versions endpoint:** `readVersions` is now set on courses (admins plus the course's fellows), articles (admins plus authors), programmes and newsletters (admins only). Payload applies `readVersions` to the versions table, where fields sit under `version.`, so the ownership rules go through `isAdminOrOwnVersions`, which prefixes them with Payload's `appendVersionToQueryKey`.

**Email sender:** `EMAIL_FROM_ADDRESS` defaults to `noreply@ci-las.org`.

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/lib/review.ts` | create | Review states, `canMove`, `reviewPatch`, `notifyOn`, `reviewEmail` |
| `src/lib/review-mail.ts` | create | Resolve recipients and send (needs Payload) |
| `src/access.ts` | modify | `ownsViaAuthors`, `canAuthor`, `isAdminOrOwnWhile`; drop `ownsViaAuthor` |
| `src/fields/credits.ts` | create | `creditsField()` |
| `src/fields/language.ts` | create | `LANGUAGE_OPTIONS` |
| `src/collections/Partners.ts` | create | Outside organisations |
| `src/collections/Articles.ts` | rewrite | Review flow, authors → people, credits, translation |
| `src/collections/Publications.ts` | create | Replaces `Article-collections.ts` |
| `src/collections/Article-collections.ts` | delete | |
| `src/collections/Press.ts` | rewrite | Target press shape |
| `src/collections/Events.ts` | rewrite | Schedule, venue, agenda, speakers, partners |
| `src/collections/Newsletters.ts` | create | Issue archive |
| `src/collections/Programmes.ts`, `Courses.ts` | modify | Programme `partners[]`; `readVersions` |
| `src/env.ts`, `src/payload.config.ts` | modify | Resend adapter; register collections |
| `seed/*` | modify | Seed the new shapes |
| `tests/unit/review.unit.spec.ts`, `access.unit.spec.ts`, `shape-fields.unit.spec.ts` | create/modify | |
| `tests/int/publishing.int.spec.ts` | create | Review flow, joins, validation against the database |
| `docs/schema.md` | modify | Drop finished sections |

**Commands**
- One spec: `pnpm vitest run --config ./vitest.config.mts <path>`.
- After every collection change: `pnpm generate:types`, then `npx tsc --noEmit`, which should print nothing.

**Before starting**
- **Baseline:** tsc is clean, lint has 0 errors, and 128 tests pass.
- **Uncommitted package files:** if `package.json`, `pnpm-lock.yaml` or `pnpm-workspace.yaml` have uncommitted changes that aren't yours, stop and ask the user to commit or stash them. Task 10 adds a dependency, and the two changes must not be mixed.

**Database warning:** Tasks 4–11 change collections. Don't run the dev server or the int tests until Task 12 resets the database.

---

### Task 1: Review state machine

**Files:**
- Create: `src/lib/review.ts`
- Test: `tests/unit/review.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { canMove, notifyOn, reviewEmail, reviewPatch } from '@/lib/review'

const now = new Date('2026-10-10T12:00:00.000Z')

describe('canMove', () => {
  it('lets an author only submit, from draft or changes requested', () => {
    expect(canMove('draft', 'submitted', false)).toBe(true)
    expect(canMove('changes_requested', 'submitted', false)).toBe(true)
    expect(canMove('submitted', 'approved', false)).toBe(false)
    expect(canMove('draft', 'approved', false)).toBe(false)
    expect(canMove('submitted', 'draft', false)).toBe(false)
  })

  it('allows staying put', () => {
    expect(canMove('submitted', 'submitted', false)).toBe(true)
  })

  it('lets an admin make any move', () => {
    expect(canMove('draft', 'approved', true)).toBe(true)
    expect(canMove('approved', 'rejected', true)).toBe(true)
  })
})

describe('reviewPatch', () => {
  it('refuses a move the author may not make', () => {
    expect(
      reviewPatch({ from: 'submitted', to: 'approved', trusted: false, data: {}, now }),
    ).toEqual({ error: 'Only an admin can move a submitted article to approved.' })
  })

  it('keeps every unapproved article a draft', () => {
    expect(reviewPatch({ from: 'draft', to: 'submitted', trusted: false, data: {}, now })).toEqual({
      patch: { _status: 'draft' },
    })
    expect(
      reviewPatch({ from: 'approved', to: 'changes_requested', trusted: true, data: {}, now }),
    ).toEqual({ patch: { _status: 'draft' } })
  })

  it('publishes on approval at the requested tier, dated now', () => {
    expect(
      reviewPatch({
        from: 'submitted',
        to: 'approved',
        trusted: true,
        data: { tier: 'owner', requested_tier: 'public' },
        now,
      }),
    ).toEqual({
      patch: { _status: 'published', tier: 'public', published_date: '2026-10-10T12:00:00.000Z' },
    })
  })

  it("keeps an admin's lower tier and an existing date", () => {
    expect(
      reviewPatch({
        from: 'submitted',
        to: 'approved',
        trusted: true,
        data: { tier: 'community', requested_tier: 'public', published_date: '2018-01-01' },
        now,
      }),
    ).toEqual({ patch: { _status: 'published', tier: 'community', published_date: '2018-01-01' } })
  })

  it('defaults to community when no tier was requested', () => {
    expect(
      reviewPatch({ from: 'draft', to: 'approved', trusted: true, data: {}, now }),
    ).toMatchObject({ patch: { tier: 'community' } })
  })

  it('leaves an already approved article alone', () => {
    expect(
      reviewPatch({ from: 'approved', to: 'approved', trusted: true, data: {}, now }),
    ).toEqual({ patch: {} })
  })
})

describe('notifyOn', () => {
  it('tells admins about a submission and authors about a decision', () => {
    expect(notifyOn('draft', 'submitted')).toBe('admins')
    expect(notifyOn('submitted', 'approved')).toBe('authors')
    expect(notifyOn('submitted', 'changes_requested')).toBe('authors')
    expect(notifyOn('submitted', 'rejected')).toBe('authors')
  })

  it('stays quiet when nothing moved or the move needs no one', () => {
    expect(notifyOn('submitted', 'submitted')).toBeNull()
    expect(notifyOn('approved', 'draft')).toBeNull()
  })
})

describe('reviewEmail', () => {
  it('names the article and includes the note', () => {
    expect(reviewEmail('changes_requested', 'On Ignorance', 'Shorten the intro.')).toEqual({
      subject: 'Changes requested: On Ignorance',
      text: '"On Ignorance" needs changes before it can be published.\n\nNote from the editor:\nShorten the intro.',
    })
  })

  it('leaves the note out when there is none', () => {
    expect(reviewEmail('submitted', 'On Ignorance', null)).toEqual({
      subject: 'Submitted for review: On Ignorance',
      text: '"On Ignorance" was submitted for review.',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/review.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/lib/review"`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * The article review path (CONTEXT.md): draft → submitted → changes requested
 * → approved or rejected. Approval is the only way an article is published.
 */

export const REVIEW_STATES = [
  'draft',
  'submitted',
  'changes_requested',
  'approved',
  'rejected',
] as const
export type ReviewState = (typeof REVIEW_STATES)[number]

export type Tier = 'owner' | 'community' | 'public'

const AUTHOR_MOVES: Record<ReviewState, ReviewState[]> = {
  draft: ['submitted'],
  changes_requested: ['submitted'],
  submitted: [],
  approved: [],
  rejected: [],
}

const LABELS: Record<ReviewState, string> = {
  draft: 'draft',
  submitted: 'submitted',
  changes_requested: 'changes requested',
  approved: 'approved',
  rejected: 'rejected',
}

/** Authors may only submit; admins (and trusted server calls) may do anything. */
export const canMove = (from: ReviewState, to: ReviewState, trusted: boolean): boolean =>
  from === to || trusted || AUTHOR_MOVES[from].includes(to)

type ReviewData = {
  tier?: Tier | null
  requested_tier?: Exclude<Tier, 'owner'> | null
  published_date?: string | null
}

type Patch = { _status?: 'draft' | 'published'; tier?: Tier; published_date?: string }

/**
 * What a review move changes. Every state but approved keeps the article a
 * draft; moving into approved publishes it at the admin's tier, or else the
 * requested one.
 */
export const reviewPatch = ({
  from,
  to,
  trusted,
  data,
  now,
}: {
  from: ReviewState
  to: ReviewState
  trusted: boolean
  data: ReviewData
  now: Date
}): { error: string } | { patch: Patch } => {
  if (!canMove(from, to, trusted)) {
    return { error: `Only an admin can move a ${LABELS[from]} article to ${LABELS[to]}.` }
  }
  if (to !== 'approved') return { patch: { _status: 'draft' } }
  if (from === 'approved') return { patch: {} }
  return {
    patch: {
      _status: 'published',
      tier: data.tier && data.tier !== 'owner' ? data.tier : (data.requested_tier ?? 'community'),
      published_date: data.published_date ?? now.toISOString(),
    },
  }
}

/** Who hears about a move: admins review submissions, authors hear decisions. */
export const notifyOn = (from: ReviewState, to: ReviewState): 'admins' | 'authors' | null => {
  if (from === to) return null
  if (to === 'submitted') return 'admins'
  if (to === 'approved' || to === 'changes_requested' || to === 'rejected') return 'authors'
  return null
}

const MESSAGES: Partial<Record<ReviewState, { subject: string; text: string }>> = {
  submitted: { subject: 'Submitted for review', text: 'was submitted for review.' },
  approved: { subject: 'Published', text: 'was approved and is now published.' },
  changes_requested: {
    subject: 'Changes requested',
    text: 'needs changes before it can be published.',
  },
  rejected: { subject: 'Not accepted', text: 'was not accepted for publication.' },
}

/** Plain-text notification for a review state. */
export const reviewEmail = (
  state: ReviewState,
  title: string,
  note?: string | null,
): { subject: string; text: string } => {
  const message = MESSAGES[state] ?? { subject: 'Review update', text: `is now ${LABELS[state]}.` }
  return {
    subject: `${message.subject}: ${title}`,
    text: `"${title}" ${message.text}${note ? `\n\nNote from the editor:\n${note}` : ''}`,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/review.unit.spec.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/review.ts tests/unit/review.unit.spec.ts
git commit -m "feat(lib): article review state machine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Author access rules

**Files:**
- Modify: `src/access.ts`
- Test: `tests/unit/access.unit.spec.ts`

- [ ] **Step 1: Write the failing tests**

Read `tests/unit/access.unit.spec.ts` first and reuse its user and request helpers. Remove any test of `ownsViaAuthor`. Add tests that pin down these behaviours, written in the file's own helper style:

- `ownsViaAuthors` takes a user with a person 7 and gives `{ authors: { contains: 7 } }`. With no person, it gives `false`.
- `canAuthor` is `true` for each of `member`, `fellow`, `non_degree_seeking`, `admin` and `super_admin`. It is `false` for anonymous.
- `isAdminOrOwnWhile(ownsViaAuthors, { 'review.status': { in: ['draft', 'changes_requested'] } })`:
  - an admin gives `true`;
  - anonymous gives `false`;
  - a member with person 7 gives `{ and: [{ authors: { contains: 7 } }, { 'review.status': { in: ['draft', 'changes_requested'] } }] }`;
  - a member with no person gives `false`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/access.unit.spec.ts`
Expected: FAIL, `ownsViaAuthors is not a function`.

- [ ] **Step 3: Implement**

In `src/access.ts`, replace `ownsViaAuthor` with:

```ts
export const ownsViaAuthors: Ownership = (user) => {
  const person = personOf(user)
  return person === null ? false : { authors: { contains: person } }
}
```

Add after `isAdminOrOwn`:

```ts
/** Who may write articles: community members, fellows, visiting students and admins. */
export const canAuthor: Access = ({ req }) =>
  hasRole(req.user, 'member', 'fellow', 'non_degree_seeking', 'admin', 'super_admin')

/**
 * Admins edit anything; an owner only while the document also matches
 * `while` (e.g. an article still with its author, not yet submitted).
 */
export const isAdminOrOwnWhile =
  (owned: Ownership, where: Where): Access =>
  ({ req }) => {
    if (isAdminUser(req.user)) return true
    if (!req.user) return false
    const owns = owned(req.user)
    return owns ? { and: [owns, where] } : false
  }
```

`src/collections/Articles.ts` still imports `ownsViaAuthor`. Change that import to `ownsViaAuthors`, and the call sites to match, so tsc passes. Task 5 rewrites the file anyway.

- [ ] **Step 4: Run tests and type-check**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/access.unit.spec.ts && npx tsc --noEmit`
Expected: the tests PASS. tsc may fail only because `Articles.ts` refers to `authors`, which doesn't exist on the collection yet. That is acceptable only if the failure is a type error inside `Articles.ts`'s `where` constraint. Otherwise, fix it.

- [ ] **Step 5: Commit**

```bash
git add src/access.ts src/collections/Articles.ts tests/unit/access.unit.spec.ts
git commit -m "feat(access): article authorship rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Credits and language fields

**Files:**
- Create: `src/fields/credits.ts`, `src/fields/language.ts`
- Test: `tests/unit/shape-fields.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

Add the imports to `tests/unit/shape-fields.unit.spec.ts`, which already has `names()`:

```ts
import { CREDIT_ROLES, creditsField } from '@/fields/credits'
import { LANGUAGE_OPTIONS } from '@/fields/language'
```

```ts
describe('credits and language', () => {
  it('builds credits as role, label and people', () => {
    const field = creditsField()
    expect(field.name).toBe('credits')
    expect(names(field.fields)).toEqual(['role', 'label', 'people'])
  })

  it('covers the roles the archive credits', () => {
    expect(CREDIT_ROLES).toEqual([
      'author',
      'editor',
      'translator',
      'copy_editor',
      'proofreader',
      'supervisor',
      'coordinator',
      'art_director',
      'cover_designer',
      'illustrator',
      'photographer',
      'other',
    ])
  })

  it('lists the languages content comes in', () => {
    expect(LANGUAGE_OPTIONS.map((o) => o.value)).toEqual(['ar', 'en', 'de', 'fr', 'other'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/fields/credits"`.

- [ ] **Step 3: Implement**

`src/fields/language.ts`:

```ts
/** Languages a piece of content or coverage is written in. */
export const LANGUAGE_OPTIONS = [
  { label: 'Arabic', value: 'ar' },
  { label: 'English', value: 'en' },
  { label: 'German', value: 'de' },
  { label: 'French', value: 'fr' },
  { label: 'Other', value: 'other' },
] as const satisfies ReadonlyArray<{ label: string; value: string }>
```

`src/fields/credits.ts`:

```ts
import type { ArrayField } from 'payload'

export const CREDIT_ROLES = [
  'author',
  'editor',
  'translator',
  'copy_editor',
  'proofreader',
  'supervisor',
  'coordinator',
  'art_director',
  'cover_designer',
  'illustrator',
  'photographer',
  'other',
] as const

const label = (role: string): string =>
  role.charAt(0).toUpperCase() + role.slice(1).replaceAll('_', ' ')

/**
 * Named contributions to an article or publication (CONTEXT.md). One row per
 * role; `label` names an odd role exactly, e.g. "Translation & editing".
 */
export const creditsField = (): ArrayField => ({
  name: 'credits',
  type: 'array',
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'role',
          type: 'select',
          required: true,
          options: CREDIT_ROLES.map((value) => ({ label: label(value), value })),
          admin: { width: '30%' },
        },
        { name: 'label', type: 'text', localized: true, admin: { width: '70%' } },
      ],
    },
    { name: 'people', type: 'relationship', relationTo: 'people', hasMany: true, required: true },
  ],
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/fields/credits.ts src/fields/language.ts tests/unit/shape-fields.unit.spec.ts
git commit -m "feat(fields): credits and content languages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Partners

**Files:**
- Create: `src/collections/Partners.ts`, `seed/collections/partners.seed.ts`
- Modify: `src/payload.config.ts`, `src/collections/Programmes.ts`, `seed/seed.type.ts`, `seed/seed.utils.ts`, `seed/index.ts`

- [ ] **Step 1: Create the collection**

```ts
import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/access'
import { slugField } from '@/fields/slug'
import { httpUrl } from '@/fields/validators'

/** An outside organisation CILAS works with: funders, co-hosts, press outlets. */
export const Partners: CollectionConfig = {
  slug: 'partners',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'url'],
  },
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    slugField({ useAsSlug: 'name' }),
    {
      // One organisation can be both, e.g. a funder that co-hosts an event.
      name: 'kind',
      type: 'select',
      hasMany: true,
      required: true,
      options: [
        { label: 'Funder', value: 'funder' },
        { label: 'Co-host', value: 'co_host' },
        { label: 'Press outlet', value: 'outlet' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'url',
      type: 'text',
      validate: (value: unknown) => (value ? httpUrl(value) : true),
      admin: { placeholder: 'https://…' },
    },
    { name: 'logo', type: 'upload', relationTo: 'media' },
  ],
}
```

Register `Partners` in `src/payload.config.ts` after `Spaces`.

In `src/collections/Programmes.ts`, add after `pricingField(...)`:

```ts
    { name: 'partners', type: 'relationship', relationTo: 'partners', hasMany: true },
```

- [ ] **Step 2: Seed partners**

- In `seed/seed.type.ts`:
  - Add `partners: IdMap` to `SeedContext`, with the comment `/** Partner names, resolved to ids. */`.
  - Add `partners: {}` to `createSeedContext()`.
  - Add:

```ts
export type PartnerSeed = {
  name: string
  kind: Array<'funder' | 'co_host' | 'outlet' | 'other'>
  url?: string
}
```

`seed/collections/partners.seed.ts`:

```ts
import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { PartnerSeed, SeedContext } from '../seed.type'
import { getOrCreateId } from '../seed.utils'

export const partnersData: PartnerSeed[] = [
  { name: 'Arab Council for the Social Sciences', kind: ['funder'], url: 'https://www.theacss.org' },
  { name: 'Ford Foundation', kind: ['funder'], url: 'https://www.fordfoundation.org' },
  { name: 'Mada Masr', kind: ['outlet'], url: 'https://www.madamasr.com' },
  { name: 'OpenDemocracy', kind: ['outlet'], url: 'https://www.opendemocracy.net' },
  { name: 'Egyptian Streets', kind: ['outlet'], url: 'https://egyptianstreets.com' },
  { name: 'Al-Fanar Media', kind: ['outlet'], url: 'https://www.al-fanarmedia.org' },
  { name: 'Mashallah News', kind: ['outlet'], url: 'https://www.mashallahnews.com' },
]

export const seedPartners = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const partner of partnersData) {
    ctx.partners[partner.name] = await getOrCreateId(
      payload,
      'partners',
      { name: { equals: partner.name } },
      () =>
        payload.create({
          collection: 'partners',
          data: { ...partner, slug: slugify(partner.name) },
          overrideAccess: true,
        }),
    )
    console.log('partner:', partner.name)
  }
}
```

- In `seed/index.ts`, import `seedPartners` and call `await seedPartners(payload, ctx)` directly after `seedSpaces`.
- In `seed/seed.utils.ts`, add `'partners'` to `CONTENT_COLLECTIONS`, just before `'spaces'`.

- [ ] **Step 3: Regenerate types and type-check**

Run: `pnpm generate:types && npx tsc --noEmit`
Expected: no output, apart from the Task 2 `Articles.ts` error if it is still there.

- [ ] **Step 4: Commit**

```bash
git add src/collections/Partners.ts src/collections/Programmes.ts src/payload.config.ts src/payload-types.ts seed
git commit -m "feat(partners): outside organisations, linked from programmes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Articles

**Files:**
- Rewrite: `src/collections/Articles.ts`
- Create: `src/lib/review-mail.ts`
- Modify: `seed/collections/articles.seed.ts`, `seed/seed.type.ts`

- [ ] **Step 1: Create the mail helper**

`src/lib/review-mail.ts`:

```ts
import type { PayloadRequest } from 'payload'

import { reviewEmail, type ReviewState } from '@/lib/review'

const emailsOf = (docs: Array<{ email?: string | null }>): string[] =>
  docs.map((d) => d.email).filter((e): e is string => Boolean(e))

/** Accounts that review submissions. */
export const adminEmails = async (req: PayloadRequest): Promise<string[]> => {
  const { docs } = await req.payload.find({
    collection: 'users',
    where: { roles: { in: ['admin', 'super_admin'] } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
  })
  return emailsOf(docs)
}

/** Accounts linked to an article's authors; authors without one get no mail. */
export const authorEmails = async (req: PayloadRequest, people: number[]): Promise<string[]> => {
  if (!people.length) return []
  const { docs } = await req.payload.find({
    collection: 'users',
    where: { person: { in: people } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
  })
  return emailsOf(docs)
}

/** Sends one review notification. A failed send is logged, never thrown. */
export const sendReviewEmail = async (
  req: PayloadRequest,
  to: string[],
  state: ReviewState,
  title: string,
  note?: string | null,
): Promise<void> => {
  if (!to.length) return
  try {
    await req.payload.sendEmail({ to, ...reviewEmail(state, title, note) })
  } catch (error) {
    req.payload.logger.error({ err: error, msg: `Review email for "${title}" failed` })
  }
}
```

- [ ] **Step 2: Rewrite the collection**

```ts
import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'
import { APIError } from 'payload'

import {
  canAuthor,
  canSetTier,
  isAdminOrOwn,
  isAdminOrOwnAndDraft,
  isAdminOrOwnWhile,
  isAdminUser,
  ownsViaAuthors,
  personOf,
  readTiers,
} from '@/access'
import { creditsField } from '@/fields/credits'
import { LANGUAGE_OPTIONS } from '@/fields/language'
import { slugField } from '@/fields/slug'
import { toPersonIds } from '@/lib/fellow-role'
import { notifyOn, reviewPatch, type ReviewState } from '@/lib/review'
import { adminEmails, authorEmails, sendReviewEmail } from '@/lib/review-mail'
import type { Article } from '@/payload-types'

/**
 * A non-admin's new article always lists them as an author, so they keep
 * access to it. beforeValidate, because `authors` is required and validation
 * runs before beforeChange.
 */
export const addSelfAsAuthor: CollectionBeforeValidateHook<Article> = ({
  data,
  req,
  operation,
}) => {
  const self = personOf(req.user)
  if (!data || operation !== 'create' || isAdminUser(req.user) || self === null) return data
  const authors = toPersonIds(data.authors)
  return authors.includes(self) ? data : { ...data, authors: [...authors, self] }
}

/**
 * Applies the review rules (src/lib/review.ts) to every write. Server calls
 * with no user (seeds, imports) are trusted like an admin.
 */
export const applyReview: CollectionBeforeChangeHook<Article> = ({
  data,
  originalDoc,
  req,
}) => {
  const trusted = !req.user || isAdminUser(req.user)
  const from: ReviewState = originalDoc?.review?.status ?? 'draft'
  const to: ReviewState = data.review?.status ?? from

  const result = reviewPatch({
    from,
    to,
    trusted,
    data: {
      tier: data.tier ?? originalDoc?.tier,
      requested_tier: data.requested_tier ?? originalDoc?.requested_tier,
      published_date: data.published_date ?? originalDoc?.published_date,
    },
    now: new Date(),
  })
  if ('error' in result) throw new APIError(result.error, 403)

  return { ...data, ...result.patch }
}

/** Emails admins on submission and authors on a decision. */
export const notifyReview: CollectionAfterChangeHook<Article> = async ({
  doc,
  previousDoc,
  req,
}) => {
  const state: ReviewState = doc.review?.status ?? 'draft'
  const audience = notifyOn(previousDoc?.review?.status ?? 'draft', state)
  if (!audience) return doc

  const to =
    audience === 'admins'
      ? await adminEmails(req)
      : await authorEmails(req, toPersonIds(doc.authors))
  await sendReviewEmail(req, to, state, doc.title, doc.review?.review_note)
  return doc
}

/** A piece of writing by members of the community, published after review. */
export const Articles: CollectionConfig = {
  slug: 'articles',
  access: {
    read: readTiers(ownsViaAuthors, { drafts: true }),
    readVersions: isAdminOrOwn(ownsViaAuthors),
    create: canAuthor,
    // Authors edit only while the article is with them, not once submitted.
    update: isAdminOrOwnWhile(ownsViaAuthors, {
      'review.status': { in: ['draft', 'changes_requested'] },
    }),
    delete: isAdminOrOwnAndDraft(ownsViaAuthors),
  },
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'authors', 'review.status', 'tier'],
  },
  hooks: {
    beforeValidate: [addSelfAsAuthor],
    beforeChange: [applyReview],
    afterChange: [notifyReview],
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'body', type: 'richText', localized: true },
    {
      name: 'authors',
      type: 'relationship',
      relationTo: 'people',
      hasMany: true,
      required: true,
      admin: { position: 'sidebar' },
    },
    { name: 'cover_image', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    {
      label: 'Review',
      type: 'collapsible',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'review',
          type: 'group',
          fields: [
            {
              name: 'status',
              type: 'select',
              required: true,
              defaultValue: 'draft',
              options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Submitted', value: 'submitted' },
                { label: 'Changes requested', value: 'changes_requested' },
                { label: 'Approved', value: 'approved' },
                { label: 'Rejected', value: 'rejected' },
              ],
              // A draft save only writes a version, so submitting must be a full save:
              // choose Submitted, then save with the main button. It stays unpublished.
              admin: { description: 'Ready for an editor? Choose Submitted, then save.' },
            },
            {
              name: 'review_note',
              type: 'textarea',
              access: { create: canSetTier, update: canSetTier },
            },
          ],
        },
        {
          name: 'requested_tier',
          type: 'select',
          defaultValue: 'community',
          options: [
            { label: 'Community', value: 'community' },
            { label: 'Public', value: 'public' },
          ],
          admin: { description: 'Who you would like to read it. An editor decides.' },
        },
        {
          // Who may see it. Admin-only; approval fills it in.
          name: 'tier',
          type: 'select',
          required: true,
          defaultValue: 'owner',
          options: [
            { label: 'Owner only', value: 'owner' },
            { label: 'Community', value: 'community' },
            { label: 'Public', value: 'public' },
          ],
          access: { create: canSetTier, update: canSetTier },
        },
        {
          name: 'published_date',
          type: 'date',
          access: { create: canSetTier, update: canSetTier },
        },
        {
          name: 'featured',
          type: 'checkbox',
          label: 'Feature on home page',
          access: { create: canSetTier, update: canSetTier },
        },
      ],
    },
    creditsField(),
    {
      label: 'Translation',
      type: 'collapsible',
      admin: { initCollapsed: true, description: 'Only for translated articles.' },
      fields: [
        {
          name: 'translation',
          type: 'group',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'original_language',
                  type: 'select',
                  options: [...LANGUAGE_OPTIONS],
                  admin: { width: '30%' },
                },
                { name: 'original_title', type: 'text', admin: { width: '70%' } },
              ],
            },
            { name: 'original_authors', type: 'relationship', relationTo: 'people', hasMany: true },
            { name: 'original_url', type: 'text' },
            { name: 'original_source', type: 'text' }, // citation of where it first appeared
            { name: 'note', type: 'text', localized: true }, // "translated in 2018, not published before"
          ],
        },
      ],
    },
    {
      label: 'Related',
      type: 'collapsible',
      admin: { initCollapsed: true },
      fields: [
        { name: 'tags', type: 'array', fields: [{ name: 'tag', type: 'text' }] },
        {
          name: 'related_articles',
          type: 'relationship',
          relationTo: 'articles',
          hasMany: true,
          admin: { description: 'Editor-curated. If empty, articles sharing tags are suggested.' },
        },
        {
          name: 'publications',
          type: 'join',
          collection: 'publications',
          on: 'articles',
          admin: { allowCreate: false },
        },
      ],
    },
  ],
}
```

The `publications` join refers to a collection created in Task 6, so Payload won't sanitize until then. Do Task 6's Step 1 and the config registration before running `generate:types` in Step 4. Alternatively, leave the join out here and add it in Task 6. Either is fine; say which you did.

- [ ] **Step 3: Reseed articles**

In `seed/seed.type.ts`, `ArticleSeed` becomes:

```ts
export type ArticleSeed = Omit<
  Draft<Article>,
  'body' | 'authors' | 'slug' | 'review' | 'requested_tier'
> & {
  /** String => one paragraph; array => one paragraph per entry. */
  body?: string | string[]
  /** Arabic title, written in a follow-up `locale: 'ar'` update. */
  title_ar: string
  /** Arabic body, written in the same follow-up `locale: 'ar'` update. */
  body_ar?: string | string[]
  /** Fixture email of the author's person. */
  author_email: string
}
```

In `seed/collections/articles.seed.ts`, the create `data` becomes:

```ts
        data: {
          ...rest,
          title,
          slug: slugify(title),
          body: body ? lexical(body) : null,
          authors: [requireId(ctx.people, author_email)],
          // Seeded articles are already published: approval publishes them at
          // their tier (the seed runs without a user, so it is trusted).
          requested_tier: rest.tier === 'public' ? 'public' : 'community',
          review: { status: 'approved' },
        },
```

The Arabic follow-up `update` stays as it is. Because the review stays `approved`, the patch is empty.

- [ ] **Step 4: Regenerate types and type-check**

Run: `pnpm generate:types && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Articles.ts src/lib/review-mail.ts src/payload-types.ts seed
git commit -m "feat(articles): review flow publishes, authors are people, credits and translation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Publications

**Files:**
- Create: `src/collections/Publications.ts`, `seed/collections/publications.seed.ts`
- Delete: `src/collections/Article-collections.ts`, `seed/collections/article-collections.seed.ts`
- Modify: `src/payload.config.ts`, `seed/seed.type.ts`, `seed/seed.utils.ts`, `seed/index.ts`

- [ ] **Step 1: Create the collection**

```ts
import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/access'
import { creditsField } from '@/fields/credits'
import { slugField } from '@/fields/slug'
import { httpUrl } from '@/fields/validators'

/**
 * An edited collection of articles, often produced by a course or lab
 * (CONTEXT.md). Its texts are articles; no PDF is stored (ADR 0004).
 */
export const Publications: CollectionConfig = {
  slug: 'publications',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'year_from'],
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Essay collection', value: 'essay_collection' },
        { label: 'Translation booklet', value: 'translation_booklet' },
        { label: 'Research', value: 'research' },
        { label: 'Other', value: 'other' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'cover_image', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    {
      type: 'row',
      admin: { position: 'sidebar' },
      fields: [
        { name: 'year_from', type: 'number', min: 2012, max: 2100, admin: { width: '50%' } },
        { name: 'year_to', type: 'number', min: 2012, max: 2100, admin: { width: '50%' } },
      ],
    },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'subtitle', type: 'text', localized: true },
    { name: 'intro', type: 'richText', localized: true },
    {
      name: 'foreword',
      type: 'relationship',
      relationTo: 'articles',
      admin: { description: 'A signed essay, so it is an article.' },
    },
    {
      name: 'articles',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      admin: { description: 'In reading order.' },
    },
    creditsField(),
    {
      label: 'Provenance',
      type: 'collapsible',
      fields: [
        { name: 'produced_by', type: 'relationship', relationTo: 'courses', hasMany: true },
        { name: 'funders', type: 'relationship', relationTo: 'partners', hasMany: true },
        {
          name: 'license',
          type: 'select',
          options: [
            { label: 'CC BY-NC-SA', value: 'cc_by_nc_sa' },
            { label: 'CC BY-SA', value: 'cc_by_sa' },
            { label: 'CC BY', value: 'cc_by' },
            { label: 'All rights reserved', value: 'all_rights_reserved' },
          ],
        },
        {
          // A link to the designed print edition, e.g. a Wayback copy. No file is stored.
          name: 'print_edition_url',
          type: 'text',
          validate: (value: unknown) => (value ? httpUrl(value) : true),
        },
      ],
    },
  ],
}
```

In `src/payload.config.ts`:
- Replace the `ArticleCollections` import with `Publications`.
- Register `Publications` in its slot.
- Delete `src/collections/Article-collections.ts`.

- [ ] **Step 2: Reseed**

- `git mv seed/collections/article-collections.seed.ts seed/collections/publications.seed.ts`.
- In it:
  - Rename `articleCollectionsData` → `publicationsData`, `seedArticleCollections` → `seedPublications`, and `'article-collections'` → `'publications'`.
  - Rename `description` / `description_ar` → `intro` / `intro_ar`.
  - Write the first entry's first article title (the foreword) to `foreword` as well, and keep it in `articles`.
  - Store the id map under `ctx.publications`.
  - Add these fields to the two entries:

```ts
    // On the Emergence of Pigeon Towers
    kind: 'essay_collection',
    year_from: 2018,
    license: 'cc_by_nc_sa',
    funders: ['Arab Council for the Social Sciences', 'Ford Foundation'],
```

```ts
    // Works of the Translation Lab
    kind: 'translation_booklet',
    year_from: 2016,
    year_to: 2018,
    license: 'cc_by_nc_sa',
```

- The seeder resolves `funders` with `requireIds(ctx.partners, funders ?? [])`. It sets `foreword` to the resolved id of `articles[0]` for the essay collection only; add `foreword: true` to that entry's seed data as a flag.
- In `seed/seed.type.ts`:
  - Rename `ArticleCollectionSeed` → `PublicationSeed`, typed from `Draft<Publication>`.
  - Omit `'intro' | 'subtitle' | 'articles' | 'cover_image' | 'slug' | 'funders' | 'foreword'`, then add back `intro?: string | string[]`, `intro_ar?: string | string[]`, `funders?: string[]` and `foreword?: boolean`.
  - Rename `SeedContext.articleCollections` → `publications`, in `createSeedContext()` too.
- In `seed/seed.utils.ts`, change `'article-collections'` → `'publications'` in `CONTENT_COLLECTIONS`.
- In `seed/index.ts`, update the import and the call.

- [ ] **Step 3: Regenerate types and type-check**

Run: `pnpm generate:types && npx tsc --noEmit`
Expected: no output. If Task 5 left the `publications` join out, add it to `Articles.ts` now and run both commands again.

- [ ] **Step 4: Commit**

```bash
git add -A src/collections src/payload.config.ts src/payload-types.ts seed
git commit -m "feat(publications): replace article collections with credited, funded publications

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Press

**Files:**
- Rewrite: `src/collections/Press.ts`, `seed/collections/press.seed.ts`
- Modify: `seed/seed.type.ts`, `seed/index.ts`, `src/fields/slug.ts`

- [ ] **Step 1: Rewrite the collection**

```ts
import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/access'
import { LANGUAGE_OPTIONS } from '@/fields/language'
import { httpUrl } from '@/fields/validators'

/** Coverage of CILAS by an outside outlet (CONTEXT.md). */
export const Press: CollectionConfig = {
  slug: 'press',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'outlet', 'published_date', 'kind'],
  },
  defaultSort: '-published_date',
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'coverage',
      options: [
        { label: 'Coverage', value: 'coverage' },
        { label: 'Interview', value: 'interview' },
        { label: 'Talk', value: 'talk' },
        { label: 'Op-ed', value: 'op_ed' },
      ],
      admin: { position: 'sidebar' },
    },
    // As published, in its own language; never translated.
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'language',
          type: 'select',
          options: [...LANGUAGE_OPTIONS],
          admin: { width: '30%' },
        },
        { name: 'outlet', type: 'relationship', relationTo: 'partners', admin: { width: '70%' } },
      ],
    },
    {
      name: 'authors',
      type: 'array',
      admin: { description: 'A person with a profile, or just a name.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'person', type: 'relationship', relationTo: 'people', admin: { width: '50%' } },
            {
              name: 'name',
              type: 'text',
              admin: { width: '50%' },
              validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
                value || siblingData.person ? true : 'Pick a person or type a name.',
            },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'published_date',
          type: 'date',
          admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
        },
        {
          name: 'date_precision',
          type: 'select',
          defaultValue: 'day',
          options: [
            { label: 'Day', value: 'day' },
            { label: 'Month', value: 'month' },
            { label: 'Year', value: 'year' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'links',
      type: 'array',
      minRows: 1,
      admin: { description: 'One per language the piece appeared in.' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'language',
              type: 'select',
              options: [...LANGUAGE_OPTIONS],
              admin: { width: '20%' },
            },
            {
              name: 'url',
              type: 'text',
              required: true,
              validate: httpUrl,
              admin: { width: '40%' },
            },
            {
              // Wayback copy, shown when the original is gone.
              name: 'archived_url',
              type: 'text',
              validate: (value: unknown) => (value ? httpUrl(value) : true),
              admin: { width: '40%' },
            },
          ],
        },
      ],
    },
    { name: 'excerpt', type: 'textarea', localized: true },
  ],
}
```

If tsc rejects the inline `validate` on `name`, type it as `TextFieldSingleValidation` from `payload`, as `src/fields/schedule.ts` does.

`optionalSlugField` in `src/fields/slug.ts` was only used by press. Delete it and its doc comment.

- [ ] **Step 2: Reseed**

In `seed/seed.type.ts`, `PressSeed` becomes:

```ts
export type PressSeed = {
  title: string
  /** Partner name, resolved to an id. */
  outlet: string
  url: string
  published_date: string
  date_precision?: 'day' | 'month' | 'year'
  language?: 'ar' | 'en' | 'de' | 'fr' | 'other'
}
```

Rewrite `seed/collections/press.seed.ts`:
- Keep the five items, mapping `organisation` → `outlet` (the partner names from Task 4), `article_title` → `title` and `article_url` → `url`. All are `language: 'en'`.
- The two `-01-01` dates get `date_precision: 'year'`, and `2013-08-01` gets `'month'`.
- The seeder:

```ts
export const seedPress = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const { outlet, url, language, ...item } of pressData) {
    await getOrCreateId(payload, 'press', { title: { equals: item.title } }, () =>
      payload.create({
        collection: 'press',
        data: {
          ...item,
          kind: 'coverage',
          language,
          outlet: requireId(ctx.partners, outlet),
          links: [{ language, url }],
        },
        overrideAccess: true,
      }),
    )
    console.log('press:', item.title)
  }
}
```

In `seed/index.ts`, the call becomes `seedPress(payload, ctx)`.

- [ ] **Step 3: Regenerate types and type-check**

Run: `pnpm generate:types && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/collections/Press.ts src/fields/slug.ts src/payload-types.ts seed
git commit -m "feat(press): outlets, mixed authors, dated links in several languages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Events

**Files:**
- Rewrite: `src/collections/Events.ts`, `seed/collections/events.seed.ts`
- Modify: `seed/seed.type.ts`, `seed/seed.utils.ts`

- [ ] **Step 1: Rewrite the collection**

```ts
import type { CollectionConfig } from 'payload'

import { canSetTier, isAdmin, readTiers } from '@/access'
import { pricingField } from '@/fields/pricing'
import { registrationField } from '@/fields/registration'
import { scheduleField, timeRangeFields } from '@/fields/schedule'
import { slugField } from '@/fields/slug'
import { httpUrl } from '@/fields/validators'

const optionalUrl = (value: unknown) => (value ? httpUrl(value) : true)

/**
 * A gathering that is not a course (CONTEXT.md). Its dates come from the same
 * schedule as courses (ADR 0002), so one expansion feeds the calendar.
 */
export const Events: CollectionConfig = {
  slug: 'events',
  access: {
    // Events have no owners: the owner tier means admins only.
    read: readTiers(),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'event_type', 'schedule.start_date', 'tier'],
  },
  fields: [
    {
      name: 'tier',
      type: 'select',
      required: true,
      defaultValue: 'owner',
      options: [
        { label: 'Owner only', value: 'owner' },
        { label: 'Community', value: 'community' },
        { label: 'Public', value: 'public' },
      ],
      access: { create: canSetTier, update: canSetTier },
      admin: { position: 'sidebar' },
    },
    {
      name: 'event_type',
      type: 'select',
      required: true,
      options: [
        { label: 'Talk', value: 'talk' },
        { label: 'Panel', value: 'panel' },
        { label: 'Book discussion', value: 'book_discussion' },
        { label: 'Reading group', value: 'reading_group' },
        { label: 'Screening', value: 'screening' },
        { label: 'Performance', value: 'performance' },
        { label: 'Music', value: 'music' },
        { label: 'Exhibition', value: 'exhibition' },
        { label: 'Open day', value: 'open_day' },
        { label: 'Workshop', value: 'workshop' },
        { label: 'Residency', value: 'residency' },
        { label: 'Visit', value: 'visit' },
        { label: 'Other', value: 'other' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'series',
      type: 'relationship',
      relationTo: 'events',
      filterOptions: ({ id }) => (id ? { id: { not_equals: id } } : true),
      admin: { position: 'sidebar', description: 'The event this one is part of.' },
    },
    { name: 'programme', type: 'relationship', relationTo: 'programmes', admin: { position: 'sidebar' } },
    { name: 'course', type: 'relationship', relationTo: 'courses', admin: { position: 'sidebar' } },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'description', type: 'richText', localized: true },
    scheduleField(),
    {
      label: 'Where',
      type: 'collapsible',
      fields: [
        { name: 'space', type: 'relationship', relationTo: 'spaces' },
        {
          name: 'external_venue',
          type: 'group',
          admin: { description: 'Only when it is not at a CILAS space.' },
          fields: [
            { name: 'name', type: 'text', localized: true },
            { name: 'address', type: 'text', localized: true },
            { name: 'map_url', type: 'text', validate: optionalUrl },
          ],
        },
        { name: 'online_url', type: 'text', validate: optionalUrl },
      ],
    },
    {
      name: 'agenda',
      type: 'array',
      admin: { description: 'Time blocks within the day, in Cairo time.' },
      fields: [
        { type: 'row', fields: [...timeRangeFields('25%')] },
        { name: 'title', type: 'text', localized: true, required: true },
      ],
    },
    {
      name: 'speakers',
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'person',
              type: 'relationship',
              relationTo: 'people',
              required: true,
              admin: { width: '60%' },
            },
            { name: 'role', type: 'text', localized: true, admin: { width: '40%' } }, // "moderator"
          ],
        },
      ],
    },
    {
      name: 'partners',
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'partner',
              type: 'relationship',
              relationTo: 'partners',
              required: true,
              admin: { width: '60%' },
            },
            {
              name: 'role',
              type: 'select',
              options: [
                { label: 'Sponsor', value: 'sponsor' },
                { label: 'Co-host', value: 'co_host' },
                { label: 'Venue', value: 'venue' },
                { label: 'Other', value: 'other' },
              ],
              admin: { width: '40%' },
            },
          ],
        },
      ],
    },
    registrationField(),
    pricingField({ dbName: 'event_price' }),
  ],
}
```

- [ ] **Step 2: Reseed**

In `seed/seed.utils.ts`, add next to `weekly`:

```ts
/** A one-off gathering on `date`, as a one-week schedule with one slot. */
export const once = (date: string, start: string, end: string): ScheduleSeed => ({
  start_date: date,
  weeks: 1,
  slots: [{ weekday: weekdayOf(date), start_time: start, end_time: end }],
})
```

In `seed/seed.type.ts`, `EventSeed` becomes:

```ts
export type EventSeed = {
  title: string
  event_type: NonNullable<Event['event_type']>
  tier: Event['tier']
  schedule: ScheduleSeed
  description?: string
  /** Space name, resolved to an id. */
  space?: string
  /** Fixture emails of the speakers' people. */
  speakers?: string[]
}
```

Rewrite the data in `seed/collections/events.seed.ts`:
- The 2017 discussion: `schedule: once('2017-10-15', '18:00', '20:00')`, `space: 'Darb el-Labbana'`, `speakers: ['surti.singh@cilas.test', 'robin.weiss@cilas.test']`.
- The exhibition: `event_type: 'open_day'`, `schedule: once('2026-06-05', '16:00', '21:00')`, `space: 'Darb el-Labbana'`.
- The screening: `schedule: once('2026-05-03', '19:00', '22:00')`, `space: 'Darb el-Labbana'`.
- Keep the descriptions.

The seeder's `data` becomes:

```ts
        data: {
          ...rest,
          title,
          slug: slugify(title),
          description: description ? lexical(description) : null,
          ...(space ? { space: requireId(ctx.spaces, space) } : {}),
          speakers: (speakers ?? []).map((email) => ({ person: requireId(ctx.people, email) })),
        },
```

(Destructure `space` and `speakers` alongside `title` and `description`.)

- [ ] **Step 3: Regenerate types and type-check**

Run: `pnpm generate:types && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/collections/Events.ts src/payload-types.ts seed
git commit -m "feat(events): shared schedule, venue, agenda, speakers, partners, registration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Newsletters

**Files:**
- Create: `src/collections/Newsletters.ts`
- Modify: `src/payload.config.ts`, `seed/seed.utils.ts`

- [ ] **Step 1: Create the collection**

```ts
import type { CollectionConfig } from 'payload'

import { isAdmin, publishedOrAdmin } from '@/access'
import { slugField } from '@/fields/slug'

/**
 * The archive of issues CILAS has sent. Subscribers live in Resend Audiences,
 * never here (ADR 0005).
 */
export const Newsletters: CollectionConfig = {
  slug: 'newsletters',
  access: {
    read: publishedOrAdmin,
    readVersions: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'issue_date', '_status'],
  },
  defaultSort: '-issue_date',
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    {
      name: 'issue_date',
      type: 'date',
      required: true,
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayOnly' } },
    },
    { name: 'cover_image', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'body', type: 'richText', localized: true },
  ],
}
```

- Register it in `src/payload.config.ts` after `Events`.
- Add `'newsletters'` to `CONTENT_COLLECTIONS`.

- [ ] **Step 2: Regenerate types and type-check**

Run: `pnpm generate:types && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/collections/Newsletters.ts src/payload.config.ts src/payload-types.ts seed/seed.utils.ts
git commit -m "feat(newsletters): archive of sent issues

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Email adapter

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `src/env.ts`, `src/payload.config.ts`, `.env.example`

- [ ] **Step 1: Install the adapter at the Payload version**

Check `git status` first. If `package.json` or `pnpm-lock.yaml` show changes that this plan didn't make, stop and ask the user.

```bash
pnpm add @payloadcms/email-resend@3.90.2
```

- [ ] **Step 2: Add the env vars**

In `src/env.ts` `server`, add:

```ts
        // Optional: without it Payload logs emails to the console (fine in dev).
        RESEND_API_KEY: z.string().min(1).optional(),
        EMAIL_FROM_ADDRESS: z.email().default('noreply@ci-las.org'),
```

In `.env.example`, add:

```
# Transactional email (review notifications, password resets). Unset = console.
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=noreply@ci-las.org
```

- [ ] **Step 3: Wire the adapter**

In `src/payload.config.ts`, import `resendAdapter` from `@payloadcms/email-resend` and add to `buildConfig`:

```ts
  // System email only. Newsletter subscribers live in Resend Audiences (ADR 0005).
  email: env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: env.RESEND_API_KEY,
        defaultFromAddress: env.EMAIL_FROM_ADDRESS,
        defaultFromName: 'CILAS',
      })
    : undefined,
```

If `env` isn't already imported in `payload.config.ts`, import it from `@/env`, as the storage config does.

- [ ] **Step 4: Type-check, lint and unit tests**

Run: `npx tsc --noEmit && pnpm lint && pnpm vitest run --config ./vitest.config.mts tests/unit`
Expected: tsc prints nothing, lint has 0 errors, and the unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/env.ts src/payload.config.ts .env.example
git commit -m "feat(email): Resend adapter for system email, console fallback in dev

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Close the draft-version leak on courses

**Files:**
- Modify: `src/collections/Courses.ts`

- [ ] **Step 1: Add `readVersions`**

In `src/collections/Courses.ts`, add to `access` (and import `isAdminOrOwn`):

```ts
    // Without this, any signed-in account reads drafts via the versions endpoint.
    readVersions: isAdminOrOwn(ownsViaFellows),
```

Articles got the same rule in Task 5, and programmes and newsletters are admin-only.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/collections/Courses.ts
git commit -m "fix(courses): only admins and the course's fellows read its draft versions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Migrate, reseed and test against the database

**Files:**
- Regenerate: `src/migrations/*`
- Create: `tests/int/publishing.int.spec.ts`

- [ ] **Step 1: Rebuild the single baseline migration**

```bash
find src/migrations -maxdepth 1 -type f \( -name '*.json' -o -name '*.ts' \) ! -name 'index.ts' -delete
pnpm db:migrate:create
```

If it throws "Multiple identifiers exceed Postgres's 63-character limit", stop and report the table it names.

- [ ] **Step 2: Reset the database (the user runs this)**

Ask the user to run:

```
! pnpm db:reset
```

The user's `db:reset` is `migrate:fresh --force-accept-warning` followed by the seed. Wait for `SEED COMPLETE`.

- [ ] **Step 3: Write the int test**

`tests/int/publishing.int.spec.ts`:

```ts
// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

type Tracked = 'people' | 'articles' | 'publications' | 'press' | 'partners'

let payload: Payload
const created: Array<{ collection: Tracked; id: number }> = []
const track = <T extends { id: number }>(collection: Tracked, doc: T): T => {
  created.push({ collection, id: doc.id })
  return doc
}

describe('publishing', () => {
  let personId: number
  let author: User
  const admin = { id: -1, roles: ['admin'] } as unknown as User

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    personId = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Author Probe', slug: 'author-probe' },
        overrideAccess: true,
      }),
    ).id
    author = { id: -2, roles: ['member'], person: personId } as unknown as User
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
    }
    await payload.destroy()
  })

  describe('article review', () => {
    let articleId: number

    it('adds the author to their own new article', async () => {
      const article = track(
        'articles',
        await payload.create({
          collection: 'articles',
          data: {
            title: 'Review Probe',
            slug: 'review-probe',
            authors: [],
            requested_tier: 'public',
            tier: 'owner',
            review: { status: 'draft' },
          },
          user: author,
          overrideAccess: false,
        }),
      )
      articleId = article.id
      expect(article.authors?.map((a) => (typeof a === 'object' ? a.id : a))).toEqual([personId])
    })

    it('refuses an author approving their own article', async () => {
      await expect(
        payload.update({
          collection: 'articles',
          id: articleId,
          data: { review: { status: 'approved' } },
          user: author,
          overrideAccess: false,
        }),
      ).rejects.toThrow(/Only an admin/)
    })

    it('lets the author submit, emails admins, then locks the article to them', async () => {
      const send = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined)
      await payload.update({
        collection: 'articles',
        id: articleId,
        data: { review: { status: 'submitted' } },
        user: author,
        overrideAccess: false,
      })
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Submitted for review: Review Probe' }),
      )

      await expect(
        payload.update({
          collection: 'articles',
          id: articleId,
          data: { title: 'Sneaky edit' },
          user: author,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })

    it('publishes on approval at the requested tier', async () => {
      const approved = await payload.update({
        collection: 'articles',
        id: articleId,
        data: { review: { status: 'approved' } },
        user: admin,
        overrideAccess: false,
      })
      expect(approved._status).toBe('published')
      expect(approved.tier).toBe('public')
      expect(approved.published_date).toBeTruthy()

      const { docs } = await payload.find({
        collection: 'articles',
        where: { id: { equals: articleId } },
        overrideAccess: false,
      })
      expect(docs).toHaveLength(1)
    })
  })

  it('lists an article’s publications through the join', async () => {
    const article = track(
      'articles',
      await payload.create({
        collection: 'articles',
        data: {
          title: 'Joined Probe',
          slug: 'joined-probe',
          authors: [personId],
          tier: 'public',
          review: { status: 'approved' },
        },
        overrideAccess: true,
      }),
    )
    const publication = track(
      'publications',
      await payload.create({
        collection: 'publications',
        data: {
          kind: 'other',
          title: 'Publication Probe',
          slug: 'publication-probe',
          articles: [article.id],
        },
        overrideAccess: true,
      }),
    )
    const read = await payload.findByID({
      collection: 'articles',
      id: article.id,
      overrideAccess: true,
    })
    expect(read.publications?.docs?.map((p) => (typeof p === 'object' ? p.id : p))).toContain(
      publication.id,
    )
  })

  it('refuses a press author with neither a person nor a name', async () => {
    await expect(
      payload.create({
        collection: 'press',
        data: {
          kind: 'coverage',
          title: 'Press Probe',
          authors: [{}],
          links: [{ url: 'https://example.org/probe' }],
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 4: Run every test**

Run: `pnpm test:int`
Expected:
- `publishing.int.spec.ts`: 6 tests pass.
- Everything else still passes. `seed-localization` and `people` are unaffected, and `teaching` is unaffected apart from courses now having `readVersions`.

If an assertion fails because Payload behaves differently from what the plan assumes, stop and report it. Examples:
- `APIError` message matching
- the draft or published read semantics after `update` with `draft: true`
- `vi.spyOn` on `payload.sendEmail`

Don't loosen the assertion. If a create call fails to type-check because a field is required but has a default, add the field to the test data explicitly (the plan-3 pattern).

- [ ] **Step 5: Smoke-check the seed**

Write a scratch script inside the repo, delete it afterwards, and run it with `npx tsx --env-file=.env <file>`. It should print:
- each article's title, `_status`, `tier` and `review.status`, with `draft: true`;
- the publications with their funders, at `depth: 1`;
- the press titles with their outlet names.

Expected:
- Every seeded article is `published` and `approved`, at its seeded tier.
- Pigeon Towers lists ACSS and the Ford Foundation as funders.
- Each press item names its outlet.

- [ ] **Step 6: Commit**

```bash
git add src/migrations tests/int/publishing.int.spec.ts
git commit -m "test(publishing): review flow, publication join and press authors against the database

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Update the spec

**Files:**
- Modify: `docs/schema.md`

- [ ] **Step 1: Replace the finished sections**

In `docs/schema.md`:
- Delete the `**credits[]**` block under Shared shapes. Change the Shared shapes paragraph to say events use the shapes too.
- Delete the `## Partners` and `## Publishing` sections, and replace them with:

```markdown
## Partners and publishing

Partners, articles (with review), publications, press, events and newsletters match the code (ADR 0005). Still to do:
- **Newsletter sign-up:** a public form that posts to the Resend Audience API (frontend work).
- **Press links:** a periodic check that marks dead links so the page falls back to `archived_url`.
```

- In the "Time and place, programmes, teaching" "Still to do" list, delete the `partners[]` and `readVersions` bullets.

- [ ] **Step 2: Commit**

```bash
git add docs/schema.md
git commit -m "docs(schema): partners and publishing are built

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
