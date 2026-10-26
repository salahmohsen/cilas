import type { CollectionConfig, Where } from 'payload'

import { isAdminUser } from '@/access'
import { contentWhere } from '@/lib/spaces'
import { RSVP_STATUSES } from '@/lib/space-event'

/**
 * One row per account and event post: the member's answer (going, maybe or
 * not going). Members answer through the server action only (rsvpSet), so
 * the archive, lock and past-event rules cannot be bypassed; reads follow the
 * space's readers, as reactions do.
 */
export const SpaceRsvps: CollectionConfig = {
  slug: 'space-rsvps',
  labels: { singular: 'Event answer', plural: 'Event answers' },
  access: {
    read: ({ req }) => contentWhere(req.payload, req.user, ['post']),
    create: ({ req }) => isAdminUser(req.user),
    update: () => false,
    delete: ({ req }) => {
      if (isAdminUser(req.user)) return true
      const own: Where = { account: { equals: (req.user as { id?: number })?.id ?? null } }
      return own
    },
  },
  admin: { hidden: true },
  fields: [
    { name: 'space', type: 'relationship', relationTo: 'spaces', required: true, index: true },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'space-posts',
      required: true,
      index: true,
    },
    { name: 'status', type: 'select', required: true, options: [...RSVP_STATUSES] },
  ],
  indexes: [{ fields: ['account', 'post'], unique: true }],
}
