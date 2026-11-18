import type { CollectionConfig } from 'payload'

import { isAdminUser, nobody, isAdmin } from '@/access'

/**
 * One row per account per notice version (spec §9): before a member's first
 * post in any space. Written by the action that records the acceptance;
 * read there too. Restoring history: admins.
 */
export const SpaceConsents: CollectionConfig = {
  slug: 'space-consents',
  labels: { singular: 'Consent', plural: 'Consents' },
  access: {
    read: ({ req }) =>
      isAdminUser(req.user)
        ? true
        : { account: { equals: (req.user as { id?: number })?.id ?? null } },
    create: nobody, // the action writes it with overrideAccess
    update: nobody,
    delete: isAdmin,
  },
  admin: { hidden: true },
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: { update: nobody },
    },
    { name: 'version', type: 'number', required: true },
    { name: 'accepted_at', type: 'date', required: true },
  ],
  indexes: [{ fields: ['account', 'version'], unique: true }],
}
