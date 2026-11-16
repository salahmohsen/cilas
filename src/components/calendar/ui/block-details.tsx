import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
  type PopoverController,
} from '@ui-sdk/react/popover'
import { AlignLeft, Clock, MapPin, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/arc/button/button'
import { timeDir } from '@/lib/digits'
import type { CalendarItem } from '@/lib/calendar-items'

import type { EditBlock } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { formatDay, formatLength, formatTimeRange } from './calendar-time'
import styles from './calendar.module.css'

/** One button of a block's details, such as Open or Edit. The host gives them. */
export type CalendarAction = {
  id: string
  label: string
  icon?: ReactNode
  /** The main action, drawn filled. One at most. */
  primary?: boolean
  /** Loads what the action opens, from the pointer or focus reaching it. */
  preload?: () => void
  /** `blockId` is the item's block that was pressed, or null for an item with no block. */
  run: (itemId: string, blockId: string | null) => void
}

/** What the details show: an item, and the block or run of all-day blocks pressed (none when unscheduled). */
export type DetailsTarget = {
  itemId: string
  blocks: EditBlock[]
  /** The control that opened them, where focus goes back. */
  anchor: HTMLElement
}

type Props = {
  controller: PopoverController<DetailsTarget>
  items: CalendarItem[]
  labels: CalendarLabels
  locale: string
  /** A sheet from the bottom of the screen, on a narrow calendar. */
  sheet: boolean
  /** Beside the block, or below it when there is no room beside, as for a full-width agenda row. */
  side: 'end' | 'bottom'
  actionsOf: (item: CalendarItem) => CalendarAction[]
  onAction: (action: CalendarAction, target: DetailsTarget) => void
}

const longDate = { weekday: 'long', day: 'numeric', month: 'long' } as const

/** A block's details in view mode: what, when, where, and the host's actions. */
export function BlockDetails({
  controller,
  items,
  labels,
  locale,
  sheet,
  side,
  actionsOf,
  onAction,
}: Props) {
  return (
    <Popover controller={controller} presentation={sheet ? 'sheet' : 'popover'}>
      <PopoverContent<DetailsTarget>
        className={styles.details}
        side={side}
        align="start"
        sideOffset={8}
        collisionPadding={12}
        finalFocus={() => {
          const anchor = controller.getPayload()?.anchor
          return anchor?.isConnected ? anchor : null
        }}
      >
        {({ payload }) => {
          const item = items.find((candidate) => candidate.id === payload?.itemId)
          if (!payload || !item) return null
          const [first] = payload.blocks
          const last = payload.blocks.at(-1)
          const actions = actionsOf(item)
          return (
            <>
              <div className={styles.detailsHead} data-tone={item.tone}>
                <span className={styles.detailsMark} aria-hidden />
                <PopoverTitle className={styles.detailsTitle} dir="auto">
                  {item.title}
                </PopoverTitle>
                <PopoverClose className={styles.detailsClose} aria-label={labels.close}>
                  <X aria-hidden size={16} />
                </PopoverClose>
              </div>

              {item.caption || item.cancelled ? (
                <p className={styles.detailsCaption}>
                  {item.caption ? <span dir="auto">{item.caption}</span> : null}
                  {item.cancelled ? (
                    <span className={styles.detailsCancelled}>{labels.cancelled}</span>
                  ) : null}
                </p>
              ) : null}

              <ul className={styles.detailsRows}>
                <li>
                  <Clock aria-hidden size={16} strokeWidth={1.75} />
                  {first && last ? (
                    <span className={styles.detailsWhen}>
                      <span>
                        {first === last
                          ? formatDay(first.track, locale, longDate)
                          : labels.range(
                              formatDay(first.track, locale, longDate),
                              formatDay(last.track, locale, longDate),
                            )}
                      </span>
                      {first.allDay ? (
                        <span className={styles.detailsMuted}>{labels.allDay}</span>
                      ) : (
                        <span className={styles.detailsMuted}>
                          <span dir={timeDir(locale)}>
                            {formatTimeRange(first.start, first.end, locale)}
                          </span>
                          {' · '}
                          {formatLength(first.end - first.start, locale)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>{labels.unscheduled}</span>
                  )}
                </li>
                {item.place ? (
                  <li>
                    <MapPin aria-hidden size={16} strokeWidth={1.75} />
                    <span dir="auto">{item.place}</span>
                  </li>
                ) : null}
                {item.summary ? (
                  <li>
                    <AlignLeft aria-hidden size={16} strokeWidth={1.75} />
                    <span className={styles.detailsSummary} dir="auto">
                      {item.summary}
                    </span>
                  </li>
                ) : null}
              </ul>

              {actions.length ? (
                <div className={styles.detailsActions}>
                  {actions.map((action) => (
                    <Button
                      key={action.id}
                      type="button"
                      size="sm"
                      variant={action.primary ? 'primary' : 'secondary'}
                      onPointerEnter={action.preload}
                      onFocus={action.preload}
                      onPointerDown={action.preload}
                      onClick={() => onAction(action, payload)}
                    >
                      {action.icon}
                      {action.label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </>
          )
        }}
      </PopoverContent>
    </Popover>
  )
}
