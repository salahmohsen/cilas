import type { MouseEvent } from 'react'

export const pageNavigation = (disabled: boolean, href: string | undefined) => ({
  ...(href === undefined
    ? { type: 'button' as const, disabled }
    : {
        href: disabled ? undefined : href,
        'aria-disabled': disabled || undefined,
        tabIndex: disabled ? -1 : undefined,
      }),
})

export const activatePage = (
  event: MouseEvent<HTMLElement>,
  disabled: boolean,
  linked: boolean,
) => {
  if (disabled) {
    event.preventDefault()
    return false
  }
  if (linked) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return false
    event.preventDefault()
  }
  return true
}
