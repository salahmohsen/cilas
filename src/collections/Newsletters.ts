import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { emailEditorFeatures } from '@/lexical/email-features'

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
    components: { beforeListTable: ['/components/admin/subscribers-link#SubscribersLink'] },
    defaultColumns: ['title', 'issue_date', 'sent_at', '_status'],
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
      defaultValue: () => new Date().toISOString(),
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayOnly' } },
    },
    { name: 'cover_image', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    {
      name: 'cover_caption',
      type: 'richText',
      editor: lexicalEditor({ features: emailEditorFeatures }),
      admin: { position: 'sidebar', description: 'Shown under the cover image.' },
    },
    ...importFields(),
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Compose',
          fields: [
            {
              name: 'preheader',
              type: 'text',
              admin: {
                description: 'The line mail apps show after the subject. Empty: the title.',
              },
            },
            {
              name: 'sections',
              type: 'array',
              labels: { singular: 'Section', plural: 'Sections' },
              defaultValue: [{}],
              minRows: 1,
              admin: {
                description:
                  'Each section is one card in the email. Press / in its body to add columns, images, galleries, picks or a quote.',
                initCollapsed: false,
              },
              fields: [
                {
                  name: 'body',
                  type: 'richText',
                  editor: lexicalEditor({ features: emailEditorFeatures }),
                },
              ],
            },
          ],
        },
        {
          label: 'Audience and delivery',
          fields: [
            {
              name: 'send_to',
              label: 'Send to',
              type: 'relationship',
              relationTo: 'mailing-lists',
              admin: {
                description:
                  'Empty: the signup list. A synced list is brought up to date just before sending.',
              },
            },
            {
              name: 'actions',
              type: 'ui',
              admin: {
                components: { Field: '/components/admin/newsletter-actions#NewsletterActions' },
              },
            },
            {
              name: 'sent_at',
              type: 'date',
              admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
            },
            { name: 'broadcast_id', type: 'text', admin: { readOnly: true } },
            { name: 'stats', type: 'json', admin: { hidden: true } },
          ],
        },
        {
          label: 'Statistics',
          fields: [
            {
              name: 'statistics',
              type: 'ui',
              admin: {
                components: { Field: '/components/admin/newsletter-stats#NewsletterStats' },
              },
            },
          ],
        },
      ],
    },
  ],
}
