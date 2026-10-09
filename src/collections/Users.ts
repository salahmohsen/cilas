import { isAdmin } from '@/access'
import type { CollectionConfig } from 'payload'

/** Login accounts. Public profiles live in `people` (ADR 0001). */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'person', 'roles'],
    hidden: (ctx) => !ctx.user?.roles.includes('super_admin') && !ctx.user?.roles.includes('admin'),
  },
  auth: true,
  access: {
    update: isAdmin,
  },
  fields: [
    {
      // At most one account per person.
      name: 'person',
      type: 'relationship',
      relationTo: 'people',
      unique: true,
      admin: { position: 'sidebar' },
    },
    {
      // Role plumbing lives in the sidebar: identity first, permissions to
      // the side.
      label: 'Roles',
      type: 'group',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'roles',
          type: 'select',
          required: true,
          defaultValue: 'member',
          hasMany: true,
          options: [
            { label: 'Super Admin', value: 'super_admin' },
            { label: 'Admin', value: 'admin' },
            { label: 'Fellow', value: 'fellow' },
            { label: 'Member', value: 'member' },
            { label: 'Non-Degree-Seeking Student', value: 'non_degree_seeking' },
          ],
        },
      ],
    },
  ],
}
