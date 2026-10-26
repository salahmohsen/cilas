import { FILE_KINDS } from './form-files'

/**
 * Spec §6 gave 5 files per post and 1 per comment. Comments now take up to 10:
 * members answer with a set of photos (a field visit, a whiteboard), and one
 * per comment forced a reply per photo. Size and type rules stay the post's.
 */
export const FILE_LIMITS = { post: 5, comment: 10 } as const

/** The picker's `accept`: every kind a space file may be (PDF, Word, images). */
export const SPACE_FILE_ACCEPT = Object.values(FILE_KINDS)
  .flatMap((k) => [...k.extensions, ...k.mime])
  .join(',')

const MB = 1024 * 1024

/**
 * Spec §6 pins 10 MB for space files (ADR 0008). Applications' 20 MB
 * (`MAX_SIZE_MB` in form-files) is the application forms' own ceiling and
 * does not transfer. Here so the browser can check a file before it is sent.
 */
export const SPACE_FILE_LIMIT = 10 * MB

/** The browser shrinks a photo bigger than this before it is sent. */
export const DOWNSCALE_OVER = 2 * MB
/** The longest side of a shrunk photo, in pixels. */
export const DOWNSCALE_EDGE = 2560

/**
 * The most one post or comment may send, after photos are shrunk. A photo of
 * at most 2560 x 2560 pixels at quality 0.85 stays under about 3.3 MB, so ten
 * of them (a comment's limit) come to about 33 MB. The page refuses a bigger
 * total with a message, before anything is sent.
 */
export const UPLOAD_TOTAL_MAX = 36 * MB

/**
 * `serverActions.bodySizeLimit` and `proxyClientMaxBodySize` in next.config:
 * the total above plus 4 MB for the text and the multipart framing. Both are
 * needed: the proxy keeps a copy of each request body and cuts it at its own
 * limit (10 MB by default), which would break an upload the action accepts.
 */
export const UPLOAD_BODY_LIMIT = '40mb'
