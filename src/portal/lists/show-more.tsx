'use client'

import { useEffect } from 'react'

import { announce } from '@/portal/feedback/announce'

import { findGroupSection } from './group-section'
import type { PagedGroup } from './groups'

/**
 * After Show more: the link carries `focus` (P13), so focus moves to the
 * first new row of this group, one announcement says how many rows came,
 * and `focus` leaves the URL, so a reload moves no focus. An index past
 * the last row (a page count from an old URL) does nothing.
 */
export function NewRowsFocus({
  group,
  firstNewIndex,
  message,
  focus,
}: {
  group: PagedGroup
  firstNewIndex: number
  message: string
  focus: PagedGroup | null
}): null {
  useEffect(() => {
    if (focus !== group) return
    const row = findGroupSection(document, group)?.querySelectorAll('ol > li')[firstNewIndex]
    const link = row?.querySelector<HTMLElement>('a')
    if (!link) return
    link.focus()
    announce(message)
    const url = new URL(window.location.href)
    url.searchParams.delete('focus')
    window.history.replaceState(null, '', url)
  }, [focus, firstNewIndex, group, message])
  return null
}
