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
    admin = await makeUser('delete-admin', ['admin'], crypto.randomUUID())
    authorPerson = await makePerson('Delete Author')
    author = await makeUser('delete-author', ['member'], authorPassword, authorPerson)
    other = await makeUser(
      'delete-other',
      ['member'],
      crypto.randomUUID(),
      await makePerson('Delete Other'),
    )
    fellow = await makeUser(
      'delete-fellow',
      ['fellow'],
      fellowPassword,
      await makePerson('Delete Fellow'),
    )
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
})
