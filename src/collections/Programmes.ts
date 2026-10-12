import type { CollectionConfig } from 'payload'

import { isAdmin, publishedOrAdmin } from '@/access'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import { pricingField } from '@/fields/pricing'
import { registrationField } from '@/fields/registration'
import { slugField } from '@/fields/slug'
import { importFields } from '@/fields/import'

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
      url: ({ data }) => `/api/preview?collection=programmes&slug=${data?.slug ?? ''}`,
    },
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Bridge', value: 'bridge' },
        { label: "Women's Studies", value: 'women_studies' },
        { label: 'Residency', value: 'residency' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'cover', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'tagline', type: 'text', localized: true },
    { name: 'overview', type: 'richText', localized: true },
    {
      name: 'highlights',
      type: 'array',
      fields: [{ name: 'text', type: 'text', localized: true, required: true }],
    },
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
          admin: { description: "Each part's courses are its cycle's courses of these types." },
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
        { name: 'featured_courses', type: 'relationship', relationTo: 'courses', hasMany: true },
        {
          name: 'self_directed_study',
          type: 'checkbox',
          admin: { description: 'A self-directed study period between the semesters.' },
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
            { name: 'capacity', type: 'number', min: 1, admin: { width: '50%' } },
            { name: 'weekly_hours', type: 'number', min: 0, admin: { width: '50%' } },
          ],
        },
        { name: 'schedule_note', type: 'textarea', localized: true },
        { name: 'requirements', type: 'richText', localized: true },
      ],
    },
    registrationField(),
    pricingField({ dbName: 'programme_price' }),
    { name: 'partners', type: 'relationship', relationTo: 'partners', hasMany: true },
    {
      name: 'testimonials',
      type: 'array',
      fields: [
        { name: 'quote', type: 'textarea', localized: true, required: true },
        { name: 'attribution', type: 'text', localized: true }, // "CILASian, 2018–19"
        { name: 'person', type: 'relationship', relationTo: 'people' },
      ],
    },
    {
      name: 'faqs',
      type: 'array',
      labels: { singular: 'FAQ', plural: 'FAQs' },
      fields: [
        { name: 'question', type: 'text', localized: true, required: true },
        { name: 'answer', type: 'richText', localized: true },
      ],
    },
    ...importFields(),
  ],
}
