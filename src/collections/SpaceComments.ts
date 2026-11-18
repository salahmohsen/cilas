import type { Access, CollectionConfig } from 'payload'

import { nobody, isAdmin } from '@/access'
import { contentWhere } from '@/lib/spaces'
import { searchChanged, searchDeleted, searchDeletingComment } from '@/lib/private-search/outbox'

/** Comments on the posts the reader may see. */
const commentsOnReadablePosts: Access = ({ req }) =>
  contentWhere(req.payload, req.user, ['post'], req.context)

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
    read: commentsOnReadablePosts,
    // Actions-only writes, as with posts (REST refusal).
    create: isAdmin,
    update: isAdmin,
    // Deletes (authors included) go through the actions' commentRemove,
    // which leaves the placeholder when replies exist (spec §3). REST
    // hard-deletes orphan child rows — the rules refuse them.
    delete: isAdmin,
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
      access: { update: nobody },
    },
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'space-posts',
      required: true,
      index: true,
      access: { update: nobody },
    },
    { name: 'parent', type: 'relationship', relationTo: 'space-comments' },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'people',
      index: true,
      access: { update: nobody },
    },
    { name: 'body', type: 'textarea', required: true },
    { name: 'edited_at', type: 'date' },
    { name: 'deleted_at', type: 'date', index: true },
  ],
}
