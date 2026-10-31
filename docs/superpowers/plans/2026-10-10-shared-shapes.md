# Shared Shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable `schedule`, `registration` and `pricing` field groups and the pure functions behind them: `expandSchedule()`, `scheduleEndDate()`, `isOnCalendar()` and `registrationStatus()`.

**Architecture:** Pure date logic lives in `src/lib/` with no Payload imports, so it runs the same in hooks, server components and tests. Field builders in `src/fields/` return Payload field configs that wrap those functions. No collection uses the new fields yet: plan 3 swaps them into cycles, programmes and courses, and plan 4 into events. So this plan changes no database tables.

**Tech Stack:** Payload 3.90.2 field configs, TypeScript, vitest unit tests. No new dependencies: dates use `Intl.DateTimeFormat` with `Africa/Cairo` and UTC `Date` arithmetic on `YYYY-MM-DD` strings.

**Spec:** `docs/schema.md` (Shared shapes), `CONTEXT.md` (Schedule, Slot, Session, Meeting, Registration, Deadline, Pricing), `docs/adr/0002-schedule-pattern-drives-session-dates.md`.

**Branch:** work directly on `main`, one commit per task. Don't push.

---

## Roadmap (this is plan 2 of 6)

1. People and identity (done)
2. **Shared shapes** (this plan)
3. Time, place and teaching: spaces, cycles, programmes, courses, enrollments (ADR 0003)
4. Publishing: articles review, credits, publications, press, partners, events, newsletters, email adapter (ADR 0005)
5. Plugins: redirects and SEO
6. Archive import pipeline (ADR 0004)

## Decisions made in this plan

These fill gaps the spec leaves open. Each is cheap to change before plan 3 wires the fields in.

- **Slot times are text, `HH:MM`, 24-hour.** Payload's time-only `date` field stores a full timestamp converted through the editor's browser time zone, which breaks the "wall-clock Cairo" rule in ADR 0002. A validated text field keeps exactly what was typed.
- **Days are `YYYY-MM-DD` strings in the logic.** A stored Payload date (an ISO timestamp) is read as the Cairo calendar day it falls on (`cairoDay()`), so a day-picker value saved at any hour still lands on the right day.
- **Week 1 is the 7 days starting at `start_date`.** Each slot meets on the first matching weekday on or after `start_date`, then every 7 days, for `weeks` weeks. A Wednesday start with Tuesday/Thursday slots gives Thursday, then next Tuesday.
- **Sessions consume pattern meetings in order.** A session takes `meetings` meetings (default: number of slots). A cancelled session still uses up its meetings, so later sessions keep their dates, and its meetings come back marked `cancelled`. A session with its own `dates[]` uses those instead of the ones it consumed. Pattern meetings left over after the last session are returned without a session number.
- **Sessions are numbered by `order`,** falling back to array position, starting at 1.
- **`end_date` is the last meeting that isn't cancelled.** The field hook here only sees the schedule group, so it uses the pattern. Plan 3 recomputes it at collection level with the course's sessions.
- **Registration falls back field by field.** A course with no `method` uses its cycle's method, and a course with no `deadline` uses its cycle's deadline. So `method` has no default value. With no method anywhere, registration is closed. With a method but no deadline, it is open.
- **A deadline day is open until midnight Cairo time.**

## File map

| File                                   | Change | Responsibility                                                               |
| -------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| `src/lib/cairo-day.ts`                 | create | `cairoDay()`, `addDays()`, `weekdayOf()` on `YYYY-MM-DD` strings             |
| `src/lib/schedule.ts`                  | create | Schedule types, `expandSchedule()`, `scheduleEndDate()`, `isOnCalendar()`    |
| `src/lib/registration.ts`              | create | `registrationStatus()`                                                       |
| `src/fields/validators.ts`             | create | `httpUrl` (moved from `social.ts`), `timeOfDay`, `endAfterStart`, `notBelow` |
| `src/fields/social.ts`                 | modify | Import `httpUrl` from `validators.ts`                                        |
| `src/fields/schedule.ts`               | create | `scheduleField()` and its `computeEndDate` hook                              |
| `src/fields/registration.ts`           | create | `registrationField()`                                                        |
| `src/fields/pricing.ts`                | create | `pricingField()`                                                             |
| `tests/unit/cairo-day.unit.spec.ts`    | create | Day helpers                                                                  |
| `tests/unit/schedule.unit.spec.ts`     | create | Expansion, sessions, end date, calendar                                      |
| `tests/unit/registration.unit.spec.ts` | create | Open/closed and fallback                                                     |
| `tests/unit/shape-fields.unit.spec.ts` | create | Validators, field shapes, end-date hook                                      |
| `docs/schema.md`                       | modify | Drop the finished shared-shape sections                                      |

