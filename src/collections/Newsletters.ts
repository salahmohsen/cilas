import type { CollectionConfig, Where } from 'payload'

import { isAdmin, publishedOrAdmin } from '@/access'
import { slugField } from '@/fields/slug'
import { importFields } from '@/fields/import'
import { newsletterEndpoints } from '@/forms/newsletter-send'

/**
 * The archive of issues CILAS has sent. Subscribers live in Resend Audiences,
 * never here (ADR 0005).
 */
export const Newsletters: CollectionConfig = {
  slug: 'newsletters',
  access: {
    read: publishedOrAdmin,
    readVersions: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  versions: { drafts: { autosave: { interval: 2000 } } },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'issue_date', 'sent_at', '_status'],
    // The real email, rendered from the saved draft; it reloads on each save.
    livePreview: { url: ({ data }) => `/api/email-preview?kind=newsletter&id=${data?.id ?? ''}` },
  },
  endpoints: newsletterEndpoints,
  defaultSort: '-issue_date',
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    {
      name: 'issue_date',
      type: 'date',
      required: true,
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayOnly' } },
    },
    { name: 'cover_image', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    {
      name: 'preheader',
      type: 'text',
      admin: { description: 'The line mail apps show after the subject. Empty: the title.' },
    },
    { name: 'body', type: 'richText', localized: true, admin: { description: 'The intro, above the picks.' } },
    {
      name: 'picks',
      type: 'array',
      labels: { singular: 'Pick', plural: 'Picks' },
      admin: {
        description:
          'Courses, articles and the Bridge to show as cards, in this order. 8 or fewer keeps the email under Gmail’s size limit.',
      },
      fields: [
        {
          name: 'item',
          type: 'relationship',
          relationTo: ['courses', 'articles', 'programmes'],
          required: true,
          // Only what a visitor can open: published and public, or the Bridge.
          filterOptions: ({ relationTo }): Where =>
            relationTo === 'programmes'
              ? { kind: { equals: 'bridge' } }
              : { and: [{ _status: { equals: 'published' } }, { tier: { equals: 'public' } }] },
        },
        {
          name: 'note',
          type: 'text',
          admin: { description: 'One line under the card, e.g. “Applications close 3 Nov”.' },
        },
      ],
    },
    {
      name: 'actions',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '/components/admin/newsletter-actions#NewsletterActions' },
      },
    },
    {
      name: 'sent_at',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'broadcast_id', type: 'text', admin: { position: 'sidebar', readOnly: true } },
    ...importFields(),
  ],
}
