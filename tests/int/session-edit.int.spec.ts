// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { loadSessionEdit, saveSessionEdit, type SessionEdit } from '@/actions/session-edit'
import { currentReader } from '@/lib/reader'
import config from '@/payload.config'
import type { User } from '@/payload-types'

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

/** Loads the form as the fellow would, then saves `change` on it. */
const edit = async (
  id: number,
  locale: 'en' | 'ar',
  change: (values: SessionEdit) => SessionEdit,
) => {
  const loaded = await loadSessionEdit(String(id), locale)
  if (!loaded.ok) throw new Error(loaded.error)
  return saveSessionEdit(
    { id: String(id), version: loaded.version, values: change(loaded.values) },
    locale,
  )
}

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
  await makeCourse([b.person], cycle)
})

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('saveSessionEdit', () => {
  it('lets a fellow of the course save, keeping the meeting’s row', async () => {
    const id = await makeSession()
    signIn(fellow)
    const result = await edit(id, 'en', (v) => ({
      ...v,
      title: 'New title',
      meetings: [{ ...v.meetings[0]!, date: '2035-10-07', start_time: '18:00', end_time: '20:00' }],
    }))
    expect(result.ok).toBe(true)
    const doc = await read(id, 'en')
    expect(doc.title).toBe('New title')
    expect(doc.meetings).toHaveLength(1)
    expect(doc.meetings![0]).toMatchObject({ date: '2035-10-07', start_time: '18:00' })
    if (result.ok) {
      // The course's items before and after, for the offer: the same block id, moved.
      const before = result.before.find((i) => i.id === String(id))!
      const after = result.after.find((i) => i.id === String(id))!
      expect(after.blocks[0]!.id).toBe(before.blocks[0]!.id)
      expect(before.blocks[0]!.date).toBe('2035-10-05')
      expect(after.blocks[0]!.date).toBe('2035-10-07')
    }
  })

  it.each([
    ['a fellow of another course', () => otherFellow],
    ['a student', () => student],
  ])('refuses %s and writes nothing', async (_, who) => {
    const id = await makeSession()
    signIn(fellow)
    const loaded = await loadSessionEdit(String(id), 'en')
    if (!loaded.ok) throw new Error(loaded.error)
    const count = await versions(id)
    signIn(who())
    const result = await saveSessionEdit(
      { id: String(id), version: loaded.version, values: { ...loaded.values, title: 'Taken' } },
      'en',
    )
    expect(result).toEqual({ ok: false, error: { code: 'forbidden' } })
    expect((await read(id, 'en')).title).toBe('English title')
    expect(await versions(id)).toBe(count)
  })

  it('fails a stale save, names the session, and saves nothing', async () => {
    const id = await makeSession()
    signIn(fellow)
    const loaded = await loadSessionEdit(String(id), 'en')
    if (!loaded.ok) throw new Error(loaded.error)
    // Someone else saves after the form loaded.
    await payload.update({
      collection: 'sessions',
      id,
      data: { title: 'Changed elsewhere' },
      overrideAccess: true,
    })
    const count = await versions(id)
    const result = await saveSessionEdit(
      { id: String(id), version: loaded.version, values: { ...loaded.values, title: 'Mine' } },
      'en',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatchObject({ code: 'stale', itemId: String(id) })
    expect((await read(id, 'en')).title).toBe('Changed elsewhere')
    expect(await versions(id)).toBe(count)
  })

  it('loads and writes the page’s language alone, and keeps the other', async () => {
    const id = await makeSession()
    signIn(fellow)
    const loaded = await loadSessionEdit(String(id), 'ar')
    if (!loaded.ok) throw new Error(loaded.error)
    // No fallback: the Arabic form starts empty, never with the English text.
    expect(loaded.values.title).toBe('')
    expect(loaded.values.description).toBe('')
    expect(loaded.values.bibliography[0]!.title).toBe('قراءة عربية')
    expect(loaded.values.activities[0]!.description).toBe('')

    const result = await saveSessionEdit(
      {
        id: String(id),
        version: loaded.version,
        values: {
          ...loaded.values,
          title: 'عنوان',
          description: 'نص',
          bibliography: [{ ...loaded.values.bibliography[0]!, title: 'قراءة جديدة' }],
          activities: [{ ...loaded.values.activities[0]!, description: 'نقاش' }],
        },
      },
      'ar',
    )
    expect(result.ok).toBe(true)

    const ar = await read(id, 'ar')
    expect(ar.title).toBe('عنوان')
    expect(ar.description).toBe('نص')
    expect(ar.bibliography![0]!.title).toBe('قراءة جديدة')
    expect(ar.activities![0]!.description).toBe('نقاش')
    const en = await read(id, 'en')
    expect(en.title).toBe('English title')
    expect(en.description).toBe('English **text**')
    expect(en.bibliography![0]).toMatchObject({ title: 'English reading', note: 'English note' })
    expect(en.activities![0]!.description).toBe('English activity')
  })

  it('refuses a meeting that ends before it starts, by the collection’s own check', async () => {
    const id = await makeSession()
    signIn(fellow)
    const result = await edit(id, 'en', (v) => ({
      ...v,
      meetings: [{ ...v.meetings[0]!, start_time: '21:00', end_time: '19:00' }],
    }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('invalid')
    expect((await read(id, 'en')).meetings![0]).toMatchObject({ start_time: '19:00' })
  })
})
