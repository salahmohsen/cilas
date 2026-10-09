import type { CollectionConfig } from 'payload'

import { anyone, isAdmin, isAdminUser, personOf } from '@/access'
import { slugField } from '@/fields/slug'
import { socialFields } from '@/fields/social'

/**
 * Everyone who appears on the site: fellows, CILASians, authors, advisors,
 * speakers. Most never log in; a `users` account may link to one person
 * (ADR 0001).
 */
export const People: CollectionConfig = {
  slug: 'people',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
  },
  access: {
    read: anyone,
    create: isAdmin,
    // A signed-in person may keep their own profile current.
    update: ({ req }) => {
      if (isAdminUser(req.user)) return true
      const person = personOf(req.user)
      return person === null ? false : { id: { equals: person } }
    },
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    slugField({ useAsSlug: 'name' }),
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      admin: { position: 'sidebar' },
    },
    {
      label: 'Profile',
      type: 'group',
      fields: [{ name: 'bio', type: 'richText', localized: true }],
    },
    socialFields,
  ],
}
