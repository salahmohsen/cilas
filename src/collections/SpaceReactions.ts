import type { CollectionConfig, Where } from 'payload'

import { isAdminUser, personOf } from '@/access'
import { readableWhere } from '@/lib/spaces'

/**
 * One row per account, target and reaction, unique on all three (spec §4).
 * The six: agree (Like), thank_you, celebrate, insightful, same_question,
 * rocket. Targets polymorphic
 * through two mutually-exclusive relationship fields; each (account, target,
 * reaction) triple is unique by its own index, so the Postgres NULL trick
 * (two rows matching when the other field is NULL) cannot double a reaction.
 */
export const REACTIONS: Array<{ value: string; label: string }> = [
  { label: 'Like', value: 'agree' },
  { label: 'Thank you', value: 'thank_you' },
  { label: 'Celebrate', value: 'celebrate' },
  { label: 'Insightful', value: 'insightful' },
  { label: 'Same question', value: 'same_question' },
  { label: 'Boost', value: 'rocket' },
]

export const SpaceReactions: CollectionConfig = {
  slug: 'space-reactions',
  labels: { singular: 'Reaction', plural: 'Reactions' },
  access: {
    read: ({ req }) => readableWhere(req.payload, req.user, 'space'),
    // Actions-only writes (REST refusal, as posts and comments).
    create: ({ req }) => isAdminUser(req.user),
    update: () => false,
    // Only the account un-reacts; moderation powers come in step 3.
    delete: ({ req }) => {
      if (isAdminUser(req.user)) return true
      const own: Where = { account: { equals: (req.user as { id?: number })?.id ?? null } }
      void personOf // not used here: the reaction belongs to the account
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
    { name: 'post', type: 'relationship', relationTo: 'space-posts', index: true },
    { name: 'comment', type: 'relationship', relationTo: 'space-comments', index: true },
    { name: 'reaction', type: 'select', required: true, options: REACTIONS },
  ],
  indexes: [
    { fields: ['account', 'post', 'reaction'], unique: true },
    { fields: ['account', 'comment', 'reaction'], unique: true },
  ],
  hooks: {
    // Exactly one target (spec §4): the actions enforce it too, but the
    // invariant belongs at the table, not only in the actions' good graces.
    beforeChange: [
      ({ data, operation }) => {
        if (operation !== 'create') return data
        const targets = [
          (data as { post?: unknown })?.post,
          (data as { comment?: unknown })?.comment,
        ].filter(Boolean)
        if (targets.length !== 1) throw new Error('space-reactions: exactly one of post or comment')
        return data
      },
    ],
  },
}
