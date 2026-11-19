import sharp from 'sharp'

import {
  IMAGE_DECODE_MAX_PIXELS,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_PIXELS,
  PHOTO_TYPES,
} from '@/lib/profile-limits'

/**
 * Whether an uploaded file is a photo that a non-admin may store: at most
 * PHOTO_MAX_BYTES, and at most PHOTO_MAX_PIXELS in all frames, and one of
 * PHOTO_TYPES as read from the bytes, not from the type the client claims.
 * Payload reads GIF and WebP as animated, so this does too, and counts the
 * same frames. A file sharp cannot read is refused. The profile form keeps the
 * same limits in the browser (src/lib/profile-limits.ts); sharp is Node only,
 * so this stays here.
 */
export const isPhotoUpload = async ({ data }: { data: Buffer }) => {
  if (data.length > PHOTO_MAX_BYTES) return false
  const metadata = await sharp(data, {
    animated: true,
    limitInputPixels: IMAGE_DECODE_MAX_PIXELS,
  })
    .metadata()
    .catch(() => undefined)
  if (!metadata?.width || !metadata.height || !metadata.format) return false
  if (!PHOTO_TYPES.includes(`image/${metadata.format}`)) return false
  const frameHeight = metadata.pageHeight ?? metadata.height
  return metadata.width * frameHeight * (metadata.pages ?? 1) <= PHOTO_MAX_PIXELS
}
