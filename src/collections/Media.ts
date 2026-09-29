import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',

  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
      admin: {
        position: 'sidebar',
      },
    },
  ],

  upload: {
    // Image sizes are processed locally before upload
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
