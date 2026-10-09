import type { CollectionConfig } from 'payload'

import { slugField } from '@/fields/slug'
import { canSetTier, isAdmin, ownsViaFellows, readTiers } from '../access'

export const Events: CollectionConfig = {
  slug: 'events',
  access: {
    read: readTiers(ownsViaFellows),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      // Who may see this. Publication state is Payload's `_status`, not this.
      name: 'tier',
      type: 'select',
      defaultValue: 'owner',
      required: true,
      options: [
        { label: 'Owner only', value: 'owner' }, // whoever can edit it
        { label: 'Community', value: 'community' }, // signed-in members only
        { label: 'Public', value: 'public' }, // world
      ],
      // Admin-only on create *and* update, so an event is created owner-only
      // and promoting it to community or world stays an admin action.
      access: { create: canSetTier, update: canSetTier },
    },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    {
      label: 'Description',
      type: 'group',
      fields: [{ name: 'description', type: 'richText', localized: true }],
    },
    {
      label: 'When',
      type: 'group',
      fields: [
        {
          name: 'event_type',
          type: 'select',
          options: [
            { label: 'Talk', value: 'talk' },
            { label: 'Screening', value: 'screening' },
            { label: 'Performance', value: 'performance' },
            { label: 'Reading Group', value: 'reading_group' },
            { label: 'Exhibition', value: 'exhibition' },
            { label: 'Workshop', value: 'workshop' },
          ],
        },
        { name: 'date', type: 'date' },
        { name: 'end_date', type: 'date' }, // for multi-day events
        { name: 'start_time', type: 'text' },
        { name: 'recurring', type: 'checkbox' }, // reading groups recur weekly
        {
          name: 'frequency',
          type: 'select',
          options: ['weekly', 'biweekly', 'monthly'].map((s) => ({ label: s, value: s })),
          admin: { condition: (d) => d.recurring },
        },
        { name: 'recurrence_until', type: 'date', admin: { condition: (d) => d.recurring } },
      ],
    },
    {
      label: 'Details',
      type: 'group',
      fields: [
        {
          name: 'location',
          type: 'select',
          options: [
            { label: 'Offline', value: 'OFFLINE' },
            { label: 'Online', value: 'ONLINE' },
          ],
        },
        { name: 'fellows', type: 'relationship', relationTo: 'users', hasMany: true },
        {
          name: 'registration_form',
          type: 'relationship',
          relationTo: 'forms',
        },
      ],
    },
  ],
  admin: {
    useAsTitle: 'title',
    hidden: (ctx) => !ctx.user?.roles.includes('super_admin') && !ctx.user?.roles.includes('admin'),
  },
}
