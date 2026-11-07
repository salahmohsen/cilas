import { relId } from '@/lib/relation'
import { routing } from '@/i18n/routing'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections'
import { z } from 'zod'

export const ALIAS = 'spaces_search'
export const PAGE_SIZE = 20
export const BATCH_SIZE = 40
export const SCAN_LIMIT = 200
export const inputSchema = z
  .object({
    query: z
      .string()
      .trim()
      .min(0)
      .max(160)
      .regex(/^$|[\p{L}\p{N}]/u),
    space: z.number().int().positive().safe().optional(),
    spaces: z.array(z.number().int().positive().safe()).max(2000).optional(),
    sort: z.enum(['relevance', 'newest', 'alpha']).default('relevance'),
    locale: z.enum(routing.locales).default('en'),
    cursor: z.string().max(2048).optional(),
  })
  .strict()
  .refine(
    (input) => input.space === undefined || input.spaces === undefined,
    'Choose one selection format',
  )
export type SearchInput = z.infer<typeof inputSchema>
export type Kind = 'post' | 'comment'
export type Source = {
  id: number
  space: unknown
  post?: unknown
  parent?: unknown
  body?: string | null
  event_title?: string | null
  deleted_at?: string | null
  updatedAt: string
}
export const numericId = (value: unknown): number | null => {
  const id = relId(value)
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null
}
export const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')
export type SearchDocument = {
  id: string
  sourceId: number
  kind: Kind
  spaceId: number
  postId: number
  title: string
  body: string
  updatedAt: number
  sourceRevision: string
}
export const projection = (kind: Kind, source: Source): SearchDocument | null => {
  const spaceId = numericId(source.space)
  const postId = kind === 'post' ? source.id : numericId(source.post)
  if (source.deleted_at || !spaceId || !postId) return null
  // Mention/Markdown link targets and bare URLs are not searchable private file metadata.
  const text = (s: string) =>
    s
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .normalize('NFC')
  const document = {
    id: `${kind}:${source.id}`,
    sourceId: source.id,
    kind,
    spaceId,
    postId,
    title: kind === 'post' ? text(source.event_title ?? '') : '',
    body: text(source.body ?? ''),
    updatedAt: Date.parse(source.updatedAt),
  }
  return {
    ...document,
    sourceRevision: fingerprint(['spaces-search-v1', document, numericId(source.parent)]),
  }
}
export const schema = (name: string): CollectionCreateSchema => ({
  name,
  fields: [
    { name: 'sourceId', type: 'int64' },
    { name: 'kind', type: 'string' },
    { name: 'spaceId', type: 'int64' },
    { name: 'postId', type: 'int64' },
    { name: 'title', type: 'string' },
    { name: 'body', type: 'string' },
    { name: 'updatedAt', type: 'int64', sort: true },
    { name: 'sourceRevision', type: 'string', index: false },
  ],
})
export type Envelope = { ids: number[]; gated: Map<number, number> }
export const permissionFilter = ({ ids, gated }: Envelope, selected?: number): string | null => {
  if (!ids.length || (selected !== undefined && !ids.includes(selected))) return null
  if (
    ids.some((id) => numericId(id) === null) ||
    [...gated].some(([s, p]) => !numericId(s) || !numericId(p))
  )
    throw new Error('Invalid permission envelope')
  const open = ids.filter((id) => !gated.has(id))
  const clauses = [
    ...(open.length ? [`spaceId:=[${open.join(',')}]`] : []),
    ...ids
      .filter((id) => gated.has(id))
      .map((id) => `(spaceId:=${id} && postId:=${gated.get(id)})`),
  ]
  return `(${clauses.join(' || ')})${selected === undefined ? '' : ` && spaceId:=${selected}`}`
}
export const permits = (e: Envelope, space: number, post: number) =>
  e.ids.includes(space) && (!e.gated.has(space) || e.gated.get(space) === post)

type Cursor = { binding: string; offset: number; expires: number }
export const encodeCursor = (cursor: Cursor, secret: string) => {
  const body = Buffer.from(JSON.stringify(cursor)).toString('base64url')
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}
export const decodeCursor = (token: string, binding: string, secret: string): number => {
  try {
    const [body, signature, extra] = token.split('.')
    const expected = createHmac('sha256', secret).update(body).digest()
    const actual = Buffer.from(signature, 'base64url')
    if (extra || actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new Error()
    const cursor = JSON.parse(Buffer.from(body, 'base64url').toString()) as Cursor
    if (
      cursor.binding !== binding ||
      cursor.expires < Date.now() ||
      !Number.isSafeInteger(cursor.offset) ||
      cursor.offset < 0 ||
      cursor.offset > 10000
    )
      throw new Error()
    return cursor.offset
  } catch {
    throw new CursorReset()
  }
}
export class CursorReset extends Error {}
export type SpaceOption = { id: number; label: string; href: string }
export type SearchResult = {
  id: string
  kind: Kind
  title: string
  snippet: string
  href: string
  space: string
  spaceId: number
  updatedAt: number
  image?: string
}
export type SearchAggregates = { total: number; facets: { id: number; found: number }[] }
export type SearchPage = {
  aggregates: SearchAggregates | null
  results: SearchResult[]
  hasMore: boolean
  incomplete: boolean
  cursor?: string
  spaces: SpaceOption[]
  account: number
}
