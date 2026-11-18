import type { FocusEvent, PointerEvent } from 'react'

import { SESSION_PARAM, sessionDrawerHref } from '@/lib/session-drawer-url'

/**
 * What opens the session drawer, apart from the drawer itself: the History
 * API writes of its param (`lib/session-drawer-url.ts`), the control to give
 * focus back to, and the intent to open. A surface that only opens sessions
 * (a calendar) imports this module, never the drawer's chunk. The host
 * (`session-drawer-host.tsx`) subscribes the drawer's preload to the intent.
 */

const intents = new Set<() => void>()

/** Calls `preload` whenever a person is about to open a session. Returns the removal. */
export const onSessionIntent = (preload: () => void) => {
  intents.add(preload)
  return () => {
    intents.delete(preload)
  }
}

const intend = () => {
  for (const preload of intents) preload()
}

/** The control that opened the drawer, to take focus back when it closes. */
let opener: HTMLElement | null = null
/** True when this page added the history entry the drawer is open on, so a close goes Back. */
let pushed = false

export const remember = (target: EventTarget | null) => {
  const control = target instanceof Element ? target.closest<HTMLElement>('button, a') : null
  if (control) opener = control
}

/**
 * Spread on a session's trigger, or on a wrapper of many (a calendar): the
 * drawer's chunk loads before the click, and the control is remembered for focus.
 */
export const sessionTriggerProps = {
  onPointerEnter: intend,
  onFocus: (event: FocusEvent) => {
    remember(event.target)
    intend()
  },
  onPointerDown: (event: PointerEvent) => {
    remember(event.target)
    intend()
  },
}

/** Opens the drawer on a session's view, as a new history entry. */
export function openSession(id: string) {
  if (!opener?.isConnected && document.activeElement instanceof HTMLElement)
    opener = document.activeElement
  window.history.pushState(null, '', sessionDrawerHref(window.location.href, id))
  pushed = true
}

export function closeSession() {
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

export function returnFocus() {
  if (opener?.isConnected) opener.focus({ preventScroll: true })
  opener = null
}

/** Records the control a link opened the drawer from. */
export const rememberOpener = (control: HTMLElement) => {
  opener = control
}

/** Forgets that this page pushed the entry the drawer is open on (the entry is gone). */
export const entryGone = () => {
  pushed = false
}
