# Time, Place and Teaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape spaces, cycles, programmes and courses to the target schema, wire in the shared `schedule` / `registration` / `pricing` fields from plan 2, add `enrollments`, and make the course page read dates, prices and registration from the shared logic.

**Architecture:**
- **Cycles** become one intake per season, start year and space. Their title, slug and academic year are built by a collection hook (ADR 0003).
- **Courses** point to their cycle. Cycles list their courses through a `join`, so there is no stored back-link.
- **Programmes** get drafts.
- **Courses** get the schedule, registration, price override and reshaped sessions, whose dates come from `expandSchedule()` (ADR 0002).
- **Pure helpers** live in `src/lib/` and are unit-tested: cycle title and academic year, price lookup, and the programme component query.
- **Database:** it is disposable and gets reset once at the end (Task 10).

**Tech Stack:** Payload 3.90.2 (Postgres adapter, `push: true` in dev), Next 16, vitest, pnpm.

**Spec:** `docs/schema.md` (Time and place, Programmes, Teaching), `CONTEXT.md`, ADRs 0002–0004.

**Branch:** work directly on `main`, one commit per task. Don't push.

---

## Roadmap (this is plan 3 of 6)

1. People and identity (done)
2. Shared shapes (done)
3. **Time, place and teaching** (this plan)
4. Publishing: articles review, credits, publications, press, partners, events, newsletters, email adapter (ADR 0005)
5. Plugins: redirects and SEO
6. Archive import pipeline (ADR 0004)

## Decisions made in this plan

These fill gaps the spec leaves open.

- **Cycle title is "Season Year, City"**, e.g. "Spring 2026, Cairo", as in CONTEXT.md. The city comes from the space; a space with no city uses its name. The slug follows the title (`spring-2026-cairo`) and is never hand-edited, so cycles use a plain read-only `slug` text field, not `slugField()`.
- **Academic year** comes from `start_date` when set, with September as the boundary. Without a date it comes from the season: fall starts a year, and winter, spring and summer end one. It is stored, so it can be filtered on.
- **Spaces gain `city` (localized), `opened_year` and `closed_year`.**
- **Cycle pricing** is an array of `{ course_types[], pricing }`. A course uses its `pricing_override` when that has a `min`, and otherwise the cycle entry listing its course type (`pricingFor()`).
- **Programmes are readable when published, and admins read everything** (`publishedOrAdmin`).
- **Programme `partners[]` waits for plan 4,** which creates `partners`.
- **Programme `admission_requirements` becomes `requirements`.**
- **Programme testimonials** are `{ quote, attribution, person? }`.
- **Programme FAQs** are `{ question, answer }`.
- **Enrollment fields:**
  - `status` is applied → accepted → confirmed (paid) → completed, or withdrawn.
  - `slot` is free text naming the group attended ("evening").
  - `assessment` is localized rich text.
  - `source` is `registration_form`, `admin` or `backfill`.
  - Read access is admins plus the enrolled person's own account. Writes are admins only.
  - A person enrolls in a course at most once.
- **Session fields:** `session_title` becomes localized, like other reader-facing text. `order` stays the sort key.
- **Course fields:** `teaching_languages` options are `ar` and `en`. `facilitator_note` and `content_warning` are localized textareas, and `syllabus_tentative` is a checkbox.
- **The admin placeholders for computed session dates are deferred.** They need a custom admin component; that follow-up is listed in `docs/schema.md`. Until it lands, the course page shows the computed dates.
- **`legacy_url` / `import_status` and the draft Bridge years** come with the archive import (plan 6).

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/lib/cycle.ts` | create | `SEASONS`, `cycleTitle()`, `academicYear()` |
| `src/lib/pricing.ts` | create | `pricingFor()`, `priceLabel()` |
| `src/lib/programme.ts` | create | `componentCoursesWhere()` |
| `src/lib/schedule.ts` | modify | export `sessionsInOrder()` (was the private `inOrder`) |
| `src/access.ts` | modify | `publishedOrAdmin`, `ownsViaPerson`, `isAdminOrOwn` |
| `src/fields/course-type.ts` | create | `COURSE_TYPES`, `COURSE_TYPE_OPTIONS` |
| `src/fields/bibliography.ts` | create | `bibliographyField()` (deduplicates courses' two copies) |
| `src/fields/schedule.ts` | modify | export `timeRangeFields()`, used by slots and session dates |
| `src/collections/Spaces.ts` | modify | `city`, `opened_year`, `closed_year` |
| `src/collections/Cycles.ts` | rewrite | season, year, space, dates, registration, pricing, `courses` join |
| `src/collections/Programmes.ts` | rewrite | target programme shape, drafts |
| `src/collections/Courses.ts` | modify | target course shape |
| `src/collections/Enrollments.ts` | create | person ↔ course |
| `src/collections/People.ts` | modify | `enrollments` join |
| `src/payload.config.ts` | modify | register Enrollments |
| `src/app/(frontend)/study/[slug]/CourseView.tsx` | modify | dates, price, registration from the shared logic |
| `seed/*` | modify | seed the new shapes |
| `tests/unit/*.unit.spec.ts` | create/modify | pure helpers, access |
| `tests/int/teaching.int.spec.ts` | create | hooks, joins, access against the database |
| `tests/int/people.int.spec.ts` | modify | programmes now need `kind` |
| `docs/schema.md` | modify | drop the finished sections |

**Commands**
- One spec: `pnpm vitest run --config ./vitest.config.mts <path>`.
- Types: `pnpm generate:types`, after every collection change.
- **Type-check after every task:** `npx tsc --noEmit` should print nothing.

**Baseline before starting:**
- `npx tsc --noEmit` is clean.
- `pnpm lint` has 0 errors.
- 95 tests pass.

**Database warning:** Tasks 5–9 change collections, and the dev database keeps the old schema until Task 10. Between those tasks, don't run the dev server or the int tests: Payload's dev push would prompt about renames and stall.

---

### Task 1: Cycle title and academic year

**Files:**
- Create: `src/lib/cycle.ts`
- Test: `tests/unit/cycle.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { academicYear, cycleTitle } from '@/lib/cycle'

describe('cycleTitle', () => {
  it('names season, year and place', () => {
    expect(cycleTitle({ season: 'spring', start_year: 2026, place: 'Cairo' })).toBe(
      'Spring 2026, Cairo',
    )
  })

  it('leaves the place out when unknown', () => {
    expect(cycleTitle({ season: 'fall', start_year: 2025, place: null })).toBe('Fall 2025')
  })
})

describe('academicYear', () => {
  it('starts with fall when there is no start date', () => {
    expect(academicYear({ season: 'fall', start_year: 2025 })).toBe('2025–2026')
  })

  it('puts winter, spring and summer at the end of a year', () => {
    expect(academicYear({ season: 'winter', start_year: 2026 })).toBe('2025–2026')
    expect(academicYear({ season: 'spring', start_year: 2026 })).toBe('2025–2026')
    expect(academicYear({ season: 'summer', start_year: 2026 })).toBe('2025–2026')
  })

  it('follows the start date, with September as the boundary', () => {
    expect(academicYear({ season: 'summer', start_year: 2025, start_date: '2025-08-31' })).toBe(
      '2024–2025',
    )
    expect(academicYear({ season: 'fall', start_year: 2025, start_date: '2025-09-01' })).toBe(
      '2025–2026',
    )
  })

  it('reads a stored timestamp as its Cairo day', () => {
    // 22:00 UTC on 31 August 2025 is 1 September in Cairo (UTC+3).
    expect(
      academicYear({ season: 'fall', start_year: 2025, start_date: '2025-08-31T22:00:00.000Z' }),
    ).toBe('2025–2026')
  })

  it('falls back to the season when the date is not real', () => {
    expect(academicYear({ season: 'spring', start_year: 2026, start_date: 'nope' })).toBe(
      '2025–2026',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/cycle.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/lib/cycle"`.

- [ ] **Step 3: Write the implementation**

```ts
import { cairoDay } from '@/lib/cairo-day'

export const SEASONS = ['fall', 'winter', 'spring', 'summer'] as const
export type Season = (typeof SEASONS)[number]

const capitalise = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

/** "Spring 2026, Cairo": a cycle is one intake per season, year and place (ADR 0003). */
export const cycleTitle = ({
  season,
  start_year,
  place,
}: {
  season: Season
  start_year: number
  place?: string | null
}): string => [`${capitalise(season)} ${start_year}`, place].filter(Boolean).join(', ')

