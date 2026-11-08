import type { CollectionConfig } from 'payload'

/**
 * One row per account (spec §8): the digest choice, weekly by default (an
 * account with no row counts as weekly), the account-wide stop for every
 * space email, and when the last digest was claimed. The sender is
 * src/lib/space-digest.ts; it creates the row on a first digest.
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
      defaultValue: 'weekly',
      options: [
        { label: 'Daily at 16:00 Cairo', value: 'daily' },
        { label: 'Weekly, Sunday at 16:00 Cairo', value: 'weekly' },
        { label: 'Off', value: 'off' },
      ],
    },
    {
      // Stops digests and announcement emails for every space at once. The
      // digest choice above stays, so turning email back on restores it.
      name: 'stop_all_email',
      label: 'Stop all space email',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      // The language the member last saved here; the digest follows it.
      name: 'locale',
      type: 'select',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Arabic', value: 'ar' },
      ],
    },
    {
      // Claimed before a digest is sent, so a retry or an overlapping run
      // cannot send it twice (src/lib/space-digest.ts).
      name: 'digest_sent_at',
      type: 'date',
      admin: { readOnly: true },
    },
  ],
  indexes: [{ fields: ['account'], unique: true }],
}