Run a single spec with `pnpm vitest run --config ./vitest.config.mts <path>`.

Baseline before starting: `npx tsc --noEmit` prints nothing, and `pnpm lint` has 0 errors.

---

### Task 1: Cairo day helpers

**Files:**

- Create: `src/lib/cairo-day.ts`
- Test: `tests/unit/cairo-day.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { addDays, cairoDay, weekdayOf } from '@/lib/cairo-day'

describe('cairoDay', () => {
  it('passes a plain day through', () => {
    expect(cairoDay('2026-03-03')).toBe('2026-03-03')
  })

  it('reads a timestamp as the Cairo calendar day', () => {
    // 22:00 UTC on 2 March is midnight on 3 March in Cairo (UTC+2).
    expect(cairoDay('2026-03-02T22:00:00.000Z')).toBe('2026-03-03')
    expect(cairoDay('2026-03-02T21:59:00.000Z')).toBe('2026-03-02')
  })

  it('accepts a Date', () => {
    expect(cairoDay(new Date('2026-03-01T21:30:00Z'))).toBe('2026-03-01')
  })
})

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-03', 0)).toBe('2026-03-03')
  })
})

describe('weekdayOf', () => {
  it('names the weekday', () => {
    expect(weekdayOf('2026-03-03')).toBe('tue')
    expect(weekdayOf('2026-03-07')).toBe('sat')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/cairo-day.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/lib/cairo-day"`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Calendar days as `YYYY-MM-DD` strings. CILAS times are Cairo wall-clock
 * (ADR 0002), so day arithmetic runs on plain dates in UTC, where no
 * daylight-saving shift can move a day.
 */

export const CAIRO = 'Africa/Cairo'

// Egypt's week starts on Saturday, so admin dropdowns list it first.
export const WEEKDAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const
export type Weekday = (typeof WEEKDAYS)[number]

// Indexed by Date#getUTCDay(), where 0 is Sunday.
const BY_JS_DAY: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const DAY = /^\d{4}-\d{2}-\d{2}$/

const cairoFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAIRO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The Cairo calendar day a stored date or timestamp falls on. */
export const cairoDay = (value: string | Date): string =>
  typeof value === 'string' && DAY.test(value) ? value : cairoFormat.format(new Date(value))

const toUTC = (day: string): Date => new Date(`${day}T00:00:00Z`)

