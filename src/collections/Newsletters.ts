import type { CollectionConfig } from 'payload'

import { isAdmin, publishedOrAdmin } from '@/access'
import { slugField } from '@/fields/slug'

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
  versions: { drafts: true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'issue_date', '_status'],
  },
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
    { name: 'body', type: 'richText', localized: true },
  ],
}
