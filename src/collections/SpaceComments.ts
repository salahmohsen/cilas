import type { CollectionConfig } from 'payload'

import { isAdminUser } from '@/access'
import { contentWhere } from '@/lib/spaces'
import { searchChanged, searchDeleted, searchDeletingComment } from '@/lib/private-search/outbox'

/**
 * Comments on a post (spec §4). Plain text with `/people/{id}` mention
 * links, stored by the mention-input serializer. Comments take no files
 * (media budget); older `space-files` rows that point at a comment stay as
 * they are. The reply depth (2 total) is enforced by the UI composer
 * and the action, not by the data model.
 */
export const SpaceComments: CollectionConfig = {
  slug: 'space-comments',
  labels: { singular: 'Comment', plural: 'Comments' },
  access: {
    read: ({ req }) => contentWhere(req.payload, req.user, ['post'], req.context),
    // Actions-only writes, as with posts (REST refusal).
    create: ({ req }) => isAdminUser(req.user),
    update: ({ req }) => isAdminUser(req.user),
    // Deletes (authors included) go through the actions' commentRemove,
    // which leaves the placeholder when replies exist (spec §3). REST
    // hard-deletes orphan child rows — the rules refuse them.
    delete: ({ req }) => isAdminUser(req.user),
  },
  hooks: {
    beforeDelete: [searchDeletingComment],
    afterChange: [searchChanged('comment')],
    afterDelete: [searchDeleted('comment')],
  },
  versions: { drafts: false },
  admin: { group: 'Community', defaultColumns: ['space', 'post', 'author', 'createdAt'] },
  fields: [
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
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
      access: { update: () => false },
    },
    { name: 'parent', type: 'relationship', relationTo: 'space-comments' },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'people',
      index: true,
      access: { update: () => false },
    },
    { name: 'body', type: 'textarea', required: true },
    { name: 'edited_at', type: 'date' },
    { name: 'deleted_at', type: 'date', index: true },
  ],
}
