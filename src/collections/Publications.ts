import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/access'
import { creditsField } from '@/fields/credits'
import { slugField } from '@/fields/slug'
import { httpUrl } from '@/fields/validators'
import { importFields } from '@/fields/import'

/**
 * An edited collection of articles, often produced by a course or lab
 * (CONTEXT.md). Its texts are articles; no PDF is stored (ADR 0004).
 */
export const Publications: CollectionConfig = {
  slug: 'publications',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'year_from'],
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: 'Essay collection', value: 'essay_collection' },
        { label: 'Translation booklet', value: 'translation_booklet' },
        { label: 'Research', value: 'research' },
        { label: 'Other', value: 'other' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'cover_image', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    {
      type: 'row',
      admin: { position: 'sidebar' },
      fields: [
        { name: 'year_from', type: 'number', min: 2012, max: 2100, admin: { width: '50%' } },
        { name: 'year_to', type: 'number', min: 2012, max: 2100, admin: { width: '50%' } },
      ],
    },
    { name: 'title', type: 'text', required: true, localized: true },
    slugField(),
    { name: 'subtitle', type: 'text', localized: true },
    { name: 'intro', type: 'richText', localized: true },
    {
      name: 'foreword',
      type: 'relationship',
      relationTo: 'articles',
      admin: { description: 'A signed essay, so it is an article.' },
    },
    {
      name: 'articles',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      admin: { description: 'In reading order.' },
    },
    creditsField(),
    {
      label: 'Provenance',
      type: 'collapsible',
      fields: [
        { name: 'produced_by', type: 'relationship', relationTo: 'courses', hasMany: true },
        { name: 'funders', type: 'relationship', relationTo: 'partners', hasMany: true },
        {
          name: 'license',
          type: 'select',
          options: [
            { label: 'CC BY-NC-SA', value: 'cc_by_nc_sa' },
            { label: 'CC BY-SA', value: 'cc_by_sa' },
            { label: 'CC BY', value: 'cc_by' },
            { label: 'All rights reserved', value: 'all_rights_reserved' },
          ],
        },
        {
          // A link to the designed print edition, e.g. a Wayback copy. No file is stored.
          name: 'print_edition_url',
          type: 'text',
          validate: (value: unknown) => (value ? httpUrl(value) : true),
        },
      ],
    },
    ...importFields(),
  ],
}
