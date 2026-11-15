import { useTranslations } from 'next-intl'

import { Alert } from '@/components/arc/alert/alert'
import { sessionItems } from '@/lib/calendar-sources'
import { scheduleView, type ScheduleRef } from '@/lib/session-refs'
import type { SessionRead } from '@/lib/spaces-data'

import { ScheduleCalendar } from './schedule-calendar'
import type { SessionLinks } from './session-chip'
import styles from './space.module.css'

/**
 * A schedule block in a post: the course's sessions in the block's weeks, as
 * the reader may read them now, with the sessions it names marked. A
 * session moved since then shows where it is now, and the block opens on
 * the first day a named session meets. When none of the named sessions is
 * left to read, or none meets in the block's weeks any more, a short line says so.
 */
export function ScheduleBlock({
  schedule,
  read,
  links,
}: {
  schedule: ScheduleRef
  read: SessionRead | null | undefined
  links: SessionLinks | null | undefined
}) {
  const t = useTranslations('SpacePost')
  const tc = useTranslations('Course')
  if (read?.state === 'hidden') return <Alert tone="info" title={t('sessionHidden')} />
  const course = read?.state === 'shown' ? read.course : null
  const view = course
    ? scheduleView(
        sessionItems(course.sessions, course, (number) => tc('session', { number })),
        schedule,
      )
    : null
  if (!view || !links) return <Alert tone="info" title={t('scheduleGone')} />
  return (
    <div className={styles.sessionBlock}>
      <ScheduleCalendar
        items={view.items}
        marked={schedule.ids}
        day={view.day}
        spaceHref={links.spaceHref}
      />
    </div>
  )
}
