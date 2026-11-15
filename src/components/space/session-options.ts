import { getFormatter, getTranslations } from 'next-intl/server'
import { sessionName } from '@/lib/calendar-sources'
import { numberingSystemOf } from '@/lib/digits'
import { numberedSessions } from '@/lib/meetings'
import type { SessionCourse } from '@/lib/spaces-data'
import type { SessionChoice } from './composer'

/** "Session 2: Title · Mon 4 May": one choice per session, in the syllabus's order. */
export async function sessionOptions(
  course: Pick<SessionCourse, 'sessions'>,
  locale: string,
): Promise<SessionChoice[]> {
  const [t, format] = await Promise.all([getTranslations('Course'), getFormatter()])
  return numberedSessions(course.sessions).map(({ session, number: n, day }) => {
    const unit = t('session', { number: n })
    const when = day
      ? format.dateTime(new Date(`${day}T00:00:00Z`), {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
          numberingSystem: numberingSystemOf(locale),
        })
      : null
    return {
      id: String(session.id),
      label: sessionName(n, session.title, (number) => t('session', { number })),
      mention: `#${n}${session.title ? ` ${session.title}` : ''}`,
      title: session.title || undefined,
      unit,
      hint: [when, session.cancelled ? t('cancelled') : null].filter(Boolean).join(' · '),
    }
  })
}
