import sharp from 'sharp'

import { COVER_EDGE, COVER_TYPES } from './event-cover'

/** What a cover upload may be: a photo of a known kind within the space file limit. */
export const coverIssue = (
  file: { mimetype: string; size: number },
  limit: number,
): 'file-type' | 'file-size' | null => {
  if (!(COVER_TYPES as readonly string[]).includes(file.mimetype)) return 'file-type'
  return file.size > limit ? 'file-size' : null
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')

/**
 * A cover as it is stored: turned upright, at most COVER_EDGE on its long
 * side, as WebP, so a card never loads more than it shows. The tone is the
 * dominant colour of the photo's lower part, where it meets the details.
 * Null when the file does not decode as an image.
 */
export const prepareCover = async (
  data: Buffer,
  name: string,
): Promise<{ data: Buffer; name: string; tone: string } | null> => {
  try {
    const upright = sharp(data, { failOn: 'error' }).rotate()
    const { data: out, info } = await upright
      .clone()
      .resize({ width: COVER_EDGE, height: COVER_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true })
    const top = Math.floor(info.height * 0.6)
    const { dominant } = await sharp(out)
      .extract({ left: 0, top, width: info.width, height: Math.max(1, info.height - top) })
      .stats()
    return {
      data: out,
      name: `${name.replace(/\.[^.]+$/, '') || 'cover'}.webp`,
      tone: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
    }
  } catch {
    return null
  }
}
