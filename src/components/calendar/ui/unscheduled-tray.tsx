'use client'

import { bindDrag, bindDragPreview, dragThreshold } from '@ui-sdk/core'
import { useEffect, useId, useRef, type PointerEvent } from 'react'

import { SplitButton } from '@/components/arc/split-button/split-button'
import type { CalendarItem } from '@/lib/calendar-items'

import type { CalendarLabels } from './calendar-labels'
import { formatDay } from './calendar-time'
import styles from './calendar.module.css'
import { useWeekSpansApi } from './week-spans'

type Props = {
  items: CalendarItem[]
  days: string[]
  editable: boolean
  labels: CalendarLabels
  locale: string
  /** The item's main button was pressed. */
  onOpen: (itemId: string, anchor: HTMLElement) => void
  /** Put an item on a day: at `start` where it was dropped, or in the first free hour. */
  onPlace: (itemId: string, day: string, start?: number) => void
}

const dayUnder = (x: number, y: number) =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-track]') ?? null

/**
 * Items with no block, each a split button: the main part opens the item,
 * and in edit mode is the handle that drags it onto a day; the menu part puts
 * it on a day, which is how the keyboard does it. ui-sdk's spans start a
 * drag only from a press on a day or on a block, so the drag is `bindDrag` and
 * `bindDragPreview`, and `valueAt` turns the drop point into a time.
 */
export function UnscheduledTray({ items, days, editable, labels, locale, onOpen, onPlace }: Props) {
  const api = useWeekSpansApi()
  const titleId = useId()
  const drag = useRef<(() => void) | null>(null)
  useEffect(() => () => drag.current?.(), [])

  const startDrag = (item: CalendarItem, event: PointerEvent<HTMLButtonElement>) => {
    if (!editable || item.readOnly || event.button !== 0) return
    const chip = event.currentTarget
    let preview: ReturnType<typeof bindDragPreview> | null = null
    let over: HTMLElement | null = null
    const mark = (day: HTMLElement | null) => {
      if (day === over) return
      over?.removeAttribute('data-over')
      day?.setAttribute('data-over', '')
      over = day
    }
    drag.current?.()
    drag.current = bindDrag(chip, event.nativeEvent, {
      threshold: dragThreshold,
      cancelOnEscape: true,
      onStart: () => {
        preview = bindDragPreview(chip, { x: event.clientX, y: event.clientY })
      },
      onMove: ({ x, y }) => {
        preview?.move(x, y)
        mark(dayUnder(x, y))
      },
      onEnd: ({ clientX, clientY }, canceled) => {
        const day = dayUnder(clientX, clientY)
        preview?.remove()
        mark(null)
        if (!canceled && day?.dataset.track) {
          onPlace(
            item.id,
            day.dataset.track,
            api.spans.valueAt(day.dataset.track, clientX, clientY),
          )
        }
      },
    })
  }

  return (
    <div
      className={styles.tray}
      role="group"
      aria-labelledby={titleId}
      data-editable={editable ? '' : undefined}
    >
      <p className={styles.trayTitle} id={titleId}>
        {labels.unscheduled}
      </p>
      <ul className={styles.trayList}>
        {items.map((item) => (
          <li
            key={item.id}
            role="group"
            aria-label={item.title}
            className={styles.trayEntry}
            data-tone={item.tone}
            data-draggable={editable && !item.readOnly ? '' : undefined}
          >
            <SplitButton
              variant="secondary"
              label={item.title}
              icon={<span className={styles.trayMark} aria-hidden />}
              menuLabel={labels.placeOnDay}
              onClick={(event) => onOpen(item.id, event.currentTarget)}
              onPointerDown={(event) => startDrag(item, event)}
              actions={
                editable && !item.readOnly
                  ? days.map((day) => ({
                      label: formatDay(day, locale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      }),
                      onSelect: () => onPlace(item.id, day),
                    }))
                  : []
              }
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
