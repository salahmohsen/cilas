import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { isAdmin, personOf, type Role } from '@/access'
import { teaches, withFellowRole } from '@/lib/fellow-role'
import type { User } from '@/payload-types'

/**
 * Keeps `fellow` true to the linked person when the link itself changes. The
 * course hooks cover the other direction (a course listing a person).
 * beforeChange, so the role lands in the same write as the link.
 */
export const syncFellowRoleOnLink: CollectionBeforeChangeHook<User> = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!('person' in data)) return data

  const before = personOf(originalDoc)
  const after = personOf(data)
  if (before === after) return data

  const isTeaching = after !== null && (await teaches(req.payload, after))
  const current = (data.roles ?? originalDoc?.roles ?? ['member']) as Role[]
  if (current.includes('fellow') === isTeaching) return data

  return { ...data, roles: withFellowRole(current, isTeaching) }
}

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
  hooks: {
    beforeChange: [syncFellowRoleOnLink],
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
