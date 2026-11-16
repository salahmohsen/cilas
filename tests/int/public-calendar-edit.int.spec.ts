// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { revalidatePath, revalidateTag } from 'next/cache'

import { publicCalendarLinks } from '@/actions/public-calendar-access'
import { publicCalendarAccess } from '@/api/public-calendar.api'
import { scheduleOffers } from '@/actions/schedule-offers'
import { saveScheduleEdits } from '@/actions/save-schedule-edits'
import { loadCalendarItems } from '@/actions/load-calendar-items'
import { currentReader } from '@/lib/reader'
import { PUBLIC_LISTS_TAG } from '@/lib/paths'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import { createTracker, uniq, uniqEmail } from './fixtures'

vi.mock('@/lib/reader', () => ({ currentReader: vi.fn() }))
vi.mock('next/cache', async (original) => ({
  ...(await original<typeof import('next/cache')>()),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const { track, cleanup } = createTracker()
let payload: Payload
let admin: User
let member: User
let courses: number[]
const range = { from: '2035-10-01', to: '2035-10-31' }
const signIn = (user: User | null) => vi.mocked(currentReader).mockResolvedValue(user)
const parent = () => ({ kind: 'public', id: courses.join(',') })
const read = (id: string) => payload.findByID({ collection: 'sessions', id: Number(id), depth: 0 })
const pair = async () =>
  Promise.all(
    courses.map(async (course) => {
      const doc = await payload.create({
        collection: 'sessions',
        data: {
          course,
          title: 'Public edit probe',
          meetings: [{ date: '2035-10-05', start_time: '10:00', end_time: '12:00' }],
        },
      })
      return { id: String(doc.id), version: doc.updatedAt, blockId: doc.meetings![0]!.id! }
    }),
  )
const moves = (items: Awaited<ReturnType<typeof pair>>) =>
  items.map((item) => ({
    ...item,
    itemId: item.id,
    op: 'move-block' as const,
    date: '2035-10-08',
    start_time: '11:00',
    end_time: '13:00',
  }))

beforeAll(async () => {
  payload = await getPayload({ config })
  const account = async (role: 'admin' | 'member') =>
    track(
      'users',
      await payload.create({
        collection: 'users',
        data: {
          email: uniqEmail(`public-calendar-${role}`),
          password: crypto.randomUUID(),
          roles: [role],
        },
      }),
    ) as User
  admin = await account('admin')
  member = await account('member')
  const person = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name: 'Public calendar member', slug: uniq('public-calendar-member') },
    }),
  )
  member = await payload.update({ collection: 'users', id: member.id, data: { person: person.id } })
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: {
        name: 'Public calendar place',
        slug: uniq('public-calendar-place'),
        city: uniq('Probe'),
      },
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2035, start_date: '2035-10-01', place },
    }),
  ).id
  courses = []
  for (const name of ['City', 'Maps']) {
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: name,
          slug: uniq(`public-calendar-${name.toLowerCase()}`),
          cycle,
          course_type: 'THEMATIC',
          tier: 'public',
          registration: { mode: 'closed' },
          _status: 'published',
        },
      }),
    )
    courses.push(course.id)
    const spaces = await payload.find({
      collection: 'spaces',
      where: { course: { equals: course.id } },
      depth: 0,
    })
    for (const space of spaces.docs) {
      track('spaces', space)
      const posts = await payload.find({
        collection: 'space-posts',
        where: { space: { equals: space.id } },
        depth: 0,
      })
      for (const post of posts.docs) track('space-posts', post)
    }
  }
  track(
    'enrollments',
    await payload.create({
      collection: 'enrollments',
      data: {
        course: courses[0]!,
        person: Number(typeof member.person === 'object' ? member.person?.id : member.person),
        status: 'confirmed',
        source: 'admin',
      },
    }),
  )
})
afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('public calendar edit requests', () => {
  it.each(['visitor', 'member'] as const)(
    'gives the %s view mode with no edit data',
    async (role) => {
      signIn(role === 'visitor' ? null : member)
      expect(await publicCalendarAccess(true, 'en', range)).toEqual({
        mode: 'view',
        canEdit: false,
      })
    },
  )
  it('loads fresh versions for an admin and keeps each course', async () => {
    const items = await pair()
    signIn(admin)
    const result = await publicCalendarAccess(true, 'en', range)
    expect(result.mode).toBe('edit')
    if (result.mode !== 'edit') throw Error('Edit expected')
    for (const [i, item] of items.entries())
      expect(result.items.find((value) => value.id === item.id)).toMatchObject({
        version: item.version,
        parentId: String(courses[i]),
        blocks: [{ id: item.blockId }],
      })
    await payload.update({
      collection: 'sessions',
      id: Number(items[0]!.id),
      data: { title: 'Fresh title' },
    })
    const fresh = await publicCalendarAccess(true, 'en', range)
    if (fresh.mode !== 'edit') throw Error('Edit expected')
    expect(fresh.items.find((item) => item.id === items[0]!.id)?.title).toBe('Fresh title')
  })
  it('refuses a non-admin load and save even with a valid public parent', async () => {
    const items = await pair()
    signIn(member)
    expect(await loadCalendarItems(parent())).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    })
    expect(
      await saveScheduleEdits({
        calendar: { parent: parent(), changes: moves(items) },
        details: [],
      }),
    ).toMatchObject({ ok: false, error: { code: 'forbidden' } })
    expect((await read(items[0]!.id)).meetings![0]!.date).toBe('2035-10-05')
  })
  it('saves two courses and offers both spaces in one list', async () => {
    const items = await pair()
    signIn(admin)
    vi.mocked(revalidatePath).mockClear()
    vi.mocked(revalidateTag).mockClear()
    const result = await saveScheduleEdits({
      calendar: { parent: parent(), changes: moves(items) },
      details: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw Error(result.error.code)
    for (const item of items) expect((await read(item.id)).meetings![0]!.date).toBe('2035-10-08')
    expect(revalidatePath).toHaveBeenCalledWith(
      expect.stringContaining('/en/study/public-calendar-'),
    )
    expect(revalidateTag).toHaveBeenCalledWith(PUBLIC_LISTS_TAG, 'max')
    const offers = await scheduleOffers({ before: result.before, after: result.after })
    expect(offers).toHaveLength(2)
    expect(new Set(offers.map((offer) => offer.space.name))).toEqual(new Set(['City', 'Maps']))
    for (const offer of offers) {
      expect(offer.text).toContain('Public edit probe')
      expect(offer.block).toContain('::schedule[')
      expect(offer.preview?.marked).toHaveLength(1)
    }
  })
  it('rolls back the first course when the second course has a stale version', async () => {
    const items = await pair()
    signIn(admin)
    await payload.update({
      collection: 'sessions',
      id: Number(items[1]!.id),
      data: { title: 'Changed elsewhere' },
    })
    const result = await saveScheduleEdits({
      calendar: { parent: parent(), changes: moves(items) },
      details: [],
    })
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'stale',
        itemId: items[1]!.id,
        name: expect.stringContaining('Changed elsewhere'),
      },
    })
    for (const item of items) expect((await read(item.id)).meetings![0]!.date).toBe('2035-10-05')
  })
  it('returns a session moved out of the range, so its offer is a move', async () => {
    const items = await pair()
    signIn(admin)
    const result = await saveScheduleEdits({
      calendar: {
        parent: parent(),
        changes: moves(items).map((change) => ({ ...change, date: '2035-12-01' })),
      },
      details: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw Error(result.error.code)
    expect(result.items.find((item) => item.id === items[0]!.id)?.blocks[0]?.date).toBe(
      '2035-12-01',
    )
    expect(
      (await scheduleOffers({ before: result.before, after: result.after }))[0]?.text,
    ).toContain('moves')
  })
  it('rejects events and session creation in the public write path', async () => {
    signIn(admin)
    for (const change of [
      { op: 'delete-block', itemId: 'e4', version: '', blockId: 'e4-0' },
      {
        op: 'create-item',
        kind: 'session',
        blocks: [{ blockId: 'new', date: '2035-10-05', start_time: '10:00', end_time: '12:00' }],
      },
    ] as const) {
      const result = await saveScheduleEdits({
        calendar: { parent: parent(), changes: [change as never] },
        details: [],
      })
      expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
    }
  })
})

