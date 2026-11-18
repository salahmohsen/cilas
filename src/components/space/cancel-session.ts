import type { ScheduleEditsResult } from '@/actions/save-schedule-edits'

import type { ScheduleActions } from './schedule-actions'

/**
 * Cancels a session, or restores it, through the one save path (decision 11):
 * its own fields are read in `locale` and sent back with `cancelled` changed,
 * so a save writes only what the session already holds in that language. A
 * session changed since it was read is refused as stale, like any save.
 */
export async function setSessionCancelled(
  id: string,
  cancelled: boolean,
  locale: string,
  {
    loadSessionEdit,
    saveScheduleEdits,
  }: Pick<ScheduleActions, 'loadSessionEdit' | 'saveScheduleEdits'>,
): Promise<ScheduleEditsResult> {
  const loaded = await loadSessionEdit(id, locale)
  if (!loaded.ok)
    return {
      ok: false,
      error:
        loaded.error === 'not-found'
          ? { code: 'not-found', itemId: id }
          : { code: loaded.error === 'unauthenticated' ? 'unauthenticated' : 'failed' },
    }
  const { meetings: _meetings, ...values } = loaded.values
  return saveScheduleEdits(
    { details: [{ op: 'edit', id, version: loaded.version, values: { ...values, cancelled } }] },
    locale,
  )
}
