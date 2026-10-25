import { FILE_KINDS } from '@/lib/form-files'

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
