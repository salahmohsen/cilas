import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  getCachedCalendarItems,
  getCalendarItems,
  getReaderCalendarItems,
} from '@/api/calendar.api'
import type { CalendarMeeting } from '@/lib/calendar'
import { detailPath } from '@/lib/paths'
import { readerCourseIds } from '@/lib/reader-courses'
import { mergeMeetings } from '@/portal/calendar/portal-items'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import en from '../../messages/en.json'
import { runInRequest } from '../../testing/next-request.test-utils'
import { createTracker } from '../../testing/payload.fixture'
import { calendarWorld, type CalendarWorld } from '../../testing/portal-calendar.fixture'

let payload: Payload
const { track, cleanup } = createTracker()
let world: CalendarWorld

const sorted = (ids: number[]) => ids.toSorted((a, b) => a - b)

const everyCourse = () => [
  ...world.portalCourses,
  world.communityCourse.id,
  world.other.id,
  world.draft.id,
  world.owner.id,
  world.stranger.id,
  world.pending.id,
]

const userOf = (id: number) =>
  payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true }) as Promise<User>

const publicIds = () => sorted([...world.portalCourses, world.other.id])

const ours = (list: readonly CalendarMeeting[]) =>
  sorted([...new Set(list.flatMap((m) => m.courseId ?? []))]).filter((id) =>
    everyCourse().includes(id),
  )

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  world = await calendarWorld(payload, track)
})

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('the public list (uncached builder)', () => {
  it('holds the public courses and the event, and no Community-tier or draft session', async () => {
    const list = await getCalendarItems(payload, 'en')
    expect(ours(list)).toEqual(sorted([...world.portalCourses, world.other.id]))
    expect(list.some((m) => m.item === `e${world.event.id}`)).toBe(true)
  })

  it('keeps the href, place, cover and session number of each public meeting', async () => {
    const list = await getCalendarItems(payload, 'en')
    const meetings = list.filter((m) => m.courseId === world.other.id)
    const { slug } = await payload.findByID({
      collection: 'courses',
      id: world.other.id,
      depth: 0,
      select: { slug: true },
      overrideAccess: true,
    })
    expect(meetings).toHaveLength(1)
    expect(meetings[0]).toMatchObject({
      kind: 'course',
      title: world.other.title,
      href: detailPath('courses', String(slug)),
      place: en.Course.delivery.ONLINE,
      date: '2034-10-07',
      start: '19:00',
      end: '21:00',
      session: 1,
      sessionTitle: world.other.session,
      type: 'thematic',
    })
    expect(meetings[0]!.cover).toBeUndefined()
  })
})

