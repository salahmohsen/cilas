// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { countSpaceContent, spaceDeleteBlock } from '@/lib/space-delete'

import { RUN, createTracker, lockSpacesMode, uniq, uniqEmail } from './fixtures'

let payload: Payload
let unlock: () => Promise<void>
let author: number
let account: number
const { track, cleanup } = createTracker()

const gone = (collection: string, id: number) =>
  payload
    .findByID({ collection: collection as never, id, overrideAccess: true, depth: 0 })
    .then(() => false)
    .catch(() => true)

const community = async () => {
  const space = await payload.create({
    collection: 'spaces',
    data: { kind: 'community' },
    overrideAccess: true,
  })
  track('spaces', space.id)
  return space.id
}

/** A post with a comment, a reply, a reaction, a visit and a bell. */
const fill = async (space: number) => {
  const post = await payload.create({
    collection: 'space-posts',
    data: { space, author, kind: 'discussion', body: 'hello' } as never,
    overrideAccess: true,
  })
  track('space-posts', post.id)
  const comment = await payload.create({
    collection: 'space-comments',
    data: { space, post: post.id, author, body: 'first' } as never,
    overrideAccess: true,
  })
  track('space-comments', comment.id)
  const reply = await payload.create({
    collection: 'space-comments',
    data: { space, post: post.id, author, body: 'reply', parent: comment.id } as never,
    overrideAccess: true,
  })
  track('space-comments', reply.id)
  const reaction = await payload.create({
    collection: 'space-reactions',
    data: { space, account, reaction: 'agree', post: post.id } as never,
    overrideAccess: true,
  })
  track('space-reactions', reaction.id)
  const visit = await payload.create({
    collection: 'space-visits',
    data: { account, space, last_visited_at: new Date().toISOString() },
    overrideAccess: true,
  })
  track('space-visits', visit.id)
  const bell = await payload.create({
    collection: 'notifications',
    data: {
      recipient: account,
      kind: 'comment',
      title: 'T',
      link: `/en/spaces/community/${space}/posts/${post.id}`,
    } as never,
    overrideAccess: true,
  })
  track('notifications', bell.id)
  return {
    post: post.id,
    comment: comment.id,
    reply: reply.id,
    reaction: reaction.id,
    visit: visit.id,
    bell: bell.id,
  }
}

describe('space delete', () => {
  beforeAll(async () => {
    unlock = await lockSpacesMode()
    payload = await getPayload({ config: await (config as never as Promise<typeof config>) })
    const p = await payload.create({
      collection: 'people',
      data: { name: 'Delete-Author', slug: uniq('delete-author') },
      overrideAccess: true,
    })
    track('people', p.id)
    const u = await payload.create({
      collection: 'users',
      data: {
        email: uniqEmail('delete-author'),
        password: 'probe-probe',
        roles: ['member'],
        person: p.id,
      },
      overrideAccess: true,
    })
    track('users', u.id)
    author = p.id
    account = u.id
  }, 600_000)

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
    await unlock()
  })

  it('deletes a community space with everything in it, and leaves other spaces alone', async () => {
    const space = await community()
    const other = await community()
    const rows = await fill(space)
    const kept = await fill(other)

    expect(await countSpaceContent(payload, space)).toMatchObject({
      posts: 1,
      comments: 2,
      reactions: 1,
    })

    await payload.delete({ collection: 'spaces', id: space, overrideAccess: true })

    expect(await gone('spaces', space)).toBe(true)
    expect(await gone('space-posts', rows.post)).toBe(true)
    expect(await gone('space-comments', rows.comment)).toBe(true)
    expect(await gone('space-comments', rows.reply)).toBe(true)
    expect(await gone('space-reactions', rows.reaction)).toBe(true)
    expect(await gone('space-visits', rows.visit)).toBe(true)
    expect(await gone('notifications', rows.bell)).toBe(true)

    expect(await gone('spaces', other)).toBe(false)
    expect(await gone('space-posts', kept.post)).toBe(false)
    expect(await gone('space-comments', kept.reply)).toBe(false)
    expect(await gone('notifications', kept.bell)).toBe(false)
  })

  it('refuses the stock delete through the API access rules', async () => {
    const space = await community()
    await expect(
      payload.delete({ collection: 'spaces', id: space, overrideAccess: false }),
    ).rejects.toThrow()
    expect(await gone('spaces', space)).toBe(false)
  })

  it('blocks a course or cohort space only while its parent exists', () => {
    expect(spaceDeleteBlock({ id: 1, kind: 'community' })).toBeNull()
    expect(spaceDeleteBlock({ id: 1, kind: 'course', course: 7 })).toMatch(/Delete the course/)
    expect(spaceDeleteBlock({ id: 1, kind: 'cohort', programme: 7 })).toMatch(
      /Delete the programme/,
    )
    // A space whose course is already gone has no owner left to delete it.
    expect(spaceDeleteBlock({ id: 1, kind: 'course', course: null })).toBeNull()
  })

  it('refuses a course space on its own, and deletes it with its course', async () => {
    const place = await payload.create({
      collection: 'places',
      data: { name: 'Delete Place', slug: uniq('delete-place'), city: `Delville ${RUN}` },
      overrideAccess: true,
    })
    track('places', place.id)
    const cycle = await payload.create({
      collection: 'cycles',
      data: { season: 'spring', start_year: 2032, place: place.id, start_date: '2032-03-04' },
      overrideAccess: true,
    })
    track('cycles', cycle.id)
    const course = await payload.create({
      collection: 'courses',
      depth: 0,
      data: {
        title: 'Delete Probe Course',
        slug: uniq('delete-probe-course'),
        course_type: 'THEMATIC',
        session_unit: 'session',
        tier: 'owner',
        cycle: cycle.id,
        registration: { mode: 'closed' },
        _status: 'published',
      } as never,
      overrideAccess: true,
    })
    track('courses', course.id)
    const { docs } = await payload.find({
      collection: 'spaces',
      where: { course: { equals: course.id } },
      overrideAccess: true,
      depth: 0,
    })
    const space = docs[0]!.id
    track('spaces', space)
    const rows = await fill(space)

    await expect(
      payload.delete({ collection: 'spaces', id: space, overrideAccess: true }),
    ).rejects.toThrow(/Delete the course instead/)
    expect(await gone('space-posts', rows.post)).toBe(false)

    await payload.delete({ collection: 'courses', id: course.id, overrideAccess: true })
    expect(await gone('spaces', space)).toBe(true)
    expect(await gone('space-posts', rows.post)).toBe(true)
    expect(await gone('space-comments', rows.reply)).toBe(true)
  })
})