/**
 * The September-to-August year a cycle belongs to, e.g. "2025–2026". The start
 * date decides when it is set; otherwise fall opens a year and the other
 * seasons close one.
 */
export const academicYear = ({
  season,
  start_year,
  start_date,
}: {
  season: Season
  start_year: number
  start_date?: string | null
}): string => {
  const day = start_date ? cairoDay(start_date) : null
  const [year, month] = day
    ? day.split('-').map(Number)
    : [start_year, season === 'fall' ? 9 : 1]
  const first = month >= 9 ? year : year - 1
  return `${first}–${first + 1}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/cycle.unit.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cycle.ts tests/unit/cycle.unit.spec.ts
git commit -m "feat(lib): cycle title and academic year

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Price lookup and label

**Files:**
- Create: `src/lib/pricing.ts`
- Test: `tests/unit/pricing.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { priceLabel, pricingFor } from '@/lib/pricing'

const cycle = {
  pricing: [
    { course_types: ['THEMATIC', 'LAB'], pricing: { min: 1500, max: 2000 } },
    { course_types: ['WORKSHOP'], pricing: { min: 800 } },
  ],
}

describe('pricingFor', () => {
  it("uses the cycle's price for the course type", () => {
    expect(pricingFor({ course_type: 'LAB' }, cycle)).toEqual({ min: 1500, max: 2000 })
    expect(pricingFor({ course_type: 'WORKSHOP' }, cycle)).toEqual({ min: 800 })
  })

  it("prefers the course's own override when it has a minimum", () => {
    expect(pricingFor({ course_type: 'LAB', pricing_override: { min: 0 } }, cycle)).toEqual({
      min: 0,
    })
  })

  it('ignores an empty override', () => {
    expect(pricingFor({ course_type: 'LAB', pricing_override: { min: null } }, cycle)).toEqual({
      min: 1500,
      max: 2000,
    })
  })

  it('is null when nothing prices the course', () => {
    expect(pricingFor({ course_type: 'CORE' }, cycle)).toBeNull()
    expect(pricingFor({ course_type: 'CORE' }, null)).toBeNull()
  })
})

describe('priceLabel', () => {
  it('shows a single price or a range in EGP', () => {
    expect(priceLabel({ min: 800 })).toBe('EGP 800')
    expect(priceLabel({ min: 1500, max: 2000 })).toBe('EGP 1,500–2,000')
    expect(priceLabel({ min: 1500, max: 1500 })).toBe('EGP 1,500')
  })

  it('calls a zero price free', () => {
    expect(priceLabel({ min: 0 })).toBe('Free')
  })

  it('is null without a minimum', () => {
    expect(priceLabel({ min: null })).toBeNull()
    expect(priceLabel(null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/pricing.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/lib/pricing"`.

- [ ] **Step 3: Write the implementation**

```ts
/** The parts of a `pricingField()` group the site reads. */
export type Pricing = {
  min?: number | null
  max?: number | null
  currency?: string | null
  need_based_deductions?: boolean | null
}

type SetPricing = Pricing & { min: number }

const isSet = (pricing: Pricing | null | undefined): pricing is SetPricing =>
  typeof pricing?.min === 'number'

/**
 * A course's price: its own override when it sets a minimum, otherwise its
 * cycle's price for its course type.
 */
export const pricingFor = (
  course: { course_type: string; pricing_override?: Pricing | null },
  cycle: { pricing?: Array<{ course_types?: string[] | null; pricing?: Pricing | null }> | null } | null | undefined,
): Pricing | null => {
  if (isSet(course.pricing_override)) return course.pricing_override
  const pricing = cycle?.pricing?.find((entry) =>
    entry.course_types?.includes(course.course_type),
  )?.pricing
  return isSet(pricing) ? pricing : null
}

const amount = new Intl.NumberFormat('en-US')

/** "EGP 1,500–2,000", "EGP 800", "Free", or null when unpriced. */
export const priceLabel = (pricing: Pricing | null | undefined): string | null => {
  if (!isSet(pricing)) return null
  const { min, max } = pricing
  const hasRange = typeof max === 'number' && max > min
  if (min === 0 && !hasRange) return 'Free'
  const range = hasRange ? `${amount.format(min)}–${amount.format(max)}` : amount.format(min)
  return `${pricing.currency ?? 'EGP'} ${range}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/pricing.unit.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.ts tests/unit/pricing.unit.spec.ts
git commit -m "feat(lib): course price from its override or its cycle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Access rules and the component query

**Files:**
- Modify: `src/access.ts`
- Create: `src/lib/programme.ts`
- Test: `tests/unit/access.unit.spec.ts`, `tests/unit/programme.unit.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/access.unit.spec.ts`, and extend its `@/access` import with `isAdminOrOwn`, `ownsViaPerson` and `publishedOrAdmin`. The file already imports `Access` and `User`. Reuse its existing helpers for building a fake request if it has them. Otherwise add this one:

```ts
const call = (access: Access, user: Partial<User> | null) =>
  access({ req: { user } } as unknown as Parameters<Access>[0])
```

```ts
describe('publishedOrAdmin', () => {
  it('lets admins read everything', () => {
    expect(call(publishedOrAdmin, { roles: ['admin'] })).toBe(true)
  })

  it('shows everyone else only published documents', () => {
    const published = { _status: { equals: 'published' } }
    expect(call(publishedOrAdmin, null)).toEqual(published)
    expect(call(publishedOrAdmin, { roles: ['member'] })).toEqual(published)
  })
})

describe('isAdminOrOwn(ownsViaPerson)', () => {
  const rule = isAdminOrOwn(ownsViaPerson)

  it('lets admins through', () => {
    expect(call(rule, { roles: ['admin'] })).toBe(true)
  })

  it("limits a linked account to its person's rows", () => {
    expect(call(rule, { roles: ['member'], person: 7 })).toEqual({ person: { equals: 7 } })
  })

  it('refuses anonymous and unlinked accounts', () => {
    expect(call(rule, null)).toBe(false)
    expect(call(rule, { roles: ['member'], person: null })).toBe(false)
  })
})
```

Create `tests/unit/programme.unit.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { componentCoursesWhere } from '@/lib/programme'

describe('componentCoursesWhere', () => {
  it("selects the cycle's courses of the component's types", () => {
    expect(componentCoursesWhere({ cycle: 4, course_types: ['CORE', 'LAB'] })).toEqual({
      and: [{ cycle: { equals: 4 } }, { course_type: { in: ['CORE', 'LAB'] } }],
    })
  })

  it('accepts a populated cycle', () => {
    expect(componentCoursesWhere({ cycle: { id: 4 }, course_types: ['CORE'] })).toEqual({
      and: [{ cycle: { equals: 4 } }, { course_type: { in: ['CORE'] } }],
    })
  })

  it('is null until both cycle and types are set', () => {
    expect(componentCoursesWhere({ cycle: null, course_types: ['CORE'] })).toBeNull()
    expect(componentCoursesWhere({ cycle: 4, course_types: [] })).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/access.unit.spec.ts tests/unit/programme.unit.spec.ts`
Expected: FAIL. The new access cases fail with `publishedOrAdmin is not a function`, and `@/lib/programme` doesn't resolve.

- [ ] **Step 3: Implement**

In `src/access.ts`, add after `ownsViaAuthor`:

```ts
export const ownsViaPerson: Ownership = (user) => {
  const person = personOf(user)
  return person === null ? false : { person: { equals: person } }
}
```

Add after `isAdminOrOwnAndDraft`:

```ts
/** Admins see every row; a signed-in account only the rows it owns. */
export const isAdminOrOwn =
  (owned: Ownership): Access =>
  ({ req }) => {
    if (isAdminUser(req.user)) return true
    if (!req.user) return false
    return owned(req.user)
  }

/** For drafts-enabled collections with no tier: the public reads what is published. */
export const publishedOrAdmin: Access = ({ req }) =>
  isAdminUser(req.user) || { _status: { equals: 'published' } }
```

Create `src/lib/programme.ts`:

```ts
import type { Where } from 'payload'

export type ProgrammeComponent = {
  cycle?: number | { id: number } | null
  course_types?: string[] | null
}

/**
 * A component's courses are not stored: they are its cycle's courses of its
 * course types (ADR 0003). Null until both are set.
 */
export const componentCoursesWhere = (component: ProgrammeComponent): Where | null => {
  const cycle = typeof component.cycle === 'object' ? component.cycle?.id : component.cycle
  if (!cycle || !component.course_types?.length) return null
  return {
    and: [{ cycle: { equals: cycle } }, { course_type: { in: component.course_types } }],
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/access.unit.spec.ts tests/unit/programme.unit.spec.ts && npx tsc --noEmit`
Expected: PASS, and tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/access.ts src/lib/programme.ts tests/unit/access.unit.spec.ts tests/unit/programme.unit.spec.ts
git commit -m "feat(access): published-or-admin and own-rows rules; component course query

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Shared field pieces

**Files:**
- Create: `src/fields/course-type.ts`, `src/fields/bibliography.ts`
- Modify: `src/fields/schedule.ts`, `src/lib/schedule.ts`
- Test: `tests/unit/shape-fields.unit.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add these imports to the top of `tests/unit/shape-fields.unit.spec.ts`. It already defines `names()`.

```ts
import { bibliographyField } from '@/fields/bibliography'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import { timeRangeFields } from '@/fields/schedule'
import { sessionsInOrder } from '@/lib/schedule'
```

```ts
describe('shared field pieces', () => {
  it('lists the five course types', () => {
    expect(COURSE_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      'CORE',
      'THEMATIC',
      'LAB',
      'WORKSHOP',
      'SHORT',
    ])
  })

  it('builds a bibliography array of materials', () => {
    const field = bibliographyField()
    expect(field.name).toBe('bibliography')
    expect(names(field.fields)).toEqual(['type', 'title', 'href', 'note'])
  })

  it('shares start and end time fields', () => {
    expect(names(timeRangeFields())).toEqual(['start_time', 'end_time'])
  })

  it('orders sessions the same way expandSchedule numbers them', () => {
    expect(sessionsInOrder([{ order: 2 }, {}, { order: 1 }])).toEqual([
      { order: 1 },
      { order: 2 },
      {},
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/fields/bibliography"`.

- [ ] **Step 3: Implement**

`src/fields/course-type.ts`:

```ts
/** Core, Thematic and Lab count toward the Bridge; Workshop and Short do not. */
export const COURSE_TYPE_OPTIONS = [
  { label: 'Core Course', value: 'CORE' },
  { label: 'Thematic Course', value: 'THEMATIC' },
  { label: 'Lab', value: 'LAB' },
  { label: 'Workshop', value: 'WORKSHOP' },
  { label: 'Short Course', value: 'SHORT' },
] as const satisfies ReadonlyArray<{ label: string; value: string }>

export type CourseType = (typeof COURSE_TYPE_OPTIONS)[number]['value']
```

If tsc rejects a `readonly` options array where Payload expects `Option[]`, spread it at each use site: `options: [...COURSE_TYPE_OPTIONS]`.

`src/fields/bibliography.ts`:

```ts
import type { ArrayField } from 'payload'

const MATERIAL_TYPES = ['reading', 'watch', 'listen', 'prompt', 'other'] as const

/** Materials a session or course asks people to engage with (CONTEXT.md). */
export const bibliographyField = (label?: string): ArrayField => ({
  name: 'bibliography',
  type: 'array',
  ...(label ? { label } : {}),
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      options: MATERIAL_TYPES.map((value) => ({
        label: value.charAt(0).toUpperCase() + value.slice(1),
        value,
      })),
    },
    { name: 'title', type: 'text', localized: true, index: true },
    { name: 'href', type: 'text' }, // youtube / vimeo / article url
    { name: 'note', type: 'text', localized: true }, // author, year, pages; primary vs secondary reading
  ],
})
```

In `src/fields/schedule.ts`, move the slot's `start_time` and `end_time` field configs, unchanged (validators included), into an exported builder. Then use it in the slot row:

```ts
/** Cairo wall-clock start and end, shared by slots and moved session dates. */
export const timeRangeFields = (width = '20%'): Field[] => [
  {
    name: 'start_time',
    type: 'text',
    required: true,
    validate: timeOfDay,
    admin: { width, placeholder: '19:00' },
  },
  {
    name: 'end_time',
    type: 'text',
    required: true,
    // Payload's text checks (required, length) first, then the time rules.
    validate: ((value, options) => {
      const base = text(value, options)
      if (base !== true) return base
      const time = timeOfDay(value)
      return time === true
        ? endAfterStart(value, (options.siblingData as Record<string, unknown>).start_time)
        : time
    }) satisfies TextFieldSingleValidation,
    admin: { width, placeholder: '21:00' },
  },
]
```

The slot row's fields become `[weekday, ...timeRangeFields(), label]`. Add `Field` to the `payload` type import.

In `src/lib/schedule.ts`, rename the private `inOrder` to an exported `sessionsInOrder`, give it a generic signature so callers keep their own session type, and update the call inside `expandSchedule`:

```ts
/** Sessions by `order`; unset orders follow, in array order. */
export const sessionsInOrder = <T extends SessionDates>(sessions: T[]): T[] =>
  sessions
    .map((session, index) => ({ session, index, key: session.order ?? Infinity }))
    .sort((a, b) => (a.key === b.key ? a.index - b.index : a.key - b.key))
    .map(({ session }) => session)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit && npx tsc --noEmit`
Expected: every unit test passes, and tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/fields/course-type.ts src/fields/bibliography.ts src/fields/schedule.ts src/lib/schedule.ts tests/unit/shape-fields.unit.spec.ts
git commit -m "feat(fields): course types, bibliography and time-range pieces

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Spaces

**Files:**
- Modify: `src/collections/Spaces.ts`, `seed/collections/spaces.seed.ts`, `seed/seed.type.ts`, `seed/index.ts`

- [ ] **Step 1: Add the fields**

In `src/collections/Spaces.ts`, after the `state` field, add:

```ts
    { name: 'city', type: 'text', localized: true }, // names the space's cycles: "Spring 2026, Cairo"
    {
      type: 'row',
      fields: [
        { name: 'opened_year', type: 'number', min: 2012, max: 2100, admin: { width: '50%' } },
        // Empty while in use.
        { name: 'closed_year', type: 'number', min: 2012, max: 2100, admin: { width: '50%' } },
      ],
    },
```

- [ ] **Step 2: Seed the city, and seed spaces before cycles**

- In `seed/seed.type.ts`:
  - Add `spaces: IdMap` to `SeedContext`, with the comment `/** Space names, resolved to ids. */`.
  - Add `spaces: {}` to `createSeedContext()`.
- In `seed/collections/spaces.seed.ts`:
  - Give the entries `city: 'Cairo'`, `city: 'Cairo'` and `city: 'Alexandria'`.
  - Change the seeder to take the context and record ids:

```ts
export const seedSpaces = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const space of spacesData) {
    const { name, description, ...rest } = space
    ctx.spaces[name] = await getOrCreateId(payload, 'spaces', { name: { equals: name } }, () =>
      payload.create({
        collection: 'spaces',
        data: {
          ...rest,
          name,
          slug: slugify(name),
          description: description ? lexical(description) : null,
        },
        overrideAccess: true,
      }),
    )
    console.log('space:', name)
  }
}
```

  (Import `SeedContext` from `../seed.type`.)
- In `seed/index.ts`, move `await seedSpaces(payload, ctx)` up, to directly after `seedUsers`, and remove the old call near the end. Cycles will need space ids.

- [ ] **Step 3: Regenerate types and type-check**

Run: `pnpm generate:types && npx tsc --noEmit`
Expected: tsc prints nothing.

- [ ] **Step 4: Commit**

```bash
git add src/collections/Spaces.ts src/payload-types.ts seed
git commit -m "feat(spaces): city and years open

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Cycles

**Files:**
- Rewrite: `src/collections/Cycles.ts`
- Modify: `seed/collections/cycles.seed.ts`, `seed/seed.type.ts`, `seed/collections/courses.seed.ts`, `src/app/(frontend)/study/[slug]/CourseView.tsx`

- [ ] **Step 1: Rewrite the collection**

```ts
import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/access'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import { pricingField } from '@/fields/pricing'
import { registrationField } from '@/fields/registration'
import { academicYear, cycleTitle, SEASONS, type Season } from '@/lib/cycle'
import { slugify } from '@/lib/slugify'

/**
 * Title, slug and academic year are derived, never typed (ADR 0003). The
 * place in the title is the space's city, so it needs a lookup.
 */
export const deriveCycleIdentity: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data
  const merged = { ...originalDoc, ...data }
  const season = merged.season as Season | undefined
  const start_year = merged.start_year as number | undefined
  if (!season || !start_year) return data

  const spaceId = typeof merged.space === 'object' ? merged.space?.id : merged.space
  const space = spaceId
    ? await req.payload
        .findByID({ collection: 'spaces', id: spaceId, depth: 0, req })
        .catch(() => null)
    : null

  const title = cycleTitle({ season, start_year, place: space?.city || space?.name })
  return {
    ...data,
    title,
    slug: slugify(title),
    academic_year: academicYear({ season, start_year, start_date: merged.start_date }),
  }
}

/** One intake of courses in a season, start year and space (CONTEXT.md). */
export const Cycles: CollectionConfig = {
  slug: 'cycles',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'academic_year', 'start_date'],
  },
  defaultSort: '-start_date',
  hooks: {
    beforeValidate: [deriveCycleIdentity],
  },
  fields: [
    { name: 'title', type: 'text', admin: { readOnly: true } },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'season',
          type: 'select',
          required: true,
          options: SEASONS.map((value) => ({
            label: value.charAt(0).toUpperCase() + value.slice(1),
            value,
          })),
          admin: { width: '33%' },
        },
        {
          name: 'start_year',
          type: 'number',
          required: true,
          min: 2012,
          max: 2100,
          admin: { width: '33%' },
        },
        {
          name: 'space',
          type: 'relationship',
          relationTo: 'spaces',
          required: true,
          admin: { width: '34%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'start_date',
          type: 'date',
          admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
        },
        {
          name: 'academic_year',
          type: 'text',
          index: true,
          admin: { width: '50%', readOnly: true },
        },
      ],
    },
    registrationField(),
    {
      name: 'pricing',
      type: 'array',
      admin: { description: 'One price per group of course types.' },
      fields: [
        {
          name: 'course_types',
          type: 'select',
          hasMany: true,
          required: true,
          options: [...COURSE_TYPE_OPTIONS],
        },
        pricingField({ dbName: 'cycle_price' }),
      ],
    },
    {
      name: 'courses',
      type: 'join',
      collection: 'courses',
      on: 'cycle',
      admin: { allowCreate: false, defaultColumns: ['title', 'course_type', 'fellows'] },
    },
  ],
}
```

- [ ] **Step 2: Reseed cycles**

In `seed/seed.type.ts`, replace `CycleSeed`:

```ts
export type CycleSeed = {
  season: 'fall' | 'winter' | 'spring' | 'summer'
  start_year: number
  /** Space name, resolved to an id. */
  space: string
  start_date: string
  deadline: string
}
```

Rewrite `seed/collections/cycles.seed.ts`:

```ts
import type { Payload } from 'payload'
import type { CycleSeed, SeedContext } from '../seed.type'
import { getOrCreateId, requireId } from '../seed.utils'

/**
 * Academic year 2025–2026 at Darb el-Labbana: one intake per season, each
 * holding every course type it offered (ADR 0003). Keyed `season-year`.
 */
export const cyclesData: CycleSeed[] = [
  { season: 'fall', start_year: 2025, space: 'Darb el-Labbana', start_date: '2025-10-19', deadline: '2025-10-10' },
  { season: 'winter', start_year: 2026, space: 'Darb el-Labbana', start_date: '2026-02-21', deadline: '2026-01-31' },
  { season: 'spring', start_year: 2026, space: 'Darb el-Labbana', start_date: '2026-04-25', deadline: '2026-04-15' },
  { season: 'summer', start_year: 2026, space: 'Darb el-Labbana', start_date: '2026-07-19', deadline: '2026-07-10' },
]

export const seedCycles = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const { season, start_year, space, start_date, deadline } of cyclesData) {
    const key = `${season}-${start_year}`
    const id = await getOrCreateId(
      payload,
      'cycles',
      { and: [{ season: { equals: season } }, { start_year: { equals: start_year } }] },
      () =>
        payload.create({
          collection: 'cycles',
          data: {
            season,
            start_year,
            space: requireId(ctx.spaces, space),
            start_date,
            registration: { method: 'form', deadline },
          },
          overrideAccess: true,
        }),
    )

    ctx.cycles[key] = id
    console.log('cycle:', key, '->', id)
  }
}
```

In `seed/collections/courses.seed.ts`, delete the "Back-link cycles.courses" loop at the end of `seedCourses`, along with `courseIdsByCycle` and its `.set(...)` line. The `courses` join replaces them.

- [ ] **Step 3: Use the cycle title on the course page**

In `src/app/(frontend)/study/[slug]/CourseView.tsx`, replace the `cycleLabel` computation with:

```ts
  const cycleLabel = cycle?.title ?? null
```

- [ ] **Step 4: Regenerate types and type-check**

Run: `pnpm generate:types && npx tsc --noEmit`
Expected: tsc prints nothing. If `seed/collections/programmes.seed.ts` or other seed files still reference the removed cycle fields, Task 7 rewrites them. For now, only fix compile errors outside `programmes.seed.ts`. If that file blocks tsc, do Task 7 Step 3 first, then return.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Cycles.ts src/payload-types.ts seed "src/app/(frontend)/study/[slug]/CourseView.tsx"
git commit -m "feat(cycles): one intake per season, year and space, with derived title

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Programmes

**Files:**
- Rewrite: `src/collections/Programmes.ts`
- Modify: `seed/collections/programmes.seed.ts`, `seed/seed.type.ts`, `tests/int/people.int.spec.ts`

- [ ] **Step 1: Rewrite the collection**

```ts
import type { CollectionConfig } from 'payload'

import { isAdmin, publishedOrAdmin } from '@/access'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import { pricingField } from '@/fields/pricing'
import { registrationField } from '@/fields/registration'
import { slugField } from '@/fields/slug'

/**
 * A path through several cycles that people join as a cohort. Its courses are
 * derived from its components, never stored (ADR 0003); its people come from
 * memberships. Drafts hold unverified years until someone confirms them.
 */
export const Programmes: CollectionConfig = {
  slug: 'programmes',
  access: {
    read: publishedOrAdmin,
    // Without this, Payload lets any signed-in account read drafts through
    // the versions endpoint.
    readVersions: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', '_status'],
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Bridge', value: 'bridge' },
        { label: "Women's Studies", value: 'women_studies' },
        { label: 'Residency', value: 'residency' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'cover', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'tagline', type: 'text', localized: true },
    { name: 'overview', type: 'richText', localized: true },
    {
      name: 'highlights',
      type: 'array',
      fields: [{ name: 'text', type: 'text', localized: true, required: true }],
    },
    {
      label: 'Structure',
      type: 'collapsible',
      fields: [
        {
          name: 'cycles',
          type: 'relationship',
          relationTo: 'cycles',
          hasMany: true,
          admin: { description: 'The semester cycles, in order.' },
        },
        {
          name: 'components',
          type: 'array',
          admin: { description: "Each part's courses are its cycle's courses of these types." },
          fields: [
            { name: 'label', type: 'text', localized: true, required: true },
            { name: 'description', type: 'textarea', localized: true },
            { name: 'cycle', type: 'relationship', relationTo: 'cycles', required: true },
            {
              name: 'course_types',
              type: 'select',
              hasMany: true,
              required: true,
              options: [...COURSE_TYPE_OPTIONS],
            },
          ],
        },
        { name: 'featured_courses', type: 'relationship', relationTo: 'courses', hasMany: true },
        {
          name: 'self_directed_study',
          type: 'checkbox',
          admin: { description: 'A self-directed study period between the semesters.' },
        },
      ],
    },
    {
      label: 'Commitment',
      type: 'collapsible',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'capacity', type: 'number', min: 1, admin: { width: '50%' } },
            { name: 'weekly_hours', type: 'number', min: 0, admin: { width: '50%' } },
          ],
        },
        { name: 'schedule_note', type: 'textarea', localized: true },
        { name: 'requirements', type: 'richText', localized: true },
      ],
    },
    registrationField(),
    pricingField({ dbName: 'programme_price' }),
    {
      name: 'testimonials',
      type: 'array',
      fields: [
        { name: 'quote', type: 'textarea', localized: true, required: true },
        { name: 'attribution', type: 'text', localized: true }, // "CILASian, 2018–19"
        { name: 'person', type: 'relationship', relationTo: 'people' },
      ],
    },
    {
      name: 'faqs',
      type: 'array',
      labels: { singular: 'FAQ', plural: 'FAQs' },
      fields: [
        { name: 'question', type: 'text', localized: true, required: true },
        { name: 'answer', type: 'richText', localized: true },
      ],
    },
  ],
}
```

- [ ] **Step 2: Regenerate types**

Run: `pnpm generate:types`

- [ ] **Step 3: Reseed programmes**

In `seed/seed.type.ts`, replace `ProgrammeSeed`, importing `CourseType` from `@/fields/course-type`:

```ts
export type ProgrammeSeed = {
  kind: 'bridge' | 'women_studies' | 'residency'
  title: string
  /** Cycle keys like `fall-2025`, resolved to ids. */
  cycles: string[]
  components: Array<{ label: string; cycle: string; course_types: CourseType[] }>
  weekly_hours?: number
  self_directed_study?: boolean
  requirements?: string
  pricing?: {
    min: number
    need_based_deductions?: boolean
    payment_plans?: Array<{ label: string; installments: Array<{ amount: number }> }>
  }
}
```

Rewrite `seed/collections/programmes.seed.ts`:

```ts
import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { ProgrammeSeed, SeedContext } from '../seed.type'
import { getOrCreateId, lexical, requireId, requireIds } from '../seed.utils'

export const programmesData: ProgrammeSeed[] = [
  {
    kind: 'bridge',
    title: 'Bridge Programme 2025–2026',
    // The two semester cycles; the academic year comes from them.
    cycles: ['fall-2025', 'spring-2026'],
    components: [
      { label: 'Core courses, fall semester', cycle: 'fall-2025', course_types: ['CORE'] },
      { label: 'Thematic courses and labs, fall semester', cycle: 'fall-2025', course_types: ['THEMATIC', 'LAB'] },
      { label: 'Core courses, spring semester', cycle: 'spring-2026', course_types: ['CORE'] },
      { label: 'Thematic courses and labs, spring semester', cycle: 'spring-2026', course_types: ['THEMATIC', 'LAB'] },
    ],
    weekly_hours: 15,
    self_directed_study: true,
    requirements: 'High school completed. A Bachelor’s degree is recommended but not required.',
    pricing: {
      min: 18000,
      need_based_deductions: true,
      payment_plans: [
        {
          label: 'Three instalments',
          installments: [{ amount: 6000 }, { amount: 6000 }, { amount: 6000 }],
        },
      ],
    },
  },
]

export const seedProgrammes = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const { title, cycles, components, requirements, ...rest } of programmesData) {
    const id = await getOrCreateId(payload, 'programmes', { title: { equals: title } }, () =>
      payload.create({
        collection: 'programmes',
        data: {
          ...rest,
          title,
          slug: slugify(title),
          _status: 'published',
          cycles: requireIds(ctx.cycles, cycles),
          components: components.map(({ cycle, ...component }) => ({
            ...component,
            cycle: requireId(ctx.cycles, cycle),
          })),
          requirements: requirements ? lexical(requirements) : null,
        },
        overrideAccess: true,
      }),
    )

    ctx.programmes[title] = id
    console.log('programme:', title)
  }
}
```

- [ ] **Step 4: Fix the people int test's programme**

In `tests/int/people.int.spec.ts`, the programme create's `data` becomes:

```ts
        data: { kind: 'bridge', title: 'Probe Programme', slug: 'probe-programme' },
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/collections/Programmes.ts src/payload-types.ts seed tests/int/people.int.spec.ts
git commit -m "feat(programmes): components, commitment, registration and pricing, with drafts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Courses

