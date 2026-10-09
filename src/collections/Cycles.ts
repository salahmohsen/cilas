import type { CollectionConfig, CollectionBeforeValidateHook, FieldHook } from 'payload'

import { slugField } from '@/fields/slug'
import { slugify } from '@/lib/slugify'
import { anyone, isAdmin } from '../access'

const buildTitle: FieldHook = ({ value, data }) => {
  const cycle = data?.cycle
  if (cycle?.season && cycle?.year) {
    return `${cycle.season.charAt(0).toUpperCase()}${cycle.season.slice(1)} ${cycle.year}`
  }
  return value
}

/**
 * The built-in slug field generates inside a field `beforeChange` hook, which
 * races the sibling slug field's `required` validation (fields traverse in
 * parallel), and `title` itself is only known server-side. Deriving the slug
 * here in collection `beforeValidate` runs ahead of both.
 */
const buildSlug: CollectionBeforeValidateHook = ({ data }) => {
  if (data && !data.slug && data.title) {
    data.slug = slugify(data.title)
  }
  return data
}

export const Cycles: CollectionConfig = {
  slug: 'cycles',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      admin: {
        hidden: true,
      },
      hooks: {
        beforeValidate: [buildTitle],
      },
    },
    slugField({ useAsSlug: 'title' }),
    {
      label: 'Cycle',
      name: 'cycle',
      type: 'group',
      fields: [
        {
          name: 'season',
          type: 'select',
          options: ['fall', 'winter', 'spring', 'summer'].map((s) => ({ label: s, value: s })),
        },
        { name: 'year', type: 'number' },
        {
          name: 'mode',
          type: 'select',
          options: [
            { label: 'Offline', value: 'OFFLINE' },
            { label: 'Online', value: 'ONLINE' },
            { label: 'Hybrid', value: 'HYBRID' },
          ],
        },
      ],
    },
    {
      label: 'Programme',
      type: 'group',
      name: 'programme',
      fields: [
        {
          name: 'programme',
          type: 'relationship',
          relationTo: 'programmes',
        },
      ],
    },
    {
      label: 'Courses',
      type: 'group',
      name: 'courses',
      fields: [{ name: 'courses', type: 'relationship', relationTo: 'courses', hasMany: true }],
    },
  ],
  hooks: {
    beforeValidate: [buildSlug],
  },
  admin: {
    useAsTitle: 'title',
  },
}
