import type { Block } from 'payload'

export const PersonProfile: Block = {
  slug: 'personProfile',
  interfaceName: 'PersonProfileBlock',
  labels: { singular: 'Person profile', plural: 'Person profiles' },
  fields: [
    {
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      required: true,
      filterOptions: { visible: { equals: true } },
      admin: {
        description:
          'Uses the public profile’s name, photo, bio, website, and social links. Update those on the person’s profile.',
      },
    },
  ],
}
