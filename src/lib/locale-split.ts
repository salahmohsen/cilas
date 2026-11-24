/**
 * Payload 3.91 ignores `locale: 'all'` on `update`: a value read that way
 * ({ en, ar } at every localized field) does not write back. This splits such a
 * value into the plain data of one locale, so a caller writes one `update` per
 * locale.
 */

export type SplitBlock = { slug: string; flattenedFields: readonly SplitField[] }

/** The part of Payload's `FlattenedField` this module reads. */
export type SplitField = {
  name: string
  type: string
  localized?: boolean
  flattenedFields?: readonly SplitField[]
  blocks?: readonly SplitBlock[]
  /** A slug, or a block inlined by Payload. */
  blockReferences?: readonly (string | SplitBlock)[]
}

type Row = Record<string, unknown>
type BlockLookup = Readonly<Record<string, SplitBlock | undefined>>

const isRow = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const blockOf = (field: SplitField, slug: unknown, lookup: BlockLookup) => {
  const inline = field.blocks?.find((block) => block.slug === slug)
  if (inline) return inline
  const reference = field.blockReferences?.find(
    (block) => (typeof block === 'string' ? block : block.slug) === slug,
  )
  if (reference === undefined) return undefined
  return typeof reference === 'string' ? lookup[reference] : reference
}

/** Row keys Payload adds to every array row and block, kept as they are. */
const ROW_KEYS = ['id'] as const
const BLOCK_KEYS = ['id', 'blockType', 'blockName'] as const

const rowKeys = (row: Row, keys: readonly string[]): Row =>
  Object.fromEntries(keys.filter((key) => row[key] !== undefined).map((key) => [key, row[key]]))

const split = (
  fields: readonly SplitField[],
  data: Row,
  locale: string,
  lookup: BlockLookup,
): Row => {
  const out: Row = {}
  for (const field of fields) {
    const value = data[field.name]
    if (value === undefined) continue
    if (field.localized) {
      out[field.name] = isRow(value) ? (value[locale] ?? null) : null
    } else if (field.type === 'array' && Array.isArray(value)) {
      out[field.name] = value.map((row: Row) => ({
        ...rowKeys(row, ROW_KEYS),
        ...split(field.flattenedFields ?? [], row, locale, lookup),
      }))
    } else if (field.type === 'blocks' && Array.isArray(value)) {
      out[field.name] = value.map((row: Row) => ({
        ...rowKeys(row, BLOCK_KEYS),
        ...split(blockOf(field, row.blockType, lookup)?.flattenedFields ?? [], row, locale, lookup),
      }))
    } else if ((field.type === 'group' || field.type === 'tab') && isRow(value)) {
      out[field.name] = split(field.flattenedFields ?? [], value, locale, lookup)
    } else {
      out[field.name] = value
    }
  }
  return out
}

/**
 * `data` as one locale's plain write. A localized value the source lacks in
 * `locale` becomes `null`, so the write clears it. A field `data` does not
 * hold is left out. `blocks` resolves block references by slug.
 */
export const dataForLocale = (
  fields: readonly SplitField[],
  data: Row,
  locale: string,
  blocks: BlockLookup = {},
): Row => split(fields, data, locale, blocks)
