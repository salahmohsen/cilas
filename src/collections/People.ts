import { adminOnlyField, isAdmin, isAdminUser, personOf, readPeople } from '@/access'
import type { CollectionConfig } from 'payload'

import { slugField } from '@/fields/slug'
import { socialFields } from '@/fields/social'
import { importFields } from '@/fields/import'
import { revalidateAfterChange, revalidateAfterDelete } from '@/lib/revalidate'

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
    // Everyone but an admin lists only their own profile, which they keep
    // current; the site still reads every shown person through `read`.
    baseFilter: ({ req }) =>
      !req.user || isAdminUser(req.user) ? null : { id: { equals: personOf(req.user) ?? 0 } },
  },
  access: {
    read: readPeople,
    create: isAdmin,
    // A signed-in person may keep their own profile current.
    update: ({ req }) => {
      if (isAdminUser(req.user)) return true
      const person = personOf(req.user)
      return person === null ? false : { id: { equals: person } }
    },
    delete: isAdmin,
  },
  hooks: {
    afterChange: [revalidateAfterChange('people')],
    afterDelete: [revalidateAfterDelete('people')],
  },
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    slugField({ useAsSlug: 'name' }),
    {
      // Off for new people, applicants accepted from a form among them.
      // Archive imports and the seed turn it on.
      name: 'visible',
      type: 'checkbox',
      label: 'Show on the site',
      defaultValue: false,
      index: true,
      access: { update: adminOnlyField },
      admin: {
        position: 'sidebar',
        description: 'Off: no profile page, and left out of lists and search.',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      admin: { position: 'sidebar' },
    },
    ...importFields(),
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Profile',
          fields: [
            {
              label: 'Profile',
              type: 'group',
              fields: [{ name: 'bio', type: 'richText', localized: true }],
            },
            socialFields,
          ],
        },
        {
          label: 'Teaching',
          fields: [
            {
              // Derived from courses.fellows; never stored on the person.
              name: 'courses',
              type: 'join',
              collection: 'courses',
              on: 'fellows',
              admin: { allowCreate: false, defaultColumns: ['title', 'cycle', 'course_type'] },
            },
          ],
        },
        {
          label: 'Memberships and enrollments',
          fields: [
            {
              name: 'memberships',
              type: 'join',
              collection: 'memberships',
              on: 'person',
              admin: { allowCreate: true, defaultColumns: ['programme', 'role'] },
            },
            {
              name: 'enrollments',
              type: 'join',
              collection: 'enrollments',
              on: 'person',
              admin: { allowCreate: true, defaultColumns: ['course', 'status'] },
            },
          ],
        },
        {
          label: 'Governance',
          fields: [
            {
              name: 'governance',
              type: 'join',
              collection: 'governance',
              on: 'person',
              admin: { allowCreate: false, defaultColumns: ['role', 'term_from', 'term_to'] },
            },
          ],
        },
      ],
    },
  ],
}