**Files:**
- Modify: `src/collections/Courses.ts`, `seed/seed.utils.ts`, `seed/seed.type.ts`, `seed/collections/courses.seed.ts`, `src/app/(frontend)/study/[slug]/CourseView.tsx`

- [ ] **Step 1: Reshape the collection**

In `src/collections/Courses.ts`:

1. Add these imports:

   ```ts
   import { bibliographyField } from '@/fields/bibliography'
   import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
   import { pricingField } from '@/fields/pricing'
   import { registrationField } from '@/fields/registration'
   import { scheduleField, timeRangeFields } from '@/fields/schedule'
   ```

2. `course_type`: replace its `options` with `[...COURSE_TYPE_OPTIONS]`.

3. Delete:
   - the `Tuition` group,
   - the `registration_form` field,
   - the whole `Syllabus` group,
   - the course-level `bibliography` array.

4. After `location`, add these sidebar fields:

   ```ts
       {
         name: 'teaching_languages',
         type: 'select',
         hasMany: true,
         options: [
           { label: 'Arabic', value: 'ar' },
           { label: 'English', value: 'en' },
         ],
         admin: { position: 'sidebar' },
       },
       {
         name: 'language_note',
         type: 'text',
         localized: true,
         admin: { position: 'sidebar', placeholder: 'Readings in Arabic, discussion in either' },
       },
   ```

   After `fellows`, add:

   ```ts
       {
         name: 'syllabus_tentative',
         type: 'checkbox',
         label: 'Syllabus may change',
         admin: { position: 'sidebar' },
       },
       {
         // The label sessions get: "Week 3" or "Session 3".
         name: 'session_unit',
         type: 'select',
         required: true,
         defaultValue: 'session',
         options: [
           { label: 'Session', value: 'session' },
           { label: 'Week', value: 'week' },
         ],
         admin: { position: 'sidebar' },
       },
   ```

