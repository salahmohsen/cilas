import { useState } from 'react'

import type { ScheduleEditsResult } from '@/actions/save-schedule-edits'
import type { CalendarItem } from '@/lib/calendar-items'

import { setSessionCancelled } from './cancel-session'
import { useScheduleActions } from './schedule-actions'
import type { ScheduleSaveText } from './schedule-save-text'

/**
 * Cancel and Restore for a host that has no session form: `setSessionCancelled`,
 * then the announcement offer (`offer`, from `useScheduleOffer`), once. `error`
 * is the sentence for a save that did not happen, for the host to show.
 */
export function useSessionCancellation({
  locale,
  text,
  offer,
}: {
  locale: string
  text: Pick<ScheduleSaveText, 'errorText'>
  offer: (
    before: CalendarItem[],
    after: CalendarItem[],
    returnTo: () => HTMLElement | null,
    courseId?: string,
  ) => void
}) {
  const actions = useScheduleActions()
  const [error, setError] = useState<string | null>(null)
  const run = async (
    session: { id: string; courseId: string; cancelled: boolean },
    returnTo: () => HTMLElement | null,
  ) => {
    setError(null)
    const result = await setSessionCancelled(session.id, session.cancelled, locale, actions).catch(
      (): ScheduleEditsResult => ({ ok: false, error: { code: 'failed' } }),
    )
    if (!result.ok) {
      setError(text.errorText(result.error))
      return false
    }
    offer(result.before, result.after, returnTo, session.courseId)
    return true
  }
  return { run, error }
}
