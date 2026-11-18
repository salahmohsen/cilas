import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
  type PopoverController,
} from '@ui-sdk/react/popover'
import { X } from 'lucide-react'
import { useEffect, type CSSProperties, type ReactNode } from 'react'

import type { CalendarItem } from '@/lib/calendar-items'

import type { EditBlock } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import styles from './calendar.module.css'
import { ItemDetails } from './item-details'

/** One button of a block's details, such as Open or Edit, or a link to a page. The host gives them. */
export type CalendarAction = {
  id: string
  label: string
  icon?: ReactNode
  /** Loads what the action opens, from the pointer or focus reaching it. */
  preload?: () => void
} & (
  | {
      /** `blockId` is the item's block that was pressed, or null for an item with no block. */
      run: (itemId: string, blockId: string | null) => void
      href?: undefined
      /** Sits in the "⋯" menu of less common actions, not in the row of buttons. */
      menu?: boolean
      /** Drawn as a dangerous choice. */
      danger?: boolean
      /** Asks first. The action's own label is the dangerous answer; `keep` is the safe one. */
      confirm?: { title: string; keep: string }
    }
  | { href: string; run?: undefined; menu?: undefined; danger?: undefined; confirm?: undefined }
)

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
  /** A sheet from the bottom of the screen, on a phone. */
  sheet: boolean
  /** Beside the block, or below it when there is no room beside, as for a full-width agenda row. */
  side: 'end' | 'bottom'
  actionsOf: (item: CalendarItem) => CalendarAction[]
  onAction: (action: CalendarAction, target: DetailsTarget) => void
}

/** The details' width beside a block, in px: Payload's admin sets its own root font size. */
export const DETAILS_WIDTH = 352

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
  // The details own their Escape. A dialog around the calendar (a post's) hears
  // Escape on the document first; the window's capture comes before it.
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !controller.isOpen()) return
      const target = event.target as Element | null
      if (!target?.closest?.(`.${styles.details}`)) return
      // An open menu in the details takes this Escape first.
      if (target.closest('[role="menu"]')) return
      event.stopPropagation()
      controller.close()
    }
    window.addEventListener('keydown', escape, true)
    return () => window.removeEventListener('keydown', escape, true)
  }, [controller])

  return (
    <Popover
      controller={controller}
      presentation={sheet ? 'sheet' : 'popover'}
      onOpenChange={(open, details) => {
        // An Escape pressed in the actions' menu closes the menu, which handles it, and not the popover.
        const target = (details.event as KeyboardEvent | undefined)?.target
        if (!open && details.reason === 'escape-key' && target instanceof Element)
          if (target.closest('[role="menu"]')) details.cancel()
      }}
    >
      <PopoverContent<DetailsTarget>
        className={styles.details}
        style={{ '--details-width': `${DETAILS_WIDTH}px` } as CSSProperties}
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
          return (
            <ItemDetails
              item={item}
              target={payload}
              labels={labels}
              locale={locale}
              imageWidth={DETAILS_WIDTH}
              floating
              heading={
                <PopoverTitle className={styles.detailsTitle} dir="auto">
                  {item.title}
                </PopoverTitle>
              }
              trailing={
                <PopoverClose className={styles.detailsClose} aria-label={labels.close}>
                  <X aria-hidden size={16} />
                </PopoverClose>
              }
              actions={actionsOf(item)}
              onLink={() => controller.close()}
              onRun={(action) => onAction(action, payload)}
            />
          )
        }}
      </PopoverContent>
    </Popover>
  )
}
