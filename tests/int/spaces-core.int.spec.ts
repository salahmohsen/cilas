// @vitest-environment node
import { getPayload, type Payload, type Where } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { personOf } from '@/access'
import { membership, readableWhere, writePostWhere } from '@/lib/spaces'
import { mySpaces, participation, spaceFeed, spaceLanding } from '@/lib/spaces-data'
import config from '@/payload.config'
import type { Space, User } from '@/payload-types'

const tracked = new Map<string, number[]>() // collection -> ids made here
// A leaked row from a failed run never collides with the next run's fixtures.
const run = Date.now().toString(36)

const track = (collection: string, id: number) => {
  const list = tracked.get(collection) ?? []
  list.push(id)
  tracked.set(collection, list)
}

describe('spaces core', () => {
  let payload: Payload
  let modeBefore: 'off' | 'trial' | 'on' = 'off'
  let fellow: User
  let student: User
  let stranger: User
  let community: Space
  let course: { id: number }
  let courseSpace: Space
  let programmeId: number
  let cohortSpace: Space

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    modeBefore =
      (
        (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })) as {
          spaces_mode?: 'off' | 'trial' | 'on'
        }
      ).spaces_mode ?? 'off'
    // People and accounts: the fellow teaches, the student is enrolled,
    // the stranger is a member of nothing.
    const mk = async (name: string, person: Record<string, unknown>) => {
      const p = await payload.create({
        collection: 'people',
        data: { name, slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${run}`, ...person },
        overrideAccess: true,
      })
      track('people', p.id)
      const u = await payload.create({
        collection: 'users',
        data: {
          email: `${name.toLowerCase().replace(/\s+/g, '-')}-${run}@cilas.test`,
          password: 'probe-probe',
          roles: ['member'],
          person: p.id,
        },
        overrideAccess: true,
      })
      track('users', u.id)
      return u as unknown as User
    }
    fellow = (await mk('Probe Fellow', { name: 'Probe Fellow' }))!
    student = (await mk('Probe Student', {}))!
    stranger = (await mk('Probe Stranger', {}))!

    // Courses validate against a season's cycle, so the fixture mirrors the
    // working course create in tests/int/teaching.int.spec.ts.
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
      depth: 0,
      data: {
        title: 'Probe Course',
        slug: 'probe-space-course',
        course_type: 'THEMATIC',
        session_unit: 'session',
        tier: 'owner',
        cycle: cycle.id,
        fellows: [personOf(fellow) as number],
        _status: 'published',
      } as never,
      overrideAccess: true,
    })) as unknown as { id: number }
    track('courses', course.id)
    const enrollment = await payload.create({
      collection: 'enrollments',
      data: {
        course: (course as { id: number }).id,
        person: personOf(student) as number,
        status: 'confirmed',
      } as never,
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
      data: { programme: programmeId, person: personOf(student) as number, role: 'student' },
      overrideAccess: true,
    })
    track('memberships', membership.id as number)

    const mkSpace = async (data: Partial<Space>) =>
      payload.create({
        collection: 'spaces',
        data: data as never,
        overrideAccess: true,
      }) as Promise<Space>
    // One community space per site: a seeded database already has it.
    const existing = await payload.find({
      collection: 'spaces',
      where: { kind: { equals: 'community' } },
      depth: 0,
      limit: 1,
      sort: 'id',
      overrideAccess: true,
    })
    if (existing.docs[0]) community = existing.docs[0] as Space
    else {
      community = await mkSpace({ kind: 'community' })
      track('spaces', community.id)
    }
    const { docs: _courseSpaces } = await payload.find({
      collection: 'spaces',
      where: { course: { equals: (course as { id: number }).id } },
      overrideAccess: true,
    })
    courseSpace = _courseSpaces[0] as Space
    track('spaces', courseSpace.id)
    const _courseIntro = (courseSpace as { introduction_post?: { id: number } | number })
      .introduction_post
    if (_courseIntro)
      track('space-posts', typeof _courseIntro === 'object' ? _courseIntro.id : _courseIntro)
    const { docs: _cohortSpaces } = await payload.find({
      collection: 'spaces',
      where: { programme: { equals: programmeId } },
      overrideAccess: true,
    })
    cohortSpace = _cohortSpaces[0] as Space
    track('spaces', cohortSpace.id)
    const _cohortIntro = (cohortSpace as { introduction_post?: { id: number } | number })
      .introduction_post
    if (_cohortIntro)
      track('space-posts', typeof _cohortIntro === 'object' ? _cohortIntro.id : _cohortIntro)
    // Settings: everything on.
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: modeBefore },
      overrideAccess: true,
    })
    // Children delete before parents: Payload's required-relation FKs
    // restrict, so a parent deleted first leaks the row silently otherwise.
    for (const collection of [
      'space-posts',
      'space-comments',
      'space-files',
      'space-reactions',
      'space-consents',
      'space-visits',
      'space-preferences',
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
          .catch((i) => console.error(`cleanup ${collection} ${id}`, i))
      }
    }
    await payload.destroy()
  })

  it('the read Where holds the student’s readable spaces', async () => {
    const where = await readableWhere(payload, student, 'id')
    expect(where).toBeTruthy()
    const { docs } = await payload.find({
      collection: 'spaces',
      where: where as never,
      overrideAccess: true,
    })
    expect(docs.map((s) => s.id).sort()).toEqual(
      [community.id, courseSpace.id, cohortSpace.id].sort(),
    )
  })

  it('gives the student the course and cohort and community spaces, and the stranger only the community', async () => {
    // Read through access rules, as each user does on the site.
    const view = (user: User) =>
      payload.find({ collection: 'spaces', user, overrideAccess: false, depth: 0 })
    const seen = (await view(student)).docs.map((s) => s.id).sort()
    expect(seen).toEqual([community.id, courseSpace.id, cohortSpace.id].sort())
    expect((await view(stranger)).docs.map((s) => s.id)).toEqual([community.id])
    // Admins read everything; not listed as members.
    expect((await view(fellow)).docs.map((s) => s.id)).toContain(courseSpace.id)
  })

  it('the write floor is a Where over readable spaces', async () => {
    const floor = await writePostWhere(payload, student)
    expect(floor).not.toBe(false)

    const refuse = (user: User) =>
      payload.create({
        collection: 'space-posts',
        user,
        overrideAccess: false,
        data: { space: community.id, kind: 'discussion', body: 'x' } as never,
      })
    // REST refusal (plan decision): members never create rows through the
    // collection surface — the write actions (Task 8, overrideAccess) are
    // the member path. Admins may; their route is what stays permitted.
    await expect(refuse(stranger)).rejects.toThrow()
  })

  it('Trial opens only the pilot courses/cohorts plus the community (spec §10)', async () => {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: {
        spaces_mode: 'trial',
        spaces_trial_community: true,
        spaces_trial_courses: [course.id],
      },
      overrideAccess: true,
    })
    const trial = async () =>
      payload
        .find({ collection: 'spaces', user: student, overrideAccess: false, depth: 0 })
        .then((r) => r.docs.map((s) => s.id).sort())
    expect(await trial()).toEqual([community.id, courseSpace.id].sort())
    // The same cohort space, with trial list empty: closed.
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_trial_courses: [], spaces_trial_cohorts: [] },
      overrideAccess: true,
    })
    expect(await trial()).toEqual([community.id])
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })
  })

  it('Off yields the same refusal as the access floor for reads and writes', async () => {
    const anon: User = {
      id: -1,
      roles: ['member'],
      person: null,
      collection: 'users',
    } as unknown as User
    const refuse = (user: User) =>
      payload.create({
        collection: 'space-posts',
        user,
        overrideAccess: false,
        data: { space: community.id, kind: 'discussion', body: 'x' } as never,
      })
    await expect(refuse(anon)).rejects.toThrow()
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'off' },
      overrideAccess: true,
    })
    expect(await readableWhere(payload, student, 'id')).toBe(false)
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })
  })

  it('moderators are the course fellows; admins are everywhere, not listed', async () => {
    expect((await membership(payload, fellow, courseSpace)).role).toBe('moderator')
    expect((await membership(payload, student, courseSpace)).role).toBe('member')
    const admin = { id: -2, roles: ['admin'], person: null, collection: 'users' } as unknown as User
    expect((await membership(payload, admin, courseSpace)).role).toBe('moderator')
  })

  it('posts read only in readable spaces', async () => {
    const where = await readableWhere(payload, stranger)
    const { docs } = await payload.find({
      collection: 'space-posts',
      where: where as never,
      overrideAccess: true,
    })
    expect(
      (docs as unknown as Array<{ space: { id: number } }>).every(
        (p) => p.space.id === community.id,
      ),
    ).toBe(true)
  })

  it('a published course owns its space and its intro post', async () => {
    const { docs } = await payload.find({
      collection: 'spaces',
      where: { course: { equals: (course as { id: number }).id } },
      overrideAccess: true,
    })
    expect(docs.length).toBe(1)
    track('spaces', (docs[0] as { id: number }).id)
    const introId = (docs[0] as { introduction_post?: { id: number } | number }).introduction_post
    expect(introId).toBeTruthy()
    const postId = typeof introId === 'object' ? introId.id : introId!
    track('space-posts', postId)
    const post = await payload.findByID({
      collection: 'space-posts',
      id: postId,
      overrideAccess: true,
    })
    expect((post as { body: string }).body).toContain('What question brings you here?')
    expect((post as { author: unknown }).author).toBeNull()
  })

  it('consent is per account and version, unique', async () => {
    const data = {
      account: (student as { id: number }).id,
      version: 1,
      accepted_at: new Date().toISOString(),
    } as never
    const made = await payload.create({ collection: 'space-consents', data, overrideAccess: true })
    track('space-consents', made.id)
    await expect(
      payload.create({ collection: 'space-consents', data, overrideAccess: true }),
    ).rejects.toThrow()
  })

  it('my spaces lists the summaries and counts unread against the visit stamp', async () => {
    // Before any visit row: every non-own post is unread (the intro post).
    const before = await mySpaces(payload, student, 'en')
    expect(before.cohorts.map((s) => s.title)).toEqual(['Probe Bridge'])
    expect(before.cohorts[0]?.href).toBe('/en/spaces/cohort/probe-bridge')
    expect(before.courses.map((s) => s.title)).toEqual(['Probe Course'])
    expect(before.courses[0]?.href).toBe('/en/spaces/course/probe-space-course')
    expect(before.courses[0]?.unread).toBe(1)
    const listed = before.communities.find((c) => c.space.id === community.id)
    expect(listed?.title).toBe('Community')
    expect(listed?.href).toBe(`/en/spaces/community/${community.id}`)

    // The fellow posts an older row; the student posts their own; the visit
    // stamp lands; then a newer fellow row. Only the newer one is unread —
    // rows older than the stamp do not count and own posts never do.
    const older = await payload.create({
      collection: 'space-posts',
      data: {
        space: courseSpace.id,
        kind: 'discussion',
        body: 'older row',
        author: personOf(fellow) as number,
      },
      overrideAccess: true,
    })
    track('space-posts', older.id)
    const studentPost = await payload.create({
      collection: 'space-posts',
      data: {
        space: courseSpace.id,
        kind: 'question',
        body: 'own row',
        author: personOf(student) as number,
      },
      overrideAccess: true,
    })
    track('space-posts', studentPost.id)
    const visit = await payload.create({
      collection: 'space-visits',
      data: {
        account: (student as { id: number }).id,
        space: courseSpace.id,
        last_visited_at: new Date().toISOString(),
      },
      overrideAccess: true,
    })
    track('space-visits', visit.id)
    const newer = await payload.create({
      collection: 'space-posts',
      data: {
        space: courseSpace.id,
        kind: 'discussion',
        body: 'newer row',
        author: personOf(fellow) as number,
      },
      overrideAccess: true,
    })
    track('space-posts', newer.id)
    const after = await mySpaces(payload, student, 'en')
    expect(after.courses[0]?.unread).toBe(1)
    expect(after.courses[0]?.lastActivity).toBeTruthy()
  })

  it('the feed sorts pinned first and rolls up comments and reactions', async () => {
    const older = await payload.find({
      collection: 'space-posts',
      depth: 0,
      overrideAccess: true,
      where: { and: [{ space: { equals: courseSpace.id } }, { body: { equals: 'older row' } }] },
    })
    const newer = await payload.find({
      collection: 'space-posts',
      depth: 0,
      overrideAccess: true,
      where: { and: [{ space: { equals: courseSpace.id } }, { body: { equals: 'newer row' } }] },
    })
    const olderId = (older.docs[0] as { id: number }).id
    const newerId = (newer.docs[0] as { id: number }).id
    const fellowComment = await payload.create({
      collection: 'space-comments',
      data: {
        space: courseSpace.id,
        post: olderId,
        author: personOf(fellow) as number,
        body: 'first reply',
      },
      overrideAccess: true,
    })
    track('space-comments', fellowComment.id)
    const studentComment = await payload.create({
      collection: 'space-comments',
      data: {
        space: courseSpace.id,
        post: olderId,
        author: personOf(student) as number,
        body: 'second reply',
      },
      overrideAccess: true,
    })
    track('space-comments', studentComment.id)
    const myReaction = await payload.create({
      collection: 'space-reactions',
      data: {
        space: courseSpace.id,
        account: (student as { id: number }).id,
        post: olderId,
        reaction: 'agree',
      },
      overrideAccess: true,
    })
    track('space-reactions', myReaction.id)
    const firstReaction = await payload.create({
      collection: 'space-reactions',
      data: {
        space: courseSpace.id,
        account: (fellow as { id: number }).id,
        post: olderId,
        reaction: 'insightful',
      },
      overrideAccess: true,
    })
    track('space-reactions', firstReaction.id)
    const secondReaction = await payload.create({
      collection: 'space-reactions',
      data: {
        space: courseSpace.id,
        account: (fellow as { id: number }).id,
        post: newerId,
        reaction: 'same_question',
      },
      overrideAccess: true,
    })
    track('space-reactions', secondReaction.id)

    // A pinned, authorless row (the CILAS announcement shape). Posted last,
    // so "pinned first" can only come from the sort, not the creation order.
    const pinned = await payload.create({
      collection: 'space-posts',
      data: { space: courseSpace.id, kind: 'announcement', body: 'pinned flag', pinned: true },
      overrideAccess: true,
    })
    track('space-posts', pinned.id)
    // The write path lifts `last_activity_at` on activity (spec §7); the raw
    // fixture stamps it by hand to hold the same order assertion: the
    // discussed row carries the newest activity among unpinned rows.
    await payload.update({
      collection: 'space-posts',
      id: olderId,
      data: { last_activity_at: new Date(Date.now() + 60_000).toISOString() },
      overrideAccess: true,
    })

    const feed = await spaceFeed(payload, student, courseSpace)
    const idxOf = (id: number | undefined) => feed.rows.findIndex((r) => r.post.id === id)
    expect(feed.archived).toBe(false)
    // Pinned leads even though the discussed row's activity is newer; then
    // last activity decides.
    expect(feed.rows[0]?.post.id).toBe(pinned.id)
    expect(idxOf(olderId)).toBe(1)
    expect(idxOf(newerId)).toBeGreaterThan(1)
    const row = feed.rows[idxOf(olderId)]
    expect(row?.commentCount).toBe(2)
    expect(row?.reactions.counts).toEqual({ agree: 1, insightful: 1 })
    expect(row?.reactions.mine).toEqual(['agree'])
    expect(row?.authorName).toBe('Probe Fellow')
    // The intro post carries no author: the page reads it as CILAS.
    expect(feed.rows.some((r) => r.authorName === null)).toBe(true)
  })

  it('participation counts posts, comments, reactions and the last visit', async () => {
    const { rows, weeks } = await participation(payload, courseSpace)
    const fellowRow = rows.find((r) => r.name === 'Probe Fellow')
    const studentRow = rows.find((r) => r.name === 'Probe Student')
    expect(fellowRow?.posts).toBe(2)
    expect(fellowRow?.comments).toBe(1)
    expect(fellowRow?.reactions).toBe(2)
    expect(fellowRow?.lastVisit).toBeNull()
    expect(studentRow?.posts).toBe(1)
    expect(studentRow?.comments).toBe(1)
    expect(studentRow?.reactions).toBe(1)
    expect(studentRow?.lastVisit).toBeTruthy()
    // Every live post and comment written this run, the CILAS intro post too, lands in the current week.
    const live: Where = {
      and: [{ space: { equals: courseSpace.id } }, { deleted_at: { exists: false } }],
    }
    const written =
      (await payload.count({ collection: 'space-posts', where: live, overrideAccess: true }))
        .totalDocs +
      (await payload.count({ collection: 'space-comments', where: live, overrideAccess: true }))
        .totalDocs
    expect(weeks).toHaveLength(12)
    expect(weeks.at(-1)!.posts + weeks.at(-1)!.comments).toBe(written)
  })

  it('landing resolves each kind by its document slug and gates by the switch', async () => {
    const courseLanding = await spaceLanding(payload, student, 'course', 'probe-space-course')
    expect(courseLanding?.space.id).toBe(courseSpace.id)
    expect(courseLanding?.course?.title).toBe('Probe Course')
    const cohortLanding = await spaceLanding(payload, student, 'cohort', 'probe-bridge')
    expect(cohortLanding?.space.id).toBe(cohortSpace.id)
    expect(cohortLanding?.programme?.title).toBe('Probe Bridge')
    const communityLanding = await spaceLanding(payload, student, 'community', '')
    expect(communityLanding?.space.id).toBe(community.id)
    // The stranger's membership stops at the community.
    expect(await spaceLanding(payload, stranger, 'course', 'probe-space-course')).toBeNull()
    expect(await spaceLanding(payload, student, 'course', 'not-a-course')).toBeNull()
    // The switch closes every landing and empties My spaces.
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'off' },
      overrideAccess: true,
    })
    expect(await spaceLanding(payload, student, 'community', '')).toBeNull()
    expect(await mySpaces(payload, student, 'en')).toEqual({
      communities: [],
      cohorts: [],
      courses: [],
    })
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })
  })

  it('a course space archives after its last meeting and reopens on demand', async () => {
    // The course's last meeting 30 days back — well past the 14-day window.
    const ago = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
    await payload.update({
      collection: 'courses',
      id: course.id,
      data: {
        sessions: [{ order: 1, dates: [{ date: ago, start_time: '18:00', end_time: '20:00' }] }],
      },
      overrideAccess: true,
    })
    const feed = await spaceFeed(payload, student, courseSpace)
    expect(feed.lastMeeting).toBeTruthy()
    expect(feed.daysSince).toBeGreaterThanOrEqual(28)
    expect(feed.archived).toBe(true)
    // Reopening holds the archive open.
    await payload.update({
      collection: 'spaces',
      id: courseSpace.id,
      data: { reopened: true },
      overrideAccess: true,
    })
    const reopened = await spaceFeed(payload, student, courseSpace)
    expect(reopened.archived).toBe(false)
  })

  it('visitRecord upserts idempotently on account+space', async () => {
    const { visitRecord } = await import('@/lib/spaces-write')
    const spaceId = courseSpace.id as number
    const account = (student as { id: number }).id

    const first = await visitRecord({ payload, user: student, space: spaceId })
    expect(first.ok).toBe(true)

    const rows = await payload.find({
      collection: 'space-visits',
      where: { and: [{ account: { equals: account } }, { space: { equals: spaceId } }] },
      overrideAccess: true,
      pagination: false,
    })
    expect(rows.docs.length).toBe(1)
    const id = rows.docs[0]!.id

    // A second call stamps the same row, never duplicates.
    const second = await visitRecord({ payload, user: student, space: spaceId })
    expect(second.ok).toBe(true)

    const again = await payload.find({
      collection: 'space-visits',
      where: { and: [{ account: { equals: account } }, { space: { equals: spaceId } }] },
      overrideAccess: true,
      pagination: false,
    })
    expect(again.docs.length).toBe(1)
    expect(again.docs[0]!.id).toBe(id)
  })

  it('preferenceSet round-trips the digest choice on space-preferences', async () => {
    const { preferenceSet } = await import('@/lib/spaces-write')
    const account = (student as { id: number }).id

    const made = await preferenceSet({ payload, user: student, digest: 'weekly' })
    expect(made.ok).toBe(true)

    const row = await payload.find({
      collection: 'space-preferences',
      where: { account: { equals: account } },
      overrideAccess: true,
      pagination: false,
      limit: 1,
    })
    expect(row.docs.length).toBe(1)
    expect((row.docs[0] as { digest?: string }).digest).toBe('weekly')

    const changed = await preferenceSet({ payload, user: student, digest: 'off' })
    expect(changed.ok).toBe(true)

    const now = await payload.find({
      collection: 'space-preferences',
      where: { account: { equals: account } },
      overrideAccess: true,
      pagination: false,
      limit: 1,
    })
    expect(now.docs.length).toBe(1)
    expect((now.docs[0] as { digest?: string }).digest).toBe('off')
  })
})
