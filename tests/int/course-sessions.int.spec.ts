// @vitest-environment node
import { revalidatePath, revalidateTag } from 'next/cache'
import { getPayload, type Payload } from 'payload'
import { Client } from 'typesense'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getCourseSessions } from '@/api/sessions.api'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { createTracker, uniq, uniqEmail } from './fixtures'

// Outside Next, these throw and the hooks swallow it; mocked, the test sees them.
vi.mock('next/cache', async (original) => ({
  ...(await original<typeof import('next/cache')>()),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

/**
 * The sessions collection against the database (ADR 0011): read access
 * follows the course, fellows edit their own course's sessions, a session
 * save keeps the course's days without publishing its pending draft, drops
 * the course from the cache and re-indexes it in search, and deleting a
 * course deletes its sessions.
 */

let payload: Payload
const { track, cleanup } = createTracker()

let published: number
let draftOnly: number
let publishedSession: number
let draftSession: number
let fellow: User
let otherFellow: User

const course = async (fellows: number[], status: 'draft' | 'published', cycle: number) =>
  track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: `Sessions probe ${status}`,
        slug: uniq(`sessions-probe-${status}`),
        course_type: 'THEMATIC',
        tier: 'public',
        cycle,
        fellows,
        registration: { mode: 'closed' },
        _status: status,
      },
      draft: status === 'draft',
      overrideAccess: true,
    }),
  ).id

const session = async (course: number, date: string) =>
  (
    await payload.create({
      collection: 'sessions',
      data: {
        course,
        title: 'Probe',
        meetings: [{ date, start_time: '19:00', end_time: '21:00' }],
      },
      overrideAccess: true,
    })
  ).id

const fellowAccount = async (name: string) => {
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
        roles: ['fellow'],
        person,
      },
      overrideAccess: true,
    })) as unknown as User,
  )
  return { person, user }
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Sessions probe place', slug: uniq('sessions-place'), city: uniq('Probe') },
      overrideAccess: true,
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2034, place, start_date: '2034-10-04' },
      overrideAccess: true,
    }),
  ).id
  const a = await fellowAccount('Sessions fellow')
  const b = await fellowAccount('Other fellow')
  fellow = a.user
  otherFellow = b.user
  published = await course([a.person], 'published', cycle)
  draftOnly = await course([a.person], 'draft', cycle)
  publishedSession = await session(published, '2034-10-07')
  draftSession = await session(draftOnly, '2034-10-08')
})

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('getCourseSessions', () => {
  it('gives each course its sessions in time order, as the reader may see them', async () => {
    const earlier = await session(published, '2034-10-05')
    const ids = (list: { id: number }[] | undefined) => list?.map((s) => s.id)

    const anyone = await getCourseSessions(payload, [published, draftOnly], {
      locale: 'en',
      reader: null,
    })
    expect(ids(anyone.get(published))).toEqual([earlier, publishedSession])
    expect(ids(anyone.get(draftOnly))).toEqual([])

    const ownFellow = await getCourseSessions(payload, [draftOnly], {
      locale: 'en',
      reader: fellow,
    })
    expect(ids(ownFellow.get(draftOnly))).toEqual([draftSession])

    await payload.delete({ collection: 'sessions', id: earlier, overrideAccess: true })
  })
})

