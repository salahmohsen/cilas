import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { loadCalendarItems } from '@/actions/load-calendar-items'
import { saveScheduleEdits } from '@/actions/save-schedule-edits'
import type { CalendarSave } from '@/lib/calendar-items'
import type { CalendarChange } from '@/lib/calendar-items'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { runInRequest } from '../../testing/next-request.test-utils'
import { createTracker, uniq, uniqEmail } from '../../testing/payload.fixture'
import { signedInHeaders } from '../../testing/reader.test-utils'

let payload: Payload
const { track, cleanup } = createTracker()

let admin: User
let fellow: User
let otherFellow: User
let course: number
let otherCourse: number

const passwords = new Map<number, string>()
let reader: HeadersInit = {}
const signIn = async (user: User | null) => {
  reader = user
    ? await signedInHeaders(payload, { email: user.email, password: passwords.get(user.id)! })
    : {}
}
const asReader = async <Result>(work: () => Promise<Result>) =>
  (await runInRequest(work, { headers: reader })).result
const saveCalendarChanges = (calendar: CalendarSave) =>
  asReader(() => saveScheduleEdits({ calendar, details: [] }))

const account = async (name: string, roles: User['roles']) => {
  const person = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name, slug: uniq(name.toLowerCase().replace(/\W+/g, '-')) },
      overrideAccess: true,
    }),
  ).id
  const password = crypto.randomUUID()
  const user = track(
    'users',
    (await payload.create({
      collection: 'users',
      data: {
        email: uniqEmail(name.toLowerCase().replace(/\W+/g, '-')),
        password,
        roles,
        person,
      },
      overrideAccess: true,
    })) as unknown as User,
  )
  passwords.set(user.id, password)
  return { person, user }
}

const makeCourse = async (fellows: number[], cycle: number) =>
  track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: 'Calendar save probe',
        slug: uniq(
          `calendar-save-${fellows.join('-') || 'none'}-${Math.random().toString(36).slice(2, 6)}`,
        ),
        course_type: 'THEMATIC',
        tier: 'public',
        cycle,
        fellows,
        registration: { mode: 'closed' },
        _status: 'published',
      },
      overrideAccess: true,
    }),
  ).id

type Times = { date: string; start_time: string | null; end_time: string | null }
const at = (date: string, start_time: string | null = '19:00', end_time: string | null = '21:00') =>
  ({ date, start_time, end_time }) satisfies Times
const newSession = (...meetings: Times[]) =>
  ({
    op: 'create-item',
    kind: 'session',
    blocks: meetings.map((meeting, i) => ({ blockId: `tmp-${i}`, ...meeting })),
  }) as CalendarChange

const makeSession = async (parent: number, ...meetings: Times[]) =>
  (
    await payload.create({
      collection: 'sessions',
      data: { course: parent, title: 'Probe', meetings },
      overrideAccess: true,
    })
  ).id
const stored = async (id: number) => {
  const doc = await payload.findByID({
    collection: 'sessions',
    id,
    depth: 0,
    overrideAccess: true,
  })
  return { version: doc.updatedAt, meetings: doc.meetings ?? [] }
}

const sessionIds = async (parent: number) =>
  (
    await payload.find({
      collection: 'sessions',
      where: { course: { equals: parent } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
  ).docs.map((s) => s.id)

const courseDays = async (id: number) => {
  const { first_day, last_day } = await payload.findByID({
    collection: 'courses',
    id,
    depth: 0,
    overrideAccess: true,
  })
  return { first_day, last_day }
}

const save = (changes: CalendarChange[], parent = course) =>
  saveCalendarChanges({ parent: { kind: 'course', id: String(parent) }, changes })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Calendar save place', slug: uniq('calendar-place'), city: uniq('Probe') },
      overrideAccess: true,
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2035, place, start_date: '2035-10-04' },
      overrideAccess: true,
    }),
  ).id
  admin = (await account('Calendar admin', ['admin'])).user
  const a = await account('Calendar fellow', ['fellow'])
  const b = await account('Calendar other fellow', ['fellow'])
  fellow = a.user
  otherFellow = b.user
  course = await makeCourse([a.person], cycle)
  otherCourse = await makeCourse([b.person], cycle)
})

