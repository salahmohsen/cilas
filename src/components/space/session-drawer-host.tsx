'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'

import { preloadable } from '@/lib/preloadable'
import { SESSION_PARAM } from '@/lib/session-drawer-url'

import {
  closeSession,
  entryGone,
  onSessionIntent,
  openSession,
  rememberOpener,
  returnFocus,
  sessionTriggerProps,
} from './session-drawer-opener'

export { openSession, sessionTriggerProps }

/**
 * The session drawer: one for every surface of the spaces (the Calendar
 * tab, the Syllabus tab, a post's schedule block, a post page or dialog).
 * Its param (`lib/session-drawer-url.ts`) is written with the History API,
 * which Next folds into its router without a server round trip. What opens
 * it lives in `session-drawer-opener.ts`, so a surface that only opens
 * sessions never loads the drawer's code.
 */

const SessionDrawer = preloadable(() => import('./session-drawer').then((m) => m.SessionDrawer), {
  name: 'SessionDrawer',
})

/**
 * A link that opens the drawer on a session; its `href` (the page with the
 * param) still opens it when it is opened in a new tab.
 */
export function SessionLink({
  id,
  href,
  className,
  children,
}: {
  id: string
  href: string
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={href}
      className={className}
      {...sessionTriggerProps}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        rememberOpener(event.currentTarget)
        openSession(id)
      }}
    >
      {children}
    </a>
  )
}

/**
 * Mounts the drawer once a session is first opened, never in the server
 * HTML, then keeps it mounted so it can slide out when the param goes.
 */
export function SessionDrawerHost() {
  const id = useSearchParams().get(SESSION_PARAM)
  const [mounted, setMounted] = useState(false)
  useEffect(() => onSessionIntent(SessionDrawer.preload), [])
  useEffect(() => {
    if (id) setMounted(true)
    // Closed by Back: the entry this page pushed is gone.
    else entryGone()
  }, [id])
  if (!mounted) return null
  return <SessionDrawer id={id} onClose={closeSession} onCloseFocus={returnFocus} />
}
