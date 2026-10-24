import type { CollectionConfig } from 'payload'

/**
 * One row per account (spec §8): the digest choice, daily by default; the
 * sending job arrives in step 3 and reads this.
 */
export const SpacePreferences: CollectionConfig = {
  slug: 'space-preferences',
  labels: { singular: 'Preference', plural: 'Preferences' },
  access: {
    read: ({ req }) => ({ account: { equals: (req.user as { id?: number })?.id ?? null } }),
    // A Where is ignored on create, so REST could write rows for any account;
    // spaces-write creates them with overrideAccess.
    create: () => false,
    update: ({ req }) =>
      req.user ? { account: { equals: (req.user as { id: number }).id } } : false,
    delete: () => false,
  },
  admin: { hidden: true },
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: 'digest',
      label: 'Email digest',
      type: 'select',
      required: true,
      defaultValue: 'daily',
      options: [
        { label: 'Daily at 08:00 Cairo', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Off', value: 'off' },
      ],
    },
  ],
  indexes: [{ fields: ['account'], unique: true }],
}
