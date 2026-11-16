import { MenuContextTrigger, type MenuController } from '@ui-sdk/react/menu'
import { Ellipsis, MapPin, Plus, RotateCcw } from 'lucide-react'
import { useRef, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'

import { timeDir } from '@/lib/digits'
import type { CalendarItem } from '@/lib/calendar-items'

import {
  blocksOf,
  scrollTargetOf,
  timedBlocks,
  type AllDayBar,
  type EditBlock,
} from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { longDay } from './block-names'
import { formatClock, formatDay, formatTime, formatTimeRange, isWeekend } from './calendar-time'
import styles from './calendar.module.css'
import type { CalendarView } from './calendar-views'
import { useScrollToWork } from './use-scroll-to-work'
import { WeekSpans } from './week-spans'

type Props = {
  /** The view the grid draws; at phone width the stylesheet shows a week as its selected day. */
  view: CalendarView
  /** The week of the selected day, where an edit grid opens its hours. */
  week: string[]
  items: CalendarItem[]
  /** The all-day bars on these days, as edited. */
  bars: AllDayBar[]
  days: string[]
  range: { min: number; max: number }
  selectedIndex: number
  todayIndex: number
  now: { date: string; minutes: number } | null
  labels: CalendarLabels
  locale: string
  editable: boolean
  unsaved: Set<string>
  /** Ids of the items marked as changed. */
  marked: ReadonlySet<string>
  selectedId: string | null
  /** A block's spoken name; `last` ends an all-day bar across days. */
  nameOf: (block: EditBlock, last?: EditBlock) => string
  /** The tone of a block of an item that does not exist yet. */
  newTone: string
  /** Set when a day's "+" can draw a new item. */
  onDraw?: (day: string) => void
  /** Set when blocks have a menu: it opens on right-click, long press, Shift+F10 and the Menu key. */
  menu?: MenuController<string>
  /** A bar was pressed: its item, its blocks, and the bar. */
  onPress: (itemId: string, blocks: EditBlock[], anchor: HTMLElement) => void
  /** A deleted bar was pressed: bring back all its days. `id` is its first block's. */
  onRestore: (id: string) => void
  /** Delete or Backspace on an all-day bar, all its days (the span editor does this for timed blocks). */
  onDelete: (id: string) => void
}

export function WeekGrid({
  view,
  week,
  items,
  bars,
  days,
  range,
  selectedIndex,
  todayIndex,
  now,
  labels,
  locale,
  editable,
  unsaved,
  marked,
  selectedId,
  nameOf,
  newTone,
  onDraw,
  menu,
  onPress,
  onRestore,
  onDelete,
}: Props) {
  const itemById = new Map(items.map((item) => [item.id, item]))
  const hours = Array.from({ length: (range.max - range.min) / 60 }, (_, i) => range.min + i * 60)
  const dayLong = (day: string) => longDay(day, locale)
  const covers = (bar: AllDayBar) =>
    selectedIndex >= bar.from && selectedIndex < bar.from + bar.span
  // A phone shows a week's selected day alone: the bars on it take lanes 1, 2, 3 there.
  const narrowLane = new Map(bars.filter(covers).map((bar, index) => [bar, index + 1]))
  // Where the now line sits, as a share of the hours shown; null when today or now is not in view.
  const nowAt =
    now && todayIndex >= 0 && now.minutes >= range.min && now.minutes <= range.max
      ? (now.minutes - range.min) / (range.max - range.min)
      : null

  // An edit grid shows the working day in a fixed-height area, opened on the week's first meeting.
  const scroller = useRef<HTMLDivElement>(null)
  useScrollToWork(scroller, {
    enabled: editable,
    minutes: scrollTargetOf(timedBlocks(blocksOf(items)), week),
    range,
    week: week[0]!,
  })

  return (
    <div
      className={styles.grid}
      ref={scroller}
      data-scroll={editable ? '' : undefined}
      data-view={view}
      style={{ '--days': days.length } as CSSProperties}
    >
      <div className={styles.head}>
        <div className={styles.dayRow}>
          <div className={styles.corner}>{labels.cairoTime}</div>
          {days.map((day, index) => (
            <div
              key={day}
              className={styles.dayHead}
              data-day={index}
              data-selected={index === selectedIndex ? '' : undefined}
              data-today={index === todayIndex ? '' : undefined}
              data-weekend={isWeekend(day) ? '' : undefined}
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
        </div>

        <div
          className={styles.allDayRow}
          style={
            {
              '--lanes': Math.max(1, ...bars.map((bar) => bar.lane + 1)),
              '--lanes-narrow': Math.max(1, narrowLane.size),
            } as CSSProperties
          }
        >
          <div className={styles.allDayLabel}>{labels.allDay}</div>
          {days.map((day, index) => (
            <div
              key={day}
              className={styles.allDay}
              data-day={index}
              data-selected={index === selectedIndex ? '' : undefined}
              data-weekend={isWeekend(day) ? '' : undefined}
              style={{ '--column': index + 2 } as CSSProperties}
            />
          ))}
          {bars.map((bar) => {
            const block = bar.blocks[0]
            const last = bar.blocks.at(-1)!
            const item = itemById.get(block.itemId)
            const pill = {
              type: 'button' as const,
              className: styles.pill,
              style: {
                '--from': bar.from + 2,
                '--to': bar.from + bar.span + 2,
                '--lane': bar.lane + 1,
                '--lane-narrow': narrowLane.get(bar),
              } as CSSProperties,
              'data-covers': covers(bar) ? '' : undefined,
              'data-allday-id': block.id,
              'data-tone': item?.tone ?? newTone,
              'data-cancelled': item?.cancelled ? '' : undefined,
              'data-marked': marked.has(block.itemId) ? '' : undefined,
              'data-unsaved': unsaved.has(block.id) ? '' : undefined,
              'data-deleted': block.deleted ? '' : undefined,
              'aria-label': nameOf(block, last),
              onClick: (event: MouseEvent<HTMLElement>) => {
                if (block.deleted) return onRestore(block.id)
                const more = (event.target as Element).closest('[data-block-menu]')
                if (menu && more) return void menu.open({ payload: block.id, anchor: more })
                if (item) onPress(item.id, bar.blocks, event.currentTarget)
              },
              onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                if (block.deleted) return
                // Not every browser turns these keys into a context menu event.
                if (
                  menu &&
                  (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
                ) {
                  event.preventDefault()
                  return void menu.open({
                    payload: block.id,
                    anchor: event.currentTarget,
                    focus: 'first',
                  })
                }
                if (
                  editable &&
                  !block.readOnly &&
                  (event.key === 'Delete' || event.key === 'Backspace')
                ) {
                  event.preventDefault()
                  onDelete(block.id)
                }
              },
              onContextMenu: (event: MouseEvent<HTMLElement>) => {
                if (!menu || block.deleted) return
                // A keyboard's context menu event has no point: it opens at the block.
                event.preventDefault()
                void menu.open({
                  payload: block.id,
                  anchor:
                    event.button === 2
                      ? { x: event.clientX, y: event.clientY }
                      : event.currentTarget,
                })
              },
            }
            const body = (
              <>
                <span className={styles.pillTitle} dir="auto">
                  {item?.title ?? labels.newItem}
                </span>
                {marked.has(block.itemId) && !block.deleted ? (
                  <span className={styles.pillState}>{labels.changed}</span>
                ) : null}
                {block.deleted ? (
                  <span className={styles.pillState}>
                    <RotateCcw aria-hidden size={12} /> {labels.restore}
                  </span>
                ) : menu ? (
                  <span className={styles.pillMore} data-block-menu aria-hidden>
                    <Ellipsis size={14} />
                  </span>
                ) : null}
              </>
            )
            return menu && !block.deleted ? (
              <MenuContextTrigger
                key={block.id}
                controller={menu}
                payload={block.id}
                render={<button />}
                {...pill}
              >
                {body}
              </MenuContextTrigger>
            ) : (
              <button key={block.id} {...pill}>
                {body}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.rows}>
        <div className={styles.hours} aria-hidden>
          {hours.map((minutes) => (
            <span key={minutes} className={styles.hour} data-hour={minutes}>
              {formatTime(minutes, locale)}
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
            data-weekend={isWeekend(day) ? '' : undefined}
            style={{ '--hours': hours.length } as CSSProperties}
          >
            {({ spans }) => (
              <>
                {spans.map((block) => {
                  const item = itemById.get(block.itemId)
                  const title = item?.title ?? labels.newItem
                  const edited = unsaved.has(block.id)
                  const changeable = editable && !block.deleted && !block.readOnly
                  return (
                    <WeekSpans.Span
                      key={block.id}
                      value={block.id}
                      className={styles.block}
                      aria-label={nameOf(block)}
                      data-tone={item?.tone ?? newTone}
                      data-cancelled={item?.cancelled ? '' : undefined}
                      data-marked={marked.has(block.itemId) ? '' : undefined}
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
                      {changeable ? (
                        <span className={styles.edge} data-span-edge="start" aria-hidden />
                      ) : null}
                      <span className={styles.body}>
                        <span className={styles.title} dir="auto">
                          {title}
                        </span>
                        <span className={styles.time} dir={timeDir(locale)}>
                          {formatTimeRange(block.start, block.end, locale)}
                        </span>
                        <span className={styles.short} dir={timeDir(locale)} aria-hidden>
                          {formatClock(block.start, locale)}
                        </span>
                        {item?.place ? (
                          <span className={styles.place}>
                            <MapPin aria-hidden size={12} strokeWidth={1.75} />
                            <span dir="auto">{item.place}</span>
                          </span>
                        ) : null}
                        {block.deleted ? (
                          <span className={styles.state}>
                            <RotateCcw aria-hidden size={12} /> {labels.restore}
                          </span>
                        ) : item?.cancelled || marked.has(block.itemId) ? (
                          <span className={styles.state}>
                            {[
                              item?.cancelled && labels.cancelled,
                              marked.has(block.itemId) && labels.changed,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        ) : null}
                      </span>
                      {changeable ? (
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
                {nowAt !== null && now?.date === day ? (
                  <div
                    className={styles.now}
                    aria-hidden
                    style={{ '--now': nowAt } as CSSProperties}
                  />
                ) : null}
              </>
            )}
          </WeekSpans.Track>
        ))}
        {nowAt !== null && now ? (
          <div className={styles.nowLine} aria-hidden style={{ '--now': nowAt } as CSSProperties}>
            <span className={styles.nowPill}>{formatTime(now.minutes, locale)}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