5. After the `Description` group, add the main-column fields:

   ```ts
       {
         label: 'Notes',
         type: 'collapsible',
         admin: { initCollapsed: true },
         fields: [
           { name: 'facilitator_note', type: 'textarea', localized: true },
           { name: 'content_warning', type: 'textarea', localized: true },
         ],
       },
       scheduleField(),
       registrationField(),
       pricingField({
         name: 'pricing_override',
         label: 'Price override',
         dbName: 'course_price',
       }),
       {
         // Unnamed: `sessions` must stay top-level, because the schedule's
         // end-date hook reads `data.sessions` (plan 2).
         label: 'Syllabus',
         type: 'collapsible',
         fields: [
           {
             name: 'sessions',
             type: 'array',
             labels: { singular: 'Session', plural: 'Sessions' },
             fields: [
               {
                 type: 'row',
                 fields: [
                   { name: 'order', type: 'number', admin: { width: '15%' } },
                   {
                     name: 'session_title',
                     type: 'text',
                     localized: true,
                     admin: { width: '55%' },
                   },
                   {
                     name: 'meetings',
                     type: 'number',
                     min: 0,
                     admin: { width: '15%', description: 'Default: one week of slots.' },
                   },
                   { name: 'cancelled', type: 'checkbox', admin: { width: '15%' } },
                 ],
               },
               { name: 'description', type: 'richText', localized: true },
               {
                 name: 'dates',
                 type: 'array',
                 admin: {
                   description:
                     "Only when this session's dates differ from the schedule. These replace them.",
                 },
                 fields: [
                   {
                     type: 'row',
                     fields: [
                       {
                         name: 'date',
                         type: 'date',
                         required: true,
                         admin: { width: '40%', date: { pickerAppearance: 'dayOnly' } },
                       },
                       ...timeRangeFields('30%'),
                     ],
                   },
                 ],
               },
               bibliographyField(),
               {
                 name: 'activities',
                 type: 'array',
                 fields: [
                   {
                     name: 'kind',
                     type: 'select',
                     required: true,
                     options: [
                       { label: 'Discussion', value: 'discussion' },
                       { label: 'Field visit', value: 'field_visit' },
                       { label: 'Exercise', value: 'exercise' },
                       { label: 'Screening', value: 'screening' },
                       { label: 'Presentation', value: 'presentation' },
                       { label: 'Other', value: 'other' },
                     ],
                   },
                   { name: 'description', type: 'textarea', localized: true },
                 ],
               },
             ],
           },
           bibliographyField('Course bibliography (all sessions)'),
         ],
       },
   ```

