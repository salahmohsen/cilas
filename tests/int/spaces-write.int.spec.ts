// @vitest-environment node
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

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
} from '@/lib/spaces-write'
import { personOf } from '@/access'
import { postView } from '@/lib/spaces-data'

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
    ).drizzle.execute(sql`delete from space_files where filename like 'probe-f%.pdf'`)
    for (const collection of [
      'space-votes',
      'space-reactions',
      'space-files',
      'space-preferences',
      'space-visits',
      'space-consents',
      'space-comments',
      'space-posts',
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
    const twoOnComment = await commentCreate({
      payload,
      user: student,
      post: postId,
      body: 'Two files',
      files: [pdf('probe-f1.pdf'), pdf('probe-f2.pdf')],
    })
    expect(twoOnComment.ok).toBe(false)
    if (!twoOnComment.ok) expect(twoOnComment.error).toBe('file-count')

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
        body: 'Has one file',
        files: [pdf('probe-f3.pdf')],
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
        [null, comment.data.id],
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

  it("a vote needs two to ten distinct options; voteSet replaces the member's whole choice", async () => {
    const vote = (options: string[], multiple = false) =>
      postCreate({
        payload,
        user: student,
        space: courseSpace.id,
        kind: 'vote',
        body: 'Probe vote',
        vote: { options, multiple },
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
})