describe('sessions', () => {
  it('shows a published course’s session to anyone, and hides a draft course’s', async () => {
    const read = (id: number) =>
      payload.findByID({ collection: 'sessions', id, depth: 0, overrideAccess: false })
    await expect(read(publishedSession)).resolves.toMatchObject({ id: publishedSession })
    await expect(read(draftSession)).rejects.toMatchObject({ status: 404 })
  })

  it('lets a fellow of the course edit its session, and no other fellow', async () => {
    const rename = (user: User, title: string) =>
      payload.update({
        collection: 'sessions',
        id: publishedSession,
        data: { title },
        user,
        overrideAccess: false,
      })
    await expect(rename(fellow, 'Renamed by its fellow')).resolves.toMatchObject({
      title: 'Renamed by its fellow',
    })
    await expect(rename(otherFellow, 'Renamed by another')).rejects.toMatchObject({ status: 403 })
  })

  it('keeps the course’s days on a session save, without publishing its pending draft', async () => {
    await payload.update({
      collection: 'courses',
      id: published,
      data: { title: 'Pending draft title' },
      draft: true,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'sessions',
      id: publishedSession,
      data: { meetings: [{ date: '2034-11-02', start_time: '10:00', end_time: '12:00' }] },
      user: fellow,
      overrideAccess: false,
    })

    const live = await payload.findByID({
      collection: 'courses',
      id: published,
      depth: 0,
      overrideAccess: true,
    })
    expect(live).toMatchObject({
      first_day: '2034-11-02',
      last_day: '2034-11-02',
      title: 'Sessions probe published',
      _status: 'published',
    })
    const draft = await payload.findByID({
      collection: 'courses',
      id: published,
      depth: 0,
      draft: true,
      overrideAccess: true,
    })
    expect(draft).toMatchObject({ title: 'Pending draft title', _status: 'draft' })
  })

  it('deletes a course’s sessions with the course', async () => {
    await payload.delete({ collection: 'courses', id: published, overrideAccess: true })
    const { totalDocs } = await payload.count({
      collection: 'sessions',
      where: { course: { equals: published } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(0)
  })
})

describe('a session save refreshes its course', () => {
  const search = new Client({
    apiKey: process.env.TYPESENSE_API_KEY ?? '',
    nodes: [
      {
        host: process.env.TYPESENSE_HOST ?? 'localhost',
        port: Number(process.env.TYPESENSE_PORT ?? 8108),
        protocol: process.env.TYPESENSE_PROTOCOL ?? 'http',
      },
    ],
  })
  /** The course's search document, once `ready` holds for it (index writes run after the save). */
  const indexed = async (id: number, ready: (document: string) => boolean) => {
    for (let tries = 0; tries < 50; tries++) {
      const document = JSON.stringify(
        await search.collections('courses').documents(String(id)).retrieve(),
      )
      if (ready(document)) return document
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error(`courses/${id} never reached the expected search document`)
  }
  const days = async (id: number) => {
    const { first_day, last_day } = await payload.findByID({
      collection: 'courses',
      id,
      depth: 0,
      overrideAccess: true,
    })
    return { first_day, last_day }
  }

  it.skipIf(!process.env.TYPESENSE_API_KEY)(
    'keeps the days, the cache and the search index of a published course current',
    async () => {
      const cycle = (
        await payload.find({ collection: 'cycles', limit: 1, depth: 0, overrideAccess: true })
      ).docs[0]!.id
      const id = await course([], 'published', cycle)
      const { slug } = await payload.findByID({ collection: 'courses', id, depth: 0 })
      const title = uniq('Indexed session')
      expect(await days(id)).toEqual({ first_day: null, last_day: null })

      const made = await payload.create({
        collection: 'sessions',
        data: { course: id, title, meetings: [{ date: '2035-03-03' }] },
        overrideAccess: true,
      })
      expect(await days(id)).toEqual({ first_day: '2035-03-03', last_day: '2035-03-03' })
      await indexed(id, (document) => document.includes(title))

      vi.mocked(revalidateTag).mockClear()
      vi.mocked(revalidatePath).mockClear()
      await payload.update({
        collection: 'sessions',
        id: made.id,
        data: { meetings: [{ date: '2035-03-10', start_time: '19:00', end_time: '21:00' }] },
        overrideAccess: true,
      })
      expect(await days(id)).toEqual({ first_day: '2035-03-10', last_day: '2035-03-10' })
      // The tag of the cached lists, the calendar among them (`getCachedCalendarItems`).
      expect(revalidateTag).toHaveBeenCalledWith('courses', 'max')
      expect(revalidatePath).toHaveBeenCalledWith(`/en/study/${slug}`)
      expect(revalidatePath).toHaveBeenCalledWith(`/ar/study/${slug}`)

      await payload.delete({ collection: 'sessions', id: made.id, overrideAccess: true })
      expect(await days(id)).toEqual({ first_day: null, last_day: null })
      await indexed(id, (document) => !document.includes(title))
    },
  )
})
