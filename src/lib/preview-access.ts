import { createLocalReq, type Payload, type Where } from 'payload'

import type { User } from '@/payload-types'

import type { PreviewCollection } from '@/lib/preview-url'

/** Draft cookies select a version; the current editor's access selects the documents. */
export const previewWhere = async (
  payload: Payload,
  collection: PreviewCollection,
  user: User | null,
): Promise<Where | false> => {
  if (!user) return false
  const req = await createLocalReq({ user }, payload)
  const access = await payload.collections[collection].config.access.update?.({ req })
  if (!access) return false
  return access === true ? {} : access
}
