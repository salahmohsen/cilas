import type { CollectionConfig } from 'payload'

import { isAdmin, isAuthenticated } from '@/access'

import { importFields } from '@/fields/import'
import { revalidateAfterChange, revalidateAfterDelete } from '@/lib/revalidate'

export const Media: CollectionConfig = {
  slug: 'media',
  hooks: {
    afterChange: [revalidateAfterChange('media')],
    afterDelete: [revalidateAfterDelete('media')],
  },

  access: {
    read: () => true,
    // Anyone signed in uploads (an author's cover image); only admins change
    // or remove what is there, as one image can serve many pages.
    create: isAuthenticated,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description:
          'Describes the image for people who can’t see it, e.g. “Students reading on the rooftop”.',
        position: 'sidebar',
      },
    },
    ...importFields(),
  ],

  upload: {
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card',
        width: 768,
        height: 1024,
        position: 'centre',
      },
    ],
    formatOptions: {
      format: 'webp', // Convert uploads to WebP
      options: {
        quality: 80,
      },
    },
  },
}
