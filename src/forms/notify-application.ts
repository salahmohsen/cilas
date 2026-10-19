import type { CollectionAfterChangeHook } from 'payload'

import { notify } from '@/lib/notify'
import { adminRecipients } from '@/lib/review-mail'

/**
 * A new application leaves a notification for every admin (the bell in the
 * admin's top bar). Contact messages, which apply to nothing, do not.
 */
export const notifyNewApplication: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create' || !doc.target?.value) return doc
  const { relationTo, value } = doc.target as {
    relationTo: 'courses' | 'programmes'
    value: number | { id: number }
  }
  const id = typeof value === 'object' ? value.id : value
  const target = await req.payload
    .findByID({ collection: relationTo, id, depth: 0, overrideAccess: true })
    .catch(() => null)
  const admins = await adminRecipients(req)
  await notify(
    req.payload,
    admins.map((a) => a.id),
    {
      kind: 'application',
      title: `New application to “${target?.title ?? relationTo}”`,
      link: `/admin/collections/form-submissions/${doc.id}`,
    },
  )
  return doc
}
