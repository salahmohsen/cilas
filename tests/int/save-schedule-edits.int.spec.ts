// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { loadSessionEdit } from '@/actions/session-edit'
import { currentReader } from '@/lib/reader'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { changesOf, keepDeleted } from '@/components/calendar/ui/calendar-edits'
import { newBlock, newItemId } from '@/components/calendar/ui/calendar-model'
import { saveScheduleEdits } from '@/actions/save-schedule-edits'
import { createTracker, uniq, uniqEmail } from './fixtures'

// Outside Next, these throw and the hooks swallow it; mocked, the test sees them.
vi.mock('next/cache', async (original) => ({
  ...(await original<typeof import('next/cache')>()),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
// The action reads the signed-in user from the request's cookie; the test names one.
vi.mock('@/lib/reader', () => ({ currentReader: vi.fn() }))

/**
 * The session drawer's Edit form against the database: the sessions
 * collection's access decides, a stale version saves nothing, and the text
 * lands in the page's language alone.
 */

let payload: Payload
const { track, cleanup } = createTracker()

let fellow: User
let otherFellow: User
let admin: User
let otherCourse: number
let student: User
let course: number

const signIn = (user: User | null) => vi.mocked(currentReader).mockResolvedValue(user)

const account = async (name: string, roles: User['roles']) => {
  const person = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name, slug: uniq(name.toLowerCase().replace(/\W+/g, '-')) },
      overrideAccess: true,
    }),
  ).id
  const user = track(
    'users',
    (await payload.create({
      collection: 'users',
      data: {
        email: uniqEmail(name.toLowerCase().replace(/\W+/g, '-')),
        password: crypto.randomUUID(),
        roles,
        person,
      },
      overrideAccess: true,
    })) as unknown as User,
  )
  return { person, user }
}

const makeCourse = async (fellows: number[], cycle: number) =>
  track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: 'Session edit probe',
        slug: uniq(`session-edit-${Math.random().toString(36).slice(2, 6)}`),
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

/** A session with English text, one material and one activity, and Arabic for the material. */
const makeSession = async () => {
  const doc = await payload.create({
    collection: 'sessions',
    locale: 'en',
    data: {
      course,
      title: 'English title',
      description: 'English **text**',
      meetings: [{ date: '2035-10-05', start_time: '19:00', end_time: '21:00' }],
      bibliography: [{ type: 'reading', title: 'English reading', note: 'English note' }],
      activities: [{ kind: 'discussion', description: 'English activity' }],
    },
    overrideAccess: true,
  })
  const material = doc.bibliography![0]!
  await payload.update({
    collection: 'sessions',
    id: doc.id,
    locale: 'ar',
    data: { bibliography: [{ ...material, title: 'قراءة عربية' }] },
    overrideAccess: true,
  })
  return doc.id
}

const read = (id: number, locale: 'en' | 'ar') =>
  payload.findByID({
    collection: 'sessions',
    id,
    depth: 0,
    locale,
    fallbackLocale: false,
    overrideAccess: true,
  })

const versions = async (id: number) =>
  (await payload.countVersions({ collection: 'sessions', where: { parent: { equals: id } } }))
    .totalDocs

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Session edit place', slug: uniq('session-edit-place'), city: uniq('Probe') },
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
  const a = await account('Session edit fellow', ['fellow'])
  const b = await account('Session edit other fellow', ['fellow'])
  fellow = a.user
  otherFellow = b.user
  student = (await account('Session edit student', ['member'])).user
  course = await makeCourse([a.person], cycle)
  otherCourse = await makeCourse([b.person], cycle)
  admin = (await account('Schedule edits admin', ['admin'])).user
})

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

const parent = () => ({ kind: 'course', id: String(course) })
const detail = async (id: number, title = 'Applied title') => {
  const loaded = await loadSessionEdit(String(id), 'en')
  if (!loaded.ok) throw new Error(loaded.error)
  const { meetings: _, ...values } = loaded.values
  return {
    op: 'edit' as const,
    id: String(id),
    version: loaded.version,
    values: { ...values, title },
  }
}

