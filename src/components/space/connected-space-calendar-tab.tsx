'use client'

import { preloadable } from '@/lib/preloadable'

import { SpaceCalendarTab } from './space-calendar-tab'
import type { ComponentProps } from 'react'

const SpaceCalendarEditor = preloadable(
  () => import('./space-calendar-editor').then((m) => m.SpaceCalendarEditor),
  { name: 'SpaceCalendarEditor' },
)

/** The Calendar tab with its lazy edit-mode calendar, which saves through the server actions. */
export function ConnectedSpaceCalendarTab(
  props: Omit<ComponentProps<typeof SpaceCalendarTab>, 'Editor'>,
) {
  return <SpaceCalendarTab {...props} Editor={SpaceCalendarEditor} />
}
