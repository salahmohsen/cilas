import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { publicCalendarLinks as readPublicCalendarLinks } from '@/actions/public-calendar-access'
import { publicCalendarAccess as readPublicCalendarAccess } from '@/api/public-calendar.api'
import { scheduleOffers as readScheduleOffers } from '@/actions/schedule-offers'
import { saveScheduleEdits as writeScheduleEdits } from '@/actions/save-schedule-edits'
import { loadCalendarItems as readCalendarItems } from '@/actions/load-calendar-items'
import { setSessionCancelled as writeSessionCancelled } from '@/components/space/cancel-session'
import { PUBLIC_LISTS_TAG } from '@/lib/paths'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import { runInRequest } from '../../testing/next-request.test-utils'
import { createTracker, lockSpacesMode, uniq, uniqEmail } from '../../testing/payload.fixture'
import { signedInHeaders } from '../../testing/reader.test-utils'

const { track, cleanup } = createTracker()
let payload: Payload
let unlockSpacesMode: (() => Promise<void>) | undefined
let modeBefore: 'off' | 'trial' | 'on' = 'off'
let admin: User
let superAdmin: User
let member: User
let host: User
let otherFellow: User
let courses: number[]
const range = { from: '2035-10-01', to: '2035-10-31' }
const passwords = new Map<number, string>()
let reader: HeadersInit = {}
const signIn = async (user: User | null) => {
  reader = user
    ? await signedInHeaders(payload, { email: user.email, password: passwords.get(user.id)! })
    : {}
}
const asReader = async <Result>(work: () => Promise<Result>) =>
  (await runInRequest(work, { headers: reader })).result
const publicCalendarLinks = (...args: Parameters<typeof readPublicCalendarLinks>) =>
  asReader(() => readPublicCalendarLinks(...args))
const publicCalendarAccess = (...args: Parameters<typeof readPublicCalendarAccess>) =>
  asReader(() => readPublicCalendarAccess(...args))
const scheduleOffers = (...args: Parameters<typeof readScheduleOffers>) =>
  asReader(() => readScheduleOffers(...args))
const saveScheduleEdits = (...args: Parameters<typeof writeScheduleEdits>) =>
  asReader(() => writeScheduleEdits(...args))
const loadCalendarItems = (...args: Parameters<typeof readCalendarItems>) =>
  asReader(() => readCalendarItems(...args))
const setSessionCancelled = (...args: Parameters<typeof writeSessionCancelled>) =>
  asReader(() => writeSessionCancelled(...args))
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
  unlockSpacesMode = await lockSpacesMode()
  payload = await getPayload({ config })
  modeBefore =
    (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })).spaces_mode ?? 'off'
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { spaces_mode: 'on' },
    overrideAccess: true,
  })
  const account = async (
    role: 'admin' | 'super_admin' | 'member' | 'fellow',
    label: string = role,
  ) => {
    const password = crypto.randomUUID()
    const user = track(
      'users',
      await payload.create({
        collection: 'users',
        data: {
          email: uniqEmail(`public-calendar-${label}`),
          password,
          roles: [role],
        },
      }),
    ) as User
    passwords.set(user.id, password)
    return user
  }
  superAdmin = await account('super_admin')
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
  const fellow = async (name: string, label: string) => {
    const person = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name, slug: uniq(`public-calendar-${label}`) },
      }),
    )
    const user = await account('fellow', label)
    return {
      person,
      user: await payload.update({
        collection: 'users',
        id: user.id,
        data: { person: person.id },
      }),
    }
  }
  const hostFellow = await fellow('Public calendar host', 'host')
  host = hostFellow.user
  otherFellow = (await fellow('Public calendar other fellow', 'other')).user
  await payload.update({
    collection: 'courses',
    id: courses[0]!,
    data: { fellows: [hostFellow.person.id] },
  })
  host = await payload.findByID({ collection: 'users', id: host.id, depth: 0 })
}, 600_000)
afterAll(async () => {
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { spaces_mode: modeBefore },
    overrideAccess: true,
  })
  await cleanup(payload)
  await payload.destroy()
  await unlockSpacesMode?.()
})

describe('public calendar links for each role', () => {
  const ids = () => courses.map(String)
  it.each([
    ['visitor', () => null, () => []],
    ['member', () => member, () => []],
    ['fellow of another course', () => otherFellow, () => []],
    ['host of the first course', () => host, () => [String(courses[0])]],
    ['admin', () => admin, () => ids()],
  ])('lists the courses a %s may change', async (_role, user, expected) => {
    await signIn(user())
    const access = await publicCalendarLinks(ids())
    expect(access.editable.toSorted()).toEqual(expected().toSorted())
    expect(access.canEdit).toBe(_role === 'admin')
  })
})

