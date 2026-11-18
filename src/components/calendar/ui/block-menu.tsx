'use client'

import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  type MenuController,
} from '@ui-sdk/react/menu'
import { Fragment } from 'react'

import type { CalendarMenuLabels } from './calendar-labels'
import styles from './calendar.module.css'

export type BlockAction = 'open' | 'move-to' | 'add-next-day' | 'copy-next-week' | 'delete'

export type BlockMenuEntry = { action: BlockAction; disabled?: boolean }

type Props = {
  /** Opens the menu from right-click, long press, a key or code. The payload is the block's id. */
  controller: MenuController<string>
  labels: CalendarMenuLabels
  titleOf: (blockId: string) => string
  entriesOf: (blockId: string) => BlockMenuEntry[]
  onAction: (action: BlockAction, blockId: string) => void
  /** Where focus goes when the menu closes. */
  finalFocus: () => HTMLElement | null
  preloadMove: () => void
}

/** The menu of actions on one block, shared by every block. */
export function BlockMenu({
  controller,
  labels,
  titleOf,
  entriesOf,
  onAction,
  finalFocus,
  preloadMove,
}: Props) {
  const words: Record<BlockAction, string> = {
    open: labels.open,
    'move-to': labels.moveTo,
    'add-next-day': labels.addNextDay,
    'copy-next-week': labels.copyNextWeek,
    delete: labels.deleteBlock,
  }

  return (
    <Menu
      controller={controller}
      onAction={(value) => {
        const blockId = controller.getPayload()
        if (blockId !== undefined) onAction(value as BlockAction, blockId)
      }}
    >
      <MenuContent<string> className={styles.menu} collisionPadding={12} finalFocus={finalFocus}>
        {({ payload }) => {
          const blockId = payload ?? ''
          const entries = entriesOf(blockId)
          return (
            <MenuGroup aria-label={labels.name(titleOf(blockId))}>
              {entries.map(({ action, disabled }) => (
                <Fragment key={action}>
                  {action === 'delete' ? <MenuSeparator className={styles.menuSeparator} /> : null}
                  <MenuItem
                    value={action}
                    disabled={disabled}
                    className={styles.menuItem}
                    data-danger={action === 'delete' ? '' : undefined}
                    onPointerEnter={action === 'move-to' ? preloadMove : undefined}
                    onFocus={action === 'move-to' ? preloadMove : undefined}
                    onPointerDown={action === 'move-to' ? preloadMove : undefined}
                  >
                    {words[action]}
                  </MenuItem>
                </Fragment>
              ))}
            </MenuGroup>
          )
        }}
      </MenuContent>
    </Menu>
  )
}
