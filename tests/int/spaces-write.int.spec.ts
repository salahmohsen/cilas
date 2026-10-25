// @vitest-environment node
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import sharp from 'sharp'

import config from '@/payload.config'
import type { Space, User } from '@/payload-types'
import {
  postCreate,
  postEdit,
  postRemove,
  postModify,
  commentCreate,
  commentEdit,
  commentRemove,
  fileAdd,
  spaceRoster,
  stepMark,
  visitRecord,
  reactionToggle,
  consentAccept,
  spaceSettingsSet,
  voteSet,
  rsvpSet,
  eventEdit,
  spaceLink,
} from '@/lib/spaces-write'
import { personOf } from '@/access'
import { ABOUT_MAX } from '@/lib/space-about'
import { mentionSafelist } from '@/lib/space-members'
import { mySpaces, postSpace, postView, spaceEvents, spaceFeed } from '@/lib/spaces-data'

let payload: Payload
let modeBefore: 'off' | 'trial' | 'on' = 'off'
let fellow: User
let student: User
let stranger: User
let admin: User
let fellowPerson: number
let studentPerson: number
let course: { id: number }
let programmeId: number
let community: Space
let courseSpace: Space
let cohortSpace: Space

// Saving an event reads its place name from the web; the tests stay offline.
vi.mock('@/lib/link-preview', async (original) => ({
  ...(await original<typeof import('@/lib/link-preview')>()),
  placeName: vi.fn(async (url: string) => (url.includes('example.org') ? 'Example room' : null)),
}))

const tracked = new Map<string, number[]>()
const track = (collection: string, id: number) => {
  const list = tracked.get(collection) ?? []
  list.push(id)
  tracked.set(collection, list)
}