describe('saveScheduleEdits', () => {
  it.each([
    ['fellow', () => fellow],
    ['admin', () => admin],
  ])('allows the %s to save details and a move together', async (_, who) => {
    const id = await makeSession()
    signIn(who())
    const change = await detail(id)
    const before = await read(id, 'en')
    const result = await saveScheduleEdits({
      calendar: {
        parent: parent(),
        changes: [
          {
            op: 'move-block',
            itemId: String(id),
            version: change.version,
            blockId: before.meetings![0]!.id!,
            date: '2035-10-08',
            start_time: '18:00',
            end_time: '20:00',
          },
        ],
      },
      details: [change],
    })
    expect(result.ok).toBe(true)
    expect(await read(id, 'en')).toMatchObject({
      title: 'Applied title',
      meetings: [{ date: '2035-10-08', start_time: '18:00' }],
    })
    expect((await read(id, 'en')).meetings![0]!.id).toBe(before.meetings![0]!.id)
  })

  it.each([
    ['student', () => student],
    ['other fellow', () => otherFellow],
  ])('refuses the %s and writes nothing', async (_, who) => {
    const id = await makeSession()
    signIn(fellow)
    const change = await detail(id)
    const count = await versions(id)
    signIn(who())
    const result = await saveScheduleEdits({
      calendar: { parent: parent(), changes: [] },
      details: [change],
    })
    expect(result).toEqual({ ok: false, error: { code: 'forbidden' } })
    expect((await read(id, 'en')).title).toBe('English title')
    expect(await versions(id)).toBe(count)
  })

  it('keeps every item when one version is stale', async () => {
    const a = await makeSession(),
      b = await makeSession()
    signIn(fellow)
    const edits = [await detail(a), await detail(b)]
    await payload.update({
      collection: 'sessions',
      id: b,
      data: { title: 'Elsewhere' },
      overrideAccess: true,
    })
    const count = await versions(a)
    const result = await saveScheduleEdits({
      calendar: { parent: parent(), changes: [] },
      details: edits,
    })
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'stale', itemId: String(b), name: expect.stringContaining('Elsewhere') },
    })
    expect((await read(a, 'en')).title).toBe('English title')
    expect(await versions(a)).toBe(count)
  })

  it('refuses an item of another course without saving the allowed item', async () => {
    const a = await makeSession()
    const b = await payload.create({
      collection: 'sessions',
      data: { course: otherCourse, title: 'Other' },
      overrideAccess: true,
    })
    signIn(admin)
    const edits = [await detail(a), await detail(b.id)]
    signIn(fellow)
    const result = await saveScheduleEdits({
      calendar: { parent: parent(), changes: [] },
      details: edits,
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'not-found', itemId: String(b.id) } })
    expect((await read(a, 'en')).title).toBe('English title')
    expect((await read(b.id, 'en')).title).toBe('Other')
  })

  it('rolls back the first write when a later meeting fails validation', async () => {
    const a = await makeSession(),
      b = await makeSession()
    signIn(fellow)
    const first = await detail(a),
      second = await detail(b)
    const count = await versions(a)
    const result = await saveScheduleEdits({
      calendar: { parent: parent(), changes: [] },
      details: [
        first,
        { ...second, meetings: [{ date: '2035-10-08', start_time: '20:00', end_time: '18:00' }] },
      ],
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
    expect((await read(a, 'en')).title).toBe('English title')
    expect(await versions(a)).toBe(count)
  })

  it('creates a session with its details and meeting in the same save', async () => {
    signIn(fellow)
    const result = await saveScheduleEdits({
      calendar: {
        parent: parent(),
        changes: [
          {
            op: 'create-item',
            itemId: 'new-test',
            kind: 'session',
            blocks: [
              {
                blockId: 'new-meeting',
                date: '2035-10-08',
                start_time: '18:00',
                end_time: '20:00',
              },
            ],
          },
        ],
      },
      details: [
        {
          op: 'edit',
          id: 'new-test',
          version: '',
          values: {
            title: 'New detailed session',
            description: 'Read **this**',
            cancelled: true,
            bibliography: [{ type: 'reading', title: 'Book', href: '', note: '' }],
            activities: [{ kind: 'discussion', description: 'Discuss' }],
          },
        },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error.code)
    const item = result.items.find((item) => item.title === 'New detailed session')!
    expect(item).toMatchObject({ cancelled: true, blocks: [{ date: '2035-10-08' }] })
    expect(await read(Number(item.id), 'en')).toMatchObject({
      description: 'Read **this**',
      bibliography: [{ title: 'Book' }],
      activities: [{ description: 'Discuss' }],
    })
  })

  it('deletes a session as the fellow', async () => {
    const id = await makeSession()
    signIn(fellow)
    const { version } = await detail(id)
    const result = await saveScheduleEdits({ details: [{ op: 'delete', id: String(id), version }] })
    expect(result.ok).toBe(true)
    expect(
      await payload.count({ collection: 'sessions', where: { id: { equals: id } } }),
    ).toMatchObject({ totalDocs: 0 })
  })

  it('never creates a drawn session removed before Save', async () => {
    signIn(fellow)
    const before = await payload.count({
      collection: 'sessions',
      where: { course: { equals: course } },
    })
    const drawn = newBlock(newItemId(), '2035-10-08', 1080, 1200)
    const changes = changesOf({
      items: [],
      base: [],
      working: keepDeleted([drawn], [], drawn.id, []),
      newItemKind: 'session',
    })
    expect(changes).toEqual([])
    const result = await saveScheduleEdits({ calendar: { parent: parent(), changes }, details: [] })
    expect(result.ok).toBe(true)
    expect(
      await payload.count({ collection: 'sessions', where: { course: { equals: course } } }),
    ).toEqual(before)
  })

  it('keeps a real session that loses its only meeting', async () => {
    const id = await makeSession()
    signIn(fellow)
    const session = await read(id, 'en')
    const result = await saveScheduleEdits({
      calendar: {
        parent: parent(),
        changes: [
          {
            op: 'delete-block',
            itemId: String(id),
            version: session.updatedAt,
            blockId: session.meetings![0]!.id!,
          },
        ],
      },
      details: [],
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.items.find((item) => item.id === String(id))!.blocks).toEqual([])
    expect((await read(id, 'en')).title).toBe('English title')
  })
})