- [ ] **Step 2: Regenerate types**

Run: `pnpm generate:types`

- [ ] **Step 3: Seed schedules, not per-session dates**

In `seed/seed.utils.ts`:
- Delete `stampTime`, the local `addDays` and the old `weekly`.
- Replace them with the code below.
- Import `weekdayOf` from `@/lib/cairo-day`, and `ScheduleSeed` and `SessionSeed` from `./seed.type`.

```ts
/**
 * A course that meets once a week from `firstDate`, one session per week. The
 * schedule is the pattern; dates come from `expandSchedule()` (ADR 0002).
 */
export const weekly = (
  firstDate: string,
  start: string,
  end: string,
  sessions: SessionSeed[],
): { schedule: ScheduleSeed; sessions: SessionSeed[] } => ({
  schedule: {
    start_date: firstDate,
    weeks: sessions.length,
    slots: [{ weekday: weekdayOf(firstDate), start_time: start, end_time: end }],
  },
  sessions,
})
```

In `seed/seed.type.ts`, add next to `SessionSeed`:

```ts
export type ScheduleSeed = NonNullable<Draft<Course>['schedule']>
```

Make `CourseSeed` omit `'schedule'` as well, then add back an optional `schedule?: ScheduleSeed`.

In `seed/collections/courses.seed.ts`:
- `shortSeries` now returns what `weekly` returns. Its return type becomes `ReturnType<typeof weekly>`.
- Replace every `sessions: shortSeries(` with `...shortSeries(`.
- Replace both `sessions: weekly(` with `...weekly(`.
- In `seedCourses`, destructure `schedule` alongside `sessions` and pass it through: `schedule: schedule ?? null`.

