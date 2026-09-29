import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '../access'

// Marquee source — external media coverage. Admin-curated, no author, no workflow.
export const Press: CollectionConfig = {
  slug: 'press',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'organisation', type: 'text', required: true }, // "Mada Masr", "OpenDemocracy", "Egyptian Streets"
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'article_url', type: 'text', required: true }, // external link to the piece mentioning CILAS
    { name: 'article_title', type: 'text' },
    { name: 'published_date', type: 'date' },
  ],
  admin: {
    useAsTitle: 'organisation',
    hidden: (ctx) => !ctx.user?.roles.includes('super_admin') && !ctx.user?.roles.includes('admin'),
  },
}
