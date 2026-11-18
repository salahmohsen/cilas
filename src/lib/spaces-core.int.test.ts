// @vitest-environment node
import { getPayload, type Payload, type Where } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { personOf } from '@/access'
import { membership, readableWhere } from '@/lib/spaces'
import { introBody } from '@/lib/space-intro'
import { mySpaces, participation, spaceFeed, spaceLanding } from '@/lib/spaces-data'
import config from '@/payload.config'
import type { Space, User } from '@/payload-types'

import { RUN, createTracker, lockSpacesMode, uniq, uniqEmail } from '../../testing/payload.fixture'

const { track, cleanup } = createTracker()
const COURSE_SLUG = uniq('probe-space-course')
const BRIDGE_SLUG = uniq('probe-bridge')
const CITY = `Probeville ${RUN}`

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

  let unlockSpacesMode: () => Promise<void>
  beforeAll(async () => {
    unlockSpacesMode = await lockSpacesMode()
  }, 600_000)

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    modeBefore =
      (
        (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })) as {
          spaces_mode?: 'off' | 'trial' | 'on'
        }
      ).spaces_mode ?? 'off'
    const mk = async (name: string, person: Record<string, unknown>) => {
      const p = await payload.create({
        collection: 'people',
        data: { name, slug: uniq(name.toLowerCase().replace(/\s+/g, '-')), ...person },
        overrideAccess: true,
      })
      track('people', p.id)
      const u = await payload.create({
        collection: 'users',
        data: {
          email: uniqEmail(name.toLowerCase().replace(/\s+/g, '-')),
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

    const place = await payload.create({
      collection: 'places',
      data: { name: 'Probe Place', slug: uniq('probe-place'), city: CITY },
      overrideAccess: true,
    })
    track('places', place.id)
    const cycle = await payload.create({
      collection: 'cycles',
      data: {
        season: 'spring',
        start_year: 2031,
        place: place.id,
        start_date: '2031-03-04',
        registration: { method: 'closed' },
      },
      overrideAccess: true,
    })
    track('cycles', cycle.id)
    course = (await payload.create({
      collection: 'courses',
      depth: 0,
      data: {
        title: 'Probe Course',
        slug: COURSE_SLUG,
        course_type: 'THEMATIC',
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
        data: { title: 'Probe Bridge', slug: BRIDGE_SLUG, kind: 'bridge', _status: 'published' },
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
    for (const [space, intro] of [
      [courseSpace, _courseIntro],
      [cohortSpace, _cohortIntro],
    ] as const) {
      if (!intro) continue
      const said = await payload.create({
        collection: 'space-comments',
        data: {
          space: space.id,
          post: typeof intro === 'object' ? intro.id : intro,
          author: personOf(student) as number,
          body: 'Probe hello',
        },
        overrideAccess: true,
      })
      track('space-comments', said.id)
    }
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
    await cleanup(payload)
    await payload.destroy()
    await unlockSpacesMode()
  })

  const ours = (ids: number[]) =>
    ids.filter((id) => [community.id, courseSpace.id, cohortSpace.id].includes(id)).sort()

  it('the read Where holds the student’s readable spaces', async () => {
    const where = await readableWhere(payload, student, 'id')
    expect(where).toBeTruthy()
    const { docs } = await payload.find({
      collection: 'spaces',
      where: where as never,
      overrideAccess: true,
    })
    expect(ours(docs.map((s) => s.id))).toEqual(
      [community.id, courseSpace.id, cohortSpace.id].sort(),
    )
  })

  it('gives the student the course and cohort and community spaces, and the stranger only the community', async () => {
    const view = (user: User) =>
      payload.find({ collection: 'spaces', user, overrideAccess: false, depth: 0 })
    const seen = ours((await view(student)).docs.map((s) => s.id))
    expect(seen).toEqual([community.id, courseSpace.id, cohortSpace.id].sort())
    expect(ours((await view(stranger)).docs.map((s) => s.id))).toEqual([community.id])
    expect((await view(fellow)).docs.map((s) => s.id)).toContain(courseSpace.id)
  })

  it('the write floor is a Where over readable spaces', async () => {
    const floor = await readableWhere(payload, student, 'space')
    expect(floor).not.toBe(false)

    const refuse = (user: User) =>
      payload.create({
        collection: 'space-posts',
        user,
        overrideAccess: false,
        data: { space: community.id, kind: 'discussion', body: 'x' } as never,
      })
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
        .then((r) => ours(r.docs.map((s) => s.id)))
    expect(await trial()).toEqual([community.id, courseSpace.id].sort())
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
    const spaceIds = (docs as unknown as Array<{ space: { id: number } }>).map((p) => p.space.id)
    expect(ours(spaceIds).every((id) => id === community.id)).toBe(true)
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
    const template = (locale: 'en' | 'ar') =>
      payload.findGlobal({
        slug: 'space-introduction',
        locale,
        fallbackLocale: false,
        overrideAccess: true,
      })
    expect((post as { body: string }).body).toBe(
      introBody(await template('en'), await template('ar')),
    )
    expect((post as { pinned?: boolean }).pinned).toBe(true)
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
    const before = await mySpaces(payload, student, 'en')
    expect(before.cohorts.map((s) => s.title)).toEqual(['Probe Bridge'])
    expect(before.cohorts[0]?.href).toBe(`/en/spaces/cohort/${BRIDGE_SLUG}`)
    expect(before.courses.map((s) => s.title)).toEqual(['Probe Course'])
    expect(before.courses[0]?.href).toBe(`/en/spaces/course/${COURSE_SLUG}`)
    expect(before.courses[0]?.unread).toBe(1)
    const listed = before.communities.find((c) => c.space.id === community.id)
    expect(listed?.title).toBe(community.name || 'Community')
    expect(listed?.href).toBe(`/en/spaces/community/${community.id}`)

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

    const replies = []
    for (const [author, body] of [
      [fellow, 'news reply'],
      [student, 'own reply'],
    ] as const) {
      replies.push(
        await payload.create({
          collection: 'space-comments',
          data: { space: courseSpace.id, post: older.id, author: personOf(author) as number, body },
          overrideAccess: true,
        }),
      )
    }
    expect((await mySpaces(payload, student, 'en')).courses[0]?.unread).toBe(2)
    for (const r of replies) {
      await payload.delete({ collection: 'space-comments', id: r.id, overrideAccess: true })
    }
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

    const pinned = await payload.create({
      collection: 'space-posts',
      data: { space: courseSpace.id, kind: 'announcement', body: 'pinned flag', pinned: true },
      overrideAccess: true,
    })
    track('space-posts', pinned.id)
    await payload.update({
      collection: 'space-posts',
      id: olderId,
      data: { last_activity_at: new Date(Date.now() + 60_000).toISOString() },
      overrideAccess: true,
    })

    const feed = await spaceFeed(payload, student, courseSpace)
    const idxOf = (id: number | undefined) => feed.rows.findIndex((r) => r.post.id === id)
    expect(feed.archived).toBe(false)
    expect(feed.rows[0]?.post.id).toBe(pinned.id)
    expect(feed.rows[1]?.post.pinned).toBe(true)
    expect(idxOf(olderId)).toBe(2)
    expect(idxOf(newerId)).toBeGreaterThan(2)
    const row = feed.rows[idxOf(olderId)]
    expect(row?.commentCount).toBe(2)
    expect(row?.reactions.counts).toEqual({ agree: 1, insightful: 1 })
    expect(row?.reactions.mine).toEqual(['agree'])
    expect(row?.authorName).toBe('Probe Fellow')
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
    expect(studentRow?.comments).toBe(2)
    expect(studentRow?.reactions).toBe(1)
    expect(studentRow?.lastVisit).toBeTruthy()
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
    const courseLanding = await spaceLanding(payload, student, 'course', COURSE_SLUG)
    expect(courseLanding?.space.id).toBe(courseSpace.id)
    expect(courseLanding?.course?.title).toBe('Probe Course')
    const cohortLanding = await spaceLanding(payload, student, 'cohort', BRIDGE_SLUG)
    expect(cohortLanding?.space.id).toBe(cohortSpace.id)
    expect(cohortLanding?.programme?.title).toBe('Probe Bridge')
    const communityLanding = await spaceLanding(payload, student, 'community', '')
    expect(communityLanding?.space.id).toBe(community.id)
    expect(await spaceLanding(payload, stranger, 'course', COURSE_SLUG)).toBeNull()
    expect(await spaceLanding(payload, student, 'course', 'not-a-course')).toBeNull()
    await payload.update({
      collection: 'courses',
      id: course.id,
      draft: true,
      data: { title: 'Probe Course (draft edit)' },
      overrideAccess: true,
    })
    const afterDraft = await spaceLanding(payload, student, 'course', COURSE_SLUG)
    expect(afterDraft?.space.id).toBe(courseSpace.id)
    expect(afterDraft?.course?.title).toBe('Probe Course')
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
    const ago = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
    const last = await payload.create({
      collection: 'sessions',
      data: {
        course: course.id,
        meetings: [{ date: ago, start_time: '18:00', end_time: '20:00' }],
      },
      overrideAccess: true,
    })
    const feed = await spaceFeed(payload, student, courseSpace)
    expect(feed.lastMeeting).toBeTruthy()
    expect(feed.daysSince).toBeGreaterThanOrEqual(28)
    expect(feed.archived).toBe(true)
    await payload.update({
      collection: 'spaces',
      id: courseSpace.id,
      data: { reopened: true },
      overrideAccess: true,
    })
    const reopened = await spaceFeed(payload, student, courseSpace)
    expect(reopened.archived).toBe(false)
    await payload.delete({ collection: 'sessions', id: last.id, overrideAccess: true })
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