The existing `sessions` mapping stays as it is.

- [ ] **Step 4: Rewrite the course page's facts and syllabus**

In `src/app/(frontend)/study/[slug]/CourseView.tsx`:
- Import:

  ```ts
  import { priceLabel, pricingFor } from '@/lib/pricing'
  import { registrationStatus } from '@/lib/registration'
  import { expandSchedule, sessionsInOrder, type Meeting } from '@/lib/schedule'
  ```

- Delete `toTimeLabel` and `formatTime`.
- Compute, after `cycleLabel`:

```ts
  const sessions = sessionsInOrder(course.sessions ?? [])
  const meetings = expandSchedule(course.schedule, course.sessions)
  const firstMeeting = meetings.find((m) => !m.cancelled)
  const price = priceLabel(pricingFor(course, cycle))
  const registration = registrationStatus(course.registration, cycle?.registration)
  const unit = course.session_unit === 'week' ? 'Week' : 'Session'
```

- In the `<dl>`, replace the `Sessions` and `Tuition` entries with:

```tsx
        {firstMeeting ? (
          <>
            <dt className="text-xs tracking-widest uppercase opacity-50">Starts</dt>
            <dd>{dayLabel(firstMeeting.date)}</dd>
          </>
        ) : null}
        {price ? (
          <>
            <dt className="text-xs tracking-widest uppercase opacity-50">Price</dt>
            <dd>
              {price}
              {pricingFor(course, cycle)?.need_based_deductions
                ? ' — need-based deductions available'
                : ''}
            </dd>
          </>
        ) : null}
        <dt className="text-xs tracking-widest uppercase opacity-50">Registration</dt>
        <dd>{registration === 'open' ? 'Open' : 'Closed'}</dd>
```

