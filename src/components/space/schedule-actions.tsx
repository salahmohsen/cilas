import { createContext, useContext, type ReactNode } from 'react'

import type { loadCalendarItems } from '@/actions/load-calendar-items'
import type { loadSessionView } from '@/actions/load-session-view'
import type { saveScheduleEdits } from '@/actions/save-schedule-edits'
import type { scheduleOffers } from '@/actions/schedule-offers'
import type { loadSessionEdit } from '@/actions/session-edit'
import type { SpacesWriteState } from '@/lib/space-actions'

/**
 * The server actions the schedule screens call, as one value. The screens
 * never import an action: a browser test cannot load one, so the host puts
 * them in (`ConnectedScheduleActions` in the app, plain functions in a test).
 */
export type ScheduleActions = {
  loadCalendarItems: typeof loadCalendarItems
  loadSessionEdit: typeof loadSessionEdit
  loadSessionView: typeof loadSessionView
  saveScheduleEdits: typeof saveScheduleEdits
  scheduleOffers: typeof scheduleOffers
  publishOffer: (form: FormData) => Promise<SpacesWriteState>
}

const ScheduleActionsContext = createContext<ScheduleActions | null>(null)

export function ScheduleActionsProvider({
  actions,
  children,
}: {
  actions: ScheduleActions
  children: ReactNode
}) {
  return (
    <ScheduleActionsContext.Provider value={actions}>{children}</ScheduleActionsContext.Provider>
  )
}

export const useScheduleActions = () => {
  const actions = useContext(ScheduleActionsContext)
  if (!actions) throw new Error('Schedule actions are missing: wrap the screen in a provider')
  return actions
}
