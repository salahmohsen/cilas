'use client'

import type { FocusEvent, ReactNode } from 'react'

/**
 * Chrome leaves a partly visible card where it is when the keyboard reaches it.
 * The row then moves it to its snap point, so the whole card shows. A pointer
 * focus does nothing: the card must not move under the pointer.
 */
const showWhole = ({ target, currentTarget }: FocusEvent<HTMLUListElement>) => {
  const row = currentTarget.parentElement
  if (!row || !target.matches(':focus-visible')) return
  const card = target.getBoundingClientRect()
  const frame = row.getBoundingClientRect()
  if (card.left < frame.left || card.right > frame.right)
    target.scrollIntoView({ block: 'nearest', inline: 'start' })
}

/** The list of "Your spaces", a direct child of the row that scrolls it. */
export function SpaceList({ className, children }: { className: string; children: ReactNode }) {
  return (
    <ul className={className} role="list" onFocus={showWhole}>
      {children}
    </ul>
  )
}
