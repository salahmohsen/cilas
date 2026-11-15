import { useTranslations } from 'next-intl'

import { Alert } from '@/components/arc/alert/alert'
import { addDays } from '@/lib/cairo-day'
import { sessionItems } from '@/lib/calendar-sources'
import type { ScheduleRef } from '@/lib/session-refs'
import type { SessionRead } from '@/lib/spaces-data'

import { ScheduleCalendar } from './schedule-calendar'
import type { SessionLinks } from './session-chip'
import styles from './space.module.css'

/**
 * A schedule block in a post: the course's sessions in the block's weeks, as
 * the reader may read them now, with the sessions it names marked. A
 * session moved since then shows where it is now. When none of the named
 * sessions is left to read, a short line says so.
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
  const named = new Set(schedule.ids)
  if (!course || !links || !course.sessions.some((s) => named.has(String(s.id))))
    return <Alert tone="info" title={t('scheduleGone')} />

  const end = addDays(schedule.from, 7 * schedule.weeks)
  const items = sessionItems(course.sessions, course, (number) => tc('session', { number }))
    .map((item) => ({
      ...item,
      blocks: item.blocks.filter((b) => b.date >= schedule.from && b.date < end),
    }))
    .filter((item) => item.blocks.length)
  return (
    <div className={styles.sessionBlock}>
      <ScheduleCalendar
        items={items}
        marked={schedule.ids}
        day={schedule.from}
        spaceHref={links.spaceHref}
      />
    </div>
  )
}