- Replace the Syllabus `<ol>` body with:

```tsx
            {sessions.map((session, i) => {
              const own = meetings.filter((m) => m.session === i + 1)
              return (
                <li key={session.id ?? i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-medium">
                      {unit} {i + 1}
                      {session.session_title ? ` · ${session.session_title}` : ''}
                      {session.cancelled ? ' (cancelled)' : ''}
                    </p>
                    {own.length ? (
                      <p className="text-sm opacity-60">{own.map(meetingLabel).join(', ')}</p>
                    ) : null}
                  </div>
                  {session.description ? (
                    <div className="opacity-70">
                      <RichTextField className="prose-sm" data={session.description} />
                    </div>
                  ) : null}
                  {session.bibliography?.length ? (
                    <ul className="mt-1 text-sm opacity-70">
                      {session.bibliography.map((material, j) => (
                        <li key={material.id ?? j}>{renderEntry(material)}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
```

- Change the guard around the Syllabus section to `sessions.length ?`.
- Add at the bottom of the file:

```ts
/** "Tue 3 Mar". Days are Cairo calendar days, so format them in UTC. */
const dayLabel = (day: string): string =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })

/** "Tue 3 Mar, 18:00–20:30" */
const meetingLabel = (m: Meeting): string =>
  `${dayLabel(m.date)}, ${m.start_time}–${m.end_time}`
```

If tsc says `cycle` doesn't match `pricingFor`'s parameter, check `Cycle['pricing']` in `src/payload-types.ts`. Widen `pricingFor`'s `cycle` parameter type to accept it; don't cast at the call site.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: tsc prints nothing, and lint has 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/collections/Courses.ts src/payload-types.ts seed "src/app/(frontend)/study/[slug]/CourseView.tsx"
git commit -m "feat(courses): schedule, registration, price override and reshaped sessions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Enrollments

**Files:**
- Create: `src/collections/Enrollments.ts`
- Modify: `src/collections/People.ts`, `src/collections/Courses.ts`, `src/payload.config.ts`, `seed/seed.utils.ts`

- [ ] **Step 1: Create the collection**

```ts
import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminOrOwn, ownsViaPerson } from '@/access'

/**
 * A person's place in one course (CONTEXT.md). Joining a programme's
 * community is a membership instead. The archive has no per-course lists, so
 * enrollments start from now.
 */
export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  admin: {
    defaultColumns: ['person', 'course', 'status', 'slot'],
  },
  access: {
    read: isAdminOrOwn(ownsViaPerson),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  indexes: [{ fields: ['person', 'course'], unique: true }],
  fields: [
    { name: 'person', type: 'relationship', relationTo: 'people', required: true, index: true },
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'applied',
      options: [
        { label: 'Applied', value: 'applied' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Confirmed (paid)', value: 'confirmed' },
        { label: 'Completed', value: 'completed' },
        { label: 'Withdrawn', value: 'withdrawn' },
      ],
    },
    {
      name: 'slot',
      type: 'text',
      admin: { description: 'Which group they attend, e.g. "evening".' },
    },
    {
      // Narratives in lieu of grades. Only admins and the student can read
      // enrollments at all.
      name: 'assessment',
      type: 'richText',
      localized: true,
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'admin',
      options: [
        { label: 'Registration form', value: 'registration_form' },
        { label: 'Added by an admin', value: 'admin' },
        { label: 'Archive backfill', value: 'backfill' },
      ],
    },
  ],
}
```

- [ ] **Step 2: Joins, registration and reset order**

- In `src/collections/People.ts`, add after the `memberships` join:

```ts
    {
      name: 'enrollments',
      type: 'join',
      collection: 'enrollments',
      on: 'person',
      admin: { allowCreate: true, defaultColumns: ['course', 'status'] },
    },
```

- In `src/collections/Courses.ts`, add at the end of `fields`:

```ts
    {
      name: 'enrollments',
      type: 'join',
      collection: 'enrollments',
      on: 'course',
      admin: { allowCreate: true, defaultColumns: ['person', 'status', 'slot'] },
    },
```

- In `src/payload.config.ts`, import `Enrollments` and register it directly after `Courses`.
- In `seed/seed.utils.ts`, put `'enrollments'` first in `CONTENT_COLLECTIONS`, since it references courses and people.

- [ ] **Step 3: Regenerate types and type-check**

