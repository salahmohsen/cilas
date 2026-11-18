import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadCalendarItems } from '@/actions/load-calendar-items'
import { loadSessionView } from '@/actions/load-session-view'
import { saveScheduleEdits } from '@/actions/save-schedule-edits'
import type { CalendarSave } from '@/lib/calendar-items'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import { runInRequest } from '../../testing/next-request.test-utils'
import { createTracker, lockSpacesMode, uniq, uniqEmail } from '../../testing/payload.fixture'
import { signedInHeaders } from '../../testing/reader.test-utils'

let payload: Payload
const { track, cleanup } = createTracker()
let admin: User, student: User, fellow: User, otherFellow: User
let course: number, space: number, cohort: number, session: number, event: number
let beforeMode: 'off' | 'trial' | 'on' | null | undefined
let unlock: (() => Promise<void>) | undefined
const passwords = new Map<number, string>()
let reader: HeadersInit = {}
const signIn = async (user: User | null) => {
  reader = user
    ? await signedInHeaders(payload, { email: user.email, password: passwords.get(user.id)! })
    : {}
}
const asReader = async <Result>(work: () => Promise<Result>) =>
  (await runInRequest(work, { headers: reader })).result
const load = (id = space) => asReader(() => loadCalendarItems({ kind: 'space', id: String(id) }))
const view = (id: string) => asReader(() => loadSessionView(id))
const saveCalendarChanges = (calendar: CalendarSave) =>
  asReader(() => saveScheduleEdits({ calendar, details: [] }))
const account = async (name: string, roles: User['roles']) => {
  const person = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name, slug: uniq(name) },
      overrideAccess: true,
    }),
  ).id
  const password = crypto.randomUUID()
  const user = track(
    'users',
    await payload.create({
      collection: 'users',
      data: {
        email: uniqEmail(name),
        password,
        roles,
        person,
      },
      overrideAccess: true,
    }),
  ) as unknown as User
  passwords.set(user.id, password)
  return { person, user }
}

beforeAll(async () => {
  unlock = await lockSpacesMode()
  payload = await getPayload({ config: await config })
  beforeMode = (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true }))
    .spaces_mode
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { spaces_mode: 'on' },
    overrideAccess: true,
  })
  admin = (await account('space-calendar-admin', ['admin'])).user
  const a = await account('space-calendar-fellow', ['fellow'])
  const b = await account('space-calendar-other', ['fellow'])
  const c = await account('space-calendar-student', ['member'])
  fellow = a.user
  otherFellow = b.user
  student = c.user
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: {
        name: 'Calendar probe',
        slug: uniq('space-calendar-place'),
        city: uniq('Calendar'),
      },
      overrideAccess: true,
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: {
        season: 'fall',
        start_year: 2035,
        place,
        start_date: '2035-10-04',
      },
      overrideAccess: true,
    }),
  ).id
  for (const [index, person] of [a.person, b.person].entries()) {
    const id = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Published calendar',
          slug: uniq(`space-calendar-course-${index}`),
          course_type: 'THEMATIC',
          tier: 'public',
          cycle,
          fellows: [person],
          registration: { mode: 'closed' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    ).id
    const spaces = await payload.find({
      collection: 'spaces',
      where: { course: { equals: id } },
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of spaces.docs) {
      track('spaces', doc)
      const posts = await payload.find({
        collection: 'space-posts',
        where: { space: { equals: doc.id } },
        overrideAccess: true,
      })
      posts.docs.forEach((post) => track('space-posts', post))
    }
    if (index === 0) {
      course = id
      space = spaces.docs[0]!.id
    }
  }
  for (const person of [b.person, c.person])
    track(
      'enrollments',
      await payload.create({
        collection: 'enrollments',
        data: { person, course, status: 'confirmed', source: 'admin' },
        overrideAccess: true,
      }),
    )
  await payload.update({
    collection: 'spaces',
    id: space,
    data: { introduction_post: null },
    overrideAccess: true,
  })
  cohort = track(
    'spaces',
    await payload.create({ collection: 'spaces', data: { kind: 'cohort' }, overrideAccess: true }),
  ).id
  const cohortPosts = await payload.find({
    collection: 'space-posts',
    where: { space: { equals: cohort } },
    overrideAccess: true,
  })
  cohortPosts.docs.forEach((post) => track('space-posts', post))
  session = (
    await payload.create({
      collection: 'sessions',
      data: {
        course,
        title: 'Published session',
        meetings: [{ date: '2035-10-05', start_time: '19:00', end_time: '21:00' }],
      },
      overrideAccess: true,
    })
  ).id
  event = track(
    'space-posts',
    await payload.create({
      collection: 'space-posts',
      data: {
        space,
        kind: 'event',
        body: 'Event description',
        event_title: 'Space event',
        event_starts_at: '2026-07-15T16:00:00Z',
      },
      overrideAccess: true,
    }),
  ).id
}, 600_000)

