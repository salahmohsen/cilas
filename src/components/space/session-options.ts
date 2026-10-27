import { getFormatter, getTranslations } from 'next-intl/server'
import type { Course } from '@/payload-types'
import { numberingSystemOf } from '@/lib/digits'
import { expandSchedule, sessionsInOrder } from '@/lib/schedule'
import type { SessionChoice } from './composer'

/** "Session 2: Title · Mon 4 May": one choice per session, in the syllabus's order. */
export async function sessionOptions(
  course: Pick<Course, 'sessions' | 'schedule' | 'session_unit'>,
  locale: string,
): Promise<SessionChoice[]> {
  const [t, format] = await Promise.all([getTranslations('Course'), getFormatter()])
  const meetings = expandSchedule(course.schedule, course.sessions)
  return sessionsInOrder(course.sessions ?? []).flatMap((session, i) => {
    if (!session.id) return []
    const n = i + 1
    const unit =
      course.session_unit === 'week' ? t('week', { number: n }) : t('session', { number: n })
    const own = meetings.filter((m) => m.session === n)
    const day = (own.find((m) => !m.cancelled) ?? own[0])?.date
    const when = day
      ? format.dateTime(new Date(`${day}T00:00:00Z`), {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
          numberingSystem: numberingSystemOf(locale),
        })
      : null
    const name = session.session_title ? `${unit}: ${session.session_title}` : unit
    return [
      {
        id: session.id,
        label: name,
        mention: `#${n}${session.session_title ? ` ${session.session_title}` : ''}`,
        title: session.session_title || undefined,
        unit,
        hint: [when, session.cancelled ? t('cancelled') : null].filter(Boolean).join(' · '),
      },
    ]
  })
}
