import type { CollectionConfig } from 'payload'

import { canSetTier, isAdmin, readTiers } from '@/access'
import { pricingField } from '@/fields/pricing'
import { registrationField } from '@/fields/registration'
import { scheduleField, timeRangeFields } from '@/fields/schedule'
import { slugField } from '@/fields/slug'
import { httpUrl } from '@/fields/validators'

const optionalUrl = (value: unknown) => (value ? httpUrl(value) : true)

/**
 * A gathering that is not a course (CONTEXT.md). Its dates come from the same
 * schedule as courses (ADR 0002), so one expansion feeds the calendar.
 */
export const Events: CollectionConfig = {
  slug: 'events',
  access: {
    // Events have no owners: the owner tier means admins only.
    read: readTiers(),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'event_type', 'schedule.start_date', 'tier'],
  },
  fields: [
    {
      name: 'tier',
      type: 'select',
      required: true,
      defaultValue: 'owner',
      options: [
        { label: 'Owner only', value: 'owner' },
        { label: 'Community', value: 'community' },
        { label: 'Public', value: 'public' },
      ],
      access: { create: canSetTier, update: canSetTier },
      admin: { position: 'sidebar' },
    },
    {
      name: 'event_type',
      type: 'select',
      required: true,
      options: [
        { label: 'Talk', value: 'talk' },
        { label: 'Panel', value: 'panel' },
        { label: 'Book discussion', value: 'book_discussion' },
        { label: 'Reading group', value: 'reading_group' },
        { label: 'Screening', value: 'screening' },
        { label: 'Performance', value: 'performance' },
        { label: 'Music', value: 'music' },
        { label: 'Exhibition', value: 'exhibition' },
        { label: 'Open day', value: 'open_day' },
        { label: 'Workshop', value: 'workshop' },
        { label: 'Residency', value: 'residency' },
        { label: 'Visit', value: 'visit' },
        { label: 'Other', value: 'other' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'series',
      type: 'relationship',
      relationTo: 'events',
      filterOptions: ({ id }) => (id ? { id: { not_equals: id } } : true),
      admin: { position: 'sidebar', description: 'The event this one is part of.' },
    },
    { name: 'programme', type: 'relationship', relationTo: 'programmes', admin: { position: 'sidebar' } },
    { name: 'course', type: 'relationship', relationTo: 'courses', admin: { position: 'sidebar' } },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'description', type: 'richText', localized: true },
    scheduleField(),
    {
      label: 'Where',
      type: 'collapsible',
      fields: [
        { name: 'space', type: 'relationship', relationTo: 'spaces' },
        {
          name: 'external_venue',
          type: 'group',
          admin: { description: 'Only when it is not at a CILAS space.' },
          fields: [
            { name: 'name', type: 'text', localized: true },
            { name: 'address', type: 'text', localized: true },
            { name: 'map_url', type: 'text', validate: optionalUrl },
          ],
        },
        { name: 'online_url', type: 'text', validate: optionalUrl },
      ],
    },
    {
      name: 'agenda',
      type: 'array',
      admin: { description: 'Time blocks within the day, in Cairo time.' },
      fields: [
        { type: 'row', fields: [...timeRangeFields('25%')] },
        { name: 'title', type: 'text', localized: true, required: true },
      ],
    },
    {
      name: 'speakers',
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'person',
              type: 'relationship',
              relationTo: 'people',
              required: true,
              admin: { width: '60%' },
            },
            { name: 'role', type: 'text', localized: true, admin: { width: '40%' } }, // "moderator"
          ],
        },
      ],
    },
    {
      name: 'partners',
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'partner',
              type: 'relationship',
              relationTo: 'partners',
              required: true,
              admin: { width: '60%' },
            },
            {
              name: 'role',
              type: 'select',
              options: [
                { label: 'Sponsor', value: 'sponsor' },
                { label: 'Co-host', value: 'co_host' },
                { label: 'Venue', value: 'venue' },
                { label: 'Other', value: 'other' },
              ],
              admin: { width: '40%' },
            },
          ],
        },
      ],
    },
    registrationField(),
    pricingField({ dbName: 'event_price' }),
  ],
}
