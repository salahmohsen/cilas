import { getFormatter, getTranslations } from 'next-intl/server'
import { numberingSystemOf } from '@/lib/digits'
import { numberedSessions } from '@/lib/meetings'
import type { SessionCourse } from '@/lib/spaces-data'
import type { SessionChoice } from './composer'

/** "Session 2: Title · Mon 4 May": one choice per session, in the syllabus's order. */
export async function sessionOptions(
  course: Pick<SessionCourse, 'sessions' | 'session_unit'>,
  locale: string,
): Promise<SessionChoice[]> {
  const [t, format] = await Promise.all([getTranslations('Course'), getFormatter()])
  return numberedSessions(course.sessions, course.session_unit).map(
    ({ session, number: n, unit: kind, day }) => {
      const unit = t(kind, { number: n })
      const when = day
        ? format.dateTime(new Date(`${day}T00:00:00Z`), {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
            numberingSystem: numberingSystemOf(locale),
          })
        : null
      const name = session.title ? `${unit}: ${session.title}` : unit
      return {
        id: String(session.id),
        label: name,
        mention: `#${n}${session.title ? ` ${session.title}` : ''}`,
        title: session.title || undefined,
        unit,
        hint: [when, session.cancelled ? t('cancelled') : null].filter(Boolean).join(' · '),
      }
    },
  )
}
