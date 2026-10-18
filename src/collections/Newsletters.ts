import type { CollectionConfig, Field } from 'payload'

import { isAdmin, publishedOrAdmin } from '@/access'
import { slugField } from '@/fields/slug'
import { importFields } from '@/fields/import'
import { newsletterEndpoints } from '@/forms/newsletter-send'
import { PICK_TYPES } from '@/emails/pick-types'

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
    components: { beforeListTable: ['/components/admin/subscribers-link#SubscribersLink'] },
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
      name: 'sections',
      type: 'blocks',
      admin: {
        description:
          'After the intro, in this order. Keep the email short: Gmail cuts emails over about 100 KB, so use 8 picks or fewer and a few gallery images.',
      },
      blocks: [
        {
          slug: 'picks',
          labels: { singular: 'Picks', plural: 'Picks' },
          fields: [
            { name: 'heading', type: 'text', admin: { placeholder: 'In this issue' } },
            {
              name: 'items',
              type: 'array',
              labels: { singular: 'Pick', plural: 'Picks' },
              fields: [
                {
                  name: 'type',
                  type: 'select',
                  required: true,
                  defaultValue: 'course',
                  options: PICK_TYPES.map(({ value, label }) => ({ value, label })),
                  admin: { description: 'Choose the type first; the next field lists only that type.' },
                },
                // One field per type, shown for its type only: a short list to search.
                ...PICK_TYPES.map(
                  ({ value, label, relationTo, filter }): Field => ({
                    name: value,
                    label,
                    type: 'relationship',
                    relationTo,
                    ...(filter ? { filterOptions: () => filter } : {}),
                    admin: { condition: (_, sibling) => sibling?.type === value },
                    validate: (v: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
                      siblingData?.type !== value || v ? true : `Choose the ${label.toLowerCase()}.`,
                  }),
                ),
                {
                  name: 'note',
                  type: 'text',
                  admin: { description: 'One line under the card, e.g. “Applications close 3 Nov”.' },
                },
              ],
            },
          ],
        },
        {
          slug: 'gallery',
          labels: { singular: 'Gallery', plural: 'Galleries' },
          fields: [
            { name: 'heading', type: 'text' },
            {
              name: 'columns',
              type: 'select',
              defaultValue: '2',
              options: [
                { label: '2 columns', value: '2' },
                { label: '3 columns (one column on phones)', value: '3' },
              ],
            },
            {
              name: 'images',
              type: 'array',
              minRows: 1,
              fields: [
                { name: 'image', type: 'upload', relationTo: 'media', required: true },
                { name: 'caption', type: 'text' },
              ],
            },
          ],
        },
        {
          slug: 'quote',
          labels: { singular: 'Quote', plural: 'Quotes' },
          fields: [
            { name: 'text', type: 'textarea', required: true },
            { name: 'attribution', type: 'text', admin: { description: 'Who said it, e.g. “Ghosoun Ismail, fellow”.' } },
          ],
        },
        {
          slug: 'text',
          labels: { singular: 'Text', plural: 'Texts' },
          fields: [{ name: 'body', type: 'richText', required: true }],
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
