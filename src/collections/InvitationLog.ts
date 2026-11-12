import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/access'

/**
 * One row per set-password email sent (src/lib/invitation.ts), for the daily
 * count of bulk invitations. Written by the server only; not in the sidebar.
 */
export const InvitationLog: CollectionConfig = {
  slug: 'invitation-log',
  labels: { singular: 'Invitation sent', plural: 'Invitations sent' },
  admin: { group: false, hidden: true, useAsTitle: 'createdAt' },
  access: { read: isAdmin, create: () => false, update: () => false, delete: () => false },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
    },
  ],
}
