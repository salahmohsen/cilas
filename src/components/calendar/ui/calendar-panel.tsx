import { useId, type ReactNode } from 'react'

import type { CalendarItem } from '@/lib/calendar-items'

import { DEFAULT_MINUTES, upNext, type EditBlock } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { formatDay, formatTimeRange, toMinutes } from './calendar-time'
import styles from './calendar.module.css'

/** The day the Month view's panel shows: its blocks, and the next one when it has none. */
export type PanelDay = {
  day: string
  isToday: boolean
  blocks: EditBlock[]
  next: EditBlock | undefined
  itemOf: (id: string) => CalendarItem | undefined
  onPress: (itemId: string, blocks: EditBlock[], anchor: HTMLElement) => void
  onSelectDay: (day: string) => void
}

type Props = {
  items: CalendarItem[]
  labels: CalendarLabels
  locale: string
  now: { date: string; minutes: number } | null
  /** Month view: the selected day first. Other views: Up next. */
  day: PanelDay | null
  /** An item's details, which replace the day or Up next. */
  details: ReactNode
  /** The colour key, and the Unscheduled tray where there is one. */
  children: ReactNode
  onOpen: (itemId: string, blockId: string | null, anchor: HTMLElement) => void
}

const longDay = { weekday: 'long', day: 'numeric', month: 'long' } as const
const shortDay = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** The side panel's content: the selected day (Month) or the next meeting, then what the host puts below it. */
export function CalendarPanel({
  items,
  labels,
  locale,
  now,
  day,
  details,
  children,
  onOpen,
}: Props) {
  const titleId = useId()
  const next = !day && now ? upNext(items, now) : null
  return (
    <div className={styles.panelBody}>
      {details ??
        (day ? (
          <DaySection day={day} labels={labels} locale={locale} />
        ) : next ? (
          <section className={styles.panelSection} aria-labelledby={titleId}>
            <p className={styles.panelTitle} id={titleId}>
              {labels.upNext}
            </p>
            <button
              type="button"
              className={styles.next}
              data-tone={next.item.tone}
              data-row-id={`${next.item.id}/${next.id}`}
              onClick={(event) => onOpen(next.item.id, next.id, event.currentTarget)}
            >
              <span className={styles.nextTitle} dir="auto">
                {next.item.title}
              </span>
              <span className={styles.nextWhen}>
                {formatDay(next.date, locale, shortDay)}
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
        ) : null)}
      {children}
    </div>
  )
}

const whenOf = (block: EditBlock, labels: CalendarLabels, locale: string) =>
  block.allDay ? labels.allDay : formatTimeRange(block.start, block.end, locale)

/** One day: its name, a "Today" mark, how many, and a row for each; an empty day says so and offers the next. */
function DaySection({
  day,
  labels,
  locale,
}: {
  day: PanelDay
  labels: CalendarLabels
  locale: string
}) {
  const titleId = useId()
  const name = formatDay(day.day, locale, longDay)
  const row = (block: EditBlock, when: ReactNode, onPress: (anchor: HTMLElement) => void) => {
    const item = day.itemOf(block.itemId)
    return item ? (
      <li key={block.id}>
        <button
          type="button"
          className={styles.next}
          data-tone={item.tone}
          data-cancelled={item.cancelled ? '' : undefined}
          data-row-id={block.id}
          onClick={(event) => onPress(event.currentTarget)}
        >
          <span className={styles.nextTitle} dir="auto">
            {item.title}
          </span>
          <span className={styles.nextWhen}>{when}</span>
          {item.place ? (
            <span className={styles.nextWhen} dir="auto">
              {item.place}
            </span>
          ) : null}
        </button>
      </li>
    ) : null
  }
  const next = day.next
  return (
    <section className={styles.panelSection} aria-labelledby={titleId}>
      <div className={styles.dayHead}>
        <h2 className={styles.dayTitle} id={titleId}>
          {name}
        </h2>
        {day.isToday ? <span className={styles.todayMark}>{labels.today}</span> : null}
      </div>
      {day.blocks.length ? (
        <p className={styles.dayCount}>{labels.dayCount(day.blocks.length)}</p>
      ) : null}
      {day.blocks.length ? (
        <ul className={styles.dayRows}>
          {day.blocks.map((block) =>
            row(block, whenOf(block, labels, locale), (anchor) =>
              day.onPress(block.itemId, [block], anchor),
            ),
          )}
        </ul>
      ) : (
        <>
          <p className={styles.dayEmpty}>{labels.nothingOn(name)}</p>
          {next ? (
            <>
              <p className={styles.panelTitle}>{labels.upNext}</p>
              <ul className={styles.dayRows}>
                {row(
                  next,
                  <>
                    {formatDay(next.track, locale, shortDay)}
                    {' · '}
                    {whenOf(next, labels, locale)}
                  </>,
                  () => day.onSelectDay(next.track),
                )}
              </ul>
            </>
          ) : null}
        </>
      )}
    </section>
  )
}
