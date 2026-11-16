import type { HTMLAttributes, KeyboardEvent } from 'react'

/** What a press can land on inside a day: buttons, and the links of items that have a page. */
export const PRESSABLE = 'button, a[href]'

/** A click with a modifier key, or not with the main button, is the browser's: a new tab, a window, a download. */
const browserClick = (
  event: Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
) => event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

/**
 * Whether a press on a block goes on: false for a click the browser takes,
 * on a link with a modifier key. A plain click on a link stays on the page.
 */
export const pressStays = (event: Event | undefined) => {
  const link = (event?.target as Element | null | undefined)?.closest?.('a[href]')
  if (!link || !(event instanceof MouseEvent)) return true
  if (browserClick(event)) return false
  event.preventDefault()
  return true
}

/** A link takes Enter; Space presses it as it presses a button. */
export const pressLinkOnSpace = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key !== ' ') return false
  event.preventDefault()
  event.currentTarget.click()
  return true
}

type Props = Omit<HTMLAttributes<HTMLElement>, 'onClick'> & {
  /** The item's page. With it the press is a link, so the page's HTML holds it. */
  href?: string
  tabIndex?: number
  onPress: (target: HTMLElement) => void
}

/**
 * A block, chip or row of an item: a button, or a link to the item's page.
 * A plain press on the link does what the button does; the browser keeps the rest.
 */
export function ItemPress({ href, onPress, onKeyDown, children, ...rest }: Props) {
  if (!href)
    return (
      <button
        type="button"
        {...rest}
        onKeyDown={onKeyDown}
        onClick={(e) => onPress(e.currentTarget)}
      >
        {children}
      </button>
    )
  return (
    <a
      href={href}
      draggable={false}
      {...rest}
      onClick={(event) => {
        if (browserClick(event)) return
        event.preventDefault()
        onPress(event.currentTarget)
      }}
      onKeyDown={(event) => {
        if (!pressLinkOnSpace(event)) onKeyDown?.(event)
      }}
    >
      {children}
    </a>
  )
}
