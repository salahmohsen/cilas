import sharp from 'sharp'

import { PHOTO_MAX_BYTES, PHOTO_MAX_PIXELS, PHOTO_TYPES } from '@/lib/profile-limits'

/**
 * Whether an uploaded file is a photo that a non-admin may store: at most
 * PHOTO_MAX_BYTES and PHOTO_MAX_PIXELS, and one of PHOTO_TYPES as read from
 * the bytes, not from the type the client claims. A file sharp cannot read
 * within the pixel limit is refused. The profile form keeps the same limits
 * in the browser (src/lib/profile-limits.ts); sharp is Node only, so this
 * stays here.
 */
export const isPhotoUpload = async ({ data }: { data: Buffer }) => {
  if (data.length > PHOTO_MAX_BYTES) return false
  const format = await sharp(data, { limitInputPixels: PHOTO_MAX_PIXELS })
    .metadata()
    .then(
      (metadata) => metadata.format,
      () => undefined,
    )
  return format !== undefined && PHOTO_TYPES.includes(`image/${format}`)
}
