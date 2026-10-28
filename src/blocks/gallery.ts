import type { Block } from 'payload'

export const Gallery: Block = {
  slug: 'gallery',
  interfaceName: 'GalleryBlock',
  labels: { singular: 'Gallery', plural: 'Galleries' },
  fields: [
    {
      name: 'columnCount',
      label: 'Grid columns',
      type: 'select',
      required: true,
      defaultValue: '3',
      options: [
        { label: 'One', value: '1' },
        { label: 'Two', value: '2' },
        { label: 'Three', value: '3' },
        { label: 'Four', value: '4' },
      ],
      admin: { description: 'The grid uses fewer columns in narrow spaces and on phones.' },
    },
    {
      name: 'images',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { description: 'Add images and drag rows to change their order.' },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
          filterOptions: { mimeType: { contains: 'image/' } },
        },
        { name: 'caption', type: 'text' },
      ],
    },
  ],
}
