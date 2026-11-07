/**
 * What a form's file question accepts (Forms → File upload), shared by the
 * page, which checks before sending, and the server, which checks again.
 */

export const FILE_KINDS = {
  pdf: { label: 'PDF', extensions: ['.pdf'], mime: ['application/pdf'] },
  word: {
    label: 'Word (doc, docx)',
    extensions: ['.doc', '.docx'],
    mime: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  image: {
    label: 'Images (jpg, png, webp)',
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    mime: ['image/jpeg', 'image/png', 'image/webp'],
  },
} as const

export type FileKind = keyof typeof FILE_KINDS

/** At most this many files for a question that takes several. */
export const MAX_FILES = 5
/** No question may take files bigger than this, whatever its setting. */
export const MAX_SIZE_MB = 20
export const DEFAULT_SIZE_MB = 10
/** Above this the form endpoint refuses a file, whatever the question allows. */
export const SUBMISSION_FILE_LIMIT = MAX_SIZE_MB * 1024 * 1024

export type FileRule = {
  accept?: FileKind[] | null
  maxSizeMB?: number | null
  multiple?: boolean | null
}

const kindsOf = (rule: FileRule): FileKind[] => (rule.accept?.length ? rule.accept : ['pdf'])

/** The `accept` attribute of the file picker, e.g. ".pdf,application/pdf". */
export const acceptAttribute = (rule: FileRule) =>
  kindsOf(rule)
    .flatMap((k) => [...FILE_KINDS[k].extensions, ...FILE_KINDS[k].mime])
    .join(',')

export const maxBytes = (rule: FileRule) =>
  Math.min((rule.maxSizeMB || DEFAULT_SIZE_MB) * 1024 * 1024, SUBMISSION_FILE_LIMIT)

export const maxCount = (rule: FileRule) => (rule.multiple ? MAX_FILES : 1)

/** The accepted kinds as people read them, e.g. "PDF or Word (doc, docx)". */
export const acceptedLabel = (rule: FileRule) =>
  kindsOf(rule)
    .map((k) => FILE_KINDS[k].label)
    .join(', ')

/** Whether a file's name and type match what the question accepts. */
export const fileAllowed = (rule: FileRule, file: { name: string; type: string }) => {
  const name = file.name.toLowerCase()
  return kindsOf(rule).some(
    (k) =>
      (FILE_KINDS[k].mime as readonly string[]).includes(file.type) &&
      FILE_KINDS[k].extensions.some((ext) => name.endsWith(ext)),
  )
}
