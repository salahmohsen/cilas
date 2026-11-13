import type { SyllabusSession } from '@/components/course/course-syllabus'
import { RichTextField } from '@/components/RichTextField'
import { sessionUnitOf, type CourseMeeting, type NumberedSession } from '@/lib/meetings'
import { expandSchedule, sessionsInOrder } from '@/lib/schedule'
import type { Course } from '@/payload-types'

/**
 * A course's old sessions array, numbered and dated as the syllabus reads
 * it. A course space still names sessions by their old row IDs, so it reads
 * the array until spaces move to the sessions collection (plan "Move course
 * readers to sessions", unit 4, which deletes this file).
 */
export const oldSyllabus = (
  course: Pick<Course, 'sessions' | 'schedule' | 'session_unit'>,
): NumberedSession<SyllabusSession>[] => {
  const meetings = expandSchedule(course.schedule, course.sessions)
  return sessionsInOrder(course.sessions ?? []).map((s, i) => {
    const number = i + 1
    const own = meetings
      .filter((m) => m.session === number)
      .map((m): CourseMeeting => ({
        date: m.date,
        start_time: m.start_time,
        end_time: m.end_time,
        session: number,
        ...(m.cancelled ? { cancelled: true as const } : {}),
      }))
    return {
      session: {
        id: String(s.id ?? `session-${i}`),
        title: s.session_title,
        cancelled: s.cancelled,
        delivery: s.delivery,
        description: s.description ? (
          <RichTextField className="article-prose article-prose--notes" data={s.description} />
        ) : null,
        bibliography: s.bibliography,
        activities: s.activities,
      },
      number,
      unit: sessionUnitOf(course.session_unit),
      meetings: own,
      day: (own.find((m) => !m.cancelled) ?? own[0])?.date ?? null,
    }
  })
}
