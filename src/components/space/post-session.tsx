import { useLocale, useTranslations } from 'next-intl'

import { Alert } from '@/components/arc/alert/alert'
import { CourseSession } from '@/components/course/course-syllabus'
import { StudyWithAI } from '@/components/study-with-ai'
import { sessionsInOrder } from '@/lib/schedule'
import type { SessionView } from '@/lib/spaces-data'

import styles from './space.module.css'

/**
 * The course session a post points at, as the syllabus shows it, from the
 * course's live data, with a way to discuss it with AI. A session the course
 * dropped, or a course the reader may not read, says so instead.
 */
export function PostSession({ session }: { session: SessionView }) {
  const t = useTranslations('SpacePost')
  const tc = useTranslations('Course')
  const ts = useTranslations('Share')
  const locale = useLocale()
  if (session.state === 'hidden') return <Alert tone="info" title={t('sessionHidden')} />
  if (session.state === 'gone') return <Alert tone="info" title={t('sessionGone')} />

  const { course } = session
  const sessions = sessionsInOrder(course.sessions ?? [])
  const at = sessions.findIndex((s) => s.id === session.session)
  const row = sessions[at]
  const unit = tc(course.session_unit === 'week' ? 'week' : 'session', { number: at + 1 })
  const readings = (row?.bibliography ?? []).flatMap((m) =>
    m.title ? [m.note ? `${m.title} (${m.note})` : m.title] : [],
  )

  return (
    <div className={styles.postSession}>
      <CourseSession course={course} session={session.session} label={t('sessionLabel')} />
      <div className={styles.sessionAi}>
        <span>{ts('aiSession')}</span>
        <StudyWithAI
          kind="course"
          path={`/${locale}/study/${course.slug}`}
          label={ts('aiSession')}
          size="sm"
          session={{
            course: course.title,
            session: row?.session_title ? `${unit}: ${row.session_title}` : unit,
            readings,
          }}
        />
      </div>
    </div>
  )
}
