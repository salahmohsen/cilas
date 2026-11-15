'use client'

import { useSearchParams } from 'next/navigation'
import {
  useEffect,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'

import { preloadable } from '@/lib/preloadable'
import { SESSION_PARAM, sessionDrawerHref } from '@/lib/session-drawer-url'

/**
 * The session drawer: one for every surface of the spaces (the Calendar
 * tab, the Syllabus tab, a post's schedule block, a post page or dialog).
 * Its param (`lib/session-drawer-url.ts`) is written with the History API,
 * which Next folds into its router without a server round trip.
 */

const SessionDrawer = preloadable(() => import('./session-drawer').then((m) => m.SessionDrawer), {
  name: 'SessionDrawer',
})

/** The control that opened the drawer, to take focus back when it closes. */
let opener: HTMLElement | null = null
/** True when this page added the history entry the drawer is open on, so a close goes Back. */
let pushed = false

const remember = (target: EventTarget | null) => {
  const control = target instanceof Element ? target.closest<HTMLElement>('button, a') : null
  if (control) opener = control
}

/**
 * Spread on a session's trigger, or on a wrapper of many (a calendar): the
 * drawer's chunk loads before the click, and the control is remembered for focus.
 */
export const sessionTriggerProps = {
  onPointerEnter: SessionDrawer.preload,
  onFocus: (event: FocusEvent) => {
    remember(event.target)
    SessionDrawer.preload()
  },
  onPointerDown: (event: PointerEvent) => {
    remember(event.target)
    SessionDrawer.preload()
  },
}

/** Opens the drawer on a session, as a new history entry. */
export function openSession(id: string) {
  if (!opener?.isConnected && document.activeElement instanceof HTMLElement)
    opener = document.activeElement
  window.history.pushState(null, '', sessionDrawerHref(window.location.href, id))
  pushed = true
}

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
        opener = event.currentTarget
        openSession(id)
      }}
    >
      {children}
    </a>
  )
}

function closeSession() {
  if (pushed) {
    pushed = false
    window.history.back()
    return
  }
  // Opened from a link: drop the param in place, so Back leaves the page as before.
  const url = new URL(window.location.href)
  url.searchParams.delete(SESSION_PARAM)
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function returnFocus() {
  if (opener?.isConnected) opener.focus({ preventScroll: true })
  opener = null
}

/**
 * Mounts the drawer once a session is first opened, never in the server
 * HTML, then keeps it mounted so it can slide out when the param goes.
 */
export function SessionDrawerHost() {
  const id = useSearchParams().get(SESSION_PARAM)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (id) setMounted(true)
    // Closed by Back: the entry this page pushed is gone.
    else pushed = false
  }, [id])
  if (!mounted) return null
  return <SessionDrawer id={id} onClose={closeSession} onCloseFocus={returnFocus} />
}
