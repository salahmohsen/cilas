import { useId, type ReactNode } from 'react'

import type { CalendarItem } from '@/lib/calendar-items'

import { DEFAULT_MINUTES, upNext } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { formatDay, formatTimeRange, toMinutes } from './calendar-time'
import styles from './calendar.module.css'

type Props = {
  items: CalendarItem[]
  labels: CalendarLabels
  locale: string
  now: { date: string; minutes: number } | null
  /** The colour key, and the Unscheduled tray where there is one. */
  children: ReactNode
  onOpen: (itemId: string, blockId: string | null) => void
}

/** The side panel's content: the next meeting, then what the host puts below it. */
export function CalendarPanel({ items, labels, locale, now, children, onOpen }: Props) {
  const titleId = useId()
  const next = now ? upNext(items, now) : null
  return (
    <div className={styles.panelBody}>
      {next ? (
        <section className={styles.panelSection} aria-labelledby={titleId}>
          <p className={styles.panelTitle} id={titleId}>
            {labels.upNext}
          </p>
          <button
            type="button"
            className={styles.next}
            data-tone={next.item.tone}
            onClick={() => onOpen(next.item.id, next.id)}
          >
            <span className={styles.nextTitle} dir="auto">
              {next.item.title}
            </span>
            <span className={styles.nextWhen}>
              {formatDay(next.date, locale, { weekday: 'short', day: 'numeric', month: 'short' })}
              {' · '}
              {next.start_time
                ? formatTimeRange(
                    toMinutes(next.start_time),
                    next.end_time
                      ? toMinutes(next.end_time)
                      : toMinutes(next.start_time) + DEFAULT_MINUTES,
                    locale,
                  )
                : labels.allDay}
            </span>
            {next.item.place ? (
              <span className={styles.nextWhen} dir="auto">
                {next.item.place}
              </span>
            ) : null}
          </button>
        </section>
      ) : null}
      {children}
    </div>
  )
}