afterAll(async () => {
  if (payload) {
    await cleanup(payload)
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: beforeMode ?? 'off' },
      overrideAccess: true,
    })
    await payload.destroy()
  }
  await unlock?.()
})

describe('space calendar read side', () => {
  it.each(['student', 'fellow', 'other fellow', 'admin'] as const)(
    'loads sessions and read-only events for %s with collection-owned Edit',
    async (role) => {
      const readers = { student, fellow, 'other fellow': otherFellow, admin }
      await signIn(readers[role])
      const result = await load()
      expect(result).toMatchObject({ ok: true, canEdit: role === 'fellow' || role === 'admin' })
      if (!result.ok) return
      expect(result.items).toHaveLength(2)
      expect(result.items.find((item) => item.id === String(session))).toMatchObject({
        kind: 'session',
        title: 'Published session',
        tone: 'blue',
      })
      expect(result.items.find((item) => item.id === `space-event:${event}`)).toMatchObject({
        kind: 'space-event',
        readOnly: true,
        tone: 'neutral',
        blocks: [{ date: '2026-07-15', start_time: '19:00', end_time: null }],
      })
    },
  )

  it('honors post read access when a member is behind the introduction gate', async () => {
    const { docs } = await payload.find({
      collection: 'space-posts',
      where: { and: [{ space: { equals: space } }, { kind: { equals: 'discussion' } }] },
      depth: 0,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'spaces',
      id: space,
      data: { introduction_post: docs[0]!.id },
      overrideAccess: true,
    })
    try {
      await signIn(student)
      const result = await load()
      expect(result).toMatchObject({ ok: true, canEdit: false })
      if (result.ok) expect(result.items.map((item) => item.id)).toEqual([String(session)])
      await signIn(fellow)
      const moderator = await load()
      expect(moderator.ok).toBe(true)
      if (moderator.ok) expect(moderator.items).toHaveLength(2)
    } finally {
      await payload.update({
        collection: 'spaces',
        id: space,
        data: { introduction_post: null },
        overrideAccess: true,
      })
    }
  })

  it('shows the published course to readers and the pending draft only to editors', async () => {
    await payload.update({
      collection: 'courses',
      id: course,
      draft: true,
      data: { title: 'Pending calendar', course_type: 'CORE' },
      overrideAccess: true,
    })
    for (const [reader, tone] of [
      [student, 'blue'],
      [otherFellow, 'blue'],
      [fellow, 'yellow'],
      [admin, 'yellow'],
    ] as const) {
      const rawDraft = payload.findByID({
        collection: 'courses',
        id: course,
        draft: true,
        depth: 0,
        user: reader,
        overrideAccess: false,
      })
      if (tone === 'blue') await expect(rawDraft).rejects.toMatchObject({ status: 404 })
      else
        await expect(rawDraft).resolves.toMatchObject({
          title: 'Pending calendar',
          course_type: 'CORE',
        })
      await signIn(reader)
      const direct = await asReader(() => loadCalendarItems({ kind: 'course', id: String(course) }))
      expect(direct.ok).toBe(true)
      if (direct.ok)
        expect(direct.items.find((item) => item.id === String(session))?.tone).toBe(tone)
      const result = await load()
      expect(result.ok).toBe(true)
      if (result.ok)
        expect(result.items.find((item) => item.id === String(session))?.tone).toBe(tone)
      const drawer = await view(String(session))
      expect(drawer).toMatchObject({
        ok: true,
        canEdit: tone === 'yellow',
        course: {
          title: tone === 'blue' ? 'Published calendar' : 'Pending calendar',
          course_type: tone === 'blue' ? 'THEMATIC' : 'CORE',
        },
        session: { number: 1, session: { id: session, title: 'Published session' } },
        spaceHref: expect.stringMatching(/^\/en\/spaces\/course\/space-calendar-course-0/),
      })
    }
  })

  it('delegates session changes to the course source and reloads the combined items', async () => {
    await signIn(fellow)
    const before = await payload.findByID({ collection: 'sessions', id: session, depth: 0 })
    const result = await saveCalendarChanges({
      parent: { kind: 'space', id: String(space) },
      changes: [
        {
          op: 'move-block',
          itemId: String(session),
          version: before.updatedAt,
          blockId: before.meetings![0]!.id!,
          date: '2035-10-06',
          start_time: '19:00',
          end_time: '21:00',
        },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items).toHaveLength(2)
    expect(result.items.find((item) => item.id === String(session))).toMatchObject({
      blocks: [{ date: '2035-10-06', start_time: '19:00', end_time: '21:00' }],
    })
    expect(result.items.find((item) => item.id === `space-event:${event}`)?.readOnly).toBe(true)
  })

  it('does not expose sessions of a draft-only course to a student', async () => {
    const parent = await payload.findByID({ collection: 'courses', id: course, depth: 0 })
    const draft = track(
      'courses',
      await payload.create({
        collection: 'courses',
        draft: true,
        data: {
          title: 'Unpublished calendar',
          slug: uniq('space-calendar-draft'),
          course_type: 'CORE',
          tier: 'public',
          cycle: parent.cycle,
          fellows: parent.fellows,
          registration: { mode: 'closed' },
          _status: 'draft',
        },
        overrideAccess: true,
      }),
    )
    const hidden = await payload.create({
      collection: 'sessions',
      data: { course: draft.id, title: 'Private session' },
      overrideAccess: true,
    })
    await signIn(student)
    const result = await asReader(() => loadCalendarItems({ kind: 'course', id: String(draft.id) }))
    expect(result.ok).toBe(false)
    expect(await view(String(hidden.id))).toEqual({ ok: false, error: 'not-found' })
    await signIn(admin)
    expect(await view(String(hidden.id))).toMatchObject({
      ok: true,
      canEdit: true,
      course: { title: 'Unpublished calendar' },
    })
  })

  it('refuses an event change in a mixed batch and saves nothing', async () => {
    await signIn(admin)
    const before = await payload.findByID({ collection: 'sessions', id: session, depth: 0 })
    const eventBefore = await payload.findByID({ collection: 'space-posts', id: event, depth: 0 })
    const result = await saveCalendarChanges({
      parent: { kind: 'space', id: String(space) },
      changes: [
        {
          op: 'create-item',
          kind: 'session',
          blocks: [{ blockId: 'new', date: '2035-10-12', start_time: '19:00', end_time: '21:00' }],
        },
        {
          op: 'delete-block',
          itemId: `space-event:${event}`,
          version: eventBefore.updatedAt,
          blockId: String(event),
        },
      ],
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid', change: 1 } })
    expect(
      await payload.count({ collection: 'sessions', where: { course: { equals: course } } }),
    ).toMatchObject({ totalDocs: 1 })
    expect(await payload.findByID({ collection: 'sessions', id: session, depth: 0 })).toEqual(
      before,
    )
    expect(await payload.findByID({ collection: 'space-posts', id: event, depth: 0 })).toEqual(
      eventBefore,
    )
  })

  it('returns invalid for a cohort', async () => {
    await signIn(admin)
    expect(await load(cohort)).toMatchObject({
      ok: false,
      error: { code: 'invalid' },
    })
  })

  it('requires a signed-in reader and refuses a space the reader cannot read', async () => {
    await signIn(null)
    expect(await load()).toEqual({ ok: false, error: { code: 'unauthenticated' } })
    expect(await view(String(session))).toEqual({
      ok: false,
      error: 'unauthenticated',
    })
    await signIn((await account('space-calendar-outsider', ['member'])).user)
    expect(await load()).toMatchObject({ ok: false })
    expect(await view(String(session))).toMatchObject({
      ok: true,
      canEdit: false,
      spaceHref: null,
    })
    expect(await view('not-a-number')).toEqual({ ok: false, error: 'not-found' })
  })
})
