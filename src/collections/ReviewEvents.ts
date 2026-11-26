import type { CollectionConfig } from 'payload'

import { isAdmin, nobody } from '@/access'
import { REVIEW_REQUESTS, REVIEW_STATES } from '@/lib/review'
import { REVIEWED } from '@/lib/reviewed-collections'

export const ReviewEvents: CollectionConfig = {
  slug: 'review-events',
  admin: { hidden: true },
  timestamps: false,
  access: { read: isAdmin, create: nobody, update: nobody, delete: nobody },
  indexes: [{ fields: ['collection', 'doc'] }],
  fields: [
    {
      name: 'collection',
      type: 'select',
      options: REVIEWED.map(({ collection }) => collection),
      required: true,
    },
    { name: 'doc', type: 'number', required: true, index: true },
    { name: 'version', type: 'number' },
    { name: 'from', type: 'select', options: [...REVIEW_STATES], required: true },
    { name: 'to', type: 'select', options: [...REVIEW_STATES], required: true },
    { name: 'request', type: 'select', options: [...REVIEW_REQUESTS] },
    { name: 'note', type: 'textarea' },
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    { name: 'at', type: 'date', required: true },
  ],
}
