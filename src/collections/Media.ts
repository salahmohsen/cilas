import { APIError, type CollectionBeforeOperationHook, type CollectionConfig } from 'payload'

import { anyone, isAdmin, isAdminUser, isAuthenticated } from '@/access'

import { importFields } from '@/fields/import'
import { isPhotoUpload } from '@/lib/photo-upload'
import { PHOTO_FORMATS, PHOTO_MAX_BYTES, PHOTO_MAX_PIXELS } from '@/lib/profile-limits'
import { revalidateAfterChange, revalidateAfterDelete } from '@/lib/revalidate'

const PHOTO_RULE = `Upload a ${PHOTO_FORMATS} image of ${PHOTO_MAX_BYTES / 1024 / 1024} MB or less and ${PHOTO_MAX_PIXELS / 1_000_000} megapixels or less. Ask an admin to add other files.`

/**
 * A non-admin uploads photos only: covers, profile photos and pasted images.
 * The check reads `req.file` before Payload converts it to WebP, because after
 * that the stored type and size describe the converted file. A create with no
 * file (a remote URL) is refused too. Admins, and seeds and the importer
 * (overrideAccess), upload anything Payload accepts; Payload's own pixel limit
 * (constructorOptions) still applies to them. An anonymous caller returns here too:
 * beforeOperation runs before the collection access check, which throws
 * Forbidden for them.
 */
const photosOnlyForNonAdmins: CollectionBeforeOperationHook = async ({
  operation,
  overrideAccess,
  req,
}) => {
  if (operation !== 'create' || overrideAccess || !req.user || isAdminUser(req.user)) return
  if (!req.file) throw new APIError(PHOTO_RULE, 400, undefined, true)
  if (await isPhotoUpload(req.file)) return
  throw new APIError(PHOTO_RULE, 400, undefined, true)
}

export const Media: CollectionConfig = {
  slug: 'media',
  hooks: {
    beforeOperation: [photosOnlyForNonAdmins],
    afterChange: [revalidateAfterChange('media')],
    afterDelete: [revalidateAfterDelete('media')],
  },

  access: {
    read: anyone,
    // Anyone signed in uploads (an author's cover image); only admins change
    // or remove what is there, as one image can serve many pages.
    create: isAuthenticated,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description:
          'Describes the image for people who can’t see it, e.g. “Students reading on the rooftop”.',
        position: 'sidebar',
      },
    },
    ...importFields(),
  ],

  upload: {
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card',
        width: 768,
        height: 1024,
        position: 'centre',
      },
    ],
    constructorOptions: { limitInputPixels: PHOTO_MAX_PIXELS },
    formatOptions: {
      format: 'webp', // Convert uploads to WebP
      options: {
        quality: 80,
      },
    },
  },
}
