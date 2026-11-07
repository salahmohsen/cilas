import { FILE_KINDS } from './form-files'

/**
 * Space posts take photos only, and no comment takes a file (media budget:
 * docs/spaces-media-budget.md). Four fills a 2 x 2 photo grid and, at about
 * 0.2 MB a photo once optimised, keeps a post under 1 MB. Five or six would
 * raise the worst-case post by a half and nobody asked for more than a
 * handful of pictures. The server enforces this (SpaceFiles hook), not only
 * the picker.
 */
export const FILE_LIMITS = { post: 4 } as const

export const SPACE_FILE_ACCEPT = [...FILE_KINDS.image.extensions, ...FILE_KINDS.image.mime].join(
  ',',
)

export const SPACE_FILE_MIME = FILE_KINDS.image.mime

const MB = 1024 * 1024

/**
 * The most one photo may weigh as it arrives. The browser shrinks photos
 * before they are sent, so a bigger file means the shrink did not run; the
 * server refuses it rather than buffer it. Here so the browser can check a
 * file before it is sent.
 */
export const SPACE_FILE_LIMIT = 10 * MB

/**
 * The longest side of a stored photo, in pixels, and its WebP quality. The
 * browser and the server (the space-files collection) use the same values,
 * so the server only re-encodes a file the browser left alone. 1600 px fills
 * the widest photo slot on a 2x screen at the post dialog's width.
 */
export const IMAGE_EDGE = 1600
export const IMAGE_QUALITY = 80

/**
 * The most one post may send, with its event cover. A shrunk photo is about
 * 0.2 MB, so this is room for photos the browser could not shrink: four at
 * the 10 MB limit would not fit, which is the point.
 */
export const UPLOAD_TOTAL_MAX = 24 * MB

/**
 * `serverActions.bodySizeLimit` and `proxyClientMaxBodySize` in next.config:
 * the total above plus 4 MB for the text and the multipart framing. Both are
 * needed: the proxy keeps a copy of each request body and cuts it at its own
 * limit (10 MB by default), which would break an upload the action accepts.
 */
export const UPLOAD_BODY_LIMIT = '28mb'
