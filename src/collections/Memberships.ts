import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/access'
import { importFields } from '@/fields/import'

/**
 * A person's place in one programme's community. Every membership makes that
 * person a CILASian of that programme (CONTEXT.md). Taking a single course is
 * an enrollment, not a membership.
 */
export const Memberships: CollectionConfig = {
  slug: 'memberships',
  admin: {
    defaultColumns: ['person', 'programme', 'role'],
  },
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  indexes: [{ fields: ['person', 'programme'], unique: true }],
  fields: [
    { name: 'person', type: 'relationship', relationTo: 'people', required: true, index: true },
    {
      name: 'programme',
      type: 'relationship',
      relationTo: 'programmes',
      required: true,
      index: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'student',
      options: [
        { label: 'Student', value: 'student' },
        { label: 'Residential fellow', value: 'residential_fellow' },
        { label: 'Visiting fellow', value: 'visiting_fellow' },
      ],
    },
    // e.g. "coordinates the field of Social Sciences"
    {
      name: 'title',
      type: 'text',
      localized: true,
      admin: {
        description:
          'Their role in words, if it needs more than the role, e.g. “Programme coordinator”.',
      },
    },
    ...importFields(),
  ],
}
