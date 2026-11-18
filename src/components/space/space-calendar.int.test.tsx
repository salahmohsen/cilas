import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SpaceCalendar } from '@/components/space/space-calendar'
import type { CalendarItem } from '@/lib/calendar-items'
import config from '@/payload.config'

import { runInRequest } from '../../../testing/next-request.test-utils'
import { createTracker, lockSpacesMode, uniq, uniqEmail } from '../../../testing/payload.fixture'
import { signedInHeaders } from '../../../testing/reader.test-utils'

let payload: Payload
const { track, cleanup } = createTracker()
let unlock: (() => Promise<void>) | undefined
let modeBefore: 'off' | 'trial' | 'on' | null | undefined
let course: number
let space: number
let admin: { email: string; password: string }

beforeAll(async () => {
  unlock = await lockSpacesMode()
  payload = await getPayload({ config: await config })
  modeBefore = (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true }))
    .spaces_mode
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { spaces_mode: 'on' },
    overrideAccess: true,
  })
  const password = crypto.randomUUID()
  const email = uniqEmail('space-calendar-view')
  track(
    'users',
    await payload.create({
      collection: 'users',
      data: { email, password, roles: ['admin'] },
      overrideAccess: true,
    }),
  )
  admin = { email, password }
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Calendar view', slug: uniq('space-calendar-view'), city: uniq('View') },
      overrideAccess: true,
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2036, place, start_date: '2036-10-04' },
      overrideAccess: true,
    }),
  ).id
  course = track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: 'Calendar view',
        slug: uniq('space-calendar-view-course'),
        course_type: 'THEMATIC',
        tier: 'public',
        cycle,
        registration: { mode: 'closed' },
        _status: 'published',
      },
      overrideAccess: true,
    }),
  ).id
  const spaces = await payload.find({
    collection: 'spaces',
    where: { course: { equals: course } },
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
  space = spaces.docs[0]!.id
  await payload.create({
    collection: 'sessions',
    data: {
      course,
      title: 'Viewed session',
      meetings: [{ date: '2036-10-07', start_time: '19:00', end_time: '21:00' }],
    },
    overrideAccess: true,
  })
}, 600_000)
afterAll(async () => {
  if (payload) {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: modeBefore ?? 'off' },
      overrideAccess: true,
    })
    await cleanup(payload)
    await payload.destroy()
  }
  await unlock?.()
})

type TabProps = { items: CalendarItem[]; canEdit: boolean; day?: string; spaceId: string }
const view = async (headers: HeadersInit) => {
  const { result } = await runInRequest(
    () => SpaceCalendar({ id: space, courseId: course, locale: 'en', spaceHref: '/en/probe' }),
    { headers },
  )
  return result
}

describe('the space calendar, on the server', () => {
  it('reads the space calendar for an editor and opens on its next meeting', async () => {
    const element = await view(await signedInHeaders(payload, admin))
    const props = (element as { props: TabProps }).props
    expect(props.spaceId).toBe(String(space))
    expect(props.canEdit).toBe(true)
    expect(props.items.map((item) => item.title)).toEqual(['Viewed session'])
    expect(props.day).toBe('2036-10-07')
  })
})