Run: `pnpm generate:types && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/collections/Enrollments.ts src/collections/People.ts src/collections/Courses.ts src/payload.config.ts src/payload-types.ts seed/seed.utils.ts
git commit -m "feat(enrollments): a person's place in one course

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Migrate, reseed and test against the database

**Files:**
- Regenerate: `src/migrations/*`
- Create: `tests/int/teaching.int.spec.ts`

- [ ] **Step 1: Rebuild the single baseline migration**

The database is disposable; the old migration describes plan 1's schema. Run:

```bash
find src/migrations -maxdepth 1 -type f \( -name '*.json' -o -name '*.ts' \) ! -name 'index.ts' -delete
pnpm db:migrate:create
```

Expected: a new `src/migrations/<timestamp>.ts` and `.json`, with `index.ts` updated.

`migrate:create` builds the full Postgres schema. If it throws "Multiple identifiers exceed Postgres's 63-character limit", stop: a `dbName` is missing. Report which table it names.

- [ ] **Step 2: Reset the database (the user runs this)**

The permission classifier blocks the agent from dropping the database, so ask the user to run:

```
! pnpm payload migrate:fresh --force-accept-warning && pnpm db:seed
```

Wait until it prints `SEED COMPLETE`.

- [ ] **Step 3: Write the int test**

`tests/int/teaching.int.spec.ts`:

```ts
// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { cairoDay } from '@/lib/cairo-day'
import type { User } from '@/payload-types'

type Tracked = 'spaces' | 'cycles' | 'courses' | 'people' | 'enrollments' | 'programmes' | 'users'

let payload: Payload
const created: Array<{ collection: Tracked; id: number }> = []
const track = <T extends { id: number }>(collection: Tracked, doc: T): T => {
  created.push({ collection, id: doc.id })
  return doc
}

describe('time, place and teaching', () => {
  let cycleId: number
  let courseId: number
  let personId: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const space = track(
      'spaces',
      await payload.create({
        collection: 'spaces',
        data: { name: 'Probe Space', slug: 'probe-space', city: 'Probeville' },
        overrideAccess: true,
      }),
    )
    cycleId = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'spring', start_year: 2031, space: space.id, start_date: '2031-03-04' },
        overrideAccess: true,
      }),
    ).id
    personId = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Enrollment Probe', slug: 'enrollment-probe' },
        overrideAccess: true,
      }),
    ).id
    courseId = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Probe Course',
          slug: 'probe-course',
          course_type: 'THEMATIC',
          cycle: cycleId,
          // 4 March 2031 is a Tuesday.
          schedule: {
            start_date: '2031-03-04',
            weeks: 3,
            slots: [{ weekday: 'tue', start_time: '18:00', end_time: '20:00' }],
          },
          sessions: [{ order: 1 }, { order: 2 }, { order: 3 }],
        },
        overrideAccess: true,
      }),
    ).id
  })

  afterAll(async () => {
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
    }
    await payload.destroy()
  })

  it('builds the cycle title, slug and academic year from its space', async () => {
    const cycle = await payload.findByID({ collection: 'cycles', id: cycleId, overrideAccess: true })
    expect(cycle.title).toBe('Spring 2031, Probeville')
    expect(cycle.slug).toBe('spring-2031-probeville')
    expect(cycle.academic_year).toBe('2030–2031')
  })

  it("lists the cycle's courses through the join", async () => {
    const cycle = await payload.findByID({ collection: 'cycles', id: cycleId, overrideAccess: true })
    expect(cycle.courses?.docs?.map((c) => (typeof c === 'object' ? c.id : c))).toContain(courseId)
  })

  it('computes the end date and keeps it through a partial update', async () => {
    const read = () =>
      payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, draft: true })
    expect(cairoDay((await read()).schedule?.end_date ?? '')).toBe('2031-03-18')

    await payload.update({
      collection: 'courses',
      id: courseId,
      data: { title: 'Probe Course, renamed' },
      overrideAccess: true,
    })
    expect(cairoDay((await read()).schedule?.end_date ?? '')).toBe('2031-03-18')
  })

  it('ends earlier when the last session is cancelled', async () => {
    await payload.update({
      collection: 'courses',
      id: courseId,
      data: { sessions: [{ order: 1 }, { order: 2 }, { order: 3, cancelled: true }] },
      overrideAccess: true,
    })
    const course = await payload.findByID({
      collection: 'courses',
      id: courseId,
      overrideAccess: true,
      draft: true,
    })
    expect(cairoDay(course.schedule?.end_date ?? '')).toBe('2031-03-11')
  })

  it('refuses a second enrollment for the same person and course', async () => {
    track(
      'enrollments',
      await payload.create({
        collection: 'enrollments',
        data: { person: personId, course: courseId },
        overrideAccess: true,
      }),
    )
    await expect(
      payload.create({
        collection: 'enrollments',
        data: { person: personId, course: courseId },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it("shows an account only its own person's enrollments", async () => {
    const own = { id: -1, roles: ['member'], person: personId } as unknown as User
    const other = { id: -2, roles: ['member'], person: personId + 1_000_000 } as unknown as User

    const mine = await payload.find({ collection: 'enrollments', user: own, overrideAccess: false })
    const theirs = await payload.find({
      collection: 'enrollments',
      user: other,
      overrideAccess: false,
    })
    expect(mine.totalDocs).toBe(1)
    expect(theirs.totalDocs).toBe(0)
  })

  it('hides a draft programme from the public', async () => {
    const draft = track(
      'programmes',
      await payload.create({
        collection: 'programmes',
        data: { kind: 'bridge', title: 'Probe Draft Programme', slug: 'probe-draft-programme' },
        draft: true,
        overrideAccess: true,
      }),
    )
    const { docs } = await payload.find({
      collection: 'programmes',
      where: { id: { equals: draft.id } },
      overrideAccess: false,
    })
    expect(docs).toHaveLength(0)
  })
})
```

- [ ] **Step 4: Run the int tests and the whole suite**

Run: `pnpm test:int`
Expected:
- `teaching.int.spec.ts` passes 7 tests.
- Everything else still passes, including `people.int.spec.ts` with its new `kind`.

If an assertion fails because Payload behaves differently from the plan's assumption, stop and report. For example: the join shape, `end_date` coming back as a full timestamp, or `user` objects in local API calls. Don't loosen the assertion.

- [ ] **Step 5: Smoke-check the seeded data**

Run:

```bash
npx tsx --env-file=.env -e "import('payload').then(async ({getPayload})=>{const {default:c}=await import('./src/payload.config.ts');const p=await getPayload({config:await c});const {docs}=await p.find({collection:'cycles',depth:0,limit:10,overrideAccess:true});console.log(docs.map(d=>[d.title,d.academic_year]));const k=await p.find({collection:'courses',where:{title:{equals:'Writing the Self'}},depth:0,overrideAccess:true,draft:true});console.log(k.docs[0]?.schedule?.end_date);await p.destroy();process.exit(0)})"
```

Expected:
- The four cycles are titled `Fall 2025, Cairo`, `Winter 2026, Cairo`, `Spring 2026, Cairo` and `Summer 2026, Cairo`.
- Each has academic year `2025–2026`.
- "Writing the Self" ends on 2026-09-20 (10 weekly Sundays from 2026-07-19). The value is a timestamp on that day.

If tsx refuses the inline ESM, put the same code in a scratch file outside the repo and run it with `npx tsx --env-file=.env <file>`.

- [ ] **Step 6: Commit**

```bash
git add src/migrations tests/int/teaching.int.spec.ts
git commit -m "test(teaching): cycles, course dates, enrollments and programme drafts against the database

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Update the spec

**Files:**
- Modify: `docs/schema.md`

- [ ] **Step 1: Replace the finished sections**

In `docs/schema.md`:
- Delete the `## Time and place`, `## Programmes` and `## Teaching` sections, including `enrollments`.
- Put this in their place:

```markdown
## Time and place, programmes, teaching

Spaces, cycles, programmes, courses and enrollments match the code (ADR 0002, ADR 0003). Still to do:
- **Admin:** show a course session's computed dates as placeholders in its `dates[]` (needs a custom field component).
- **Programmes:** `partners[]` → partners, once plan 4 adds the collection.
- **Access:** courses and articles have no `readVersions` rule, so any signed-in account can read their drafts through the versions endpoint. Set it to match their edit rules (plan 4 reworks articles).
- **Archive import (plan 6):** `legacy_url` and `import_status` on imported documents; unverified Bridge years (2020–21, 2023–24, 2024–25) as draft programmes; legacy trimesters mapped onto fall, winter and spring.
```

- In `## Shared shapes`:
  - Delete the three wiring bullets about `end_date`, `dbName` and `registration_form`. They are done for courses.
  - Keep one line: `Events adopt them in plan 4; drop events' top-level registration_form in the same migration.`

- [ ] **Step 2: Commit**

```bash
git add docs/schema.md
git commit -m "docs(schema): time, place and teaching are built

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