beforeEach(async () => signIn(admin))

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('saveCalendarChanges', () => {
  it('lets an admin move a meeting, and keeps its row and the course’s days', async () => {
    const id = await makeSession(course, at('2035-10-05'), at('2035-10-12'))
    const before = await stored(id)
    const [first, second] = before.meetings

    const result = await save([
      {
        op: 'move-block',
        itemId: String(id),
        version: before.version,
        blockId: second!.id!,
        ...at('2035-09-20', '10:00', '12:00'),
      },
    ])

    expect(result.ok).toBe(true)
    const after = await stored(id)
    expect(after.meetings).toHaveLength(2)
    expect(after.meetings.find((m) => m.id === second!.id)).toMatchObject(
      at('2035-09-20', '10:00', '12:00'),
    )
    expect(after.meetings.find((m) => m.id === first!.id)).toMatchObject(at('2035-10-05'))
    expect((await courseDays(course)).first_day).toBe('2035-09-20')
    if (result.ok) {
      const item = result.items.find((i) => i.id === String(id))
      expect(item).toMatchObject({ kind: 'session', version: after.version })
      expect(item?.blocks.map((b) => b.date)).toEqual(['2035-09-20', '2035-10-05'])
    }
  })

  it('lets an admin add a session, and place an unscheduled one on the grid', async () => {
    const unscheduled = await makeSession(course)
    const before = await stored(unscheduled)
    const known = await sessionIds(course)

    const result = await save([
      newSession(at('2035-12-01', null, null)),
      {
        op: 'add-block',
        itemId: String(unscheduled),
        version: before.version,
        blockId: 'tmp-placed',
        ...at('2035-12-08'),
      },
    ])

    expect(result.ok).toBe(true)
    const created = (await sessionIds(course)).filter((s) => !known.includes(s))
    expect(created).toHaveLength(1)
    expect((await stored(created[0]!)).meetings[0]).toMatchObject(at('2035-12-01', null, null))
    const placed = (await stored(unscheduled)).meetings
    expect(placed).toHaveLength(1)
    expect(placed[0]).toMatchObject(at('2035-12-08'))
    expect(placed[0]!.id).not.toBe('tmp-placed')
    expect((await courseDays(course)).last_day).toBe('2035-12-08')
  })

  it('makes one session with all the meetings of a create-item with several blocks', async () => {
    const source = await makeSession(course, at('2035-12-02'), at('2035-12-04', '10:00', '12:00'))
    const known = await sessionIds(course)
    const result = await save([newSession(at('2035-12-09'), at('2035-12-11', '10:00', '12:00'))])

    expect(result.ok).toBe(true)
    const created = (await sessionIds(course)).filter((s) => !known.includes(s))
    expect(created).toHaveLength(1)
    const copy = await stored(created[0]!)
    expect(copy.meetings).toHaveLength(2)
    expect(copy.meetings[0]).toMatchObject(at('2035-12-09'))
    expect(copy.meetings[1]).toMatchObject(at('2035-12-11', '10:00', '12:00'))
    expect(copy.meetings.map((m) => m.id)).not.toContain('tmp-0')
    expect((await stored(source)).meetings).toHaveLength(2)
  })

  it('refuses a create-item with no block or with a bad block, and saves nothing', async () => {
    const known = await sessionIds(course)

    const empty = await save([{ op: 'create-item', kind: 'session', blocks: [] } as never])
    expect(empty).toMatchObject({ ok: false, error: { code: 'invalid' } })

    const bad = await save([newSession(at('2035-12-16'), at('2035-12-17', '21:00', '19:00'))])
    expect(bad).toMatchObject({ ok: false, error: { code: 'invalid', change: 0 } })

    expect(await sessionIds(course)).toEqual(known)
  })

  it('lets an admin delete a meeting, and leaves the session with the others', async () => {
    const id = await makeSession(course, at('2035-11-03'), at('2035-11-10'))
    const before = await stored(id)

    const result = await save([
      {
        op: 'delete-block',
        itemId: String(id),
        version: before.version,
        blockId: before.meetings[0]!.id!,
      },
    ])

    expect(result.ok).toBe(true)
    expect((await stored(id)).meetings.map((m) => m.date)).toEqual(['2035-11-10'])
  })

  it('applies several changes to one session in one update', async () => {
    const id = await makeSession(course, at('2035-11-17'))
    const before = await stored(id)
    const versions = () =>
      payload.countVersions({ collection: 'sessions', where: { parent: { equals: id } } })
    const count = (await versions()).totalDocs

    const result = await save([
      {
        op: 'add-block',
        itemId: String(id),
        version: before.version,
        blockId: 'tmp-a',
        ...at('2035-11-18'),
      },
      {
        op: 'move-block',
        itemId: String(id),
        version: before.version,
        blockId: 'tmp-a',
        ...at('2035-11-19'),
      },
      {
        op: 'delete-block',
        itemId: String(id),
        version: before.version,
        blockId: before.meetings[0]!.id!,
      },
    ])

    expect(result.ok).toBe(true)
    expect((await stored(id)).meetings.map((m) => m.date)).toEqual(['2035-11-19'])
    expect((await versions()).totalDocs).toBe(count + 1)
  })

  it('lets a fellow edit their own course’s sessions', async () => {
    await signIn(fellow)
    const id = await makeSession(course, at('2035-11-24'))
    const before = await stored(id)

    const result = await save([
      newSession(at('2035-12-15')),
      {
        op: 'move-block',
        itemId: String(id),
        version: before.version,
        blockId: before.meetings[0]!.id!,
        ...at('2035-11-25'),
      },
    ])

    expect(result.ok).toBe(true)
    expect((await stored(id)).meetings[0]).toMatchObject(at('2035-11-25'))
  })

  it('refuses a fellow of another course, and changes nothing', async () => {
    await signIn(otherFellow)
    const id = await makeSession(course, at('2035-12-02'))
    const before = await stored(id)
    const known = await sessionIds(course)

    const move = save([
      {
        op: 'move-block',
        itemId: String(id),
        version: before.version,
        blockId: before.meetings[0]!.id!,
        ...at('2035-12-03'),
      },
    ])
    await expect(move).resolves.toEqual({ ok: false, error: { code: 'forbidden' } })
    const create = save([newSession(at('2035-12-04'))])
    await expect(create).resolves.toEqual({ ok: false, error: { code: 'forbidden' } })

    expect(await stored(id)).toEqual(before)
    expect(await sessionIds(course)).toEqual(known)
  })

  it('refuses a signed-out user, and changes nothing', async () => {
    await signIn(null)
    const id = await makeSession(course, at('2035-12-09'))
    const before = await stored(id)

    const result = await save([
      {
        op: 'delete-block',
        itemId: String(id),
        version: before.version,
        blockId: before.meetings[0]!.id!,
      },
    ])

    expect(result).toEqual({ ok: false, error: { code: 'unauthenticated' } })
    expect(await stored(id)).toEqual(before)
  })

  it('saves nothing when one change is invalid among valid ones', async () => {
    const id = await makeSession(course, at('2035-12-16'))
    const before = await stored(id)
    const known = await sessionIds(course)
    const blockId = before.meetings[0]!.id!

    const result = await save([
      newSession(at('2035-12-17')),
      {
        op: 'move-block',
        itemId: String(id),
        version: before.version,
        blockId,
        ...at('2035-12-18'),
      },
      {
        op: 'add-block',
        itemId: String(id),
        version: before.version,
        blockId: 'tmp-2',
        ...at('2035-02-30'),
      },
    ])

    expect(result).toMatchObject({ ok: false, error: { code: 'invalid', change: 2 } })
    expect(await stored(id)).toEqual(before)
    expect(await sessionIds(course)).toEqual(known)
  })

  it('rolls back earlier writes when a later one fails in the database', async () => {
    const first = await makeSession(course, at('2036-01-06'))
    const second = await makeSession(course, at('2036-01-13'))
    const [one, two] = [await stored(first), await stored(second)]
    const known = await sessionIds(course)

    const result = await save([
      newSession(at('2036-01-20')),
      {
        op: 'move-block',
        itemId: String(first),
        version: one.version,
        blockId: one.meetings[0]!.id!,
        ...at('2036-01-07'),
      },
      { op: 'delete-block', itemId: String(second), version: two.version, blockId: 'no-such-row' },
    ])

    expect(result).toEqual({
      ok: false,
      error: { code: 'not-found', itemId: String(second), blockId: 'no-such-row' },
    })
    expect(await stored(first)).toEqual(one)
    expect(await stored(second)).toEqual(two)
    expect(await sessionIds(course)).toEqual(known)
  })

  it('fails the whole save when a version is stale', async () => {
    const fresh = await makeSession(course, at('2036-02-03'))
    const old = await makeSession(course, at('2036-02-10'))
    const [freshBefore, oldBefore] = [await stored(fresh), await stored(old)]
    await payload.update({
      collection: 'sessions',
      id: old,
      data: { title: 'Edited meanwhile' },
      overrideAccess: true,
    })
    const known = await sessionIds(course)

    const result = await save([
      newSession(at('2036-02-17')),
      {
        op: 'move-block',
        itemId: String(fresh),
        version: freshBefore.version,
        blockId: freshBefore.meetings[0]!.id!,
        ...at('2036-02-04'),
      },
      {
        op: 'move-block',
        itemId: String(old),
        version: oldBefore.version,
        blockId: oldBefore.meetings[0]!.id!,
        ...at('2036-02-11'),
      },
    ])
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'stale',
        itemId: String(old),
        name: expect.stringMatching(/^Session \d+: Edited meanwhile$/),
      },
    })
    expect(await stored(fresh)).toEqual(freshBefore)
    expect((await stored(old)).meetings).toEqual(oldBefore.meetings)
    expect(await sessionIds(course)).toEqual(known)
  })

  it('keeps the course’s first and last day with the change', async () => {
    const days = await makeCourse(
      [],
      (
        await payload.findByID({
          collection: 'courses',
          id: course,
          depth: 0,
          overrideAccess: true,
        })
      ).cycle as number,
    )
    const id = await makeSession(days, at('2036-03-03'), at('2036-03-10'))
    const before = await stored(id)
    expect(await courseDays(days)).toEqual({ first_day: '2036-03-03', last_day: '2036-03-10' })

    await save(
      [
        {
          op: 'delete-block',
          itemId: String(id),
          version: before.version,
          blockId: before.meetings[0]!.id!,
        },
        newSession(at('2036-03-31')),
      ],
      days,
    )

    expect(await courseDays(days)).toEqual({ first_day: '2036-03-10', last_day: '2036-03-31' })
  })

  it('does not touch a session of another course named in the save', async () => {
    const elsewhere = await makeSession(otherCourse, at('2036-04-07'))
    const before = await stored(elsewhere)

    const result = await save([
      {
        op: 'move-block',
        itemId: String(elsewhere),
        version: before.version,
        blockId: before.meetings[0]!.id!,
        ...at('2036-04-08'),
      },
    ])

    expect(result).toEqual({ ok: false, error: { code: 'not-found', itemId: String(elsewhere) } })
    expect(await stored(elsewhere)).toEqual(before)
  })
})

describe('loadCalendarItems', () => {
  const load = (parent = course) =>
    asReader(() => loadCalendarItems({ kind: 'course', id: String(parent) }))

  it('gives an admin the course’s sessions as items, and Edit', async () => {
    const id = await makeSession(course, at('2036-05-05'))
    const result = await load()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.canEdit).toBe(true)
    expect(result.items.find((i) => i.id === String(id))).toMatchObject({
      kind: 'session',
      tone: 'blue',
      blocks: [{ date: '2036-05-05', start_time: '19:00', end_time: '21:00' }],
    })
  })

  it('offers Edit to the fellow of the course and not to another course’s fellow', async () => {
    await signIn(fellow)
    expect(await load(course)).toMatchObject({ ok: true, canEdit: true })
    expect(await load(otherCourse)).toMatchObject({ ok: true, canEdit: false })
  })

  it('refuses a visitor', async () => {
    await signIn(null)
    expect(await load()).toEqual({ ok: false, error: { code: 'unauthenticated' } })
  })

  it('names a parent kind it has no adapter for', async () => {
    const result = await asReader(() => loadCalendarItems({ kind: 'event', id: '1' }))
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
  })
})
