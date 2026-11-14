import { MenuContextTrigger, type MenuController } from '@ui-sdk/react/menu'
import { Ellipsis, Plus, RotateCcw } from 'lucide-react'
import { useRef, type CSSProperties } from 'react'

import { timeDir } from '@/lib/digits'
import type { CalendarItem } from '@/lib/calendar-items'

import { scrollTargetOf, timedBlocks, type AllDayBlock, type TimedBlock } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { longDay } from './block-names'
import { formatDay, formatMinutes } from './calendar-time'
import styles from './calendar.module.css'
import { useScrollToWork } from './use-scroll-to-work'
import { WeekSpans } from './week-spans'

type Props = {
  items: CalendarItem[]
  allDay: AllDayBlock[]
  days: string[]
  range: { min: number; max: number }
  selectedIndex: number
  todayIndex: number
  now: { date: string; minutes: number } | null
  labels: CalendarLabels
  locale: string
  hour12: boolean
  editable: boolean
  unsaved: Set<string>
  selectedId: string | null
  /** A block's spoken name. */
  nameOf: (block: TimedBlock) => string
  /** The tone of a block of an item that does not exist yet. */
  newTone: string
  /** Set when a day's "+" can draw a new item. */
  onDraw?: (day: string) => void
  /** Set when blocks have a menu: it opens on right-click, long press, Shift+F10 and the Menu key. */
  menu?: MenuController<string>
  /** The id of the text that says how to edit. */
  hintId: string
  onOpen: (itemId: string, blockId: string | null) => void
}

export function WeekGrid({
  items,
  allDay,
  days,
  range,
  selectedIndex,
  todayIndex,
  now,
  labels,
  locale,
  hour12,
  editable,
  unsaved,
  selectedId,
  nameOf,
  newTone,
  onDraw,
  menu,
  hintId,
  onOpen,
}: Props) {
  const itemById = new Map(items.map((item) => [item.id, item]))
  const hours = Array.from({ length: (range.max - range.min) / 60 }, (_, i) => range.min + i * 60)
  const dayLong = (day: string) => longDay(day, locale)

  // An edit grid shows the working day in a fixed-height area, opened on the week's first meeting.
  const scroller = useRef<HTMLDivElement>(null)
  useScrollToWork(scroller, {
    enabled: editable,
    minutes: scrollTargetOf(timedBlocks(items), days),
    range,
    week: days[0]!,
  })

  return (
    <div className={styles.grid} ref={scroller} data-scroll={editable ? '' : undefined}>
      <div className={styles.head}>
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
            {editable && onDraw ? (
              <button
                type="button"
                className={styles.add}
                data-add={day}
                aria-label={labels.addBlock(dayLong(day))}
                onClick={() => onDraw(day)}
              >
                <Plus aria-hidden size={14} />
              </button>
            ) : null}
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
                    status: item.cancelled ? labels.cancelled : '',
                  })}
                  onClick={() => onOpen(item.id, blockId)}
                >
                  {item.title}
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className={styles.rows}>
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
            tabIndex={-1}
            data-track={day}
            data-day={index}
            data-selected={index === selectedIndex ? '' : undefined}
            style={{ '--hours': hours.length } as CSSProperties}
          >
            {({ spans }) => (
              <>
                {spans.map((block) => {
                  const item = itemById.get(block.itemId)
                  const title = item?.title ?? labels.newItem
                  const edited = unsaved.has(block.id)
                  return (
                    <WeekSpans.Span
                      key={block.id}
                      value={block.id}
                      className={styles.block}
                      aria-label={nameOf(block)}
                      aria-describedby={editable && !block.deleted ? hintId : undefined}
                      data-tone={item?.tone ?? newTone}
                      data-cancelled={item?.cancelled ? '' : undefined}
                      data-unsaved={edited ? '' : undefined}
                      data-deleted={block.deleted ? '' : undefined}
                      data-selected={block.id === selectedId ? '' : undefined}
                      onKeyDown={
                        menu && !block.deleted
                          ? (event) => {
                              // Not every browser turns these keys into a context menu event.
                              if (
                                event.key !== 'ContextMenu' &&
                                !(event.shiftKey && event.key === 'F10')
                              )
                                return
                              event.preventDefault()
                              void menu.open({
                                payload: block.id,
                                anchor: event.currentTarget,
                                focus: 'first',
                              })
                            }
                          : undefined
                      }
                      onContextMenu={
                        menu && !block.deleted
                          ? (event) => {
                              // A keyboard's context menu event has no point: it opens at the block.
                              event.preventDefault()
                              void menu.open({
                                payload: block.id,
                                anchor:
                                  event.button === 2
                                    ? { x: event.clientX, y: event.clientY }
                                    : event.currentTarget,
                              })
                            }
                          : undefined
                      }
                      render={
                        menu && !block.deleted ? (
                          <MenuContextTrigger
                            controller={menu}
                            payload={block.id}
                            render={<button />}
                          />
                        ) : undefined
                      }
                    >
                      {editable && !block.deleted ? (
                        <span className={styles.edge} data-span-edge="start" aria-hidden />
                      ) : null}
                      <span className={styles.body}>
                        <span className={styles.title} dir="auto">
                          {title}
                        </span>
                        <span className={styles.time} dir={timeDir(locale)}>
                          {formatMinutes(block.start, locale, hour12)}–
                          {formatMinutes(block.end, locale, hour12)}
                        </span>
                        {block.deleted ? (
                          <span className={styles.state}>
                            <RotateCcw aria-hidden size={12} /> {labels.restore}
                          </span>
                        ) : item?.cancelled ? (
                          <span className={styles.state}>{labels.cancelled}</span>
                        ) : null}
                      </span>
                      {editable && !block.deleted ? (
                        <span className={styles.edge} data-span-edge="end" aria-hidden />
                      ) : null}
                      {menu && !block.deleted ? (
                        <span className={styles.more} data-block-menu aria-hidden>
                          <Ellipsis size={14} />
                        </span>
                      ) : null}
                    </WeekSpans.Span>
                  )
                })}
                {now && now.date === day && now.minutes >= range.min && now.minutes <= range.max ? (
                  <div
                    className={styles.now}
                    aria-hidden
                    style={
                      {
                        '--now': (now.minutes - range.min) / (range.max - range.min),
                      } as CSSProperties
                    }
                  />
                ) : null}
              </>
            )}
          </WeekSpans.Track>
        ))}
      </div>
    </div>
  )
}
