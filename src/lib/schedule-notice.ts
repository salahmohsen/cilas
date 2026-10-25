import { createTranslator } from 'next-intl'
import type { CollectionAfterChangeHook } from 'payload'

import { localDigits, numberingSystemOf } from '@/lib/digits'
import { notify } from '@/lib/notify'
import { expandSchedule, sessionsInOrder, type Meeting } from '@/lib/schedule'
import { spacePeople } from '@/lib/space-members'
import type { Course } from '@/payload-types'
import ar from '../../messages/ar.json'
import en from '../../messages/en.json'

const LANGUAGES = [
  { locale: 'en', messages: en },
  { locale: 'ar', messages: ar },
] as const

/** More changes than this are summed up, so one save never makes a wall of text. */
const LISTED = 5

type CourseSession = NonNullable<Course['sessions']>[number]

export type SessionChange = {
  /** The session's id in the course and its place in the order, 1-based. */
  id: string
  number: number
  title: string | null
  kind: 'cancelled' | 'restored' | 'moved'
  before: Meeting[]
  after: Meeting[]
}

const ownMeetings = (course: Pick<Course, 'schedule' | 'sessions'>, number: number): Meeting[] =>
  expandSchedule(course.schedule, course.sessions).filter((m) => m.session === number)

const signature = (meetings: Meeting[]): string =>
  meetings.map((m) => `${m.date} ${m.start_time}-${m.end_time}`).join('|')

/**
 * Which sessions were cancelled, brought back, or moved between two saves of
 * a course. Sessions are matched by their row id; a new or removed session is
 * not a change of an existing one. A cancelled session keeps its dates, so a
 * cancel does not also read as a move.
 */
export const sessionChanges = (
  before: Pick<Course, 'schedule' | 'sessions'>,
  after: Pick<Course, 'schedule' | 'sessions'>,
): SessionChange[] => {
  const was = new Map<string, { row: CourseSession; number: number }>()
  sessionsInOrder(before.sessions ?? []).forEach((row, i) => {
    if (row.id) was.set(row.id, { row, number: i + 1 })
  })
  const changes: SessionChange[] = []
  sessionsInOrder(after.sessions ?? []).forEach((row, i) => {
    const prior = row.id ? was.get(row.id) : undefined
    if (!row.id || !prior) return
    const number = i + 1
    const common = {
      id: row.id,
      number,
      title: row.session_title ?? null,
      before: ownMeetings(before, prior.number),
      after: ownMeetings(after, number),
    }
    const wasCancelled = Boolean(prior.row.cancelled)
    const isCancelled = Boolean(row.cancelled)
    if (wasCancelled !== isCancelled)
      changes.push({ ...common, kind: isCancelled ? 'cancelled' : 'restored' })
    else if (!isCancelled && signature(common.before) !== signature(common.after))
      changes.push({ ...common, kind: 'moved' })
  })
  return changes
}

/** One announcement text in both languages, the way the intro post is. */
export const noticeBody = (changes: SessionChange[], unit: 'session' | 'week'): string =>
  LANGUAGES.map(({ locale, messages }) => {
    const t = createTranslator({ locale, messages, namespace: 'ScheduleNotice' })
    const day = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
      numberingSystem: numberingSystemOf(locale),
    })
    const when = (meetings: Meeting[]) =>
      meetings
        .map(
          (m) =>
            `${day.format(new Date(`${m.date}T00:00:00Z`))} ${localDigits(`${m.start_time}–${m.end_time}`, locale)}`,
        )
        .join('; ')
    const lines = changes.slice(0, LISTED).map((c) => {
      const unitName = t(unit, { number: localDigits(c.number, locale) })
      const name = c.title ? `${unitName} (${c.title})` : unitName
      const was = when(c.before)
      const now = when(c.after)
      switch (c.kind) {
        case 'cancelled':
          return was ? t('cancelled', { name, when: was }) : t('cancelledNoDate', { name })
        case 'restored':
          return now ? t('restored', { name, when: now }) : t('restoredNoDate', { name })
        case 'moved':
          return was && now
            ? t('moved', { name, from: was, to: now })
            : t('dated', { name, to: now || was })
      }
    })
    if (changes.length > LISTED) lines.push(t('more', { count: changes.length - LISTED }))
    return [`**${t('title')}**`, ...lines.map((l) => `- ${l}`)].join('\n')
  }).join('\n\n')

/**
 * When an admin changes a published course's schedule (a session cancelled,
 * brought back, or moved), the course's space gets one announcement from no
 * author, and its members a notification. It compares the saved course with
 * the one before, so saving again without a change says nothing.
 */
export const announceScheduleChanges: CollectionAfterChangeHook<Course> = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (doc._status !== 'published' || !previousDoc) return
  const { payload } = req
  try {
    // Publishing a draft sees the draft as the course before; the members
    // only know the last published schedule, so that is what to compare with.
    const published =
      previousDoc._status === 'published'
        ? previousDoc
        : (
            await payload.findVersions({
              collection: 'courses',
              where: {
                and: [
                  { parent: { equals: doc.id } },
                  { 'version._status': { equals: 'published' } },
                ],
              },
              sort: '-updatedAt',
              limit: 1,
              depth: 0,
              overrideAccess: true,
              // No `req`: inside this save's transaction the new version is already there.
            })
          ).docs[0]?.version
    if (!published) return
    const changes = sessionChanges(published, doc)
    if (!changes.length) return

    const { docs } = await payload.find({
      collection: 'spaces',
      where: { course: { equals: doc.id } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
    })
    const space = docs[0]
    if (!space) return
    const post = await payload.create({
      collection: 'space-posts',
      data: {
        space: space.id,
        author: null,
        kind: 'announcement',
        body: noticeBody(changes, doc.session_unit === 'week' ? 'week' : 'session'),
        // A lone change points at its session, shown as the syllabus shows it.
        ...(changes.length === 1 ? { course_session: changes[0]!.id } : {}),
        last_activity_at: new Date().toISOString(),
      } as never,
      overrideAccess: true,
      req,
    })
    const people = await spacePeople(payload, space.id)
    await notify(
      payload,
      people.map((p) => p.accountId).filter((id): id is number => id !== null),
      {
        kind: 'announcement',
        description: createTranslator({
          locale: 'en',
          messages: en,
          namespace: 'ScheduleNotice',
        })('notification', { space: doc.title }),
        link: `/spaces/course/${doc.slug}/posts/${post.id}`,
      },
    )
  } catch (error) {
    payload.logger.error({ err: error, msg: `Schedule notice for course ${doc.id} failed` })
  }
}
