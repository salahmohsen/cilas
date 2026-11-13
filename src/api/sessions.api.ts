import { otherLocale, type Locale } from '@/i18n/routing'
import { sessionsInOrder } from '@/lib/meetings'
import type { Reader } from '@/lib/reader'
import { relId } from '@/lib/relation'
import type { Payload } from 'payload'
import type { Session } from '@/payload-types'

/**
 * The sessions of each course, in order (ADR 0011): what `lib/meetings.ts`
 * reads to number, date and summarise them. One query for all the courses.
 * Read as `reader`: a draft course's sessions only reach its fellows and
 * admins, as its page does. Every course asked for has an entry, empty when
 * it has no session the reader may see.
 */
export const getCourseSessions = async (
  payload: Payload,
  courses: readonly number[],
  { locale, reader }: { locale: Locale; reader: Reader },
): Promise<Map<number, Session[]>> => {
  const byCourse = new Map<number, Session[]>(courses.map((id) => [id, []]))
  if (!courses.length) return byCourse
  const { docs } = await payload.find({
    collection: 'sessions',
    where: { course: { in: [...courses] } },
    depth: 0,
    pagination: false,
    // A stable order to start from: `sessionsInOrder` keeps it for ties.
    sort: 'id',
    overrideAccess: false,
    user: reader,
    locale,
    fallbackLocale: otherLocale(locale),
  })
  for (const session of docs) byCourse.get(Number(relId(session.course)))?.push(session)
  for (const [id, list] of byCourse) byCourse.set(id, sessionsInOrder(list))
  return byCourse
}
