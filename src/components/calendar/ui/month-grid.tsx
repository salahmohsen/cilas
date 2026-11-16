import { isRTL } from '@ui-sdk/core'
import { RotateCcw } from 'lucide-react'
import { useMemo, type CSSProperties, type KeyboardEvent } from 'react'

import { timeDir } from '@/lib/digits'
import type { CalendarItem } from '@/lib/calendar-items'

import { longDay } from './block-names'
import { allDayBars, editState, type AllDayBar, type EditBlock } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { addDays, addMonths, formatDay, formatShortTime, isWeekend, monthOf } from './calendar-time'
import styles from './calendar.module.css'
import { ItemPress, PRESSABLE } from './item-press'
import { MonthFocus, type GridCell } from './month-focus'

/** Lines of items a day shows under its date: bars first, then chips, the last one "N more" when they do not fit. */
const LINES = 3

type Props = {
  /** The days of the month shown. */
  days: string[]
  /** The weeks from Saturday that hold them. */
  weeks: string[][]
  /** The day that holds the tab stop at first. */
  anchor: string
  focusAnchor: boolean
  /** "November 2026", the grid's name. */
  name: string
  items: CalendarItem[]
  blocks: EditBlock[]
  today: string | null
  labels: CalendarLabels
  locale: string
  unsaved: Set<string>
  marked: ReadonlySet<string>
  nameOf: (block: EditBlock, last?: EditBlock) => string
  newTone: string
  onPress: (itemId: string, blocks: EditBlock[], anchor: HTMLElement) => void
  onRestore: (blocks: EditBlock[]) => void
  /** Shows one day in the Day view: "N more", and a press on an empty day when one can be added. */
  onOpenDay: (day: string) => void
  /**
   * Whether a press on a day's free space opens it in the Day view, where a new item can be
   * drawn; Enter does on a day with nothing in it, and enters the chips of one that has some.
   */
  pressOpensDay: boolean
  /** The keyboard left the month: show `day`'s month, with focus on `day`. */
  onTurn: (day: string) => void
}

const byStart = (a: EditBlock, b: EditBlock) => a.start - b.start || a.end - b.end

/** Keys on a day's buttons: Up and Down stay in the day, Escape goes back to it; Left and Right go on to the grid. */
const inDay = (event: KeyboardEvent<HTMLElement>) => {
  const cell = event.currentTarget.closest<HTMLElement>('[role="gridcell"]')
  if (!cell) return
  const buttons = [...cell.querySelectorAll<HTMLElement>(PRESSABLE)]
  const at = buttons.indexOf(event.currentTarget)
  if (event.key === 'Escape') cell.focus()
  else if (event.key === 'ArrowDown') buttons[at + 1]?.focus()
  else if (event.key === 'ArrowUp') buttons[at - 1]?.focus()
  else return
  event.preventDefault()
  event.stopPropagation()
}

