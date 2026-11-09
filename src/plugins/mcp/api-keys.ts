import type { Access, CollectionBeforeDeleteHook, CollectionConfig } from 'payload'

import { hasRole, isAdmin } from '@/access'

import { AI_ACCESS_LINK } from './paths'

const isSuperAdmin = (user: Parameters<typeof hasRole>[0]) => hasRole(user, 'super_admin')

/**
 * Keys are for developers: only a super admin makes one. Administrators
 * connect Claude or ChatGPT with OAuth instead, so they never see this
 * collection in the panel (but may still remove a key a developer left).
 */
const superAdminOnly: Access = ({ req }) =>
  Boolean(req.user && req.user.collection === 'users' && isSuperAdmin(req.user))

/**
 * Change or unlock only your own key, and only while you are a super admin.
 * The plugin's default lets any account manage its own keys.
 */
const ownKeyAsSuperAdmin: Access = ({ req }) =>
  req.user && req.user.collection === 'users' && isSuperAdmin(req.user)
    ? { user: { equals: req.user.id } }
    : false

/**
 * A key's user column is NOT NULL, so Payload's own clean-up of the relation
 * would refuse the delete.
 */
export const deleteOwnersAiKeys: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'payload-mcp-api-keys',
    where: { user: { equals: id } },
    overrideAccess: true,
    req,
  })
}

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
    create: superAdminOnly,
    // Any admin must be able to remove a key a former admin left behind.
    read: isAdmin,
    update: ownKeyAsSuperAdmin,
    delete: isAdmin,
    unlock: ownKeyAsSuperAdmin,
  },
  admin: {
    ...collection.admin,
    group: 'Site',
    hidden: ({ user }) => !isSuperAdmin(user),
    description:
      'For developers: a key lets a program make course and article drafts. Administrators connect Claude or ChatGPT instead, from the AI assistants guide.',
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
