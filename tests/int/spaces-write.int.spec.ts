// @vitest-environment node
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Space, User } from '@/payload-types'
import {
  postCreate,
  postEdit,
  postRemove,
  postModify,
  commentCreate,
  fileAdd,
  reactionToggle,
  consentAccept,
} from '@/lib/spaces-write'
import { personOf } from '@/access'

let payload: Payload
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
      data: { spaces_mode: 'off' },
      overrideAccess: true,
    })
    await (
      payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }
    ).drizzle.execute(sql`delete from space_files where filename like 'probe-f%.pdf'`)
    for (const collection of [
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
})
