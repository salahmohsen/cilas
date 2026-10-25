import { useTranslations } from 'next-intl'

import type { SessionCourse } from '@/lib/spaces-data'

import { PostSession } from './post-session'
import styles from './space.module.css'

/**
 * The course's next session as the syllabus shows it, with a note when the
 * schedule may still change. It is the post session card, from the live course.
 */
export function NextSession({
  course,
  session,
  tentative,
}: {
  course: SessionCourse
  /** The id of the session's row in the course */
  session: string
  tentative: boolean
}) {
  const t = useTranslations('Spaces')
  const tc = useTranslations('Course')
  return (
    <section className={styles.nextSession} aria-labelledby="next-session-title">
      <h2 id="next-session-title" className={styles.sectionTitle}>
        {t('nextSession')}
      </h2>
      <PostSession session={{ state: 'shown', course, session }} kind="announcement" postHref="" />
      {tentative && <p className={styles.meta}>{tc('tentative')}</p>}
    </section>
  )
}
