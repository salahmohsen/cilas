import type { Access, CollectionConfig } from 'payload'

import { isAdmin, isAdminUser } from '@/access'

import { AI_ACCESS_LINK } from './paths'

/**
 * Read, change, delete and unlock only your own key, and only while you are
 * an admin. The plugin's default lets any account manage its own keys.
 */
const ownKeyAsAdmin: Access = ({ req }) =>
  req.user && req.user.collection === 'users' && isAdminUser(req.user)
    ? { user: { equals: req.user.id } }
    : false

/**
 * The plugin's key collection, as CILAS shows it. The group and the hidden
 * rule are set here, not in role-nav.ts: the plugin may run after roleNav.
 * The `user` field stays bound to the creator, so no one can issue a key that
 * acts as someone else.
 */
export const overrideApiKeyCollection = (collection: CollectionConfig): CollectionConfig => ({
  ...collection,
  labels: { singular: 'AI access key', plural: 'AI access' },
  access: {
    ...collection.access,
    create: isAdmin,
    read: ownKeyAsAdmin,
    update: ownKeyAsAdmin,
    delete: ownKeyAsAdmin,
    unlock: ownKeyAsAdmin,
  },
  admin: {
    ...collection.admin,
    group: 'Site',
    hidden: ({ user }) => !isAdminUser(user),
    description:
      'Keys that let an AI assistant make course and article drafts. A person always publishes.',
    components: {
      ...collection.admin?.components,
      beforeList: [AI_ACCESS_LINK],
    },
  },
  fields: [
    {
      name: 'ai_access_guide',
      type: 'ui',
      admin: { components: { Field: AI_ACCESS_LINK } },
    },
    ...collection.fields,
  ],
})