describe('the gated read', () => {
  it('shows a student their Community-tier course and their two public courses', async () => {
    const student = await userOf(world.accounts.student.id)
    const ids = await readerCourseIds(payload, student)
    const list = await getReaderCalendarItems(payload, 'en', student, ids)
    expect(ours(list)).toEqual(sorted([...world.portalCourses, world.communityCourse.id]))
    expect(ours(list)).not.toContain(world.stranger.id)
    expect(ours(list)).not.toContain(world.draft.id)
    expect(ours(list)).not.toContain(world.other.id)
  })

  it('builds the same meeting as the public list for a public course the reader takes', async () => {
    const student = await userOf(world.accounts.student.id)
    const gated = await getReaderCalendarItems(payload, 'en', student, world.portalCourses)
    const list = await getCalendarItems(payload, 'en')
    for (const course of world.portalCourses)
      expect(gated.filter((m) => m.courseId === course)).toEqual(
        list.filter((m) => m.courseId === course),
      )
  })

  it('shows each session of a course in both lists once after the merge', async () => {
    const student = await userOf(world.accounts.student.id)
    const own = await getReaderCalendarItems(
      payload,
      'en',
      student,
      await readerCourseIds(payload, student),
    )
    const merged = mergeMeetings(await getCalendarItems(payload, 'en'), own)
    expect(new Set(merged.map((m) => m.key)).size).toBe(merged.length)
    for (const course of world.portalCourses)
      expect(merged.filter((m) => m.courseId === course)).toHaveLength(1)
  })

  it('does not show a course whose enrollment is not accepted', async () => {
    const student = await userOf(world.accounts.student.id)
    const ids = await readerCourseIds(payload, student)
    expect(ids).not.toContain(world.pending.id)
    const list = await getReaderCalendarItems(payload, 'en', student, ids)
    expect(ours(list)).not.toContain(world.pending.id)
  })

  it('does not show a student an owner-tier course they take', async () => {
    const student = await userOf(world.accounts.student.id)
    const ids = await readerCourseIds(payload, student)
    expect(ids).toContain(world.owner.id)
    const list = await getReaderCalendarItems(payload, 'en', student, ids)
    expect(ours(list)).not.toContain(world.owner.id)
  })

  it('shows a fellow their unpublished course, with no link and the course type fallback', async () => {
    const fellow = await userOf(world.accounts.fellow.id)
    const list = await getReaderCalendarItems(
      payload,
      'en',
      fellow,
      await readerCourseIds(payload, fellow),
    )
    expect(ours(list)).toEqual(sorted([...world.portalCourses, world.draft.id]))
    const draft = list.filter((m) => m.courseId === world.draft.id)
    expect(draft.map((m) => m.href)).toEqual([null])
    expect(draft.map((m) => m.type)).toEqual(['course'])
  })

  it('hides another fellow’s draft when its id is passed', async () => {
    const teacher2 = await userOf(world.teacher2.id)
    expect(await getReaderCalendarItems(payload, 'en', teacher2, [world.draft.id])).toEqual([])
  })

  it('reads nothing for an account with no person', async () => {
    const admin = await userOf(world.accounts.admin.id)
    const ids = await readerCourseIds(payload, admin)
    expect(ids).toEqual([])
    const find = vi.spyOn(payload, 'find')
    try {
      expect(await getReaderCalendarItems(payload, 'en', admin, ids)).toEqual([])
      expect(find).not.toHaveBeenCalled()
    } finally {
      find.mockRestore()
    }
  })

  it('makes one read of courses and one of sessions, for one course and for three', async () => {
    const student = await userOf(world.accounts.student.id)
    const reads = async (courses: number[]) => {
      const find = vi.spyOn(payload, 'find')
      try {
        await getReaderCalendarItems(payload, 'en', student, courses)
        const count = (collection: string) =>
          find.mock.calls.filter(([args]) => args.collection === collection).length
        return ['courses', 'sessions', 'cycles'].map(count)
      } finally {
        find.mockRestore()
      }
    }
    const [one, three] = [
      await reads([world.communityCourse.id]),
      await reads([world.communityCourse.id, ...world.portalCourses]),
    ]
    for (const [courses, sessions, cycles] of [one, three]) {
      expect(courses).toBe(1)
      expect(sessions).toBe(1)
      expect(cycles).toBeLessThanOrEqual(1)
    }
    expect(three[0]).toBe(one[0])
  })
})

describe('the cache', () => {
  it('holds no Community-tier or draft session after a reader read', async () => {
    const cacheDirectory = await mkdtemp(join(tmpdir(), 'reader-calendar-'))
    onTestFinished(() => rm(cacheDirectory, { recursive: true, force: true }))
    const student = await userOf(world.accounts.student.id)
    const fellow = await userOf(world.accounts.fellow.id)
    const { result: first } = await runInRequest(
      async () => {
        const studentMeetings = await getReaderCalendarItems(
          payload,
          'en',
          student,
          await readerCourseIds(payload, student),
        )
        expect(ours(studentMeetings)).toContain(world.communityCourse.id)
        const fellowMeetings = await getReaderCalendarItems(
          payload,
          'en',
          fellow,
          await readerCourseIds(payload, fellow),
        )
        expect(ours(fellowMeetings)).toContain(world.draft.id)
        return getCachedCalendarItems('en')
      },
      { cacheDirectory },
    )
    expect(ours(first)).toEqual(publicIds())

    const ownSessionTitles = (meetings: CalendarMeeting[]) =>
      meetings
        .filter((meeting) => meeting.courseId === world.other.id)
        .map((meeting) => meeting.sessionTitle)
    // WARNING: SQL runs no hook, so no cache tag is revalidated.
    const retitle = (title: string) =>
      payload.db.pool.query(
        `UPDATE sessions_locales SET title = $1
         WHERE _locale = 'en' AND _parent_id IN (SELECT id FROM sessions WHERE course_id = $2)`,
        [title, world.other.id],
      )
    const title = `${world.other.session} edited`
    onTestFinished(async () => void (await retitle(world.other.session)))
    await retitle(title)
    expect(ownSessionTitles(await getCalendarItems(payload, 'en'))).toEqual([title])

    const { result: second } = await runInRequest(() => getCachedCalendarItems('en'), {
      cacheDirectory,
    })
    expect(ours(second)).toEqual(publicIds())
    expect(ownSessionTitles(second)).toEqual([world.other.session])
  })
})
