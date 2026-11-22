'use client'

import { useEffect } from 'react'

import { announce } from '@/portal/feedback/announce'

/**
 * After **Show more** the link carries `focus=latest`: focus moves to the first new
 * row, one announcement says how many rows came, and `focus` leaves the URL, so a
 * reload moves no focus. An index past the last row does nothing.
 */
export function LatestFocus({
  focus,
  firstNewIndex,
  message,
}: {
  focus: boolean
  firstNewIndex: number
  message: string
}): null {
  useEffect(() => {
    if (!focus) return
    const row = document.querySelectorAll<HTMLElement>('[data-latest] ol > li')[firstNewIndex]
    const target = row?.querySelector<HTMLElement>('a')
    if (!row) return
    if (target) target.focus()
    else {
      row.tabIndex = -1
      row.focus()
    }
    announce(message)
    const url = new URL(window.location.href)
    url.searchParams.delete('focus')
    window.history.replaceState(null, '', url)
  }, [focus, firstNewIndex, message])
  return null
}
