'use client'

import type { ReactNode } from 'react'

import { markRead } from '@/lib/notifications-client'

/**
 * An unread Latest row's link. A click, with or without a modifier key, and a
 * middle click mark the row read and let the navigation go on; `keepalive` keeps
 * the request alive when the page leaves. A right click opens the context menu
 * and opens nothing. Before hydration it is a plain link, so a row opened then
 * stays unread until the bell's next read.
 */
export function ReadLink({
  href,
  id,
  className,
  children,
}: {
  href: string
  id: number
  className?: string
  children: ReactNode
}) {
  const read = () => void markRead(id, true, { keepalive: true })
  return (
    <a
      href={href}
      className={className}
      onClick={read}
      onAuxClick={(event) => {
        if (event.button === 1) read()
      }}
    >
      {children}
    </a>
  )
}
