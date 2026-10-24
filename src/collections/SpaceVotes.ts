import type { CollectionConfig, Where } from 'payload'

import { isAdminUser } from '@/access'
import { readableWhere } from '@/lib/spaces'

/**
 * One row per account, vote post and chosen option, unique on all three.
 * `option` is the id of a row in the post's `vote_options`. Members vote
 * through the server action only (voteSet), so single choice and the
 * option list cannot be bypassed; the same access pattern as reactions.
 */
export const SpaceVotes: CollectionConfig = {
  slug: 'space-votes',
  labels: { singular: 'Vote', plural: 'Votes' },
  access: {
    read: ({ req }) => readableWhere(req.payload, req.user, 'space'),
    create: ({ req }) => isAdminUser(req.user),
    update: () => false,
    delete: ({ req }) => {
      if (isAdminUser(req.user)) return true
      const own: Where = { account: { equals: (req.user as { id?: number })?.id ?? null } }
      return own
    },
  },
  admin: { hidden: true },
  fields: [
    { name: 'space', type: 'relationship', relationTo: 'spaces', required: true, index: true },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'space-posts',
      required: true,
      index: true,
    },
    { name: 'option', type: 'text', required: true },
  ],
  indexes: [{ fields: ['account', 'post', 'option'], unique: true }],
}
