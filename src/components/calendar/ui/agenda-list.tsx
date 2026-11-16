import { MapPin, RotateCcw } from 'lucide-react'
import { useId } from 'react'

import { timeDir } from '@/lib/digits'
import type { CalendarItem } from '@/lib/calendar-items'

import type { EditBlock } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { formatDay, formatTime } from './calendar-time'
import styles from './calendar.module.css'

type Props = {
  items: CalendarItem[]
  /** Every block as edited; the list shows the ones on `days`. */
  blocks: EditBlock[]
  days: string[]
  today: string | null
  labels: CalendarLabels
  locale: string
  unsaved: Set<string>
  marked: ReadonlySet<string>
  nameOf: (block: EditBlock) => string
  newTone: string
  /** What the list says when it is empty: "Nothing scheduled this week". */
  empty: string
  onOpen: (itemId: string, blockId: string | null) => void
  onRestore: (id: string) => void
}

const byTime = (a: EditBlock, b: EditBlock) =>
  Number(!a.allDay) - Number(!b.allDay) || a.start - b.start || a.end - b.end

/** The agenda: the days that have blocks, each with its blocks in time order. Nothing here moves. */
export function AgendaList({
  items,
  blocks,
  days,
  today,
  labels,
  locale,
  unsaved,
  marked,
  nameOf,
  newTone,
  empty,
  onOpen,
  onRestore,
}: Props) {
  const id = useId()
  const itemById = new Map(items.map((item) => [item.id, item]))
  const groups = days
    .map((day) => ({ day, blocks: blocks.filter((block) => block.track === day).toSorted(byTime) }))
    .filter((group) => group.blocks.length)

  if (!groups.length) return <p className={styles.agendaEmpty}>{empty}</p>

  return (
    <ol className={styles.agenda}>
      {groups.map(({ day, blocks: dayBlocks }) => {
        const headId = `${id}-${day}`
        return (
          <li key={day} className={styles.agendaDay} data-today={day === today ? '' : undefined}>
            <p className={styles.agendaHead} id={headId}>
              <span className={styles.agendaDate} aria-hidden>
                {formatDay(day, locale, { day: 'numeric' })}
              </span>
              <span className={styles.agendaWeekday}>
                {formatDay(day, locale, { weekday: 'long' })}
              </span>{' '}
              <span className={styles.agendaMonthDay}>
                {formatDay(day, locale, { month: 'short', day: 'numeric' })}
              </span>
            </p>
            <ul className={styles.agendaRows} aria-labelledby={headId}>
              {dayBlocks.map((block) => {
                const item = itemById.get(block.itemId)
                const openable = Boolean(item) || block.deleted
                return (
                  <li key={block.id}>
                    <button
                      type="button"
                      className={styles.agendaRow}
                      data-tone={item?.tone ?? newTone}
                      data-cancelled={item?.cancelled ? '' : undefined}
                      data-marked={marked.has(block.itemId) ? '' : undefined}
                      data-unsaved={unsaved.has(block.id) ? '' : undefined}
                      data-deleted={block.deleted ? '' : undefined}
                      aria-label={nameOf(block)}
                      aria-disabled={openable ? undefined : true}
                      onClick={() => {
                        if (block.deleted) onRestore(block.id)
                        else if (item) onOpen(item.id, block.blockId)
                      }}
                    >
                      <span className={styles.agendaTime} dir={timeDir(locale)}>
                        {block.allDay ? (
                          <span>{labels.allDay}</span>
                        ) : (
                          <>
                            <span>{formatTime(block.start, locale)}</span>
                            <span className={styles.agendaEnd}>
                              {formatTime(block.end, locale)}
                            </span>
                          </>
                        )}
                      </span>
                      <span className={styles.agendaBar} />
                      <span className={styles.agendaText}>
                        <span className={styles.agendaTitle} dir="auto">
                          {item?.title ?? labels.newItem}
                        </span>
                        {item?.place ? (
                          <span className={styles.agendaPlace}>
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
                    </button>
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}
