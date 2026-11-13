'use client'

import { useMemo, useRef, useState } from 'react'

import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import type { CalendarItem } from '@/lib/calendar-items'

import { allDayBlocks, hourRange, legendOf, timedBlocks } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { CalendarToolbar } from './calendar-toolbar'
import { addDays, cairoNow, formatDay, weekOf, weekStartOf } from './calendar-time'
import styles from './calendar.module.css'
import { useHour12 } from './use-hour12'
import { useNarrow } from './use-narrow'
import { useNow } from './use-now'
import { WeekGrid } from './week-grid'

export type CalendarProps = {
  items: CalendarItem[]
  mode: 'view' | 'edit'
  labels: CalendarLabels
  locale: string
  /** Any Cairo day of the week to open on; today by default. */
  day?: string
  /** A block was chosen. `blockId` is null for an item with no block. */
  onOpen: (itemId: string, blockId: string | null) => void
}

const indexOfDay = (days: string[], day: string) => Math.max(0, days.indexOf(day))

export function Calendar({ items, labels, locale, day, onOpen }: CalendarProps) {
  const frame = useRef<HTMLDivElement>(null)
  const narrow = useNarrow(frame)
  const now = useNow()
  const [hour12, setHour12] = useHour12()

  const [start, setStart] = useState(() => weekStartOf(day ?? cairoNow().date))
  const [selectedIndex, setSelectedIndex] = useState(() =>
    indexOfDay(weekOf(start), cairoNow().date),
  )
  const days = useMemo(() => weekOf(start), [start])
  const todayIndex = now ? days.indexOf(now.date) : -1

  const goTo = (next: string) => {
    setStart(next)
    setSelectedIndex(indexOfDay(weekOf(next), cairoNow().date))
  }

  const blocks = useMemo(() => timedBlocks(items), [items])
  const range = useMemo(() => hourRange(blocks, days), [blocks, days])
  const allDay = useMemo(() => allDayBlocks(items, days), [items, days])
  const legend = useMemo(() => legendOf(items), [items])
  const unscheduled = items.filter((item) => item.blocks.length === 0)
  const anyCancelled = items.some((item) => item.cancelled)

  const rangeLabel = labels.range(
    formatDay(days[0]!, locale, { day: 'numeric', month: 'short' }),
    formatDay(days[6]!, locale, { day: 'numeric', month: 'short', year: 'numeric' }),
  )

  return (
    <div className={styles.root} role="group" aria-label={labels.name}>
      <div className={styles.frame} ref={frame}>
        <CalendarToolbar
          labels={labels}
          range={rangeLabel}
          hour12={hour12}
          onHour12={setHour12}
          onPrevious={() => goTo(addDays(start, -7))}
          onNext={() => goTo(addDays(start, 7))}
          onToday={() => goTo(weekStartOf(cairoNow().date))}
        />

        {legend.length ? (
          <ul className={styles.legend} aria-label={labels.legend}>
            {legend.map(({ kind, tone }) => (
              <li key={kind} data-tone={tone}>
                <span className={styles.swatch} aria-hidden />
                {labels.kind(kind)}
              </li>
            ))}
            {anyCancelled ? (
              <li data-tone="neutral">
                <span className={styles.swatch} data-cancelled aria-hidden />
                {labels.cancelled}
              </li>
            ) : null}
          </ul>
        ) : null}

        <div className={styles.switcher}>
          <SegmentedControl
            label={labels.daySwitcher}
            value={String(selectedIndex)}
            onValueChange={(value) => setSelectedIndex(Number(value))}
            options={days.map((date, index) => ({
              value: String(index),
              label: `${formatDay(date, locale, { weekday: 'short' })} ${formatDay(date, locale, { day: 'numeric' })}`,
            }))}
          />
        </div>

        <WeekGrid
          items={items}
          blocks={blocks}
          allDay={allDay}
          days={days}
          tracks={narrow ? [days[selectedIndex]!] : days}
          range={range}
          selectedIndex={selectedIndex}
          todayIndex={todayIndex}
          now={now}
          labels={labels}
          locale={locale}
          hour12={hour12}
          onOpen={onOpen}
        />

        {unscheduled.length ? (
          <div className={styles.tray} role="group" aria-labelledby="calendar-unscheduled">
            <p className={styles.trayTitle} id="calendar-unscheduled">
              {labels.unscheduled}
            </p>
            <ul className={styles.trayList}>
              {unscheduled.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.trayItem}
                    data-tone={item.tone}
                    onClick={() => onOpen(item.id, null)}
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
