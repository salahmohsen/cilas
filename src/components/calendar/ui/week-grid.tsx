import { useCallback, type CSSProperties } from 'react'

import { timeDir } from '@/lib/digits'
import type { CalendarItem } from '@/lib/calendar-items'

import type { AllDayBlock, TimedBlock } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { formatDay, formatMinutes } from './calendar-time'
import styles from './calendar.module.css'
import { WeekSpans } from './week-spans'

const STEP = 15

type Props = {
  items: CalendarItem[]
  blocks: TimedBlock[]
  allDay: AllDayBlock[]
  days: string[]
  tracks: string[]
  range: { min: number; max: number }
  selectedIndex: number
  todayIndex: number
  now: { date: string; minutes: number } | null
  labels: CalendarLabels
  locale: string
  hour12: boolean
  onOpen: (itemId: string, blockId: string | null) => void
}

export function WeekGrid({
  items,
  blocks,
  allDay,
  days,
  tracks,
  range,
  selectedIndex,
  todayIndex,
  now,
  labels,
  locale,
  hour12,
  onOpen,
}: Props) {
  const itemById = new Map(items.map((item) => [item.id, item]))
  const hours = Array.from({ length: (range.max - range.min) / 60 }, (_, i) => range.min + i * 60)
  const dayLong = (day: string) =>
    formatDay(day, locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const timeOf = (block: TimedBlock) =>
    labels.timeRange(
      formatMinutes(block.start, locale, hour12),
      formatMinutes(block.end, locale, hour12),
    )

  const nameOf = useCallback(
    (block: TimedBlock) => {
      const item = itemById.get(block.itemId)
      return labels.blockName({
        title: item?.title ?? '',
        day: dayLong(block.track),
        time: timeOf(block),
        cancelled: item?.cancelled ?? false,
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, labels, locale, hour12],
  )

  return (
    <WeekSpans.Root
      className={styles.grid}
      spans={blocks}
      editable={false}
      tracks={tracks}
      min={range.min}
      max={range.max}
      step={STEP}
      label={nameOf}
      onOpen={(block) => onOpen(block.itemId, block.blockId)}
    >
      <div className={styles.corner}>{labels.cairoTime}</div>
      {days.map((day, index) => (
        <div
          key={day}
          className={styles.dayHead}
          data-day={index}
          data-selected={index === selectedIndex ? '' : undefined}
          data-today={index === todayIndex ? '' : undefined}
        >
          <span className={styles.dayName}>{formatDay(day, locale, { weekday: 'short' })}</span>
          <span className={styles.dayNumber}>{formatDay(day, locale, { day: 'numeric' })}</span>
        </div>
      ))}

      <div className={styles.allDayLabel}>{labels.allDay}</div>
      {days.map((day, index) => (
        <div
          key={day}
          className={styles.allDay}
          data-day={index}
          data-selected={index === selectedIndex ? '' : undefined}
        >
          {allDay
            .filter((entry) => entry.date === day)
            .map(({ item, blockId }) => (
              <button
                key={`${item.id}/${blockId}`}
                type="button"
                className={styles.pill}
                data-tone={item.tone}
                data-cancelled={item.cancelled ? '' : undefined}
                aria-label={labels.blockName({
                  title: item.title,
                  day: dayLong(day),
                  time: labels.allDay,
                  cancelled: item.cancelled,
                })}
                onClick={() => onOpen(item.id, blockId)}
              >
                {item.title}
              </button>
            ))}
        </div>
      ))}

      <div className={styles.hours} aria-hidden>
        {hours.map((minutes) => (
          <span key={minutes} className={styles.hour}>
            {formatMinutes(minutes, locale, hour12, true)}
          </span>
        ))}
      </div>
      {days.map((day, index) => (
        <WeekSpans.Track
          key={day}
          value={day}
          role="group"
          aria-label={dayLong(day)}
          className={styles.track}
          data-day={index}
          data-selected={index === selectedIndex ? '' : undefined}
          style={{ '--hours': hours.length } as CSSProperties}
        >
          {blocks
            .filter((block) => block.track === day)
            .map((block) => {
              const item = itemById.get(block.itemId)
              return (
                <WeekSpans.Span
                  key={block.id}
                  value={block.id}
                  className={styles.block}
                  aria-label={nameOf(block)}
                  data-tone={item?.tone}
                  data-cancelled={item?.cancelled ? '' : undefined}
                >
                  <span className={styles.title} dir="auto">
                    {item?.title}
                  </span>
                  <span className={styles.time} dir={timeDir(locale)}>
                    {formatMinutes(block.start, locale, hour12)}–
                    {formatMinutes(block.end, locale, hour12)}
                  </span>
                  {item?.cancelled ? (
                    <span className={styles.state}>{labels.cancelled}</span>
                  ) : null}
                </WeekSpans.Span>
              )
            })}
          {now && now.date === day && now.minutes >= range.min && now.minutes <= range.max ? (
            <div
              className={styles.now}
              aria-hidden
              style={
                { '--now': (now.minutes - range.min) / (range.max - range.min) } as CSSProperties
              }
            />
          ) : null}
        </WeekSpans.Track>
      ))}
    </WeekSpans.Root>
  )
}
