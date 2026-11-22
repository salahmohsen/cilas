import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getCalendarItems } from '@/api/calendar.api'
import type { CalendarMeeting } from '@/lib/calendar'
import { detailPath } from '@/lib/paths'
import config from '@/payload.config'

import en from '../../messages/en.json'
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
