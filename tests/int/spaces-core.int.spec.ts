// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { personOf } from '@/access'
import { membership, readableWhere, writePostWhere } from '@/lib/spaces'
import config from '@/payload.config'
import type { Space, User } from '@/payload-types'

const tracked = new Map<string, number[]>() // collection -> ids made here

const track = (collection: string, id: number) => {
  const list = tracked.get(collection) ?? []
  list.push(id)
  tracked.set(collection, list)
}

describe('spaces core', () => {
  let payload: Payload
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
    // People and accounts: the fellow teaches, the student is enrolled,
    // the stranger is a member of nothing.
    const mk = async (name: string, person: Record<string, unknown>) => {
      const p = await payload.create({
        collection: 'people',
        data: { name, slug: name.toLowerCase().replace(/\s+/g, '-'), ...person },
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
    community = await mkSpace({ kind: 'community' })
    track('spaces', community.id)
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
      data: { spaces_mode: 'off' },
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
})
