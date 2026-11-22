'use client'

import { useEffect } from 'react'

import { focusNewRow } from '@/portal/feedback/focus-new-row'

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
    if (!target) row.tabIndex = -1
    focusNewRow(target ?? row, message)
  }, [focus, firstNewIndex, message])
  return null
}