describe('cancel and restore a session', () => {
  const make = async () => {
    const doc = await payload.create({
      collection: 'sessions',
      locale: 'en',
      data: {
        course: courses[0]!,
        title: 'Cancel probe',
        description: 'English text',
        meetings: [{ date: '2035-10-05', start_time: '10:00', end_time: '12:00' }],
        bibliography: [{ type: 'reading', title: 'English book', href: 'https://example.com/a' }],
        activities: [{ kind: 'discussion', description: 'Talk' }],
      },
    })
    await payload.update({
      collection: 'sessions',
      id: doc.id,
      locale: 'ar',
      data: { title: 'عنوان', description: 'نص عربي' },
    })
    return String(doc.id)
  }
  const fields = async (id: string, locale: 'en' | 'ar') => {
    const doc = await payload.findByID({
      collection: 'sessions',
      id: Number(id),
      locale,
      fallbackLocale: false,
      depth: 0,
    })
    return {
      title: doc.title,
      description: doc.description,
      materials: doc.bibliography?.map((row) => [row.type, row.href]),
      activities: doc.activities?.map((row) => row.kind),
      meetings: doc.meetings?.map((row) => [row.date, row.start_time, row.end_time]),
    }
  }
  it.each(['en', 'ar'] as const)(
    'flips only the flag in %s and keeps the text in both languages',
    async (locale) => {
      const id = await make()
      const before = { en: await fields(id, 'en'), ar: await fields(id, 'ar') }
      await signIn(host)
      const cancelled = await setSessionCancelled(id, true, locale)
      expect(cancelled.ok).toBe(true)
      expect((await read(id)).cancelled).toBe(true)
      expect({ en: await fields(id, 'en'), ar: await fields(id, 'ar') }).toEqual(before)
      const restored = await setSessionCancelled(id, false, locale)
      expect(restored.ok).toBe(true)
      expect((await read(id)).cancelled).toBe(false)
      expect({ en: await fields(id, 'en'), ar: await fields(id, 'ar') }).toEqual(before)
    },
  )
  it('refuses a member and a fellow of another course, and changes nothing', async () => {
    const id = await make()
    for (const user of [member, otherFellow]) {
      await signIn(user)
      expect((await setSessionCancelled(id, true, 'en')).ok).toBe(false)
    }
    await signIn(null)
    expect(await setSessionCancelled(id, true, 'en')).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    })
    expect((await read(id)).cancelled).toBeFalsy()
  })
  it('lets an admin cancel and reports the before and after items for the offer', async () => {
    const id = await make()
    await signIn(admin)
    const result = await setSessionCancelled(id, true, 'en')
    if (!result.ok) throw Error(result.error.code)
    expect(result.before.find((item) => item.id === id)?.cancelled).toBe(false)
    expect(result.after.find((item) => item.id === id)?.cancelled).toBe(true)
    const offers = await scheduleOffers({
      courseId: String(courses[0]),
      before: result.before,
      after: result.after,
    })
    expect(offers.length).toBeGreaterThan(0)
    expect(offers[0]!.text).toContain('cancelled')
  })
})

describe('public calendar edit requests', () => {
  it.each(['visitor', 'member'] as const)(
    'gives the %s view mode with no edit data',
    async (role) => {
      await signIn(role === 'visitor' ? null : member)
      expect(await publicCalendarAccess(true, 'en', range)).toEqual({
        mode: 'view',
        canEdit: false,
      })
    },
  )
  it('loads fresh versions for an admin and keeps each course', async () => {
    const items = await pair()
    await signIn(admin)
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
    await signIn(member)
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
    await signIn(admin)
    const { result, revalidated } = await runInRequest(
      () =>
        writeScheduleEdits({
          calendar: { parent: parent(), changes: moves(items) },
          details: [],
        }),
      { headers: reader },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) throw Error(result.error.code)
    for (const item of items) expect((await read(item.id)).meetings![0]!.date).toBe('2035-10-08')
    expect(revalidated).toContain(PUBLIC_LISTS_TAG)
    expect(revalidated.some((tag) => tag.startsWith('_N_T_/en/study/public-calendar-'))).toBe(true)
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
    await signIn(admin)
    await payload.update({
      collection: 'sessions',
      id: Number(items[1]!.id),
      data: { title: 'Changed elsewhere' },
    })
    const writes = vi.spyOn(payload, 'update')
    const result = await saveScheduleEdits({
      calendar: { parent: parent(), changes: moves(items) },
      details: [],
    })
    const firstWriteStarted = writes.mock.calls.some(
      ([options]) =>
        options.collection === 'sessions' &&
        'id' in options &&
        Number(options.id) === Number(items[0]!.id),
    )
    writes.mockRestore()
    expect(firstWriteStarted).toBe(true)
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
    await signIn(admin)
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
    await signIn(admin)
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
  expect(await readPublicCalendarAccess(false, 'en', range)).toEqual({
    mode: 'view',
    canEdit: false,
  })
})

it('returns only the spaces that each reader may read', async () => {
  await signIn(member)
  const enrolled = await publicCalendarLinks(courses.map(String), 'en')
  expect(enrolled.canEdit).toBe(false)
  expect(Object.keys(enrolled.spaces)).toEqual([String(courses[0])])
  expect(enrolled.spaces[String(courses[0])]).toContain('/en/spaces/course/public-calendar-city-')
  await signIn(admin)
  expect(Object.keys((await publicCalendarLinks(courses.map(String), 'ar')).spaces).sort()).toEqual(
    courses.map(String).sort(),
  )
  await signIn(null)
  expect(await publicCalendarLinks(courses.map(String))).toEqual({
    canEdit: false,
    editable: [],
    spaces: {},
  })
  const outsiderPassword = crypto.randomUUID()
  const outsider = track(
    'users',
    await payload.create({
      collection: 'users',
      data: {
        email: uniqEmail('public-calendar-outsider'),
        password: outsiderPassword,
        roles: ['member'],
      },
    }),
  ) as User
  passwords.set(outsider.id, outsiderPassword)
  await signIn(outsider)
  expect(await publicCalendarLinks(courses.map(String))).toEqual({
    canEdit: false,
    editable: [],
    spaces: {},
  })
})

it('allows the super admin role to load the public editor', async () => {
  await signIn(superAdmin)
  expect((await publicCalendarAccess(true, 'en', range)).mode).toBe('edit')
})

it('saves a cancellation and a deletion in different courses together', async () => {
  const items = await pair()
  await signIn(admin)
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
