import { relId } from '@/lib/relation'
import { randomBytes } from 'node:crypto'

import { APIError, type CollectionConfig } from 'payload'

import { isAdminUser } from '@/access'
import { contentWhere } from '@/lib/spaces'
import {
  FILE_LIMITS,
  IMAGE_EDGE,
  IMAGE_QUALITY,
  SPACE_FILE_LIMIT,
  SPACE_FILE_MIME,
} from '@/lib/space-file-limits'

/**
 * ADR 0008: files in spaces are private, not media. Random names, no public
 * URL, served by Payload only to someone who could read the space itself.
 * Written and deleted only by the server actions.
 *
 * Media budget (docs/spaces-media-budget.md): only photos, at most
 * FILE_LIMITS.post on a post, none on a comment. This collection is the
 * authority: it enforces those limits itself and re-encodes every photo to
 * one WebP no longer than IMAGE_EDGE px, with EXIF and GPS data dropped.
 * There are no `imageSizes`, because each size is one more R2 object (one
 * more Class A write, one more thing to delete); the stored file is the only
 * object a photo has.
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
    mimeTypes: [...SPACE_FILE_MIME],
    filesRequiredOnCreate: true,
    // Upright, at most IMAGE_EDGE px, one WebP. Payload turns the photo
    // upright before this runs and sharp drops all metadata unless asked to
    // keep it (`withMetadata` is not set).
    resizeOptions: {
      width: IMAGE_EDGE,
      height: IMAGE_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    },
    formatOptions: { format: 'webp', options: { quality: IMAGE_QUALITY } },
    // A stored name is random and never rewritten, so a browser may keep the
    // file for good: a repeat view costs no R2 read and no server bandwidth.
    // `private`: the file is behind a membership check, so no shared cache
    // may hold it.
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'private, max-age=31536000, immutable')
      return headers
    },
  },
  hooks: {
    beforeOperation: [
      ({ operation, req }) => {
        if (operation !== 'create' || !req.file) return
        // The input ceiling, whichever way the file arrived.
        const size = req.file.size ?? req.file.data?.length ?? 0
        if (size > SPACE_FILE_LIMIT)
          throw new APIError('This photo is too large.', 413, undefined, true)
        // Same pattern as submission-files: unguessable names (ADR 0008).
        const safe = req.file.name.replace(/[^\w.-]+/g, '-').slice(-80)
        req.file.name = `${randomBytes(16).toString('hex')}-${safe}`
      },
    ],
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || !data) return data
        // Comments take no files. Older rows keep their `comment` link so
        // they stay readable and can be cleaned up, but none is made now.
        if (data.comment) throw new APIError('A comment takes no files.', 400, undefined, true)
        if (!data.post) return data
        const post = relId(data.post)
        const { totalDocs } = await req.payload.count({
          collection: 'space-files',
          where: { post: { equals: post } },
          overrideAccess: true,
          req,
        })
        // An edit stores its new photos before it deletes the ones it
        // replaces, so those still count here; the write layer passes how many.
        const replacing = Number(req.context.spaceFilesReplacing ?? 0)
        if (totalDocs - replacing >= FILE_LIMITS.post)
          throw new APIError(
            `A post takes at most ${FILE_LIMITS.post} photos.`,
            400,
            undefined,
            true,
          )
        return data
      },
    ],
  },
  fields: [
    { name: 'space', type: 'relationship', relationTo: 'spaces', required: true, index: true },
    { name: 'post', type: 'relationship', relationTo: 'space-posts', index: true },
    {
      // Legacy: comments no longer take files. Kept so older rows stay linked
      // (read access, cleanup); the hook above refuses a new one.
      name: 'comment',
      type: 'relationship',
      relationTo: 'space-comments',
      index: true,
      admin: { readOnly: true },
    },
    { name: 'filename', type: 'text', required: true }, // the human name, shown in the list
  ],
}

export { SPACE_FILE_LIMIT } from '@/lib/space-file-limits'
