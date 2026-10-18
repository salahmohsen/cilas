import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminUser, personOf, readPeople } from '@/access'
import { slugField } from '@/fields/slug'
import { socialFields } from '@/fields/social'
import { importFields } from '@/fields/import'
import {
  revalidateCoursesAfterChange,
  revalidateCoursesAfterDelete,
} from '@/lib/revalidate-courses'

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
  // Its names show in the cached study list.
  hooks: {
    afterChange: [revalidateCoursesAfterChange],
    afterDelete: [revalidateCoursesAfterDelete],
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
      access: { update: ({ req }) => isAdminUser(req.user) },
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
    {
      label: 'Profile',
      type: 'group',
      fields: [{ name: 'bio', type: 'richText', localized: true }],
    },
    socialFields,
    {
      // Derived from courses.fellows; never stored on the person.
      name: 'courses',
      type: 'join',
      collection: 'courses',
      on: 'fellows',
      admin: { allowCreate: false, defaultColumns: ['title', 'cycle', 'course_type'] },
    },
    {
      name: 'governance',
      type: 'join',
      collection: 'governance',
      on: 'person',
      admin: { allowCreate: false, defaultColumns: ['role', 'term_from', 'term_to'] },
    },
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
    ...importFields(),
  ],
}
