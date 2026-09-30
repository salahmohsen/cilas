import type { CollectionConfig } from 'payload'

import { canSetStatus, isAdmin, ownsViaFellows, readTiers } from '../access'

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
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      required: true,
      options: [
        { label: 'Draft', value: 'draft' }, // owner only
        { label: 'Community', value: 'community' }, // signed-in members only
        { label: 'Public', value: 'public' }, // world
      ],
      // Admin-only on create *and* update, so an event is created unpublished
      // and promoting it to community or world stays an admin action.
      access: { create: canSetStatus, update: canSetStatus },
    },
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'description', type: 'richText', localized: true },
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
  admin: {
    useAsTitle: 'title',
    hidden: (ctx) => !ctx.user?.roles.includes('super_admin') && !ctx.user?.roles.includes('admin'),
  },
}