export const addDays = (day: string, n: number): string => {
  const d = toUTC(day)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const weekdayOf = (day: string): Weekday => BY_JS_DAY[toUTC(day).getUTCDay()]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/cairo-day.unit.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cairo-day.ts tests/unit/cairo-day.unit.spec.ts
git commit -m "feat(lib): Cairo calendar-day helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Expand a schedule pattern

**Files:**

- Create: `src/lib/schedule.ts`
- Test: `tests/unit/schedule.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { expandSchedule, type Schedule } from '@/lib/schedule'

// 3 March 2026 is a Tuesday.
const tueThu: Schedule = {
  start_date: '2026-03-03',
  weeks: 2,
  slots: [
    { weekday: 'thu', start_time: '19:00', end_time: '21:00' },
    { weekday: 'tue', start_time: '19:00', end_time: '21:00', label: 'Seminar' },
  ],
}

const days = (s: Schedule) => expandSchedule(s).map((m) => m.date)

describe('expandSchedule (pattern only)', () => {
  it('produces every meeting in date order', () => {
    expect(days(tueThu)).toEqual(['2026-03-03', '2026-03-05', '2026-03-10', '2026-03-12'])
  })

  it('carries times and labels from the slot', () => {
    expect(expandSchedule(tueThu)[0]).toEqual({
      date: '2026-03-03',
      start_time: '19:00',
      end_time: '21:00',
      label: 'Seminar',
    })
  })

  it('starts each slot on its first weekday on or after the start date', () => {
    // A Wednesday start: Thursday first, then the next Tuesday.
    expect(days({ ...tueThu, start_date: '2026-03-04', weeks: 1 })).toEqual([
      '2026-03-05',
      '2026-03-10',
    ])
  })

  it('orders two meetings on one day by start time', () => {
    const twice: Schedule = {
      start_date: '2026-03-03',
      weeks: 1,
      slots: [
        { weekday: 'tue', start_time: '18:00', end_time: '19:00' },
        { weekday: 'tue', start_time: '10:00', end_time: '12:00' },
      ],
    }
    expect(expandSchedule(twice).map((m) => m.start_time)).toEqual(['10:00', '18:00'])
  })

  it('reads a stored timestamp as its Cairo day', () => {
    expect(days({ ...tueThu, start_date: '2026-03-02T22:00:00.000Z' })[0]).toBe('2026-03-03')
  })

  it('is empty until start date, weeks and slots are all set', () => {
    expect(expandSchedule({ ...tueThu, start_date: null })).toEqual([])
    expect(expandSchedule({ ...tueThu, weeks: 0 })).toEqual([])
    expect(expandSchedule({ ...tueThu, slots: [] })).toEqual([])
    expect(expandSchedule(null)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/schedule.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/lib/schedule"`.

- [ ] **Step 3: Write the implementation**

```ts
import { addDays, cairoDay, WEEKDAYS, weekdayOf, type Weekday } from '@/lib/cairo-day'

/**
 * The one place dates come from (ADR 0002). Every date shown anywhere, from
 * the course page to the calendar, goes through `expandSchedule()`.
 */

export type Slot = {
  weekday: Weekday
  start_time: string
  end_time: string
  label?: string | null
}

export type Schedule = {
  start_date?: string | null
  start_precision?: 'day' | 'week' | null
  weeks?: number | null
  slots?: Slot[] | null
}

export type Meeting = {
  date: string
  start_time: string
  end_time: string
  label?: string
}

const byWhen = (a: Meeting, b: Meeting): number =>
  a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)

// Days from `from` forward to the next `weekday`, 0 when it is that day.
const daysUntil = (from: string, weekday: Weekday): number =>
  (WEEKDAYS.indexOf(weekday) - WEEKDAYS.indexOf(weekdayOf(from)) + 7) % 7

const expandPattern = (schedule: Schedule): Meeting[] => {
  const { start_date, weeks, slots } = schedule
  if (!start_date || !weeks || !slots?.length) return []

  const start = cairoDay(start_date)
  const meetings: Meeting[] = []
  for (let week = 0; week < weeks; week++) {
    for (const { weekday, start_time, end_time, label } of slots) {
      meetings.push({
        date: addDays(start, week * 7 + daysUntil(start, weekday)),
        start_time,
        end_time,
        ...(label ? { label } : {}),
      })
    }
  }
  return meetings.sort(byWhen)
}

export const expandSchedule = (schedule: Schedule | null | undefined): Meeting[] =>
  schedule ? expandPattern(schedule) : []
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/schedule.unit.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule.ts tests/unit/schedule.unit.spec.ts
git commit -m "feat(lib): expand a schedule pattern into meetings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Hand meetings to sessions

**Files:**

- Modify: `src/lib/schedule.ts`
- Test: `tests/unit/schedule.unit.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/schedule.unit.spec.ts`. The import line at the top becomes:

```ts
import { expandSchedule, type Schedule, type SessionDates } from '@/lib/schedule'
```

```ts
describe('expandSchedule with sessions', () => {
  // Tuesdays and Thursdays for 3 weeks: 6 meetings, 2 per session.
  const threeWeeks: Schedule = { ...tueThu, weeks: 3 }
  const pick = (sessions: SessionDates[]) =>
    expandSchedule(threeWeeks, sessions).map(({ date, session, cancelled }) => ({
      date,
      session,
      ...(cancelled ? { cancelled } : {}),
    }))

  it('gives each session one week of meetings by default', () => {
    expect(pick([{}, {}, {}])).toEqual([
      { date: '2026-03-03', session: 1 },
      { date: '2026-03-05', session: 1 },
      { date: '2026-03-10', session: 2 },
      { date: '2026-03-12', session: 2 },
      { date: '2026-03-17', session: 3 },
      { date: '2026-03-19', session: 3 },
    ])
  })

  it('lets a session take a different number of meetings', () => {
    expect(pick([{ meetings: 1 }, { meetings: 3 }])).toEqual([
      { date: '2026-03-03', session: 1 },
      { date: '2026-03-05', session: 2 },
      { date: '2026-03-10', session: 2 },
      { date: '2026-03-12', session: 2 },
      // Left over after the last session.
      { date: '2026-03-17', session: undefined },
      { date: '2026-03-19', session: undefined },
    ])
  })

  it('keeps a cancelled session in place, marked cancelled', () => {
    expect(pick([{}, { cancelled: true }, {}])).toEqual([
      { date: '2026-03-03', session: 1 },
      { date: '2026-03-05', session: 1 },
      { date: '2026-03-10', session: 2, cancelled: true },
      { date: '2026-03-12', session: 2, cancelled: true },
      { date: '2026-03-17', session: 3 },
      { date: '2026-03-19', session: 3 },
    ])
  })

  it("uses a session's own dates instead of the computed ones", () => {
    const moved = expandSchedule(threeWeeks, [
      {},
      {},
      { dates: [{ date: '2026-03-21', start_time: '10:00', end_time: '12:00' }] },
    ])
    expect(moved.slice(4)).toEqual([
      { date: '2026-03-21', start_time: '10:00', end_time: '12:00', session: 3 },
    ])
  })

  it('reads stored timestamps in session dates as Cairo days', () => {
    const moved = expandSchedule(threeWeeks, [
      { dates: [{ date: '2026-03-20T22:00:00.000Z', start_time: '10:00', end_time: '12:00' }] },
    ])
    expect(moved.find((m) => m.session === 1)?.date).toBe('2026-03-21')
  })

  it('numbers sessions by order, not array position', () => {
    expect(pick([{ order: 2 }, { order: 1, meetings: 1 }]).slice(0, 3)).toEqual([
      { date: '2026-03-03', session: 1 },
      { date: '2026-03-05', session: 2 },
      { date: '2026-03-10', session: 2 },
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/schedule.unit.spec.ts`
Expected: the 6 new cases FAIL because the meetings have no `session` (vitest strips the type-only `SessionDates` import, so that import doesn't fail at runtime).

- [ ] **Step 3: Implement**

In `src/lib/schedule.ts`, extend `Meeting`, add `SessionDates`, and replace `expandSchedule`:

```ts
export type Meeting = {
  date: string
  start_time: string
  end_time: string
  label?: string
  // 1-based, by session order. Absent for meetings after the last session.
  session?: number
  cancelled?: boolean
}

/** The parts of a course session that affect its dates. */
export type SessionDates = {
  order?: number | null
  // How many pattern meetings this session takes. Default: slots per week.
  meetings?: number | null
  cancelled?: boolean | null
  // When set, these replace the session's computed meetings.
  dates?: Array<{ date: string; start_time: string; end_time: string }> | null
}
```

```ts
const inOrder = (sessions: SessionDates[]): SessionDates[] =>
  sessions
    .map((session, index) => ({ session, key: session.order ?? index }))
    .sort((a, b) => a.key - b.key)
    .map(({ session }) => session)

/**
 * Meetings for a schedule. With sessions, each session takes its share of
 * the pattern in order; a cancelled one keeps its share (marked), and one
 * with its own dates swaps its share for them.
 */
export const expandSchedule = (
  schedule: Schedule | null | undefined,
  sessions?: SessionDates[] | null,
): Meeting[] => {
  const pattern = schedule ? expandPattern(schedule) : []
  if (!sessions?.length) return pattern

  const perWeek = schedule?.slots?.length || 1
  const meetings: Meeting[] = []
  let cursor = 0

  inOrder(sessions).forEach((s, index) => {
    const session = index + 1
    const share = pattern.slice(cursor, cursor + (s.meetings ?? perWeek))
    cursor += s.meetings ?? perWeek

    const own = s.dates?.length
      ? s.dates.map(({ date, start_time, end_time }) => ({
          date: cairoDay(date),
          start_time,
          end_time,
        }))
      : share

    for (const meeting of own) {
      meetings.push({ ...meeting, session, ...(s.cancelled ? { cancelled: true } : {}) })
    }
  })

  meetings.push(...pattern.slice(cursor))
  return meetings.sort(byWhen)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/schedule.unit.spec.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule.ts tests/unit/schedule.unit.spec.ts
git commit -m "feat(lib): sessions take their share of schedule meetings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: End date and calendar visibility

**Files:**

- Modify: `src/lib/schedule.ts`
- Test: `tests/unit/schedule.unit.spec.ts`

- [ ] **Step 1: Write the failing tests**

Change the import at the top of `tests/unit/schedule.unit.spec.ts` to:

```ts
import {
  expandSchedule,
  isOnCalendar,
  scheduleEndDate,
  type Schedule,
  type SessionDates,
} from '@/lib/schedule'
```

Append:

```ts
describe('scheduleEndDate', () => {
  it('is the last meeting day', () => {
    expect(scheduleEndDate(tueThu)).toBe('2026-03-12')
  })

  it('ignores cancelled meetings', () => {
    expect(scheduleEndDate(tueThu, [{}, { cancelled: true }])).toBe('2026-03-05')
  })

  it('follows moved session dates', () => {
    expect(
      scheduleEndDate(tueThu, [
        {},
        { dates: [{ date: '2026-03-28', start_time: '10:00', end_time: '12:00' }] },
      ]),
    ).toBe('2026-03-28')
  })

  it('is null with no meetings', () => {
    expect(scheduleEndDate({ ...tueThu, slots: [] })).toBeNull()
  })
})

describe('isOnCalendar', () => {
  it('shows day-precision schedules, the default', () => {
    expect(isOnCalendar(tueThu)).toBe(true)
    expect(isOnCalendar({ ...tueThu, start_precision: 'day' })).toBe(true)
  })

  it('keeps week-precision schedules off the calendar', () => {
    expect(isOnCalendar({ ...tueThu, start_precision: 'week' })).toBe(false)
  })

  it('keeps empty schedules off the calendar', () => {
    expect(isOnCalendar({ ...tueThu, start_date: null })).toBe(false)
    expect(isOnCalendar(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/schedule.unit.spec.ts`
Expected: FAIL, `scheduleEndDate is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/schedule.ts`:

```ts
/** The last day the course actually meets, or null with no meetings. */
export const scheduleEndDate = (
  schedule: Schedule | null | undefined,
  sessions?: SessionDates[] | null,
): string | null =>
  expandSchedule(schedule, sessions)
    .filter((m) => !m.cancelled)
    .at(-1)?.date ?? null

/** Only schedules whose start day is known go on the calendar (ADR 0002). */
export const isOnCalendar = (schedule: Schedule | null | undefined): boolean =>
  !!schedule && schedule.start_precision !== 'week' && expandSchedule(schedule).length > 0
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/schedule.unit.spec.ts`
Expected: PASS, 19 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule.ts tests/unit/schedule.unit.spec.ts
git commit -m "feat(lib): schedule end date and calendar visibility

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Registration status

**Files:**

- Create: `src/lib/registration.ts`
- Test: `tests/unit/registration.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { registrationStatus } from '@/lib/registration'

// 23:30 on 1 March in Cairo, then 00:30 on 2 March.
const lateOnDeadline = new Date('2026-03-01T21:30:00Z')
const dayAfter = new Date('2026-03-01T22:30:00Z')

describe('registrationStatus', () => {
  it('is open through the end of the deadline day in Cairo', () => {
    const reg = { method: 'form' as const, deadline: '2026-03-01' }
    expect(registrationStatus(reg, null, lateOnDeadline)).toBe('open')
    expect(registrationStatus(reg, null, dayAfter)).toBe('closed')
  })

  it('reads a stored deadline timestamp as its Cairo day', () => {
    const reg = { method: 'external' as const, deadline: '2026-02-28T22:00:00.000Z' }
    expect(registrationStatus(reg, null, lateOnDeadline)).toBe('open')
  })

  it('is open with a method and no deadline', () => {
    expect(registrationStatus({ method: 'form' }, null, dayAfter)).toBe('open')
  })

  it('is closed when the method is closed, whatever the deadline', () => {
    expect(registrationStatus({ method: 'closed', deadline: '2099-01-01' }, null)).toBe('closed')
  })

  it('is closed when nothing is set', () => {
    expect(registrationStatus(null, null)).toBe('closed')
    expect(registrationStatus({}, {})).toBe('closed')
  })

  it("falls back to the cycle's method and deadline", () => {
    const cycle = { method: 'form' as const, deadline: '2026-03-01' }
    expect(registrationStatus({}, cycle, lateOnDeadline)).toBe('open')
    expect(registrationStatus({}, cycle, dayAfter)).toBe('closed')
  })

  it("prefers the course's own deadline", () => {
    const cycle = { method: 'form' as const, deadline: '2026-02-01' }
    expect(registrationStatus({ deadline: '2026-03-01' }, cycle, lateOnDeadline)).toBe('open')
  })

  it('lets a course close even when its cycle is open', () => {
    const cycle = { method: 'form' as const }
    expect(registrationStatus({ method: 'closed' }, cycle)).toBe('closed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/registration.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/lib/registration"`.

- [ ] **Step 3: Write the implementation**

```ts
import { cairoDay } from '@/lib/cairo-day'

export const REGISTRATION_METHODS = ['form', 'external', 'closed'] as const
export type RegistrationMethod = (typeof REGISTRATION_METHODS)[number]

export type Registration = {
  method?: RegistrationMethod | null
  deadline?: string | null
}

export type RegistrationStatus = 'open' | 'closed'

/**
 * Whether people can register now. Each field falls back to the parent
 * (a course's cycle) when the item leaves it empty. The deadline day stays
 * open until midnight in Cairo.
 */
export const registrationStatus = (
  own: Registration | null | undefined,
  parent?: Registration | null,
  now: Date = new Date(),
): RegistrationStatus => {
  const method = own?.method ?? parent?.method
  if (!method || method === 'closed') return 'closed'

  const deadline = own?.deadline ?? parent?.deadline
  if (!deadline) return 'open'
  return cairoDay(now) <= cairoDay(deadline) ? 'open' : 'closed'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/registration.unit.spec.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/registration.ts tests/unit/registration.unit.spec.ts
git commit -m "feat(lib): registration is open until the deadline day ends in Cairo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Shared field validators

**Files:**

- Create: `src/fields/validators.ts`
- Modify: `src/fields/social.ts`
- Test: `tests/unit/shape-fields.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { endAfterStart, httpUrl, notBelow, timeOfDay } from '@/fields/validators'

describe('validators', () => {
  it('timeOfDay accepts 24-hour HH:MM only', () => {
    expect(timeOfDay('19:00')).toBe(true)
    expect(timeOfDay('00:05')).toBe(true)
    expect(timeOfDay('7:00')).toMatch(/HH:MM/)
    expect(timeOfDay('24:00')).toMatch(/HH:MM/)
    expect(timeOfDay('7pm')).toMatch(/HH:MM/)
    expect(timeOfDay(null)).toMatch(/HH:MM/)
  })

  it('endAfterStart needs the end strictly later', () => {
    expect(endAfterStart('21:00', '19:00')).toBe(true)
    expect(endAfterStart('19:00', '19:00')).toMatch(/after/)
    expect(endAfterStart('18:00', '19:00')).toMatch(/after/)
    // An invalid end is reported by timeOfDay; an unset start can't be compared.
    expect(endAfterStart('21:00', undefined)).toBe(true)
  })

  it('notBelow allows an empty or larger value', () => {
    expect(notBelow(500, 300, 'the minimum')).toBe(true)
    expect(notBelow(300, 300, 'the minimum')).toBe(true)
    expect(notBelow(null, 300, 'the minimum')).toBe(true)
    expect(notBelow(100, 300, 'the minimum')).toBe('Must not be below the minimum.')
  })

  it('httpUrl still lives here', () => {
    expect(httpUrl('https://cilas.net')).toBe(true)
    expect(httpUrl('cilas.net')).toMatch(/https/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/fields/validators"`.

- [ ] **Step 3: Write the implementation**

`src/fields/validators.ts`:

```ts
/** Field validators. Each returns true or a message for the editor. */

export const httpUrl = (value: unknown): true | string =>
  typeof value === 'string' && /^https?:\/\/\S+$/.test(value)
    ? true
    : 'Enter a full URL starting with https:// or http://'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const timeOfDay = (value: unknown): true | string =>
  typeof value === 'string' && TIME.test(value)
    ? true
    : 'Use 24-hour HH:MM in Cairo time, e.g. 19:00'

// Zero-padded HH:MM strings sort the same way as the times they name.
export const endAfterStart = (end: unknown, start: unknown): true | string =>
  typeof end !== 'string' || typeof start !== 'string' || !TIME.test(start) || end > start
    ? true
    : 'End time must be after the start time.'

export const notBelow = (value: unknown, floor: unknown, name: string): true | string =>
  typeof value !== 'number' || typeof floor !== 'number' || value >= floor
    ? true
    : `Must not be below ${name}.`
```

In `src/fields/social.ts`, delete the `httpUrl` definition and import it instead (nothing else imports it from `social.ts`):

```ts
import type { Field } from 'payload'

import { httpUrl } from './validators'

export const SOCIAL_PLATFORMS = ['facebook', 'x', 'youtube', 'instagram', 'linkedin'] as const
```

The rest of `social.ts` is unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts && npx tsc --noEmit`
Expected: PASS, 4 tests; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/fields/validators.ts src/fields/social.ts tests/unit/shape-fields.unit.spec.ts
git commit -m "feat(fields): shared validators for times, ranges and URLs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `scheduleField()`

**Files:**

- Create: `src/fields/schedule.ts`
- Test: `tests/unit/shape-fields.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/shape-fields.unit.spec.ts`, and add these imports at the top:

```ts
import type { Field, FieldHookArgs } from 'payload'

import { computeEndDate, scheduleField } from '@/fields/schedule'
```

```ts
// Names of the data fields directly inside a group, looking through rows.
const names = (fields: Field[]): string[] =>
  fields.flatMap((f) => ('name' in f ? [f.name] : 'fields' in f ? names(f.fields) : []))

describe('scheduleField', () => {
  it('is a named group with the spec fields', () => {
    const field = scheduleField()
    expect(field.name).toBe('schedule')
    expect(names(field.fields)).toEqual([
      'start_date',
      'start_precision',
      'weeks',
      'slots',
      'end_date',
      'note',
    ])
  })

  it('computes end_date from its sibling pattern', () => {
    const siblingData = {
      start_date: '2026-03-03',
      weeks: 2,
      slots: [{ weekday: 'tue', start_time: '19:00', end_time: '21:00' }],
    }
    expect(computeEndDate({ siblingData } as unknown as FieldHookArgs)).toBe('2026-03-10')
    expect(computeEndDate({ siblingData: {} } as unknown as FieldHookArgs)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/fields/schedule"`.

- [ ] **Step 3: Write the implementation**

```ts
import type { FieldHook, NamedGroupField } from 'payload'

import { WEEKDAYS } from '@/lib/cairo-day'
import { scheduleEndDate, type Schedule } from '@/lib/schedule'
import { endAfterStart, timeOfDay } from './validators'

const WEEKDAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  sat: 'Saturday',
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
}

/**
 * Pattern-only end date. Courses recompute it with their sessions in a
 * collection hook, since a field hook can't see them.
 */
export const computeEndDate: FieldHook = ({ siblingData }) =>
  scheduleEndDate(siblingData as Schedule)

/**
 * How something meets: a start date, a number of weeks and weekly slots in
 * Cairo wall-clock time (ADR 0002). Dates come from `expandSchedule()`.
 */
export const scheduleField = (): NamedGroupField => ({
  name: 'schedule',
  type: 'group',
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'start_date',
          type: 'date',
          admin: { width: '40%', date: { pickerAppearance: 'dayOnly' } },
        },
        {
          name: 'start_precision',
          type: 'select',
          defaultValue: 'day',
          options: [
            { label: 'Exact day', value: 'day' },
            { label: 'Week only', value: 'week' },
          ],
          admin: {
            width: '30%',
            description: 'Week only keeps it off the calendar.',
          },
        },
        { name: 'weeks', type: 'number', min: 1, max: 52, admin: { width: '30%' } },
      ],
    },
    {
      name: 'slots',
      type: 'array',
      labels: { singular: 'Slot', plural: 'Slots' },
      admin: { description: 'Weekly meeting times, in Cairo time.' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'weekday',
              type: 'select',
              required: true,
              options: WEEKDAYS.map((value) => ({ label: WEEKDAY_LABELS[value], value })),
              admin: { width: '30%' },
            },
            {
              name: 'start_time',
              type: 'text',
              required: true,
              validate: timeOfDay,
              admin: { width: '20%', placeholder: '19:00' },
            },
            {
              name: 'end_time',
              type: 'text',
              required: true,
              validate: (
                value: unknown,
                { siblingData }: { siblingData: Record<string, unknown> },
              ) => {
                const time = timeOfDay(value)
                return time === true ? endAfterStart(value, siblingData.start_time) : time
              },
              admin: { width: '20%', placeholder: '21:00' },
            },
            { name: 'label', type: 'text', localized: true, admin: { width: '30%' } },
          ],
        },
      ],
    },
    {
      name: 'end_date',
      type: 'date',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayOnly' },
        description: 'Worked out from the schedule.',
      },
      hooks: { beforeChange: [computeEndDate] },
    },
    {
      name: 'note',
      type: 'textarea',
      localized: true,
      admin: {
        description: 'One-off exceptions, e.g. "hybrid for the first 6 weeks, then online".',
      },
    },
  ],
})
```

If tsc rejects the `end_time` validate's parameter type, type it as `TextFieldSingleValidation` from `payload` instead and read `siblingData` as `Record<string, unknown>`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts && npx tsc --noEmit`
Expected: PASS, 6 tests; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/fields/schedule.ts tests/unit/shape-fields.unit.spec.ts
git commit -m "feat(fields): schedule group with computed end date

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `registrationField()`

**Files:**

- Create: `src/fields/registration.ts`
- Test: `tests/unit/shape-fields.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

Add `import { registrationField } from '@/fields/registration'` at the top of `tests/unit/shape-fields.unit.spec.ts`, then append:

```ts
describe('registrationField', () => {
  it('is a named group with the spec fields', () => {
    const field = registrationField()
    expect(field.name).toBe('registration')
    expect(names(field.fields)).toEqual([
      'method',
      'form',
      'url',
      'deadline',
      'application_requirements',
      'archived_registration_url',
    ])
  })

  it('has no default method, so an empty one falls back to the parent', () => {
    const method = registrationField().fields.find((f) => 'name' in f && f.name === 'method')
    expect(method && 'defaultValue' in method ? method.defaultValue : undefined).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/fields/registration"`.

- [ ] **Step 3: Write the implementation**

```ts
import type { NamedGroupField } from 'payload'

import { REGISTRATION_METHODS } from '@/lib/registration'
import { httpUrl } from './validators'

const METHOD_LABELS: Record<(typeof REGISTRATION_METHODS)[number], string> = {
  form: 'Site form',
  external: 'External link',
  closed: 'Closed',
}

/**
 * How people apply. Whether it is open now comes from `registrationStatus()`,
 * never from a stored flag.
 */
export const registrationField = (): NamedGroupField => ({
  name: 'registration',
  type: 'group',
  fields: [
    {
      name: 'method',
      type: 'select',
      options: REGISTRATION_METHODS.map((value) => ({ label: METHOD_LABELS[value], value })),
      admin: { description: "Leave empty on a course to use its cycle's." },
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms',
      admin: { condition: (_, sibling) => sibling?.method === 'form' },
    },
    {
      name: 'url',
      type: 'text',
      validate: (value: unknown) => (value ? httpUrl(value) : true),
      admin: {
        condition: (_, sibling) => sibling?.method === 'external',
        placeholder: 'https://…',
      },
    },
    {
      name: 'deadline',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: "The last day to register, in Cairo. Empty on a course uses its cycle's.",
      },
    },
    { name: 'application_requirements', type: 'richText', localized: true },
    // The old Weebly or Google Forms link, kept for the record.
    { name: 'archived_registration_url', type: 'text', admin: { hidden: true } },
  ],
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts && npx tsc --noEmit`
Expected: PASS, 8 tests; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/fields/registration.ts tests/unit/shape-fields.unit.spec.ts
git commit -m "feat(fields): registration group

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `pricingField()`

**Files:**

- Create: `src/fields/pricing.ts`
- Test: `tests/unit/shape-fields.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

Add `import { pricingField } from '@/fields/pricing'` at the top of `tests/unit/shape-fields.unit.spec.ts`, then append:

```ts
describe('pricingField', () => {
  it('is named pricing by default, with the spec fields', () => {
    const field = pricingField()
    expect(field.name).toBe('pricing')
    expect(names(field.fields)).toEqual([
      'min',
      'max',
      'currency',
      'note',
      'need_based_deductions',
      'payment_plans',
    ])
  })

  it('takes another name, for a course override', () => {
    expect(pricingField({ name: 'pricing_override' }).name).toBe('pricing_override')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts`
Expected: FAIL, `Failed to resolve import "@/fields/pricing"`.

- [ ] **Step 3: Write the implementation**

```ts
import type { NamedGroupField } from 'payload'

import { notBelow } from './validators'

/**
 * What something costs, as a range in EGP with optional payment plans.
 * Cycles hold one per course type; a course can override with
 * `pricingField({ name: 'pricing_override' })`.
 */
export const pricingField = ({
  name = 'pricing',
  label,
}: { name?: string; label?: string } = {}): NamedGroupField => ({
  name,
  ...(label ? { label } : {}),
  type: 'group',
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'min', type: 'number', min: 0, admin: { width: '35%' } },
        {
          name: 'max',
          type: 'number',
          min: 0,
          validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
            notBelow(value, siblingData.min, 'the minimum'),
          admin: { width: '35%', description: 'Leave empty for a single price.' },
        },
        {
          name: 'currency',
          type: 'select',
          defaultValue: 'EGP',
          options: [{ label: 'EGP', value: 'EGP' }],
          admin: { width: '30%' },
        },
      ],
    },
    { name: 'note', type: 'text', localized: true },
    { name: 'need_based_deductions', type: 'checkbox', label: 'Need-based deductions available' },
    {
      name: 'payment_plans',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', localized: true, required: true },
        {
          name: 'installments',
          type: 'array',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'amount', type: 'number', min: 0, required: true, admin: { width: '50%' } },
                {
                  name: 'due_date',
                  type: 'date',
                  admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
})
```

If tsc rejects the `max` validate's parameter type, type it as `NumberFieldSingleValidation` from `payload` instead.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run --config ./vitest.config.mts tests/unit/shape-fields.unit.spec.ts && npx tsc --noEmit`
Expected: PASS, 10 tests; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/fields/pricing.ts tests/unit/shape-fields.unit.spec.ts
git commit -m "feat(fields): pricing group with payment plans

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verify and update the spec

**Files:**

- Modify: `docs/schema.md`

- [ ] **Step 1: Run the full suite, lint and type check**

Run: `pnpm test:int && pnpm lint && npx tsc --noEmit`
Expected: all tests pass (the 30 existing plus the new unit tests), lint has 0 errors, tsc prints nothing. No database change, so no migration is needed.

- [ ] **Step 2: Update `docs/schema.md`**

Replace the `schedule`, `registration` and `pricing` entries under `## Shared shapes` with one line, and keep `credits[]`:

```markdown
## Shared shapes

`schedule`, `registration` and `pricing` exist as field builders in `src/fields/`, with their logic in `src/lib/schedule.ts` and `src/lib/registration.ts` (ADR 0002). Collections adopt them in plans 3 and 4. Courses must recompute `schedule.end_date` with their sessions in a collection hook.

**`credits[]`** (articles, publications)
```

(The `credits[]` bullet list below it stays unchanged.)

- [ ] **Step 3: Commit**

```bash
git add docs/schema.md
git commit -m "docs(schema): shared shapes are built

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
