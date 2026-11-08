import type { CollectionConfig } from 'payload'

/**
 * Per account and space (spec §2 first steps, spec's "new posts since the
 * last visit"): what the member has done here and when they last looked.
 * Also the whole checklist's mark storage; nothing here gates reading.
 */
export const SpaceVisits: CollectionConfig = {
  slug: 'space-visits',
  labels: { singular: 'Visit', plural: 'Visits' },
  // Anyone signed-in may read and write only their own rows; the collection
  // never leaves members' hands, so a flat id-own rule is enough.
  access: {
    read: ({ req }) => ({ account: { equals: (req.user as { id?: number })?.id ?? null } }),
    // A Where is ignored on create, so REST could write rows for any account;
    // spaces-write creates them with overrideAccess.
    create: () => false,
    update: ({ req }) =>
      req.user ? { account: { equals: (req.user as { id: number }).id } } : false,
    delete: () => false, // rows hold a timestamp and checklist marks, no content: the 30-day purge leaves them
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
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
      required: true,
      index: true,
      access: { update: () => false },
    },
    { name: 'last_visited_at', type: 'date', required: true },
    { name: 'saw_privacy', type: 'checkbox', defaultValue: false },
    { name: 'introduced', type: 'checkbox', defaultValue: false },
    { name: 'read_pinned', type: 'checkbox', defaultValue: false },
    { name: 'checked_profile', type: 'checkbox', defaultValue: false },
    { name: 'chose_digest', type: 'checkbox', defaultValue: false },
  ],
  indexes: [{ fields: ['account', 'space'], unique: true }],
}
