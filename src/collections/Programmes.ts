import { copyRegistrationTemplate } from '@/forms/templates'
import { previewUrl } from '@/lib/preview-url'
import type { CollectionConfig } from 'payload'

import { isAdmin, publishedOrAdmin } from '@/access'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import { contributionField } from '@/fields/pricing'
import { registrationField } from '@/fields/registration'
import { slugField } from '@/fields/slug'
import { importFields } from '@/fields/import'
import { deleteOwnedSpaces } from '@/lib/space-delete'
import { ensureSpaceFor } from '@/lib/space-hooks'

/**
 * A path through several cycles that people join as a cohort. Its courses are
 * derived from its components, never stored (ADR 0003); its people come from
 * memberships. Drafts hold unverified years until someone confirms them.
 */
export const Programmes: CollectionConfig = {
  slug: 'programmes',
  access: {
    read: publishedOrAdmin,
    // Without this, Payload lets any signed-in account read drafts through
    // the versions endpoint.
    readVersions: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', '_status'],
    // Through /api/preview, as courses and articles: it checks the editor,
    // turns on draft mode and opens the programme's page with this draft.
    livePreview: {
      url: previewUrl('programmes'),
    },
  },
  fields: [
    { name: 'cover', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    ...importFields(),
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Overview',
          fields: [
            {
              name: 'tagline',
              type: 'text',
              localized: true,
              admin: {
                description:
                  'One line under the title, e.g. “A year of the liberal arts in Cairo”.',
              },
            },
            {
              name: 'overview',
              type: 'richText',
              localized: true,
              admin: {
                description:
                  'Write the introduction here. Use lists for highlights and quotes for testimonials, in the order you want readers to see them.',
              },
            },
            {
              name: 'highlights',
              type: 'array',
              fields: [{ name: 'text', type: 'text', localized: true, required: true }],
              admin: { hidden: true, readOnly: true },
            },
            {
              name: 'testimonials',
              type: 'array',
              fields: [
                { name: 'quote', type: 'textarea', localized: true, required: true },
                { name: 'attribution', type: 'text', localized: true }, // "CILASian, 2018–19"
                { name: 'person', type: 'relationship', relationTo: 'people' },
              ],
              admin: { hidden: true, readOnly: true },
            },
            {
              name: 'kind',
              type: 'select',
              required: true,
              options: [
                { label: 'Bridge', value: 'bridge' },
                { label: "Women's Studies", value: 'women_studies' },
                { label: 'Residency', value: 'residency' },
              ],
              admin: {
                description:
                  'What sort of programme: the Bridge (the year-long programme), Women’s Studies or a Residency.',
              },
            },
          ],
        },
        {
          label: 'Structure',
          fields: [
            {
              label: 'Structure',
              type: 'collapsible',
              fields: [
                {
                  name: 'cycles',
                  type: 'relationship',
                  relationTo: 'cycles',
                  hasMany: true,
                  admin: { description: 'The semester cycles, in order.' },
                },
                {
                  name: 'components',
                  type: 'array',
                  admin: {
                    description: "Each part's courses are its cycle's courses of these types.",
                  },
                  fields: [
                    { name: 'label', type: 'text', localized: true, required: true },
                    { name: 'description', type: 'textarea', localized: true },
                    { name: 'cycle', type: 'relationship', relationTo: 'cycles', required: true },
                    {
                      name: 'course_types',
                      type: 'select',
                      hasMany: true,
                      required: true,
                      options: [...COURSE_TYPE_OPTIONS],
                    },
                  ],
                },
              ],
            },
            {
              label: 'Commitment',
              type: 'collapsible',
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'capacity',
                      type: 'number',
                      min: 1,
                      admin: { description: 'Seats available, e.g. 20.', width: '50%' },
                    },
                    {
                      name: 'weekly_hours',
                      type: 'number',
                      min: 0,
                      admin: {
                        description: 'Expected hours of study a week, e.g. 9.',
                        width: '50%',
                      },
                    },
                  ],
                },
                {
                  name: 'schedule_note',
                  type: 'textarea',
                  localized: true,
                  admin: {
                    description:
                      'When it meets, in words, e.g. “Saturdays and Tuesdays, from 10:30 or 5:30, three hours”.',
                  },
                },
                {
                  name: 'requirements',
                  type: 'richText',
                  localized: true,
                  admin: {
                    description:
                      'What applicants need, e.g. “A high-school certificate; a university degree helps.”',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Applications and contribution',
          fields: [
            registrationField(),
            contributionField({ dbName: 'programme_price', paymentPlans: true }),
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      copyRegistrationTemplate(
        'bridge_template',
        (programme, operation) => operation === 'create' && programme.kind === 'bridge',
      ),
    ],
    afterChange: [ensureSpaceFor('cohort')],
    beforeDelete: [deleteOwnedSpaces('programme')],
  },
}