describe('spaces write', () => {
  let mkUser: (name: string) => Promise<User | undefined>
  beforeAll(async () => {
    payload = await getPayload({ config: await (config as never as Promise<typeof config>) })
    modeBefore =
      (
        (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })) as {
          spaces_mode?: 'off' | 'trial' | 'on'
        }
      ).spaces_mode ?? 'off'
    const mk = async (name: string) => {
      const p = await payload.create({
        collection: 'people',
        data: { name, slug: name.toLowerCase().replace(/\s+/g, '-') },
        overrideAccess: true,
      })
      track('people', p.id)
      const u = await payload.create({
        collection: 'users',
        data: {
          email: `${name.toLowerCase().replace(/\s+/g, '-')}@probe.cilas`,
          password: 'probe-probe',
          roles: ['member'],
          person: p.id,
        },
        overrideAccess: true,
      })
      track('users', u.id)
      return u as unknown as User
    }
    fellow = (await mk('Probe Fellow'))!
    student = (await mk('Probe Student'))!
    // A real admin account: the announcement voice, and a consent holder.
    {
      const p = await payload.create({
        collection: 'people',
        data: { name: 'Probe Admin', slug: 'probe-admin' },
        overrideAccess: true,
      })
      track('people', p.id)
      admin = (await payload.create({
        collection: 'users',
        data: {
          email: 'probe-admin@probe.cilas',
          password: 'probe-probe',
          roles: ['admin', 'member'],
          person: p.id,
        },
        overrideAccess: true,
      })) as unknown as User
      track('users', admin.id)
    }
    stranger = (await mk('Probe Stranger'))!
    mkUser = mk
    fellowPerson = personOf(fellow)!
    studentPerson = personOf(student)!

    const place = await payload.create({
      collection: 'places',
      data: { name: 'Probe Place', slug: 'probe-place', city: 'Probeville' },
      overrideAccess: true,
    })
    track('places', place.id)
    const cycle = await payload.create({
      collection: 'cycles',
      data: { season: 'spring', start_year: 2031, place: place.id, start_date: '2031-03-04' },
      overrideAccess: true,
    })
    track('cycles', cycle.id)
    course = (await payload.create({
      collection: 'courses',
      data: {
        title: 'Probe Course',
        slug: 'probe-space-course',
        course_type: 'THEMATIC',
        session_unit: 'session',
        tier: 'owner',
        cycle: cycle.id,
        fellows: [fellowPerson],
        _status: 'published',
      },
      overrideAccess: true,
    })) as unknown as { id: number }
    track('courses', course.id)
    const enrollment = await payload.create({
      collection: 'enrollments',
      data: { course: course.id, person: studentPerson, status: 'confirmed' } as never,
      overrideAccess: true,
    })
    track('enrollments', enrollment.id as number)
    programmeId = (
      await payload.create({
        collection: 'programmes',
        data: { title: 'Probe Bridge', slug: 'probe-bridge', kind: 'bridge', _status: 'published' },
        overrideAccess: true,
      })
    ).id as number
    track('programmes', programmeId)
    const membership = await payload.create({
      collection: 'memberships',
      data: { programme: programmeId, person: studentPerson, role: 'student' } as never,
      overrideAccess: true,
    })
    track('memberships', membership.id as number)

    const { docs: spaces } = await payload.find({
      collection: 'spaces',
      where: { kind: { equals: 'community' } },
      overrideAccess: true,
      limit: 1,
      sort: 'id',
    })
    if (spaces.length === 0) {
      const s = await payload.create({
        collection: 'spaces',
        data: { kind: 'community' },
        overrideAccess: true,
      })
      track('spaces', s.id)
      community = s as unknown as Space
    } else {
      community = spaces[0] as unknown as Space
    }
    const { docs: cs } = await payload.find({
      collection: 'spaces',
      where: { course: { equals: course.id } },
      overrideAccess: true,
    })
    courseSpace = cs[0] as unknown as Space
    track('spaces', courseSpace.id)
    const courseIntro = (courseSpace as unknown as { introduction_post?: number | { id: number } })
      .introduction_post
    if (courseIntro)
      track(
        'space-posts',
        typeof courseIntro === 'object' && courseIntro !== null ? courseIntro.id : courseIntro,
      )
    const { docs: cos } = await payload.find({
      collection: 'spaces',
      where: { programme: { equals: programmeId } },
      overrideAccess: true,
    })
    cohortSpace = cos[0] as unknown as Space
    track('spaces', cohortSpace.id)
    const cohortIntro = (cohortSpace as unknown as { introduction_post?: number | { id: number } })
      .introduction_post
    if (cohortIntro)
      track(
        'space-posts',
        typeof cohortIntro === 'object' && cohortIntro !== null ? cohortIntro.id : cohortIntro,
      )

    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })

    // The fixture's members have accepted the current notice (spec §9);
    // posting tests here go beyond consent, and one test takes a fresh
    // account through refusal to acceptance.
    for (const u of [student, fellow, admin]) {
      const consent = await consentAccept({ payload, user: u })
      expect(consent.ok).toBe(true)
      const { docs: rows } = await payload.find({
        collection: 'space-consents',
        where: { account: { equals: u.id } },
        overrideAccess: true,
      })
      for (const r of rows) track('space-consents', r.id)
    }
  })

  afterAll(async () => {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: modeBefore },
      overrideAccess: true,
    })
    await (
      payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }
    ).drizzle.execute(sql`delete from space_files where filename like 'probe-f%'`)
    for (const collection of [
      'space-rsvps',
      'space-votes',
      'space-reactions',
      'space-files',
      'space-preferences',
      'space-visits',
      'space-consents',
      'space-comments',
      'notifications',
      'space-posts',
      'spaces',
      'enrollments',
      'memberships',
      'courses',
      'programmes',
      'cycles',
      'places',
      'users',
      'people',
    ] as const) {
      const ids = [...(tracked.get(collection) ?? [])].reverse()
      for (const id of ids) {
        await payload
          .delete({ collection: collection as never, id, overrideAccess: true })
          .catch(() => undefined)
      }
    }
    await payload.destroy()
  })

  it('postCreate by member writes a row', async () => {
    const result = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'discussion',
      body: 'Hello world',
    })
    expect(result.ok).toBe(true)
    if (result.ok) track('space-posts', result.data.id)
  })

  it('stranger cannot course post', async () => {
    const result = await postCreate({
      payload,
      user: stranger,
      space: courseSpace.id,
      kind: 'discussion',
      body: 'Hello',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('not-member')
  })

  it('announcement by member refused, by admin pinned', async () => {
    const memberResult = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'announcement',
      body: 'Ann',
    })
    expect(memberResult.ok).toBe(false)
    if (!memberResult.ok) expect(memberResult.error).toBe('announcement')
    const modResult = await postCreate({
      payload,
      user: admin,
      space: community.id,
      kind: 'announcement',
      body: 'Ann',
    })
    expect(modResult.ok).toBe(true)
    if (modResult.ok) {
      track('space-posts', modResult.data.id)
      const row = await payload.findByID({
        collection: 'space-posts',
        id: modResult.data.id,
        depth: 0,
        overrideAccess: true,
      })
      expect((row as { pinned?: boolean }).pinned).toBe(true)
    }
  })

  it('mode off rejects everything', async () => {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'off' },
      overrideAccess: true,
    })
    const result = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'discussion',
      body: 'Hello',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('mode')
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })
  })

  it('consent required before posting', async () => {
    const fresh = (await mkUser('Probe Fresh'))!
    const result = await postCreate({
      payload,
      user: fresh,
      space: community.id,
      kind: 'discussion',
      body: 'No consent',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('consent')
    await consentAccept({ payload, user: fresh })
    const { docs: freshConsents } = await payload.find({
      collection: 'space-consents',
      where: { account: { equals: fresh.id } },
      overrideAccess: true,
    })
    for (const fc of freshConsents) track('space-consents', fc.id)
    const result2 = await postCreate({
      payload,
      user: fresh,
      space: community.id,
      kind: 'discussion',
      body: 'With consent',
    })
    expect(result2.ok).toBe(true)
    if (result2.ok) track('space-posts', result2.data.id)
  })

  it('mention validation rejects non-members', async () => {
    const result = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'discussion',
      body: 'Hi [@X](/people/999999)',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('mention')
  })

  it('a comment mentions the person by id, so two members with one name stay apart; notification links use the real space path', async () => {
    const twin = async (email: string) => {
      const person = await payload.create({
        collection: 'people',
        data: { name: 'Probe Twin', slug: `probe-twin-${email}` },
        overrideAccess: true,
      })
      track('people', person.id)
      const account = (await payload.create({
        collection: 'users',
        data: {
          email: `probe-twin-${email}@probe.cilas`,
          password: 'probe-probe',
          roles: ['member'],
          person: person.id,
        },
        overrideAccess: true,
      })) as unknown as User
      track('users', account.id)
      return { person: person.id, account }
    }
    const a = await twin('a')
    const b = await twin('b')
    const enrol = async (person: number) => {
      const row = await payload.create({
        collection: 'enrollments',
        data: { course: course.id, person, status: 'confirmed' } as never,
        overrideAccess: true,
      })
      track('enrollments', row.id as number)
    }
    await enrol(a.person)
    await enrol(b.person)

    const post = await postCreate({
      payload,
      user: student,
      space: courseSpace.id,
      kind: 'discussion',
      body: 'QA twins',
    })
    expect(post.ok).toBe(true)
    if (!post.ok) return
    track('space-posts', post.data.id)

    const comment = await commentCreate({
      payload,
      user: student,
      post: post.data.id,
      body: `Hello [@Probe Twin](/people/${b.person})`,
    })
    expect(comment.ok).toBe(true)
    if (!comment.ok) return
    track('space-comments', comment.data.id)
    await comment.notify?.()

    const notesOf = async (account: User) =>
      (
        await payload.find({
          collection: 'notifications',
          where: { recipient: { equals: account.id }, kind: { equals: 'mention' } },
          overrideAccess: true,
          depth: 0,
        })
      ).docs
    expect(await notesOf(a.account)).toHaveLength(0)
    const forB = await notesOf(b.account)
    expect(forB).toHaveLength(1)
    expect(forB[0]!.link).toBe(`/spaces/course/probe-space-course/posts/${post.data.id}`)

    const community_ = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'discussion',
      body: 'QA community link',
    })
    expect(community_.ok).toBe(true)
    if (!community_.ok) return
    track('space-posts', community_.data.id)
    expect(await spaceLink(payload, community, community_.data.id)).toBe(
      `/spaces/community/${community.id}/posts/${community_.data.id}`,
    )
    expect(await spaceLink(payload, cohortSpace, 7)).toBe('/spaces/cohort/probe-bridge/posts/7')
    for (const account of [a.account, b.account]) {
      const rows = await payload.find({
        collection: 'notifications',
        where: { recipient: { equals: account.id } },
        overrideAccess: true,
        depth: 0,
      })
      for (const row of rows.docs) track('notifications', row.id)
    }
  })

  it('reactionToggle twice returns duplicate', async () => {
    const post = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'discussion',
      body: 'React to this',
    })
    expect(post.ok).toBe(true)
    if (!post.ok) return
    track('space-posts', post.data.id)
    await consentAccept({ payload, user: fellow })
    const r1 = await reactionToggle({
      payload,
      user: fellow,
      post: post.data.id,
      reaction: 'agree',
      on: true,
    })
    expect(r1.ok).toBe(true)
    const r2 = await reactionToggle({
      payload,
      user: fellow,
      post: post.data.id,
      reaction: 'agree',
      on: true,
    })
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error).toBe('duplicate')
    const r3 = await reactionToggle({
      payload,
      user: fellow,
      post: post.data.id,
      reaction: 'agree',
      on: false,
    })
    expect(r3.ok).toBe(true)
    if (r3.ok) expect(r3.data.removed).toBe(true)
  })

  it('fileAdd enforces count limit', async () => {
    const post = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'discussion',
      body: 'Files',
    })
    expect(post.ok).toBe(true)
    if (!post.ok) return
    track('space-posts', post.data.id)
    // Seed the five-row cap at the table: going through fileAdd would move
    // bytes to the real bucket, which no test may do. The refusal itself is
    // the product behavior (the gate fires before any storage work).
    await (
      payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }
    ).drizzle.execute(
      sql`insert into space_files (filename, space_id, post_id, url, mime_type, filesize) select 'probe-f' || g || '.pdf', ${courseSpace.id}, ${post.data.id}, '/probe/' || g || '.pdf', 'application/pdf', 5 from generate_series(1, 5) g`,
    )
    const pdf = Buffer.from('%PDF-1.4\n')
    const r = await fileAdd({
      payload,
      user: student,
      post: post.data.id,
      file: { data: pdf, mimetype: 'application/pdf', name: 'f6.pdf', size: 9 },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('file-count')
  })

  it('fileAdd enforces size and type', async () => {
    const post = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'discussion',
      body: 'Big file',
    })
    expect(post.ok).toBe(true)
    if (!post.ok) return
    track('space-posts', post.data.id)
    const buf = Buffer.alloc(11 * 1024 * 1024)
    const rSize = await fileAdd({
      payload,
      user: student,
      post: post.data.id,
      file: { data: buf, mimetype: 'application/pdf', name: 'big.pdf', size: 11 * 1024 * 1024 },
    })
    expect(rSize.ok).toBe(false)
    if (!rSize.ok) expect(rSize.error).toBe('file-size')
    const rType = await fileAdd({
      payload,
      user: student,
      post: post.data.id,
      file: { data: Buffer.from('x'), mimetype: 'video/mp4', name: 'v.mp4', size: 5 },
    })
    expect(rType.ok).toBe(false)
    if (!rType.ok) expect(rType.error).toBe('file-type')
  })

  it('postEdit by author passes, by stranger refuses', async () => {
    const post = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'discussion',
      body: 'Edit me',
    })
    expect(post.ok).toBe(true)
    if (!post.ok) return
    track('space-posts', post.data.id)
    const strangerResult = await postEdit({
      payload,
      user: stranger,
      id: post.data.id,
      body: 'Hacked',
    })
    expect(strangerResult.ok).toBe(false)
    if (!strangerResult.ok) expect(strangerResult.error).toBe('not-yours')
    const authorResult = await postEdit({
      payload,
      user: student,
      id: post.data.id,
      body: 'Edited',
    })
    expect(authorResult.ok).toBe(true)
  })

  it('postRemove leaves placeholder when replies exist', async () => {
    const post = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'discussion',
      body: 'Remove me',
    })
    expect(post.ok).toBe(true)
    if (!post.ok) return
    track('space-posts', post.data.id)
    await consentAccept({ payload, user: fellow })
    const comment = await commentCreate({
      payload,
      user: fellow,
      post: post.data.id,
      body: 'A reply',
    })
    expect(comment.ok).toBe(true)
    if (comment.ok) track('space-comments', comment.data.id)
    const removeResult = await postRemove({ payload, user: student, id: post.data.id })
    expect(removeResult.ok).toBe(true)
    const updated = await payload.findByID({
      collection: 'space-posts',
      id: post.data.id,
      overrideAccess: true,
    })
    expect((updated as { deleted_at: string | null }).deleted_at).toBeTruthy()
  })

  it('commentCreate on locked post refuses', async () => {
    const post = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'discussion',
      body: 'Locked post',
    })
    expect(post.ok).toBe(true)
    if (!post.ok) return
    track('space-posts', post.data.id)
    await postModify({
      payload,
      user: { id: -2, roles: ['admin'], person: null, collection: 'users' } as unknown as User,
      id: post.data.id,
      locked: true,
    })
    await consentAccept({ payload, user: fellow })
    const comment = await commentCreate({
      payload,
      user: fellow,
      post: post.data.id,
      body: 'Comment on locked',
    })
    expect(comment.ok).toBe(false)
    if (!comment.ok) expect(comment.error).toBe('locked')
  })

  it('comment depth enforced', async () => {
    const post = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'discussion',
      body: 'Deep thread',
    })
    expect(post.ok).toBe(true)
    if (!post.ok) return
    track('space-posts', post.data.id)
    await consentAccept({ payload, user: fellow })
    const c1 = await commentCreate({ payload, user: fellow, post: post.data.id, body: 'Level 1' })
    expect(c1.ok).toBe(true)
    if (!c1.ok) return
    track('space-comments', c1.data.id)
    const c2 = await commentCreate({
      payload,
      user: student,
      post: post.data.id,
      parent: c1.data.id,
      body: 'Level 2',
    })
    expect(c2.ok).toBe(true)
    if (!c2.ok) return
    track('space-comments', c2.data.id)
    const c3 = await commentCreate({
      payload,
      user: fellow,
      post: post.data.id,
      parent: c2.data.id,
      body: 'Level 3',
    })
    expect(c3.ok).toBe(false)
    if (!c3.ok) expect(c3.error).toBe('depth')
  })

  it('REST delete on space-files refused for non-admin', async () => {
    // Just verify the collection's delete access returns false for non-admin
    const access = (await import('@/collections/SpaceFiles')).SpaceFiles.access?.delete
    if (access) {
      const result = await (access as (args: { req: { user: User } }) => boolean | object)({
        req: { user: student },
      })
      expect(result).toBe(false)
    }
  })

  const pdf = (name: string) => ({
    data: Buffer.from('%PDF-1.4\n'),
    mimetype: 'application/pdf',
    name,
    size: 9,
  })

  const newPost = async (user: User, space: Space, body: string) => {
    const r = await postCreate({ payload, user, space: space.id, kind: 'discussion', body })
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('post fixture failed')
    track('space-posts', r.data.id)
    return r.data.id
  }

  it('a file that storage refuses gives the upload error and leaves no post, comment or file behind', async () => {
    const postId = await newPost(student, community, 'Upload refused')
    const real = payload.create.bind(payload)
    const stored: number[] = []
    const spy = vi.spyOn(payload, 'create').mockImplementation((async (args: {
      collection: string
    }) => {
      if (args.collection !== 'space-files') return real(args as never)
      if (stored.length === 1) throw new Error('storage refused the file')
      stored.push(-1)
      return { id: -1 }
    }) as never)
    try {
      const comment = await commentCreate({
        payload,
        user: student,
        post: postId,
        body: 'QA two files, the second is refused',
        files: [pdf('probe-f1.pdf'), pdf('probe-f2.pdf')],
      })
      expect(comment.ok).toBe(false)
      if (!comment.ok) expect(comment.error).toBe('upload')
    } finally {
      spy.mockRestore()
    }
    const left = await payload.find({
      collection: 'space-comments',
      where: { post: { equals: postId } },
      overrideAccess: true,
      depth: 0,
    })
    expect(left.totalDocs).toBe(0)

    const spy2 = vi.spyOn(payload, 'create').mockImplementation((async (args: {
      collection: string
    }) => {
      if (args.collection === 'space-files') throw new Error('storage refused the file')
      return real(args as never)
    }) as never)
    try {
      const post = await postCreate({
        payload,
        user: student,
        space: community.id,
        kind: 'discussion',
        body: 'QA post whose file is refused',
        files: [pdf('probe-f1.pdf')],
      })
      expect(post.ok).toBe(false)
      if (!post.ok) expect(post.error).toBe('upload')
    } finally {
      spy2.mockRestore()
    }
    const posts = await payload.find({
      collection: 'space-posts',
      where: { body: { equals: 'QA post whose file is refused' } },
      overrideAccess: true,
      depth: 0,
    })
    expect(posts.totalDocs).toBe(0)
  })

  it('the feed puts the post with the newest comment or reply first', async () => {
    const pause = () => new Promise((r) => setTimeout(r, 15))
    const older = await newPost(student, courseSpace, 'Feed order, oldest')
    await pause()
    const middle = await newPost(student, courseSpace, 'Feed order, middle')
    await pause()
    const newest = await newPost(student, courseSpace, 'Feed order, newest')
    const order = async () =>
      (await spaceFeed(payload, student, courseSpace)).rows
        .map((r) => r.post.id)
        .filter((id) => [older, middle, newest].includes(id))
    expect(await order()).toEqual([newest, middle, older])

    await pause()
    const top = await commentCreate({ payload, user: fellow, post: older, body: 'Wakes it up' })
    expect(top.ok).toBe(true)
    if (!top.ok) return
    track('space-comments', top.data.id)
    expect(await order()).toEqual([older, newest, middle])

    await pause()
    const reply = await commentCreate({
      payload,
      user: fellow,
      post: middle,
      body: 'Reply to nobody yet',
    })
    expect(reply.ok).toBe(true)
    if (!reply.ok) return
    track('space-comments', reply.data.id)
    await pause()
    const nested = await commentCreate({
      payload,
      user: student,
      post: older,
      parent: top.data.id,
      body: 'A reply moves it back',
    })
    expect(nested.ok).toBe(true)
    if (!nested.ok) return
    track('space-comments', nested.data.id)
    expect(await order()).toEqual([older, middle, newest])
  })

  it('an archived course space refuses every content write, until reopened', async () => {
    const postId = await newPost(student, courseSpace, 'Before the archive')
    const c = await commentCreate({ payload, user: student, post: postId, body: 'Early comment' })
    expect(c.ok).toBe(true)
    if (!c.ok) return
    track('space-comments', c.data.id)

    const ago = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: {
        sessions: [{ order: 1, dates: [{ date: ago, start_time: '18:00', end_time: '20:00' }] }],
      },
      overrideAccess: true,
    })
    const refused = async () => [
      await postCreate({
        payload,
        user: student,
        space: courseSpace.id,
        kind: 'discussion',
        body: 'Late',
      }),
      await commentCreate({ payload, user: student, post: postId, body: 'Late' }),
      await postEdit({ payload, user: student, id: postId, body: 'Edited late' }),
      await commentEdit({ payload, user: student, id: c.data.id, body: 'Edited late' }),
      await fileAdd({ payload, user: student, post: postId, file: pdf('late.pdf') }),
      await reactionToggle({ payload, user: student, post: postId, reaction: 'agree', on: true }),
    ]
    for (const r of await refused()) {
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toBe('read-only')
    }

    await payload.update({
      collection: 'spaces',
      id: courseSpace.id,
      data: { reopened: true },
      overrideAccess: true,
    })
    const reopened = await postEdit({ payload, user: student, id: postId, body: 'Edited again' })
    expect(reopened.ok).toBe(true)

    await payload.update({
      collection: 'spaces',
      id: courseSpace.id,
      data: { reopened: false },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { sessions: [] },
      overrideAccess: true,
    })
  })

  it('space-visits and space-preferences refuse REST create', async () => {
    const { SpaceVisits } = await import('@/collections/SpaceVisits')
    const { SpacePreferences } = await import('@/collections/SpacePreferences')
    for (const col of [SpaceVisits, SpacePreferences]) {
      const create = col.access?.create as (a: { req: { user: User } }) => unknown
      expect(create({ req: { user: student } })).toBe(false)
    }
  })

  it('attachments are counted per post and per comment, then stored on the new row', async () => {
    const tooMany = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'discussion',
      body: 'Six files',
      files: Array.from({ length: 6 }, (_, n) => pdf(`probe-f${n}.pdf`)),
    })
    expect(tooMany.ok).toBe(false)
    if (!tooMany.ok) expect(tooMany.error).toBe('file-count')

    const postId = await newPost(student, community, 'Comment files')
    const elevenOnComment = await commentCreate({
      payload,
      user: student,
      post: postId,
      body: 'Eleven files',
      files: Array.from({ length: 11 }, (_, n) => pdf(`probe-f${n}.pdf`)),
    })
    expect(elevenOnComment.ok).toBe(false)
    if (!elevenOnComment.ok) expect(elevenOnComment.error).toBe('file-count')
    const videoOnComment = await commentCreate({
      payload,
      user: student,
      post: postId,
      body: 'A video',
      files: [{ data: Buffer.from('x'), mimetype: 'video/mp4', name: 'probe-f.mp4', size: 1 }],
    })
    expect(videoOnComment.ok).toBe(false)
    if (!videoOnComment.ok) expect(videoOnComment.error).toBe('file-type')

    // Storage would write to the real bucket, so the space-files create is
    // intercepted; the row it would get is what is under test.
    const real = payload.create.bind(payload)
    const spy = vi
      .spyOn(payload, 'create')
      .mockImplementation((async (args: { collection: string }) =>
        args.collection === 'space-files' ? { id: -1 } : real(args as never)) as never)
    try {
      const withFiles = await postCreate({
        payload,
        user: student,
        space: community.id,
        kind: 'discussion',
        body: 'Has two files',
        files: [pdf('probe-f1.pdf'), pdf('probe-f2.pdf')],
      })
      expect(withFiles.ok).toBe(true)
      if (!withFiles.ok) return
      track('space-posts', withFiles.data.id)
      const comment = await commentCreate({
        payload,
        user: student,
        post: postId,
        body: 'Has ten files',
        files: Array.from({ length: 10 }, (_, n) => pdf(`probe-f${n}.pdf`)),
      })
      expect(comment.ok).toBe(true)
      if (!comment.ok) return
      track('space-comments', comment.data.id)
      const fileCalls = spy.mock.calls
        .map(([a]) => a as unknown as { collection: string; data: Record<string, unknown> })
        .filter((a) => a.collection === 'space-files')
      expect(fileCalls.map((a) => [a.data.post, a.data.comment])).toEqual([
        [withFiles.data.id, null],
        [withFiles.data.id, null],
        ...Array.from({ length: 10 }, () => [null, comment.data.id]),
      ])
    } finally {
      spy.mockRestore()
    }
  })

  it('commentCreate refuses a foreign or missing parent and a tombstoned post', async () => {
    const a = await newPost(student, community, 'Post A')
    const b = await newPost(student, community, 'Post B')
    const onA = await commentCreate({ payload, user: student, post: a, body: 'On A' })
    expect(onA.ok).toBe(true)
    if (!onA.ok) return
    track('space-comments', onA.data.id)

    const foreign = await commentCreate({
      payload,
      user: student,
      post: b,
      parent: onA.data.id,
      body: 'Wrong thread',
    })
    expect(foreign.ok).toBe(false)
    if (!foreign.ok) expect(foreign.error).toBe('not-found')

    const missing = await commentCreate({
      payload,
      user: student,
      post: b,
      parent: 999_999_999,
      body: 'No such parent',
    })
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.error).toBe('not-found')

    // Post A has a reply, so removing it leaves a tombstone.
    expect((await postRemove({ payload, user: student, id: a })).ok).toBe(true)
    const onTomb = await commentCreate({ payload, user: student, post: a, body: 'Late' })
    expect(onTomb.ok).toBe(false)
    if (!onTomb.ok) expect(onTomb.error).toBe('not-found')
    const editTomb = await postEdit({ payload, user: student, id: a, body: 'Edit tomb' })
    expect(editTomb.ok).toBe(false)
  })

  it('commentRemove tombstones a comment that has replies', async () => {
    const postId = await newPost(student, community, 'Thread')
    const top = await commentCreate({ payload, user: student, post: postId, body: 'Top' })
    expect(top.ok).toBe(true)
    if (!top.ok) return
    track('space-comments', top.data.id)
    const reply = await commentCreate({
      payload,
      user: fellow,
      post: postId,
      parent: top.data.id,
      body: 'Reply',
    })
    expect(reply.ok).toBe(true)
    if (reply.ok) track('space-comments', reply.data.id)
    const removed = await commentRemove({ payload, user: student, id: top.data.id })
    expect(removed.ok).toBe(true)
    const row = (await payload.findByID({
      collection: 'space-comments',
      id: top.data.id,
      overrideAccess: true,
    })) as { deleted_at?: string | null; body: string }
    expect(row.deleted_at).toBeTruthy()
  })

  it('roster, visits and checklist marks need membership; unknown steps are refused', async () => {
    const roster = await spaceRoster({ payload, user: stranger, space: courseSpace.id })
    expect(roster.ok).toBe(false)
    if (!roster.ok) expect(roster.error).toBe('not-member')
    const visit = await visitRecord({ payload, user: stranger, space: courseSpace.id })
    expect(visit.ok).toBe(false)
    const mark = await stepMark({
      payload,
      user: student,
      space: community.id,
      step: 'account' as never,
      value: true,
    })
    expect(mark.ok).toBe(false)
  })

  it('a comment shows all its files in order, and says which are images', async () => {
    const postId = await newPost(student, courseSpace, 'Photos in a comment')
    const c = await commentCreate({ payload, user: student, post: postId, body: 'Three files' })
    expect(c.ok).toBe(true)
    if (!c.ok) return
    track('space-comments', c.data.id)
    // Rows straight into the table: storage would write to the real bucket.
    await (
      payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }
    ).drizzle.execute(
      sql`insert into space_files (filename, space_id, comment_id, url, mime_type, filesize, width, height, created_at, updated_at) values
        ('probe-f-a.png', ${courseSpace.id}, ${c.data.id}, '/probe/a.png', 'image/png', 5, 800, 600, now() - interval '2 seconds', now()),
        ('probe-f-b.pdf', ${courseSpace.id}, ${c.data.id}, '/probe/b.pdf', 'application/pdf', 5, null, null, now() - interval '1 second', now()),
        ('probe-f-c.webp', ${courseSpace.id}, ${c.data.id}, '/probe/c.webp', 'image/webp', 5, 300, 400, now(), now())`,
    )
    const view = await postView(payload, student, courseSpace, postId)
    expect(view?.comments[0].files).toMatchObject([
      { name: 'probe-f-a.png', isImage: true, mime: 'image/png', width: 800, height: 600 },
      { name: 'probe-f-b.pdf', isImage: false, mime: 'application/pdf', width: null },
      { name: 'probe-f-c.webp', isImage: true, width: 300, height: 400 },
    ])
    expect(await postView(payload, stranger, courseSpace, postId)).toBeNull()
  })

  it('postView: the thread for members, null for strangers and for another space', async () => {
    const postId = await newPost(student, courseSpace, 'Thread for the post page')
    const top = await commentCreate({ payload, user: student, post: postId, body: 'Top' })
    expect(top.ok).toBe(true)
    if (!top.ok) return
    track('space-comments', top.data.id)
    const reply = await commentCreate({
      payload,
      user: fellow,
      post: postId,
      parent: top.data.id,
      body: `Thanks [@Probe Student](/people/${studentPerson})`,
    })
    expect(reply.ok).toBe(true)
    if (!reply.ok) return
    track('space-comments', reply.data.id)
    const liked = await reactionToggle({
      payload,
      user: student,
      comment: reply.data.id,
      reaction: 'agree',
      on: true,
    })
    expect(liked.ok).toBe(true)
    const { docs: likes } = await payload.find({
      collection: 'space-reactions',
      where: { comment: { equals: reply.data.id } },
      overrideAccess: true,
    })
    for (const r of likes) track('space-reactions', r.id)
    await commentRemove({ payload, user: student, id: top.data.id })

    const view = await postView(payload, student, courseSpace, postId)
    expect(view?.row.post.body).toBe('Thread for the post page')
    expect(view?.row.commentCount).toBe(1)
    expect(view?.comments).toHaveLength(1)
    expect(view?.comments[0]).toMatchObject({ deleted: true, body: '' })
    expect(view?.comments[0].replies).toHaveLength(1)
    expect(view?.comments[0].replies[0]).toMatchObject({
      authorId: fellowPerson,
      reactions: { counts: { agree: 1 }, mine: ['agree'] },
    })

    expect(await postView(payload, stranger, courseSpace, postId)).toBeNull()
    expect(await postView(payload, student, community, postId)).toBeNull()
    expect(await postView(payload, student, courseSpace, 999_999_999)).toBeNull()
  })

  it('postSpace: a post id opens its space for a member, and nothing for a stranger or a missing post', async () => {
    const postId = await newPost(student, courseSpace, 'Opened from its id')
    expect((await postSpace(payload, student, postId))?.id).toBe(courseSpace.id)
    expect(await postSpace(payload, stranger, postId)).toBeNull()
    expect(await postSpace(payload, null, postId)).toBeNull()
    expect(await postSpace(payload, student, 999_999_999)).toBeNull()
  })

  it('fellows_only keeps members to reading; moderators still comment', async () => {
    const postId = await newPost(fellow, courseSpace, 'Moderators only below')
    await payload.update({
      collection: 'spaces',
      id: courseSpace.id,
      data: { posting: 'fellows_only' },
      overrideAccess: true,
    })
    try {
      const member = await commentCreate({ payload, user: student, post: postId, body: 'Hi' })
      expect(member.ok).toBe(false)
      if (!member.ok) expect(member.error).toBe('posting-level')
      const moderator = await commentCreate({ payload, user: fellow, post: postId, body: 'Hi' })
      expect(moderator.ok).toBe(true)
      if (moderator.ok) track('space-comments', moderator.data.id)
    } finally {
      await payload.update({
        collection: 'spaces',
        id: courseSpace.id,
        data: { posting: 'open' },
        overrideAccess: true,
      })
    }
  })

  it('an event needs a place and a start that has not passed; the space may keep events to moderators', async () => {
    const soon = new Date(Date.now() + 86_400_000).toISOString()
    const event = (location: string, startsAt: string, user = student) =>
      postCreate({
        payload,
        user,
        space: courseSpace.id,
        kind: 'event',
        body: 'Probe event',
        event: { location, startsAt },
      })
    expect(await event('', soon)).toMatchObject({ ok: false, error: 'event' })
    expect(await event('Room 2', '2020-01-01T10:00:00Z')).toMatchObject({
      ok: false,
      error: 'event',
    })
    expect(await event('Room 2', 'not a date')).toMatchObject({ ok: false, error: 'event' })

    const made = await event('  Room 2  ', soon)
    expect(made.ok).toBe(true)
    if (!made.ok) return
    track('space-posts', made.data.id)
    const row = await payload.findByID({
      collection: 'space-posts',
      id: made.data.id,
      overrideAccess: true,
    })
    expect(row.kind).toBe('event')
    expect(row.event_location).toBe('Room 2')
    expect(new Date(row.event_starts_at!).toISOString()).toBe(soon)

    // Moderators only: the member is refused, the course's fellow is not.
    expect(
      (
        await spaceSettingsSet({
          payload,
          user: student,
          space: courseSpace.id,
          events: 'moderators',
        })
      ).ok,
    ).toBe(false)
    expect(
      (
        await spaceSettingsSet({
          payload,
          user: fellow,
          space: courseSpace.id,
          events: 'moderators',
        })
      ).ok,
    ).toBe(true)
    expect(await event('Room 2', soon)).toMatchObject({ ok: false, error: 'events' })
    const byFellow = await event('Room 3', soon, fellow)
    expect(byFellow.ok).toBe(true)
    if (byFellow.ok) track('space-posts', byFellow.data.id)
    await spaceSettingsSet({ payload, user: fellow, space: courseSpace.id, events: 'members' })
  })

  it('a member answers an event once, changes or withdraws it; archive, lock and a past event refuse', async () => {
    const day = 86_400_000
    const starts = new Date(Date.now() + day).toISOString()
    const ends = new Date(Date.now() + day + 2 * 3_600_000).toISOString()
    const make = (event: { location: string; startsAt: string; endsAt?: string | null }) =>
      postCreate({
        payload,
        user: fellow,
        space: courseSpace.id,
        kind: 'event',
        body: 'Probe rsvp event',
        event,
      })
    expect(await make({ location: 'Room 2', startsAt: starts, endsAt: starts })).toMatchObject({
      ok: false,
      error: 'event',
    })
    const made = await make({
      location: 'https://example.org/room',
      startsAt: starts,
      endsAt: ends,
    })
    expect(made.ok).toBe(true)
    if (!made.ok) return
    track('space-posts', made.data.id)
    const post = made.data.id
    const stored = await payload.findByID({ collection: 'space-posts', id: post })
    expect(stored.event_location).toBe('https://example.org/room')
    expect(new Date(stored.event_ends_at!).toISOString()).toBe(ends)

    const answer = async (user: User, status: 'going' | 'maybe' | 'not_going' | null) => {
      const result = await rsvpSet({ payload, user, post, status })
      const { docs } = await payload.find({
        collection: 'space-rsvps',
        where: { post: { equals: post } },
        overrideAccess: true,
        pagination: false,
      })
      for (const r of docs) track('space-rsvps', r.id)
      return { result, docs }
    }
    expect((await answer(student, 'going')).docs).toHaveLength(1)
    // Changing the answer keeps one row; a second member adds another.
    const changed = await answer(student, 'maybe')
    expect(changed.docs).toHaveLength(1)
    expect(changed.docs[0]?.status).toBe('maybe')
    expect((await answer(fellow, 'going')).docs).toHaveLength(2)
    expect((await answer(student, null)).docs).toHaveLength(1)
    expect((await answer(student, null)).result.ok).toBe(true)
    expect((await answer(stranger, 'going')).result).toMatchObject({
      ok: false,
      error: 'not-member',
    })
    expect((await answer(student, 'perhaps' as never)).result).toMatchObject({
      ok: false,
      error: 'rsvp',
    })

    // One query through the reader's access: counts, who is going and the reader's own answer.
    await answer(student, 'going')
    const { upcoming } = await spaceEvents(payload, student, courseSpace.id)
    const item = upcoming.find((e) => e.type === 'post' && e.post.id === post)
    if (item?.type !== 'post') throw new Error('the event post is missing from the tab')
    expect(item.rsvp.counts).toEqual({ going: 2, maybe: 0, not_going: 0 })
    expect(item.rsvp.mine).toBe('going')
    expect(item.rsvp.going).toHaveLength(2)
    const feed = await spaceFeed(payload, student, courseSpace.id)
    expect(feed.rows.find((r) => r.post.id === post)?.rsvp?.counts.going).toBe(2)
    const outsider = await spaceEvents(payload, stranger, courseSpace.id)
    expect(outsider.upcoming.concat(outsider.past)).toHaveLength(0)

    // Time passes: after the end, an answer is refused and the event moves to Past events.
    const later = new Date(Date.now() + 2 * day)
    expect((await rsvpSet({ payload, user: student, post, status: 'maybe' }, later)).ok).toBe(false)
    expect(await rsvpSet({ payload, user: student, post, status: 'maybe' }, later)).toMatchObject({
      error: 'event-over',
    })
    const afterwards = await spaceEvents(payload, student, courseSpace.id, 'en', later)
    expect(afterwards.past.some((e) => e.type === 'post' && e.post.id === post)).toBe(true)
    expect(afterwards.upcoming.some((e) => e.type === 'post' && e.post.id === post)).toBe(false)

    await payload.update({
      collection: 'space-posts',
      id: post,
      data: { locked: true },
      overrideAccess: true,
    })
    expect(await rsvpSet({ payload, user: student, post, status: 'maybe' })).toMatchObject({
      error: 'locked',
    })
    await payload.update({
      collection: 'space-posts',
      id: post,
      data: { locked: false },
      overrideAccess: true,
    })
  })

  it('changing an event notifies those who said going or maybe; the author and moderators may change it', async () => {
    const day = 86_400_000
    const starts = new Date(Date.now() + day).toISOString()
    const made = await postCreate({
      payload,
      user: student,
      space: community.id,
      kind: 'event',
      body: 'Probe change event',
      event: { location: 'Room 2', startsAt: starts },
    })
    expect(made.ok).toBe(true)
    if (!made.ok) return
    track('space-posts', made.data.id)
    const post = made.data.id
    const watcher = (await mkUser('Probe Watcher'))!
    const skeptic = (await mkUser('Probe Skeptic'))!
    for (const [user, status] of [
      [fellow, 'going'],
      [watcher, 'maybe'],
      [skeptic, 'not_going'],
    ] as const) {
      await rsvpSet({ payload, user, post, status })
    }
    const { docs: rows } = await payload.find({
      collection: 'space-rsvps',
      where: { post: { equals: post } },
      overrideAccess: true,
      pagination: false,
    })
    for (const r of rows) track('space-rsvps', r.id)

    const next = new Date(Date.now() + 2 * day).toISOString()
    // A member who is neither the author nor a moderator is refused; an end before the start is refused.
    expect(
      await eventEdit({ payload, user: watcher, id: post, location: 'Room 3', startsAt: next }),
    ).toMatchObject({ ok: false, error: 'not-yours' })
    expect(
      await eventEdit({
        payload,
        user: student,
        id: post,
        location: 'Room 2',
        startsAt: next,
        endsAt: starts,
      }),
    ).toMatchObject({ ok: false, error: 'event' })

    // No change, no notification.
    const same = await eventEdit({
      payload,
      user: student,
      id: post,
      location: 'Room 2',
      startsAt: starts,
    })
    expect(same.ok && same.notify).toBeFalsy()

    const edited = await eventEdit({
      payload,
      user: admin,
      id: post,
      location: 'Room 3',
      startsAt: next,
    })
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    await edited.notify?.()
    const { docs: notes } = await payload.find({
      collection: 'notifications',
      where: { kind: { equals: 'event_changed' } },
      overrideAccess: true,
      pagination: false,
      sort: '-createdAt',
      limit: 20,
    })
    for (const n of notes) track('notifications', n.id)
    const mine = notes.filter((n) => n.link?.endsWith(`/posts/${post}`))
    const recipients = mine.map((n) =>
      typeof n.recipient === 'object' ? n.recipient.id : n.recipient,
    )
    // Going and maybe are told; the one who said no is not.
    expect(recipients.sort()).toEqual([fellow.id, watcher.id].sort())
    const stored = await payload.findByID({ collection: 'space-posts', id: post })
    expect(stored.event_location).toBe('Room 3')
  })

  it('an event has its own name; one edit changes the words, the time and place, or both', async () => {
    const day = 86_400_000
    const starts = new Date(Date.now() + day).toISOString()
    const make = (title: string) =>
      postCreate({
        payload,
        user: student,
        space: community.id,
        kind: 'event',
        body: 'Probe what to bring',
        event: { title, location: 'Room 2', startsAt: starts },
      })
    expect(await make('x'.repeat(101))).toMatchObject({ ok: false, error: 'event' })
    const made = await make('  Probe   reading circle ')
    expect(made.ok).toBe(true)
    if (!made.ok) return
    track('space-posts', made.data.id)
    const post = made.data.id
    const row = () => payload.findByID({ collection: 'space-posts', id: post, depth: 0 })
    expect((await row()).event_title).toBe('Probe reading circle')

    const edit = (
      user: User,
      extra: { title?: string; body?: string; location?: string },
      now?: Date,
    ) =>
      eventEdit(
        {
          payload,
          user,
          id: post,
          location: extra.location ?? 'Room 2',
          startsAt: starts,
          title: extra.title,
          body: extra.body,
        },
        now,
      )
    // New words tell nobody and mark the post edited; a moderator may not reword it.
    const reworded = await edit(student, { title: 'Probe circle', body: 'Probe bring the text' })
    expect(reworded).toMatchObject({ ok: true })
    expect(reworded.ok && reworded.notify).toBeFalsy()
    const after = await row()
    expect(after).toMatchObject({ event_title: 'Probe circle', body: 'Probe bring the text' })
    expect(after.edited_at).toBeTruthy()
    expect(await edit(admin, { title: 'Probe renamed by a moderator' })).toMatchObject({
      ok: false,
      error: 'not-yours',
    })
    expect(await edit(admin, { location: 'Room 4' })).toMatchObject({ ok: true })

    // Once it is over, the words may still be fixed, the place may not move.
    const later = new Date(Date.now() + 2 * day)
    expect(
      await edit(student, { location: 'Room 4', title: 'Probe circle, notes' }, later),
    ).toMatchObject({
      ok: true,
    })
    expect(await edit(student, { location: 'Room 5' }, later)).toMatchObject({
      ok: false,
      error: 'event-over',
    })
  })

  it('an event keeps one cover photo apart from its files, and the place an address names', async () => {
    const starts = new Date(Date.now() + 86_400_000).toISOString()
    const photo = async (background: string) => {
      const data = await sharp({ create: { width: 2400, height: 1600, channels: 3, background } })
        .jpeg()
        .toBuffer()
      return { data, mimetype: 'image/jpeg', name: 'probe-f-cover.jpg', size: data.byteLength }
    }
    const pdf = {
      data: Buffer.from('%PDF-1.4'),
      mimetype: 'application/pdf',
      name: 'probe-f-cover.pdf',
      size: 8,
    }
    const make = (cover: Awaited<ReturnType<typeof photo>> | typeof pdf) =>
      postCreate({
        payload,
        user: student,
        space: community.id,
        kind: 'event',
        body: 'Probe cover event',
        event: { location: 'https://example.org/room', startsAt: starts },
        cover,
      })
    expect(await make(pdf)).toMatchObject({ ok: false, error: 'file-type' })
    const made = await make(await photo('#c03020'))
    expect(made.ok).toBe(true)
    if (!made.ok) return
    track('space-posts', made.data.id)
    const post = made.data.id
    const cover = async () => {
      const row = await payload.findByID({ collection: 'space-posts', id: post, depth: 0 })
      return { id: row.event_cover as number | null, tone: row.event_cover_tone, row }
    }
    const first = await cover()
    expect(first.row.event_place).toBe('Example room')
    expect(first.tone).toMatch(/^#[0-9a-f]{6}$/)
    expect(first.id).toEqual(expect.any(Number))
    track('space-files', first.id!)
    const file = await payload.findByID({ collection: 'space-files', id: first.id! })
    expect(file.post ?? null).toBeNull()
    expect(file.mimeType).toBe('image/webp')
    expect(file.width).toBeLessThanOrEqual(1600)

    // A member reads the cover through the post; it is not one of the post's files.
    const { rows } = await spaceFeed(payload, student, community.id)
    const row = rows.find((r) => r.post.id === post)!
    expect(row.files).toEqual([])
    expect(row.post.event_cover).toMatchObject({ id: first.id, url: expect.any(String) })

    // A new photo replaces the old file and tells nobody; null takes it away.
    const edit = (extra: { cover?: Awaited<ReturnType<typeof photo>> | null }) =>
      eventEdit({
        payload,
        user: student,
        id: post,
        location: 'https://example.org/room',
        startsAt: starts,
        ...extra,
      })
    expect(await edit({ cover: await photo('#20a040') })).toMatchObject({ ok: true })
    const second = await cover()
    track('space-files', second.id!)
    expect(second.id).not.toBe(first.id)
    expect(second.tone).not.toBe(first.tone)
    expect(
      (await payload.count({ collection: 'space-files', where: { id: { equals: first.id } } }))
        .totalDocs,
    ).toBe(0)
    expect(await edit({})).toMatchObject({ ok: true })
    expect((await cover()).id).toBe(second.id)
    expect(await edit({ cover: null })).toMatchObject({ ok: true })
    expect(await cover()).toMatchObject({ id: null, tone: null })
    expect(
      (await payload.count({ collection: 'space-files', where: { id: { equals: second.id } } }))
        .totalDocs,
    ).toBe(0)

    // Removing the post removes its cover.
    expect(await edit({ cover: await photo('#202020') })).toMatchObject({ ok: true })
    const third = (await cover()).id!
    track('space-files', third)
    expect(await postRemove({ payload, user: student, id: post })).toMatchObject({ ok: true })
    expect(
      (await payload.count({ collection: 'space-files', where: { id: { equals: third } } }))
        .totalDocs,
    ).toBe(0)
  })

  it('a moderator attaches a session of the course to an announcement; readers see it through their access', async () => {
    const setCourse = (data: Record<string, unknown>) =>
      payload.update({
        collection: 'courses',
        id: course.id,
        data: { ...data, _status: 'published' } as never,
        overrideAccess: true,
      })
    const updated = await setCourse({
      sessions: [{ session_title: 'Probe one' }, { session_title: 'Probe two' }],
    })
    const [one, two] = (updated.sessions ?? []).map((s) => s.id!)
    expect(one && two).toBeTruthy()

    const post = (
      user: User,
      kind: 'announcement' | 'discussion',
      session: string,
      space = courseSpace.id,
    ) => postCreate({ payload, user, space, kind, body: 'QA probe session', session })

    // A member writes no announcement at all, but may link a discussion to a session of this course.
    expect(await post(student, 'announcement', one!)).toMatchObject({
      ok: false,
      error: 'announcement',
    })
    const memberLinked = await post(student, 'discussion', one!)
    expect(memberLinked.ok).toBe(true)
    if (memberLinked.ok) {
      track('space-posts', memberLinked.data.id)
      const linked = await payload.findByID({
        collection: 'space-posts',
        id: memberLinked.data.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(linked.course_session).toBe(one)
    }
    // Only this course's session, only in its course space, for every kind.
    expect(await post(student, 'discussion', 'not-a-session')).toMatchObject({
      ok: false,
      error: 'session',
    })
    expect(await post(student, 'discussion', one!, community.id)).toMatchObject({
      ok: false,
      error: 'session',
    })
    expect(await post(fellow, 'discussion', 'not-a-session')).toMatchObject({
      ok: false,
      error: 'session',
    })
    expect(await post(fellow, 'announcement', 'not-a-session')).toMatchObject({
      ok: false,
      error: 'session',
    })
    expect(await post(admin, 'announcement', one!, community.id)).toMatchObject({
      ok: false,
      error: 'session',
    })

    const made = await post(fellow, 'announcement', two!)
    expect(made.ok).toBe(true)
    if (!made.ok) return
    track('space-posts', made.data.id)
    const row = await payload.findByID({
      collection: 'space-posts',
      id: made.data.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(row.course_session).toBe(two)

    const sessionFor = async (user: User) =>
      (await spaceFeed(payload, user, courseSpace.id)).rows.find((r) => r.post.id === made.data.id)
        ?.session

    // The course is owner-only: its fellow reads the session, the student may not.
    const shown = await sessionFor(fellow)
    expect(shown).toMatchObject({ state: 'shown', session: two })
    if (shown?.state === 'shown')
      expect(shown.course.sessions?.map((s) => s.session_title)).toEqual(['Probe one', 'Probe two'])
    expect(await sessionFor(student)).toEqual({ state: 'hidden' })
    expect((await postView(payload, student, courseSpace, made.data.id))?.row.session).toEqual({
      state: 'hidden',
    })

    // Live data: a cancelled session shows cancelled; a removed one is gone.
    await setCourse({
      tier: 'community',
      sessions: [
        { id: one, session_title: 'Probe one' },
        { id: two, session_title: 'Probe two', cancelled: true },
      ],
    })
    const cancelled = await sessionFor(student)
    expect(cancelled?.state).toBe('shown')
    if (cancelled?.state === 'shown')
      expect(cancelled.course.sessions?.find((s) => s.id === two)?.cancelled).toBe(true)
    await setCourse({ tier: 'owner', sessions: [{ id: one, session_title: 'Probe one' }] })
    expect(await sessionFor(fellow)).toEqual({ state: 'gone' })
    await setCourse({ sessions: [] })
  })

  it('a schedule change posts one announcement from no author, once, and notifies the members', async () => {
    const setCourse = (data: Record<string, unknown>) =>
      payload.update({
        collection: 'courses',
        id: course.id,
        data: { ...data, _status: 'published' } as never,
        overrideAccess: true,
      })
    const notices = async () =>
      (
        await payload.find({
          collection: 'space-posts',
          where: {
            and: [
              { space: { equals: courseSpace.id } },
              { kind: { equals: 'announcement' } },
              { author: { exists: false } },
              { body: { contains: 'The schedule changed' } },
            ],
          },
          sort: 'createdAt',
          depth: 0,
          pagination: false,
          overrideAccess: true,
        })
      ).docs
    const before = (await notices()).length
    const weeks = await setCourse({
      schedule: {
        start_date: '2031-03-03',
        start_precision: 'day',
        weeks: 3,
        slots: [{ weekday: 'mon', start_time: '18:00', end_time: '20:30' }],
      },
      sessions: [{ session_title: 'Probe one' }, { session_title: 'Probe two' }],
    })
    // Adding the sessions and the schedule is not a change of a session that existed.
    expect((await notices()).length).toBe(before)
    const [one, two] = (weeks.sessions ?? []).map((s) => s.id!)
    const rows = (weeks.sessions ?? []).map((s) => ({ id: s.id!, session_title: s.session_title }))

    // Saving again with nothing different says nothing.
    await setCourse({ sessions: rows })
    expect((await notices()).length).toBe(before)

    // One cancelled session: one announcement that names it, in both languages, tied to the session.
    await setCourse({ sessions: [rows[0]!, { ...rows[1]!, cancelled: true }] })
    const afterCancel = await notices()
    expect(afterCancel.length).toBe(before + 1)
    const cancelPost = afterCancel.at(-1)!
    track('space-posts', cancelPost.id)
    expect(cancelPost.body).toContain('Session 2 (Probe two) is cancelled')
    expect(cancelPost.body).toContain('أُلغيت الجلسة ٢')
    expect(cancelPost.course_session).toBe(two)
    expect(cancelPost.author ?? null).toBeNull()
    const note = await payload.find({
      collection: 'notifications',
      where: {
        and: [
          { recipient: { equals: fellow.id } },
          { link: { contains: `/posts/${cancelPost.id}` } },
        ],
      },
      depth: 0,
      overrideAccess: true,
    })
    expect(note.totalDocs).toBe(1)
    for (const row of note.docs) track('notifications', row.id)

    // Bringing it back and moving the other in one save: one announcement for both.
    await setCourse({
      sessions: [
        { ...rows[0]!, dates: [{ date: '2031-03-12', start_time: '17:00', end_time: '19:00' }] },
        { ...rows[1]!, cancelled: false },
      ],
    })
    const afterTwo = await notices()
    expect(afterTwo.length).toBe(before + 2)
    const both = afterTwo.at(-1)!
    track('space-posts', both.id)
    expect(both.body).toContain('Session 2 (Probe two) is back on')
    expect(both.body).toContain('Session 1 (Probe one) moved from')
    expect(both.body).toContain('17:00–19:00')
    expect(both.course_session ?? null).toBeNull()

    // An unpublished draft of the course never posts.
    await payload.update({
      collection: 'courses',
      id: course.id,
      draft: true,
      data: { sessions: [rows[0]!, { ...rows[1]!, cancelled: true }] } as never,
      overrideAccess: true,
    })
    expect((await notices()).length).toBe(before + 2)
    // Publishing that draft is the save that changes the course, so it posts once.
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: { _status: 'published' } as never,
      overrideAccess: true,
    })
    const afterPublish = await notices()
    expect(afterPublish.length).toBe(before + 3)
    track('space-posts', afterPublish.at(-1)!.id)
    await setCourse({ sessions: [] })
  })

  it("a course space's Events tab shows the course's public events with its own, by start time, and no others", async () => {
    const mk = (data: Record<string, unknown>) =>
      payload.create({
        collection: 'events',
        data: {
          event_type: 'talk',
          slug: `probe-${Math.random().toString(36).slice(2, 8)}`,
          ...data,
        } as never,
        overrideAccess: true,
      })
    const schedule = (day: string) => ({
      start_date: day,
      start_precision: 'day',
      weeks: 1,
      slots: [{ weekday: 'sat', start_time: '18:00', end_time: '19:30' }],
    })
    const mine = await mk({
      title: 'Probe public talk',
      tier: 'public',
      course: course.id,
      schedule: schedule('2031-06-07'),
    })
    const members = await mk({
      title: 'Probe members talk',
      tier: 'community',
      course: course.id,
      schedule: schedule('2031-06-14'),
    })
    const other = await mk({
      title: 'Probe other talk',
      tier: 'public',
      schedule: schedule('2031-06-21'),
    })
    for (const e of [mine, members, other]) track('events', e.id)

    const { upcoming } = await spaceEvents(
      payload,
      student,
      courseSpace,
      'en',
      new Date('2031-01-01'),
    )
    const titles = upcoming.flatMap((e) => (e.type === 'public' ? [e.title] : []))
    expect(titles).toEqual(['Probe public talk'])
    const row = upcoming.find((e) => e.type === 'public')!
    expect(row.startsAt).toMatch(/^2031-06-07T1[56]:00:00/)
    expect(row.endsAt).toMatch(/^2031-06-07T1[67]:30:00/)

    // After its day it moves to the past group; the community space has none of them.
    const later = await spaceEvents(payload, student, courseSpace, 'en', new Date('2031-07-01'))
    expect(later.past.some((e) => e.type === 'public')).toBe(true)
    const none = await spaceEvents(payload, student, community, 'en', new Date('2031-01-01'))
    expect(none.upcoming.some((e) => e.type === 'public')).toBe(false)
  })

  it('a moderator sets the About text per language and resets it; a member cannot', async () => {
    const aboutOf = async (locale: 'en' | 'ar') =>
      (
        await payload.findByID({
          collection: 'spaces',
          id: courseSpace.id,
          locale,
          fallbackLocale: false,
          overrideAccess: true,
        })
      ).about ?? null
    expect(
      await spaceSettingsSet({ payload, user: student, space: courseSpace.id, about: 'Nope' }),
    ).toMatchObject({ ok: false, error: 'not-yours' })
    expect(
      (
        await spaceSettingsSet({
          payload,
          user: fellow,
          space: courseSpace.id,
          about: '  Probe about\nsecond line ',
          locale: 'en',
        })
      ).ok,
    ).toBe(true)
    expect(await aboutOf('en')).toBe('Probe about\nsecond line')
    expect(await aboutOf('ar')).toBeNull()
    expect(
      await spaceSettingsSet({
        payload,
        user: fellow,
        space: courseSpace.id,
        about: 'x'.repeat(ABOUT_MAX + 1),
      }),
    ).toMatchObject({ ok: false, error: 'about' })
    await spaceSettingsSet({
      payload,
      user: fellow,
      space: courseSpace.id,
      about: '',
      locale: 'en',
    })
    expect(await aboutOf('en')).toBe('')
  })

  it("a vote needs two to ten distinct options; voteSet replaces the member's whole choice", async () => {
    const vote = (options: string[], multiple = false, anonymous = false) =>
      postCreate({
        payload,
        user: student,
        space: courseSpace.id,
        kind: 'vote',
        body: 'Probe vote',
        vote: { options, multiple, anonymous },
      })
    expect(await vote(['Only one'])).toMatchObject({ ok: false, error: 'vote' })
    expect(await vote(['Same', ' same '])).toMatchObject({ ok: false, error: 'vote' })
    expect(await vote(Array.from({ length: 11 }, (_, i) => `Option ${i}`))).toMatchObject({
      ok: false,
      error: 'vote',
    })

    const single = await vote(['Tuesday', 'Thursday'])
    expect(single.ok).toBe(true)
    if (!single.ok) return
    track('space-posts', single.data.id)
    const post = await payload.findByID({
      collection: 'space-posts',
      id: single.data.id,
      overrideAccess: true,
    })
    const [tue, thu] = (post.vote_options ?? []).map((o) => o.id!)
    const held = async (user: User) =>
      (
        await payload.find({
          collection: 'space-votes',
          where: { and: [{ account: { equals: user.id } }, { post: { equals: single.data.id } }] },
          overrideAccess: true,
        })
      ).docs.map((d) => d.option)

    // One choice at a time; a second call moves the vote; a repeat changes nothing.
    expect(
      await voteSet({ payload, user: student, post: single.data.id, options: [tue!, thu!] }),
    ).toMatchObject({ ok: false, error: 'vote' })
    expect(
      (await voteSet({ payload, user: student, post: single.data.id, options: [tue!] })).ok,
    ).toBe(true)
    expect(
      (await voteSet({ payload, user: student, post: single.data.id, options: [thu!] })).ok,
    ).toBe(true)
    expect(
      (await voteSet({ payload, user: student, post: single.data.id, options: [thu!] })).ok,
    ).toBe(true)
    expect(await held(student)).toEqual([thu])
    expect(
      await voteSet({ payload, user: student, post: single.data.id, options: ['nope'] }),
    ).toMatchObject({ ok: false, error: 'vote' })
    expect(
      await voteSet({ payload, user: stranger, post: single.data.id, options: [tue!] }),
    ).toMatchObject({ ok: false, error: 'not-member' })
    // An empty choice withdraws the vote.
    expect((await voteSet({ payload, user: student, post: single.data.id, options: [] })).ok).toBe(
      true,
    )
    expect(await held(student)).toEqual([])

    const multiple = await vote(['Tea', 'Coffee', 'Water'], true)
    expect(multiple.ok).toBe(true)
    if (!multiple.ok) return
    track('space-posts', multiple.data.id)
    const ids = (
      (
        await payload.findByID({
          collection: 'space-posts',
          id: multiple.data.id,
          overrideAccess: true,
        })
      ).vote_options ?? []
    ).map((o) => o.id!)
    expect(
      (
        await voteSet({
          payload,
          user: fellow,
          post: multiple.data.id,
          options: [ids[0]!, ids[2]!],
        })
      ).ok,
    ).toBe(true)
    const rows = await payload.find({
      collection: 'space-votes',
      where: { post: { equals: multiple.data.id } },
      overrideAccess: true,
    })
    for (const r of rows.docs) track('space-votes', r.id)
    expect(rows.docs.map((r) => r.option).sort()).toEqual([ids[0], ids[2]].sort())
    // The page reads counts and distinct voters; only the reader's own choice is named.
    await voteSet({ payload, user: student, post: multiple.data.id, options: [ids[0]!] })
    for (const r of (
      await payload.find({
        collection: 'space-votes',
        where: { post: { equals: multiple.data.id } },
        overrideAccess: true,
      })
    ).docs)
      track('space-votes', r.id)
    const seen = await postView(payload, student, courseSpace, multiple.data.id)
    const named = (personId: number) => ({
      personId,
      name: expect.any(String),
      photo: null,
    })
    expect(seen?.row.vote).toEqual({
      multiple: true,
      anonymous: false,
      options: [
        {
          id: ids[0],
          label: 'Tea',
          count: 2,
          voters: expect.arrayContaining([named(fellowPerson), named(studentPerson)]),
        },
        { id: ids[1], label: 'Coffee', count: 0, voters: [] },
        { id: ids[2], label: 'Water', count: 1, voters: [named(fellowPerson)] },
      ],
      voters: 2,
      mine: [ids[0]],
    })
    expect(seen?.row.vote?.options[0]?.voters).toHaveLength(2)

    // An anonymous vote keeps its counts and the reader's own choice, never a voter.
    const secret = await vote(['Yes', 'No'], false, true)
    expect(secret.ok).toBe(true)
    if (secret.ok) {
      track('space-posts', secret.data.id)
      const yes = (
        (
          await payload.findByID({
            collection: 'space-posts',
            id: secret.data.id,
            overrideAccess: true,
          })
        ).vote_options ?? []
      ).map((o) => o.id!)
      await voteSet({ payload, user: fellow, post: secret.data.id, options: [yes[0]!] })
      await voteSet({ payload, user: student, post: secret.data.id, options: [yes[1]!] })
      for (const r of (
        await payload.find({
          collection: 'space-votes',
          where: { post: { equals: secret.data.id } },
          overrideAccess: true,
        })
      ).docs)
        track('space-votes', r.id)
      const hidden = await postView(payload, student, courseSpace, secret.data.id)
      expect(hidden?.row.vote).toEqual({
        multiple: false,
        anonymous: true,
        options: [
          { id: yes[0], label: 'Yes', count: 1, voters: [] },
          { id: yes[1], label: 'No', count: 1, voters: [] },
        ],
        voters: 2,
        mine: [yes[1]],
      })
      expect(JSON.stringify(hidden?.row.vote)).not.toContain(String(fellowPerson) + ',')
      // The API read hides other people's rows too; each voter still sees their own.
      const asStudent = await payload.find({
        collection: 'space-votes',
        user: student,
        overrideAccess: false,
        where: { post: { equals: secret.data.id } },
      })
      expect(asStudent.docs.map((r) => r.option)).toEqual([yes[1]])
    }

    // A locked vote takes no more choices; a discussion is not a vote.
    await postModify({ payload, user: fellow, id: multiple.data.id, locked: true })
    expect(
      await voteSet({ payload, user: fellow, post: multiple.data.id, options: [ids[1]!] }),
    ).toMatchObject({ ok: false, error: 'locked' })
    const plain = await postCreate({
      payload,
      user: student,
      space: courseSpace.id,
      kind: 'discussion',
      body: 'Probe plain',
    })
    if (plain.ok) {
      track('space-posts', plain.data.id)
      expect(
        await voteSet({ payload, user: student, post: plain.data.id, options: [] }),
      ).toMatchObject({ ok: false, error: 'not-found' })
    }
  })
  it('keeps a community space to its audience', async () => {
    const make = async (audience: 'all' | 'fellows' | 'admins', name: string) => {
      const row = (await payload.create({
        collection: 'spaces',
        data: { kind: 'community', audience, name },
        overrideAccess: true,
      })) as unknown as Space
      track('spaces', row.id)
      return row
    }
    const fellows = await make('fellows', 'Probe fellows hall')
    const admins = await make('admins', 'Probe admin room')
    const everyone = await make('all', 'Probe tech community')

    const post = (user: User, space: Space) =>
      postCreate({ payload, user, space: space.id, kind: 'discussion', body: 'Probe audience' })
    const created: number[] = []
    const note = (r: Awaited<ReturnType<typeof post>>) => {
      if (r.ok) {
        track('space-posts', r.data.id)
        created.push(r.data.id)
      }
      return r
    }

    // Writing follows membership: fellows and admins in, a plain student out.
    expect(note(await post(fellow, fellows)).ok).toBe(true)
    expect(note(await post(admin, fellows)).ok).toBe(true)
    expect(await post(student, fellows)).toMatchObject({ ok: false, error: 'not-member' })
    expect(await post(stranger, fellows)).toMatchObject({ ok: false, error: 'not-member' })
    expect(note(await post(admin, admins)).ok).toBe(true)
    expect(await post(fellow, admins)).toMatchObject({ ok: false, error: 'not-member' })
    expect(note(await post(student, everyone)).ok).toBe(true)

    // Reading follows it too: the space row is hidden from outsiders.
    const readable = async (user: User) =>
      (
        await payload.find({
          collection: 'spaces',
          user,
          overrideAccess: false,
          where: { kind: { equals: 'community' } },
          pagination: false,
        })
      ).docs.map((d) => d.id)
    expect(await readable(fellow)).toEqual(expect.arrayContaining([fellows.id, everyone.id]))
    expect(await readable(fellow)).not.toContain(admins.id)
    expect(await readable(student)).toContain(everyone.id)
    expect(await readable(student)).not.toContain(fellows.id)
    expect(await readable(student)).not.toContain(admins.id)
    expect(await readable(admin)).toEqual(
      expect.arrayContaining([fellows.id, admins.id, everyone.id]),
    )

    // My spaces lists only the spaces the reader may open, with the admin's name.
    const mine = await mySpaces(payload, student, 'en')
    expect(mine.communities.map((c) => c.title)).toContain('Probe tech community')
    expect(mine.communities.map((c) => c.title)).not.toContain('Probe fellows hall')
    const fellowMine = await mySpaces(payload, fellow, 'en')
    expect(fellowMine.communities.find((c) => c.space.id === fellows.id)?.href).toBe(
      `/en/spaces/community/${fellows.id}`,
    )

    // Mentions and notification recipients draw on the same audience.
    const fellowSet = await mentionSafelist(payload, fellows.id)
    expect(fellowSet.has(fellowPerson)).toBe(true)
    expect(fellowSet.has(studentPerson)).toBe(false)
    const adminSet = await mentionSafelist(payload, admins.id)
    expect(adminSet.has(personOf(admin)!)).toBe(true)
    expect(adminSet.has(fellowPerson)).toBe(false)
    expect((await mentionSafelist(payload, everyone.id)).has(studentPerson)).toBe(true)

    // A course space takes no custom name or audience.
    const renamed = await payload.update({
      collection: 'spaces',
      id: courseSpace.id,
      data: { name: 'Probe not allowed', audience: 'admins' },
      overrideAccess: true,
    })
    expect(renamed.name).toBeFalsy()
    expect(renamed.audience).toBe('all')
  })
})