it('keeps view loading independent of the user request', async () => {
  vi.mocked(currentReader).mockClear()
  expect(await publicCalendarAccess(false, 'en', range)).toEqual({ mode: 'view', canEdit: false })
  expect(currentReader).not.toHaveBeenCalled()
})

it('returns only the spaces that each reader may read', async () => {
  signIn(member)
  const enrolled = await publicCalendarLinks(courses.map(String), 'en')
  expect(enrolled.canEdit).toBe(false)
  expect(Object.keys(enrolled.spaces)).toEqual([String(courses[0])])
  expect(enrolled.spaces[String(courses[0])]).toContain('/en/spaces/course/public-calendar-city-')
  signIn(admin)
  expect(Object.keys((await publicCalendarLinks(courses.map(String), 'ar')).spaces).sort()).toEqual(
    courses.map(String).sort(),
  )
  signIn(null)
  expect(await publicCalendarLinks(courses.map(String))).toEqual({ canEdit: false, spaces: {} })
  const outsider = track(
    'users',
    await payload.create({
      collection: 'users',
      data: {
        email: uniqEmail('public-calendar-outsider'),
        password: crypto.randomUUID(),
        roles: ['member'],
      },
    }),
  ) as User
  signIn(outsider)
  expect(await publicCalendarLinks(courses.map(String))).toEqual({ canEdit: false, spaces: {} })
})

it('allows the super admin role to load the public editor', async () => {
  signIn({ ...admin, roles: ['super_admin'] })
  expect((await publicCalendarAccess(true, 'en', range)).mode).toBe('edit')
})

it('saves a cancellation and a deletion in different courses together', async () => {
  const items = await pair()
  signIn(admin)
  const result = await saveScheduleEdits({
    calendar: { parent: parent(), changes: [] },
    details: [
      {
        op: 'edit',
        id: items[0]!.id,
        version: items[0]!.version,
        values: {
          title: 'Cancelled session',
          description: '',
          cancelled: true,
          bibliography: [],
          activities: [],
        },
      },
      { op: 'delete', id: items[1]!.id, version: items[1]!.version },
    ],
  })
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error(result.error.code)
  expect((await read(items[0]!.id)).cancelled).toBe(true)
  expect(
    await payload.count({
      collection: 'sessions',
      where: { id: { equals: Number(items[1]!.id) } },
    }),
  ).toMatchObject({ totalDocs: 0 })
  expect(await scheduleOffers({ before: result.before, after: result.after })).toHaveLength(2)
})
