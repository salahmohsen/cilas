import type { CollectionConfig } from 'payload'

import { anyone, hasRole, isAdmin } from '../access'

// Advisors + trustees — external Board members. No login, content only.
export const Governance: CollectionConfig = {
  slug: 'governance',
  auth: false,
  admin: {
    hidden: ({ user }) => {
      return !hasRole(user, 'super_admin')
    },
    useAsTitle: "user"
  },
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      label: 'Membership',
      type: 'group',
      fields: [
        { name: 'user', type: 'relationship', relationTo: 'users' },
        {
          name: 'role',
          type: 'select',
          required: true,
          options: [
            { label: 'Advisor', value: 'advisor' },
            { label: 'Trustee', value: 'trustee' },
          ],
        },
        { name: 'board_role', type: 'text', admin: { condition: (d) => d.role === 'trustee' } }, // "Chairman", "Secretary", "Treasurer"
        { name: 'advises_on', type: 'text', admin: { condition: (d) => d.role === 'advisor' } }, // "curriculum design and university partnerships"
      ],
    },
  ],

}
