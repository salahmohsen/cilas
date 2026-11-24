'use client'

import { useEffect } from 'react'

let region: HTMLDivElement | null = null
let frame = 0

/**
 * Reads `message` once in the shell's live region. The region is emptied
 * first and filled a frame later, so a repeat of the same text is read
 * again; a second call in the same frame replaces the first.
 */
export const announce = (message: string): void => {
  const target = region
  if (!target) return
  cancelAnimationFrame(frame)
  target.textContent = ''
  frame = requestAnimationFrame(() => {
    target.textContent = message
  })
}

const attach = (node: HTMLDivElement) => {
  region = node
  return () => {
    if (region !== node) return
    cancelAnimationFrame(frame)
    region = null
  }
}

/** The shell's one polite region; `announce` writes into it. */
export function LiveRegion(): React.JSX.Element {
  return (
    <div
      ref={attach}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-portal-live
    />
  )
}

/**
 * Reads `message` in the shell's region once this mounts. A `role="status"`
 * element that arrives with its text already in it may stay silent; the shell's
 * region is there before the text.
 */
export function Announce({ message }: { message: string }): null {
  useEffect(() => announce(message), [message])
  return null
}
