import { randomBytes } from 'node:crypto'

import type { CollectionConfig } from 'payload'

import { isAdminUser } from '@/access'
import { contentWhere } from '@/lib/spaces'
import { FILE_KINDS } from '@/lib/form-files'

/**
 * ADR 0008: files in spaces are private, not media. Random names, no public
 * URL, served by Payload only to someone who could read the space itself.
 * Written and deleted only by the server actions, so the per-post and
 * per-comment counts (spec §6) are enforced in one place.
 */
export const SpaceFiles: CollectionConfig = {
  slug: 'space-files',
  labels: { singular: 'Space file', plural: 'Space files' },
  access: {
    // Equal to the read access of the post it sits on (spec §6).
    read: ({ req }) => contentWhere(req.payload, req.user, ['post', 'comment.post'], req.context),
    // Writes run only in the server actions (counts and limits live in one
    // place); a file otherwise goes away with its post or comment. REST
    // deletes would let any member of a space hard-delete anyone's files.
    create: () => false, // the actions write with overrideAccess
    update: () => false,
    delete: ({ req }) => isAdminUser(req.user),
  },
  admin: { hidden: true },
  upload: {
    mimeTypes: Object.values(FILE_KINDS as Record<string, { mime: readonly string[] }>).flatMap(
      (k) => [...k.mime],
    ),
    filesRequiredOnCreate: true,
  },
  hooks: {
    // Same pattern as submission-files: unguessable names (ADR 0008).
    beforeOperation: [
      ({ operation, req }) => {
        if (operation !== 'create' || !req.file) return
        const safe = req.file.name.replace(/[^\w.-]+/g, '-').slice(-80)
        req.file.name = `${randomBytes(16).toString('hex')}-${safe}`
      },
    ],
  },
  fields: [
    { name: 'space', type: 'relationship', relationTo: 'spaces', required: true, index: true },
    { name: 'post', type: 'relationship', relationTo: 'space-posts', index: true },
    { name: 'comment', type: 'relationship', relationTo: 'space-comments', index: true },
    { name: 'filename', type: 'text', required: true }, // the human name, shown in the list
  ],
}

export { SPACE_FILE_LIMIT } from '@/lib/space-file-limits'
