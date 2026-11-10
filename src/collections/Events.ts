import { tierField } from '@/fields/tier'
import type { CollectionConfig } from 'payload'

import { isAdmin, readTiers } from '@/access'
import { contributionField } from '@/fields/pricing'
import { registrationField } from '@/fields/registration'
import { scheduleField, timeRangeFields } from '@/fields/schedule'
import { slugField } from '@/fields/slug'
import { optionalHttpUrl } from '@/fields/validators'
import { revalidateAfterChange, revalidateAfterDelete } from '@/lib/revalidate'
import { importFields } from '@/fields/import'
import { lastEditedByField, stampLastEditor } from '@/fields/last-edited-by'

/**
 * A gathering that is not a course (CONTEXT.md). Its dates come from the same
 * schedule as courses (ADR 0002), so one expansion feeds the calendar.
 */
export const Events: CollectionConfig = {
  slug: 'events',
  access: {
    // Events have no owners: the owner tier means admins only.
    read: readTiers(undefined, { drafts: true }),
    readVersions: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  versions: { drafts: { autosave: { interval: 2000, showSaveDraftButton: true } } },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'event_type', 'schedule.start_date', 'tier', '_status'],
    livePreview: {
      url: ({ data, locale }) => `/${locale?.code ?? 'en'}/events/preview/${data?.id ?? ''}`,
    },
  },
  hooks: {
    beforeOperation: [
      ({ args, operation }) => {
        // Imports and older API clients send weekly slots without the new mode.
        if ((operation === 'create' || operation === 'update') && 'data' in args) {
          const schedule = args.data?.schedule
          if (schedule && !schedule.mode && (schedule.weeks || schedule.slots?.length)) {
            schedule.mode = 'recurring'
          }
        }
        return args
      },
    ],
    beforeChange: [stampLastEditor],
    afterChange: [revalidateAfterChange('events')],
    afterDelete: [revalidateAfterDelete('events')],
  },
  fields: [
    lastEditedByField,
    tierField({ sidebar: true }),
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    {
      name: 'cover_image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        position: 'sidebar',
        description:
          'Used on event cards. Add images to the description editor to show them on the event page.',
      },
    },
    ...importFields(),
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            { name: 'description', type: 'richText', localized: true },
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
          ],
        },
        {
          label: 'When and where',
          fields: [
            scheduleField({ event: true }),
            {
              label: 'Where',
              type: 'collapsible',
              fields: [
                { name: 'place', type: 'relationship', relationTo: 'places' },
                {
                  name: 'external_venue',
                  type: 'group',
                  admin: { description: 'Only when it is not at a CILAS place.' },
                  fields: [
                    { name: 'name', type: 'text', localized: true },
                    { name: 'address', type: 'text', localized: true },
                    { name: 'map_url', type: 'text', validate: optionalHttpUrl },
                  ],
                },
                { name: 'online_url', type: 'text', validate: optionalHttpUrl },
              ],
            },
            {
              name: 'agenda',
              type: 'array',
              label: 'Agenda (optional)',
              admin: {
                initCollapsed: true,
                description:
                  'Only for named segments within the event, such as a screening followed by a discussion. Set the event’s own date and time in When; no agenda is needed.',
              },
              fields: [
                { type: 'row', fields: [...timeRangeFields('25%')] },
                { name: 'title', type: 'text', localized: true, required: true },
              ],
            },
          ],
        },
        {
          label: 'Registration and contribution',
          fields: [registrationField(), contributionField({ dbName: 'event_price' })],
        },
        {
          label: 'Relationships',
          fields: [
            {
              name: 'series',
              type: 'relationship',
              relationTo: 'events',
              filterOptions: ({ id }) => (id ? { id: { not_equals: id } } : true),
              admin: { description: 'The event this one is part of.' },
            },
            {
              name: 'programme',
              type: 'relationship',
              relationTo: 'programmes',
            },
            { name: 'course', type: 'relationship', relationTo: 'courses' },
          ],
        },
      ],
    },
  ],
}
