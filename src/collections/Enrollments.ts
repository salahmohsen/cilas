import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminOrOwn, ownsViaPerson } from '@/access'

/**
 * A person's place in one course (CONTEXT.md). Joining a programme's
 * community is a membership instead. The archive has no per-course lists, so
 * enrollments start from now.
 */
export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  admin: {
    defaultColumns: ['person', 'course', 'status', 'slot'],
  },
  access: {
    read: isAdminOrOwn(ownsViaPerson),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  indexes: [{ fields: ['person', 'course'], unique: true }],
  fields: [
    { name: 'person', type: 'relationship', relationTo: 'people', required: true, index: true },
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'applied',
      options: [
        { label: 'Applied', value: 'applied' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Confirmed (paid)', value: 'confirmed' },
        { label: 'Completed', value: 'completed' },
        { label: 'Withdrawn', value: 'withdrawn' },
      ],
    },
    {
      name: 'slot',
      type: 'text',
      admin: { description: 'Which group they attend, e.g. "evening".' },
    },
    {
      // Narratives in lieu of grades. Only admins and the student can read
      // enrollments at all.
      name: 'assessment',
      type: 'richText',
      localized: true,
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'admin',
      options: [
        { label: 'Registration form', value: 'registration_form' },
        { label: 'Added by an admin', value: 'admin' },
        { label: 'Archive backfill', value: 'backfill' },
      ],
    },
  ],
}
