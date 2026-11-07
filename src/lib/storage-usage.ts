type SizedDoc = {
  filesize?: number | null
  sizes?: Record<string, { filesize?: number | null } | null | undefined> | null
}

export const docBytes = (doc: SizedDoc): number => {
  let bytes = doc.filesize ?? 0
  for (const variant of Object.values(doc.sizes ?? {})) bytes += variant?.filesize ?? 0
  return bytes
}

export const sumDocBytes = (docs: readonly SizedDoc[]): number =>
  docs.reduce((total, doc) => total + docBytes(doc), 0)

/** Storage key prefix of each upload collection (payload.config.ts). */
export const BUCKET_PREFIXES = {
  media: 'media',
  submissions: 'applications',
  spaces: 'spaces',
} as const

export const sumByPrefix = (
  objects: readonly { Key?: string; Size?: number }[],
): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const { Key = '', Size = 0 } of objects) {
    const slash = Key.indexOf('/')
    const prefix = slash === -1 ? '' : Key.slice(0, slash)
    out[prefix] = (out[prefix] ?? 0) + Size
  }
  return out
}
