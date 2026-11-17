import { useState } from 'react'

import { ButtonGroup } from '@/components/arc/button-group/button-group'

import type { CalendarAction } from './block-details'
import styles from './calendar.module.css'

/**
 * An item's actions as one group of segments with hairline dividers: its
 * buttons and links, and, last, an icon-only overflow segment that opens a
 * menu of the actions that ask for one (`menu`). With no such action there is
 * no overflow segment. One component for the popover, the side panel and the
 * session drawer.
 *
 * In a floating popover (`floating`) the menu renders inside the group's own
 * element, which is inside the popover. The popover then counts a press or
 * focus in the menu as inside it: in the page body it was an outside press,
 * and the popover closed when "⋯" was pressed.
 */
export function ItemActions({
  label,
  menuLabel,
  actions,
  floating = false,
  className = styles.detailsActions,
  onLink,
  onRun,
}: {
  /** The group's accessible name. */
  label: string
  /** The overflow segment's accessible name: "More actions". */
  menuLabel: string
  actions: CalendarAction[]
  floating?: boolean
  className?: string
  /** A link was followed. */
  onLink?: () => void
  onRun: (action: CalendarAction) => void
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const segments = actions.filter((action) => !action.menu)
  const overflow = actions.filter((action) => action.menu && action.run)
  if (!segments.length && !overflow.length) return null
  const preload = () => actions.forEach((action) => action.preload?.())
  return (
    <div
      ref={setContainer}
      className={className}
      onPointerEnter={preload}
      onFocus={preload}
      onPointerDown={preload}
    >
      <ButtonGroup
        label={label}
        size="sm"
        className={styles.actionGroup}
        items={segments.map((action) => ({
          id: action.id,
          label: action.label,
          icon: action.icon,
          href: action.href,
          onSelect: action.href ? onLink : () => onRun(action),
        }))}
        menu={
          overflow.length
            ? {
                label: menuLabel,
                container: floating ? container : undefined,
                items: overflow.map((action) => ({
                  id: action.id,
                  label: action.label,
                  destructive: action.danger,
                  onPreload: action.preload,
                  onSelect: () => onRun(action),
                })),
              }
            : undefined
        }
      />
    </div>
  )
}
