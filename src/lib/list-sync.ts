import type { Payload } from 'payload'

import { env } from '@/env'
import { memberEmails, segmentDiff, type MembersRule } from '@/lib/list-members'
import { addToSegment, listContacts, paced, removeFromSegment } from '@/lib/resend-contacts'

/** Passed in `context` when a sync writes its result, so the write does not sync again. */
export const SYNC_WRITE = 'mailingListSyncWrite'

export type SyncResult = { members: number; added: number; removed: number; failed: number }

type List = {
  id: number
  source?: string | null
  segment_id?: string | null
  members?: MembersRule | null
}

const running = new Set<number>()

/**
 * Makes a synced list's Resend segment hold exactly its members: adds who is
 * missing, takes out who no longer belongs. A contact taken out stays in
 * Resend for its other lists, and an unsubscribe someone made is kept.
 * Records the outcome on the list. Signup lists are left alone.
 */
export const syncList = async (payload: Payload, list: List): Promise<SyncResult | null> => {
  if (list.source !== 'members' || !list.segment_id || !env.RESEND_API_KEY) return null
  if (running.has(list.id)) throw new Error('This list is syncing already.')
  running.add(list.id)
  const apiKey = env.RESEND_API_KEY
  const segmentId = list.segment_id
  try {
    const [wanted, current] = await Promise.all([
      memberEmails(payload, list.members ?? {}),
      listContacts(apiKey, segmentId),
    ])
    const { add, remove } = segmentDiff(wanted, current)
    const failed =
      (await paced(add, (email) => addToSegment(apiKey, segmentId, email))) +
      (await paced(remove, (email) => removeFromSegment(apiKey, segmentId, email)))
    const result = { members: wanted.length, added: add.length, removed: remove.length, failed }
    await record(payload, list.id, {
      last_synced: new Date().toISOString(),
      member_count: wanted.length,
      sync_note: failed
        ? `${failed} of ${add.length + remove.length} changes failed; sync again.`
        : null,
    })
    return result
  } catch (error) {
    await record(payload, list.id, { sync_note: `Sync failed: ${(error as Error).message}` }).catch(
      () => {},
    )
    throw error
  } finally {
    running.delete(list.id)
  }
}

const record = (payload: Payload, id: number, data: Record<string, unknown>) =>
  payload.update({
    collection: 'mailing-lists',
    id,
    data,
    overrideAccess: true,
    context: { [SYNC_WRITE]: true },
  })

/** A sync after the request has answered: a first sync of a big list takes minutes. */
export const syncLater = (payload: Payload, list: List) => {
  void syncList(payload, list).catch((error) =>
    payload.logger.error({ err: error, msg: `Mailing list ${list.id} failed to sync` }),
  )
}