/** A month: weeks from Saturday, each day a cell with its bars, chips and "N more". */
export function MonthGrid({
  days,
  weeks,
  anchor,
  focusAnchor,
  name,
  items,
  blocks,
  today,
  labels,
  locale,
  unsaved,
  marked,
  nameOf,
  newTone,
  onPress,
  onRestore,
  onOpenDay,
  pressOpensDay,
  onTurn,
}: Props) {
  const itemById = new Map(items.map((item) => [item.id, item]))
  const month = new Set(days)
  const start = useMemo((): GridCell => {
    const row = weeks.findIndex((week) => week.includes(anchor))
    return row === -1 ? { row: 0, col: 0 } : { row, col: weeks[row]!.indexOf(anchor) }
  }, [weeks, anchor])

  const rows = useMemo(
    () =>
      weeks.map((week) => {
        const bars = allDayBars(blocks, week, editState(unsaved))
        // Bars past the last line but one fold into "N more", so a day keeps a line for its chips.
        const shown = bars.filter((bar) => bar.lane < LINES - 1)
        const cells = week.map((day, col) => {
          const covers = (bar: AllDayBar) => col >= bar.from && col < bar.from + bar.span
          // The lines the bars over this day take: up to the lowest one, so lanes line up across the row.
          const lanes = Math.max(0, ...shown.filter(covers).map((bar) => bar.lane + 1))
          const timed = blocks
            .filter((block) => block.track === day && !block.allDay)
            .toSorted(byStart)
          const hidden = bars.filter((bar) => !shown.includes(bar) && covers(bar)).length
          const room = LINES - lanes
          const fits = timed.length + hidden <= room
          return {
            day,
            col,
            lanes,
            chips: fits ? timed : timed.slice(0, room - 1),
            more: fits ? 0 : timed.length + hidden - (room - 1),
            bars: shown.filter((bar) => bar.from === col),
          }
        })
        return { week, cells }
      }),
    [weeks, blocks, unsaved],
  )

  const chipProps = (block: EditBlock, run: EditBlock[]) => {
    const item = itemById.get(block.itemId)
    return {
      href: item?.href,
      tabIndex: -1,
      'data-tone': item?.tone ?? newTone,
      'data-cancelled': item?.cancelled ? '' : undefined,
      'data-marked': marked.has(block.itemId) ? '' : undefined,
      'data-unsaved': unsaved.has(block.id) ? '' : undefined,
      'data-deleted': block.deleted ? '' : undefined,
      'aria-disabled': item || block.deleted ? undefined : true,
      onPress: (target: HTMLElement) => {
        if (block.deleted) onRestore(run)
        else if (item) onPress(item.id, run, target)
      },
      onKeyDown: inDay,
    }
  }

  /** Arrows past the grid's edge and Page Up or Down turn the month, as a date picker does. */
  const turnKey = (event: KeyboardEvent<HTMLElement>, day: string) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      // From the month shown, so a muted day of the month before or after turns it too.
      const next = monthOf(addMonths(days[0]!, event.key === 'PageUp' ? -1 : 1))
      return onTurn(next[Math.min(Number(day.slice(8)), next.length) - 1]!)
    }
    const rtl = isRTL(event.currentTarget)
    const step = {
      ArrowUp: -7,
      ArrowDown: 7,
      ArrowLeft: rtl ? 1 : -1,
      ArrowRight: rtl ? -1 : 1,
    }[event.key]
    if (step === undefined) return
    const next = addDays(day, step)
    if (weeks.some((week) => week.includes(next))) return
    event.preventDefault()
    onTurn(next)
  }

  return (
    <MonthFocus.Root
      className={styles.month}
      aria-label={name}
      rows={weeks.length}
      start={start}
      focusStart={focusAnchor}
      style={{ '--lines': LINES } as CSSProperties}
    >
      <MonthFocus.Row value="head" className={styles.monthHead}>
        {weeks[0]!.map((day) => (
          <div
            key={day}
            role="columnheader"
            className={styles.monthWeekday}
            data-weekend={isWeekend(day) ? '' : undefined}
            aria-label={formatDay(day, locale, { weekday: 'long' })}
          >
            {formatDay(day, locale, { weekday: 'short' })}
          </div>
        ))}
      </MonthFocus.Row>
      {rows.map(({ week, cells }, row) => (
        <MonthFocus.Row key={week[0]} value={week[0]!} className={styles.monthRow}>
          {cells.map(({ day, col, lanes, chips, more, bars }) => {
            const long = longDay(day, locale)
            return (
              <MonthFocus.Cell
                key={day}
                value={day}
                row={row}
                col={col}
                className={styles.monthDay}
                data-day={day}
                data-outside={month.has(day) ? undefined : ''}
                data-today={day === today ? '' : undefined}
                data-opens={pressOpensDay ? '' : undefined}
                data-weekend={isWeekend(day) ? '' : undefined}
                aria-current={day === today ? 'date' : undefined}
                style={{ '--lanes': lanes } as CSSProperties}
                onClick={(event) => {
                  if (pressOpensDay && !(event.target as Element).closest(PRESSABLE)) onOpenDay(day)
                }}
                onKeyDown={(event) => {
                  const own = event.target === event.currentTarget
                  if (own && (event.key === 'Enter' || event.key === ' ' || event.key === 'F2')) {
                    const first = event.currentTarget.querySelector<HTMLElement>(PRESSABLE)
                    event.preventDefault()
                    if (first) first.focus()
                    else if (pressOpensDay) onOpenDay(day)
                    return
                  }
                  turnKey(event, day)
                }}
              >
                <span className={styles.monthDate} aria-hidden>
                  {formatDay(day, locale, { day: 'numeric' })}
                </span>
                <span className={styles.srOnly}>{long}</span>
                {bars.map((bar) => {
                  const block = bar.blocks[0]
                  const item = itemById.get(block.itemId)
                  return (
                    <ItemPress
                      key={block.id}
                      className={styles.monthBar}
                      data-allday-id={block.id}
                      style={{ '--span': bar.span, '--lane': bar.lane } as CSSProperties}
                      aria-label={nameOf(block, bar.blocks.at(-1))}
                      {...chipProps(block, bar.blocks)}
                    >
                      <span className={styles.monthTitle} dir="auto">
                        {item?.title ?? labels.newItem}
                      </span>
                      {block.deleted ? <RotateCcw aria-hidden size={12} /> : null}
                    </ItemPress>
                  )
                })}
                {chips.map((block) => {
                  const item = itemById.get(block.itemId)
                  return (
                    <ItemPress
                      key={block.id}
                      className={styles.chip}
                      data-block-id={block.id}
                      aria-label={nameOf(block)}
                      {...chipProps(block, [block])}
                    >
                      <span className={styles.chipTime} dir={timeDir(locale)}>
                        {formatShortTime(block.start, locale)}
                      </span>
                      <span className={styles.monthTitle} dir="auto">
                        {item?.title ?? labels.newItem}
                      </span>
                      {block.deleted ? <RotateCcw aria-hidden size={12} /> : null}
                    </ItemPress>
                  )
                })}
                {more ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    className={styles.monthMore}
                    aria-label={labels.moreName(more, long)}
                    onClick={() => onOpenDay(day)}
                    onKeyDown={inDay}
                  >
                    {labels.more(more)}
                  </button>
                ) : null}
              </MonthFocus.Cell>
            )
          })}
        </MonthFocus.Row>
      ))}
    </MonthFocus.Root>
  )
}
