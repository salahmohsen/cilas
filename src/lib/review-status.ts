import type { ReviewRequest, ReviewState } from './review'

export type ReviewedDoc = {
  id: number
  _status?: 'draft' | 'published' | null
  updatedAt: string
  review?: { status?: ReviewState | null; request?: ReviewRequest | null } | null
} & Record<string, unknown>

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (!isPlainObject(value)) return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => !(key === 'id' && typeof value[key] === 'string'))
      .filter((key) => value[key] !== null && value[key] !== undefined)
      .map((key) => [key, canonical(value[key])]),
  )
}

const fingerprint = (value: unknown): string => JSON.stringify(canonical(value) ?? null)

/**
 * True when a reviewed field of the draft copy differs from the live row. Both
 * rows must come from one read (same depth, locale and fields). Lexical node
 * ids, row ids and empty locales do not count.
 */
export const hasUnsentEdits = (
  draft: ReviewedDoc,
  doc: ReviewedDoc,
  fields: readonly string[],
): boolean => fields.some((field) => fingerprint(draft[field]) !== fingerprint(doc[field]))
