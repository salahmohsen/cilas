import type { CollectionConfig } from 'payload'

import { anyone, hasRole, isAdmin } from '../access'
import { importFields } from '@/fields/import'

/** Board of advisors and board of trustees, one row per person per term. */
export const Governance: CollectionConfig = {
  slug: 'governance',
  admin: {
    hidden: ({ user }) => !hasRole(user, 'super_admin'),
    defaultColumns: ['person', 'role', 'term_from', 'term_to'],
  },
  defaultSort: 'order',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'person', type: 'relationship', relationTo: 'people', required: true, index: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'Advisor', value: 'advisor' },
        { label: 'Trustee', value: 'trustee' },
      ],
    },
    // Their position elsewhere, e.g. "Dean of Liberal Arts, Leiden University College".
    { name: 'title', type: 'text', localized: true },
    // "Chairman", "Secretary", "Treasurer"
    {
      name: 'board_role',
      type: 'text',
      admin: {
        description: 'Their role on the board, e.g. “Chair” or “Treasurer”.',
        condition: (d) => d.role === 'trustee',
      },
    },
    // "curriculum design and university partnerships"
    {
      name: 'advises_on',
      type: 'text',
      localized: true,
      admin: {
        description: 'What they advise on, e.g. “curriculum design and university partnerships”.',
        condition: (d) => d.role === 'advisor',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'term_from',
          type: 'number',
          min: 2012,
          max: 2100,
          admin: { description: 'First year on the board, e.g. 2016.', width: '50%' },
        },
        { name: 'term_to', type: 'number', min: 2012, max: 2100, admin: { width: '50%' } },
      ],
    },
    {
      name: 'order',
      type: 'number',
      admin: {
        description: 'Position in the list: lower numbers come first.',
        position: 'sidebar',
      },
    },
    ...importFields(),
  ],
}
