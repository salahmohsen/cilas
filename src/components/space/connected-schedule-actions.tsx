'use client'

import type { ReactNode } from 'react'

import { loadCalendarItems } from '@/actions/load-calendar-items'
import { loadSessionView } from '@/actions/load-session-view'
import { saveScheduleEdits } from '@/actions/save-schedule-edits'
import { scheduleOffers } from '@/actions/schedule-offers'
import { loadSessionEdit } from '@/actions/session-edit'
import { postCreateAction } from '@/lib/space-actions'

import { ScheduleActionsProvider, type ScheduleActions } from './schedule-actions'

const actions = {
  loadCalendarItems,
  loadSessionEdit,
  loadSessionView,
  saveScheduleEdits,
  scheduleOffers,
  publishOffer: (form) => postCreateAction({ status: 'ok' }, form),
} satisfies ScheduleActions

/** The schedule screens' server actions, the real ones: wrap a host where the app mounts it. */
export function ConnectedScheduleActions({ children }: { children: ReactNode }) {
  return <ScheduleActionsProvider actions={actions}>{children}</ScheduleActionsProvider>
}
