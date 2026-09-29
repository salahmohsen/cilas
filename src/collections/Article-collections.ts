import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '../access'

// The Pigeon Tower section — CILAS' own productions.
export const ArticleCollections: CollectionConfig = {
  slug: 'article-collections',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'subtitle', type: 'text', localized: true },
    { name: 'description', type: 'richText', localized: true },
    {
      name: 'articles',
      type: 'relationship',
      hasMany: true,
      relationTo: "articles"
    },
    { name: 'cover_image', type: 'upload', relationTo: 'media' },
  ],
  admin: {
    useAsTitle: "title"
  }
}
