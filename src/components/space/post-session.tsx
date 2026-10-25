import { useTranslations } from 'next-intl'

import { Alert } from '@/components/arc/alert/alert'
import { CourseSession } from '@/components/course/course-syllabus'
import type { SessionView } from '@/lib/spaces-data'

/**
 * The course session a post points at, as the syllabus shows it, from the
 * course's live data. A session the course dropped, or a course the reader
 * may not read, says so instead.
 */
export function PostSession({ session }: { session: SessionView }) {
  const t = useTranslations('SpacePost')
  if (session.state === 'hidden') return <Alert tone="info" title={t('sessionHidden')} />
  if (session.state === 'gone') return <Alert tone="info" title={t('sessionGone')} />
  return (
    <CourseSession course={session.course} session={session.session} label={t('sessionLabel')} />
  )
}
