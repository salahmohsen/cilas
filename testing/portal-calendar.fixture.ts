import type { Payload } from 'payload'

import { relId } from '../src/lib/relation'
import { type createTracker, uniq } from './payload.fixture'
import { courseRoom, type PortalAccount, portalWorld } from './portal.fixture'

type Track = ReturnType<typeof createTracker>['track']

type CourseOptions = {
  cycle: number
  title: string
  tier: 'public' | 'community' | 'owner'
  fellow: number
  status: 'published' | 'draft'
  day: string
  online?: true
  enrolled?: { account: PortalAccount; status: 'accepted' | 'applied' }
}

/** What a reader sees of a course: its id and the title of its one session. */
export type CalendarCourse = { id: number; title: string; session: string }

export type CalendarWorld = Awaited<ReturnType<typeof portalWorld>> & {
  /** A fellow with a person in no `portalWorld` course. It teaches every course here except `draft`. */
  teacher2: PortalAccount
  /** The ids of `portalWorld`'s two public courses (the student and the world fellow are in both), one session each on 2034-10-05. */
  portalCourses: [number, number]
  /** Published Community-tier; the student is accepted. */
  communityCourse: CalendarCourse
  /** Published public; no link to any account: the "other course". */
  other: CalendarCourse
  /** Never published, owner-tier, taught by the world fellow, no course type. */
  draft: CalendarCourse
  /** Published owner-tier; the student is accepted, and access refuses the student. */
  owner: CalendarCourse
  /** Published Community-tier; no link to any account. */
  stranger: CalendarCourse
  /** Published Community-tier; the student's enrollment is only applied, not accepted. */
  pending: CalendarCourse
  /** A published public event. */
  event: { id: number; title: string }
}

const course = async (payload: Payload, track: Track, options: CourseOptions) => {
  const title = uniq(options.title)
  const session = uniq(`${options.title} session`)
  const data = {
    title,
    slug: uniq(options.title.toLowerCase().replace(/\W+/g, '-')),
    tier: options.tier,
    fellows: [options.fellow],
    ...(options.online ? { location: ['ONLINE' as const] } : {}),
    registration: { mode: 'closed' as const },
  }
  const created =
    options.status === 'draft'
      ? await payload.create({
          collection: 'courses',
          data: { ...data, _status: 'draft' },
          draft: true,
          locale: 'en',
          overrideAccess: true,
        })
      : await payload.create({
          collection: 'courses',
          data: { ...data, course_type: 'THEMATIC', cycle: options.cycle, _status: 'published' },
          locale: 'en',
          overrideAccess: true,
        })
  const id = track('courses', created).id
  if (options.status === 'published') await courseRoom(payload, track, id)
  track(
    'sessions',
    await payload.create({
      collection: 'sessions',
      data: {
        course: id,
        title: session,
        meetings: [{ date: options.day, start_time: '19:00', end_time: '21:00' }],
      },
      overrideAccess: true,
    }),
  )
  if (options.enrolled)
    track(
      'enrollments',
      await payload.create({
        collection: 'enrollments',
        data: {
          person: options.enrolled.account.person!,
          course: id,
          status: options.enrolled.status,
          source: 'admin',
        },
        overrideAccess: true,
      }),
    )
  return { id, title, session } satisfies CalendarCourse
}

/**
 * `portalWorld` and seven more items for the portal calendar, each on its own
 * day from Saturday 2034-10-07 to Monday 2034-10-09, so the week of 2034-10-11
 * at 1440 and the three days from 2034-10-07 at 390 show every one with no
 * arrow press. `portalWorld`'s two courses meet on 2034-10-05.
 */
export const calendarWorld = async (payload: Payload, track: Track) => {
  const world = await portalWorld(payload, track)
  const { student, fellow } = world.accounts
  const teacher2 = world.loners.fellow
  const teacher = teacher2.person!
  const courseOf = async (space: number) =>
    await payload.findByID({
      collection: 'courses',
      id: Number(
        relId(
          (
            await payload.findByID({
              collection: 'spaces',
              id: space,
              depth: 0,
              overrideAccess: true,
            })
          ).course,
        ),
      ),
      depth: 0,
      overrideAccess: true,
    })
  const first = await courseOf(world.course.space)
  const cycle = Number(relId(first.cycle))
  const make = (
    options: Omit<CourseOptions, 'fellow' | 'status' | 'cycle'> & Partial<CourseOptions>,
  ) => course(payload, track, { fellow: teacher, status: 'published', cycle, ...options })
  const communityCourse = await make({
    title: 'Calendar community',
    tier: 'community',
    day: '2034-10-07',
    enrolled: { account: student, status: 'accepted' },
  })
  const other = await make({
    title: 'Calendar other',
    tier: 'public',
    day: '2034-10-07',
    online: true,
  })
  const draft = await make({
    title: 'Calendar draft',
    tier: 'owner',
    day: '2034-10-08',
    status: 'draft',
    fellow: fellow.person!,
  })
  const owner = await make({
    title: 'Calendar owner',
    tier: 'owner',
    day: '2034-10-08',
    enrolled: { account: student, status: 'accepted' },
  })
  const stranger = await make({ title: 'Calendar stranger', tier: 'community', day: '2034-10-09' })
  const pending = await make({
    title: 'Calendar pending',
    tier: 'community',
    day: '2034-10-09',
    enrolled: { account: student, status: 'applied' },
  })
  const portalCourses: [number, number] = [first.id, (await courseOf(world.otherCourse.space)).id]
  const title = uniq('Calendar event')
  const event = track(
    'events',
    await payload.create({
      collection: 'events',
      locale: 'en',
      data: {
        title,
        slug: uniq('calendar-event'),
        tier: 'public',
        event_type: 'talk',
        schedule: {
          mode: 'single',
          start_date: '2034-10-08',
          start_time: '18:00',
          end_time: '19:00',
        },
        _status: 'published',
      } as never,
      overrideAccess: true,
    }),
  )
  return {
    ...world,
    teacher2,
    portalCourses,
    communityCourse,
    other,
    draft,
    owner,
    stranger,
    pending,
    event: { id: event.id, title },
  } satisfies CalendarWorld
}
