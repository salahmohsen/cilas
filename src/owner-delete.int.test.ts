import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../testing/local-services.test-utils'
import { mockNetwork } from '../testing/msw-node.test-utils'
import { createTracker, uniq, uniqEmail } from '../testing/payload.fixture'
import { rest } from '../testing/payload-rest.test-utils'
import { resendInbox } from '../testing/resend.test-utils'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
const { track, cleanup } = createTracker()

describe('an owner deletes a declined, never-published document', () => {
  let admin: User
  let author: User
  let other: User
  let fellow: User
  let authorPerson: number
  let authorPassword: string
  let fellowPassword: string
  let fellowPerson: number
  let adminPassword: string

  const makePerson = async (name: string) =>
    track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name, slug: uniq(name.toLowerCase().replace(/\W+/g, '-')) },
        overrideAccess: true,
      }),
    ).id

  const makeUser = async (base: string, roles: User['roles'], password: string, person?: number) =>
    track(
      'users',
      (await payload.create({
        collection: 'users',
        data: { email: uniqEmail(base), password, roles, ...(person ? { person } : {}) },
        overrideAccess: true,
      })) as unknown as User,
    )

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    authorPassword = crypto.randomUUID()
    fellowPassword = crypto.randomUUID()
    adminPassword = crypto.randomUUID()
    admin = await makeUser('delete-admin', ['admin'], adminPassword)
    authorPerson = await makePerson('Delete Author')
    author = await makeUser('delete-author', ['member'], authorPassword, authorPerson)
    other = await makeUser(
      'delete-other',
      ['member'],
      crypto.randomUUID(),
      await makePerson('Delete Other'),
    )
    fellowPerson = await makePerson('Delete Fellow')
    fellow = await makeUser('delete-fellow', ['fellow'], fellowPassword, fellowPerson)
  })

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  const as = (user: User) => ({ user, overrideAccess: false }) as const

  let serial = 0
  const fresh = (base: string) => uniq(`${base}-${(serial += 1)}`)

  const tokenOf = async (user: User, password: string) =>
    (await payload.login({ collection: 'users', data: { email: user.email, password } })).token ??
    ''

  const decide = (collection: 'articles' | 'courses', id: number, status: 'rejected') =>
    payload.update({
      collection,
      id,
      data: { _status: 'draft', review: { status, review_note: 'Not for us' } },
      ...as(admin),
    })

  const article = async () =>
    track(
      'articles',
      await payload.create({
        collection: 'articles',
        data: {
          title: fresh('Delete Article'),
          slug: fresh('delete-article'),
          authors: [],
          tier: 'owner',
          review: { status: 'draft' },
        },
        ...as(author),
      }),
    ).id

  const submitted = async (collection: 'articles' | 'courses', id: number, user: User) =>
    payload.update({
      collection,
      id,
      data: { _status: 'draft', review: { status: 'submitted' } },
      ...as(user),
    })

  const course = async () => {
    const id = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: { title: fresh('Delete Course'), course_type: 'THEMATIC' },
        draft: true,
        ...as(fellow),
      }),
    ).id
    track(
      'sessions',
      await payload.create({
        collection: 'sessions',
        data: {
          course: id,
          title: 'Doomed session',
          meetings: [{ date: '2036-10-05', start_time: '10:00', end_time: '12:00' }],
        },
        overrideAccess: true,
      }),
    )
    return id
  }

  const exists = async (collection: 'articles' | 'courses', id: number) =>
    (
      await payload.count({
        collection,
        where: { id: { equals: id } },
        overrideAccess: true,
      })
    ).totalDocs === 1

  it('an owner deletes a declined, never-published article', async () => {
    const id = await article()
    await submitted('articles', id, author)
    await decide('articles', id, 'rejected')
    await payload.delete({ collection: 'articles', id, ...as(author) })
    expect(await exists('articles', id)).toBe(false)
  })

  it('an owner deletes a declined course that has a session', async () => {
    const id = await course()
    await submitted('courses', id, fellow)
    await decide('courses', id, 'rejected')
    const response = await rest('POST', `courses/${id}/delete`, {
      token: await tokenOf(fellow, fellowPassword),
    })
    expect(response.status).toBe(200)
    expect(await exists('courses', id)).toBe(false)
    const sessions = await payload.count({
      collection: 'sessions',
      where: { course: { equals: id } },
      overrideAccess: true,
    })
    expect(sessions.totalDocs).toBe(0)
  })

  it('an owner cannot delete a submitted article', async () => {
    const id = await article()
    await submitted('articles', id, author)
    await expect(payload.delete({ collection: 'articles', id, ...as(author) })).rejects.toThrow()
    expect(await exists('articles', id)).toBe(true)
  })

  it('an owner cannot delete a submitted course', async () => {
    const id = await course()
    await submitted('courses', id, fellow)
    const response = await rest('POST', `courses/${id}/delete`, {
      token: await tokenOf(fellow, fellowPassword),
    })
    expect(response.status).toBe(403)
    expect(await exists('courses', id)).toBe(true)
  })

  it('an owner cannot delete a published article', async () => {
    const id = track(
      'articles',
      await payload.create({
        collection: 'articles',
        data: {
          title: fresh('Delete Published'),
          slug: fresh('delete-published'),
          authors: [authorPerson],
          tier: 'public',
          review: { status: 'approved' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    ).id
    await expect(payload.delete({ collection: 'articles', id, ...as(author) })).rejects.toThrow()
    expect(await exists('articles', id)).toBe(true)
  })

  it('another member cannot delete the declined article', async () => {
    const id = await article()
    await submitted('articles', id, author)
    await decide('articles', id, 'rejected')
    await expect(payload.delete({ collection: 'articles', id, ...as(other) })).rejects.toThrow()
    expect(await exists('articles', id)).toBe(true)
  })

  it('the author token of an unrelated member cannot delete the declined course', async () => {
    const id = await course()
    await submitted('courses', id, fellow)
    await decide('courses', id, 'rejected')
    const response = await rest('POST', `courses/${id}/delete`, {
      token: await tokenOf(author, authorPassword),
    })
    expect(response.status).toBe(403)
    expect(await exists('courses', id)).toBe(true)
  })

  const publishedArticle = async () =>
    track(
      'articles',
      await payload.create({
        collection: 'articles',
        data: {
          title: fresh('Delete Live'),
          slug: fresh('delete-live'),
          authors: [authorPerson],
          tier: 'public',
          review: { status: 'approved' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    ).id

  const publishedCourse = async () => {
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Delete Place', slug: fresh('delete-place'), city: fresh('Deleteville') },
        overrideAccess: true,
      }),
    )
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2035, place: place.id, start_date: '2035-10-04' },
        overrideAccess: true,
      }),
    )
    return track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: fresh('Delete Live Course'),
          slug: fresh('delete-live-course'),
          course_type: 'THEMATIC',
          tier: 'public',
          cycle: cycle.id,
          fellows: [fellowPerson],
          registration: { mode: 'closed' },
          review: { status: 'approved' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    ).id
  }

  const declinedCopy = async (collection: 'articles' | 'courses', id: number, user: User) => {
    await payload.update({
      collection,
      id,
      data: { title: fresh('Edited'), _status: 'draft' },
      draft: true,
      ...as(user),
    } as never)
    await submitted(collection, id, user)
    await decide(collection, id, 'rejected')
  }

  it('an owner cannot delete a published article whose draft copy was declined', async () => {
    const id = await publishedArticle()
    await declinedCopy('articles', id, author)
    await expect(payload.delete({ collection: 'articles', id, ...as(author) })).rejects.toThrow()
    expect(await exists('articles', id)).toBe(true)
  })

  it('an owner cannot delete a published course whose draft copy was declined', async () => {
    const id = await publishedCourse()
    await declinedCopy('courses', id, fellow)
    const response = await rest('POST', `courses/${id}/delete`, {
      token: await tokenOf(fellow, fellowPassword),
    })
    expect(response.status).toBe(403)
    expect(await exists('courses', id)).toBe(true)
  })

  describe('GET /api/courses/{id}/delete-summary', () => {
    const summaryAs = async (user: User, password: string, id: number | string) => {
      const response = await rest('GET', `courses/${id}/delete-summary`, {
        token: await tokenOf(user, password),
      })
      return { status: response.status, body: await response.json() }
    }

    it('a member who owns nothing gets one 403 for an existing and a missing id', async () => {
      const id = await course()
      const found = await summaryAs(author, authorPassword, id)
      const missing = await summaryAs(author, authorPassword, 2_000_000_000)
      expect(found.status).toBe(403)
      expect(missing.status).toBe(403)
      expect(found.body).toEqual(missing.body)
      expect(Object.keys(found.body)).toEqual(['error'])
    })

    it('the owner and an admin get the summary', async () => {
      const id = await course()
      for (const [user, password] of [
        [fellow, fellowPassword],
        [admin, adminPassword],
      ] as const) {
        const { status, body } = await summaryAs(user, password, id)
        expect(status).toBe(200)
        expect(body.noun).toBe('course')
        expect(body.deletes.map((g: { label: string }) => g.label)).toContain('sessions')
      }
    })

    it('the owner of a submitted course gets 403 with the reason', async () => {
      const id = await course()
      await submitted('courses', id, fellow)
      const { status, body } = await summaryAs(fellow, fellowPassword, id)
      expect(status).toBe(403)
      expect(Object.keys(body)).toEqual(['error'])
    })
  })
})
