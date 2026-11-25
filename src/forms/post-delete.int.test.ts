import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'
import { deletePostKeepingReplies } from '@/lib/space-delete'
import { REACTION_KINDS } from '@/lib/space-reactions'
import { lockRow } from '@/lib/row-lock'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { createTracker, uniq, uniqEmail } from '../../testing/payload.fixture'
import { rest } from '../../testing/payload-rest.test-utils'
import { resendInbox } from '../../testing/resend.test-utils'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
const { track, cleanup } = createTracker()
const REACTION = REACTION_KINDS[0]

describe('an admin deletes a post from the admin panel', () => {
  let admin: User
  let member: User
  let adminPassword: string
  let memberPassword: string
  let space: number
  let person: number

  const makeUser = async (base: string, roles: User['roles'], password: string) =>
    track(
      'users',
      (await payload.create({
        collection: 'users',
        data: { email: uniqEmail(base), password, roles },
        overrideAccess: true,
      })) as unknown as User,
    )

  const tokenOf = async (user: User, password: string) =>
    (await payload.login({ collection: 'users', data: { email: user.email, password } })).token ??
    ''

  const post = async (body = 'A first line\nand more') =>
    (
      await payload.create({
        collection: 'space-posts',
        data: { space, kind: 'discussion', body } as never,
        overrideAccess: true,
      })
    ).id

  const comment = async (postId: number, parent: number | null = null) =>
    (
      await payload.create({
        collection: 'space-comments',
        data: { space, post: postId, parent, author: person, body: 'A reply' } as never,
        overrideAccess: true,
      })
    ).id

  const react = (target: { post: number } | { comment: number }) =>
    payload.create({
      collection: 'space-reactions',
      data: { space, account: member.id, reaction: REACTION, ...target } as never,
      overrideAccess: true,
    })

  const count = async (
    collection: 'space-posts' | 'space-comments' | 'space-reactions',
    ids: number[],
  ) =>
    (
      await payload.count({
        collection,
        where: { id: { in: ids } },
        overrideAccess: true,
      })
    ).totalDocs

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    adminPassword = crypto.randomUUID()
    memberPassword = crypto.randomUUID()
    admin = await makeUser('post-delete-admin', ['admin'], adminPassword)
    member = await makeUser('post-delete-member', ['member'], memberPassword)
    person = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Post Delete', slug: uniq('post-delete') },
        overrideAccess: true,
      }),
    ).id
    space = track(
      'spaces',
      await payload.create({
        collection: 'spaces',
        data: { kind: 'community', name: uniq('Post delete space') } as never,
        overrideAccess: true,
      }),
    ).id
  })

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  it('closes the stock REST delete', async () => {
    const id = await post()
    await expect(
      payload.delete({ collection: 'space-posts', id, user: admin, overrideAccess: false }),
    ).rejects.toThrow()
    expect(await count('space-posts', [id])).toBe(1)
  })

  it('lists the comments that go with the post, with no name to type', async () => {
    const id = await post()
    const first = await comment(id)
    await comment(id, first)
    await react({ comment: first })
    await react({ post: id })
    const response = await rest('GET', `space-posts/${id}/delete-summary`, {
      token: await tokenOf(admin, adminPassword),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      name: 'A first line',
      noun: 'post',
      typeToConfirm: false,
      deletes: [
        { label: 'comments', count: 2, items: [] },
        { label: 'reactions', count: 2, items: [] },
      ],
      unlinks: [],
    })
  })

  it('deletes the post with its comments, replies and their reactions', async () => {
    const id = await post()
    const first = await comment(id)
    const reply = await comment(id, first)
    const onComment = await react({ comment: reply })
    const onPost = await react({ post: id })
    const response = await rest('POST', `space-posts/${id}/delete`, {
      token: await tokenOf(admin, adminPassword),
    })
    expect(response.status).toBe(200)
    expect(await count('space-posts', [id])).toBe(0)
    expect(await count('space-comments', [first, reply])).toBe(0)
    expect(await count('space-reactions', [onComment.id, onPost.id])).toBe(0)
  })

  it('a member’s delete keeps a post that has a reply, and deletes nothing', async () => {
    const id = await post()
    const reply = await comment(id)
    expect(await deletePostKeepingReplies(payload, id)).toBe(false)
    expect(await count('space-posts', [id])).toBe(1)
    expect(await count('space-comments', [reply])).toBe(1)
  })

  it('a member’s delete lock holds back a reply until the delete ends', async () => {
    const id = await post()
    const transactionID = await payload.db.beginTransaction()
    const req = { payload, transactionID, context: {} } as unknown as PayloadRequest
    const client = await (payload.db as unknown as PostgresAdapter).pool.connect()
    try {
      await lockRow(req, 'space-posts', id, 'references')
      await client.query(`SET lock_timeout = '300ms'`)
      await expect(
        client.query('INSERT INTO space_comments (space_id, post_id, body) VALUES ($1, $2, $3)', [
          space,
          id,
          'A late reply',
        ]),
      ).rejects.toMatchObject({ code: '55P03' })
    } finally {
      client.release()
      await payload.db.rollbackTransaction(transactionID!)
    }
  })

  it('a member’s delete removes a post with no reply', async () => {
    const id = await post()
    const onPost = await react({ post: id })
    expect(await deletePostKeepingReplies(payload, id)).toBe(true)
    expect(await count('space-posts', [id])).toBe(0)
    expect(await count('space-reactions', [onPost.id])).toBe(0)
  })

  it('refuses a member', async () => {
    const id = await post()
    const response = await rest('POST', `space-posts/${id}/delete`, {
      token: await tokenOf(member, memberPassword),
    })
    expect(response.status).toBe(403)
    expect(await count('space-posts', [id])).toBe(1)
  })

  it('refuses the space’s introduction post', async () => {
    const id = await post('Welcome')
    await comment(id)
    await payload.update({
      collection: 'spaces',
      id: space,
      data: { introduction_post: id } as never,
      overrideAccess: true,
    })
    const token = await tokenOf(admin, adminPassword)
    const summary = await rest('GET', `space-posts/${id}/delete-summary`, { token })
    const remove = await rest('POST', `space-posts/${id}/delete`, { token })
    expect(summary.status).toBe(403)
    expect((await summary.json()).error).toMatch(/introduction post/)
    expect(remove.status).toBe(403)
    expect(await count('space-posts', [id])).toBe(1)
  })
})
