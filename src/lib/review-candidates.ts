import 'server-only'

import type { FindOptions, Payload, SelectType, Where } from 'payload'

import { relId } from '@/lib/relation'
import {
  KEY_SELECT,
  KEY_WHERE,
  KEYS_READ_ERROR,
  LIVE_COPY,
  liveParentIds,
  statusInputOf,
  statusOf,
  statusSelect,
  waitsOn,
  type ReviewedDoc,
  type StatusInput,
  type StatusKey,
} from '@/lib/review-status'
import type { ReviewedCollection } from '@/lib/reviewed-fields'
import type { User } from '@/payload-types'

/**
 * The candidate keys the admin queue reads: the 1b admin list's `workKeys('admin')`
 * (`src/portal/lists/groups.ts`). `src/lib` cannot import `groups.ts`, so this is a
 * pinned copy, and `sources.unit.test.ts` fails when the two differ.
 *
 * Only `submitted`, `published_edits` and `published_removal` wait on an admin.
 * The other three (`draft`, `changes_requested`, `published_edits_returned`) give
 * an admin-waiting id only for a row whose main row and latest version are out of
 * step, a state Payload cannot write (a save moves both together). They stay
 * because the queue is that list's Needs you group (Deviation 21): the same
 * candidates, so the same set. Each costs a read; drop one only with the list.
 */
export const ADMIN_LIST_KEYS: readonly StatusKey[] = [
  'draft',
  'submitted',
  'changes_requested',
  'published_edits',
  'published_removal',
  'published_edits_returned',
]

type Doc = ReviewedDoc
type Version = {
  parent: number | { id: number }
  version: { updatedAt: string } & Record<string, unknown>
}
type Found = { docs: Doc[]; totalDocs: number; hasNextPage: boolean }

/**
 * Who reads. A `User` reads with their own access. An admin server read has no
 * user and says so with `server: 'admin'` (Deviation 17): it overrides access,
 * and every caller checks `isAdminUser` first. A `null` user alone is not a
 * reader, so it does not type-check.
 */
type Reader = { user: User } | { user: null; server: 'admin' }

/** What a read needs: the reader, the collection, and the base `where`. */
export type ReadCtx = Reader & {
  payload: Payload
  collection: ReviewedCollection
  base: Where
}

export type Entry = { id: number; main: Doc; latest: Doc | null; key: StatusKey }
type KeysEntry = Omit<Entry, 'key'> & { key: StatusKey | null }

type Selected = Record<string, true>
type Gated = 'collection' | 'user' | 'overrideAccess'
type MainArgs = Omit<FindOptions<ReviewedCollection, SelectType>, Gated | 'draft'>
type CopyArgs = Omit<Parameters<Payload['findVersions']>[0], Gated>

/**
 * The access of a read. A `User` gets a gated read; an admin server read gets
 * `overrideAccess: true`. A `null` user with no `server` mark is a bug that the
 * types refuse, and at run time it throws and never reads.
 */
export function gate(ctx: { user: User }): { user: User; overrideAccess: false }
export function gate(ctx: { user: null; server: 'admin' }): { overrideAccess: true }
export function gate(ctx: Reader): { user: User; overrideAccess: false } | { overrideAccess: true }
export function gate({ user, server }: { user: User | null; server?: 'admin' }) {
  if (user) return { user, overrideAccess: false } as const
  if (server === 'admin') return { overrideAccess: true } as const
  throw new Error('A read with no user must be an admin server read (server: "admin").')
}

export const findMain = async (ctx: ReadCtx, args: MainArgs) =>
  (await ctx.payload.find({
    collection: ctx.collection,
    draft: false,
    depth: 0,
    pagination: false,
    ...args,
    ...gate(ctx),
  })) as unknown as Found

export const findCopies = async (ctx: ReadCtx, args: CopyArgs) =>
  (await ctx.payload.findVersions({
    collection: ctx.collection,
    depth: 0,
    pagination: false,
    ...args,
    ...gate(ctx),
  })) as unknown as { docs: Version[] }

const newestPerParent = (versions: Version[]) => {
  const latest = new Map<number, Doc>()
  for (const { parent, version } of versions) {
    const id = relId(parent) as number
    const seen = latest.get(id)
    if (!seen || version.updatedAt > seen.updatedAt) latest.set(id, { ...version, id } as Doc)
  }
  return latest
}

const readMains = async (ctx: ReadCtx, ids: number[], select: Selected) => {
  const { docs } = await findMain(ctx, {
    where: { and: [ctx.base, { id: { in: ids } }] },
    select,
    locale: 'all',
  })
  return new Map(docs.map((doc) => [doc.id, doc]))
}

const readLatest = async (ctx: ReadCtx, ids: number[], version: Selected) => {
  const { docs } = await findCopies(ctx, {
    where: { and: [{ parent: { in: ids } }, { latest: { equals: true } }] },
    select: { parent: true, version },
    locale: 'all',
  })
  return newestPerParent(docs)
}

/**
 * The key of a keys-only row. `statusOf` throws `KEYS_READ_ERROR` only for a live
 * row whose copy needs a field compare, and each such key waits on nobody, so that
 * row has no key. Any other error is a bug and goes on.
 */
export const keyOrNull = (input: StatusInput): StatusKey | null => {
  try {
    return statusOf(input)
  } catch (error) {
    if (error instanceof Error && error.message === KEYS_READ_ERROR) return null
    throw error
  }
}

type KeyedOptions = { select: { main: Selected; version: Selected } }

/**
 * Reads the rows and their latest versions. Step one reads `KEY_SELECT` plus the
 * caller's fields. `read: 'full'` then reads the reviewed fields, only for a live
 * row with a draft copy, because only those need a field compare. `read: 'keys'`
 * stops after step one: a row whose key needs a compare gets `key: null`. The main
 * read keeps `base` in its `and`: it is the one base check of every candidate, and
 * an id with no main row inside `base` gets no entry.
 */
export async function keyedRows(
  ctx: ReadCtx,
  ids: number[],
  options: KeyedOptions & { read: 'full' },
): Promise<Map<number, Entry>>
export async function keyedRows(
  ctx: ReadCtx,
  ids: number[],
  options: KeyedOptions & { read: 'keys' },
): Promise<Map<number, KeysEntry>>
export async function keyedRows(
  ctx: ReadCtx,
  ids: number[],
  { select, read }: KeyedOptions & { read: 'keys' | 'full' },
): Promise<Map<number, KeysEntry>> {
  const entries = new Map<number, KeysEntry>()
  if (ids.length === 0) return entries
  const mains = await readMains(ctx, ids, { ...KEY_SELECT, ...select.main })
  const latests = await readLatest(ctx, ids, { ...KEY_SELECT, ...select.version })
  const keyed = ids.flatMap((id) => {
    const main = mains.get(id)
    return main ? [{ id, main, latest: latests.get(id) ?? null }] : []
  })
  if (read === 'keys') {
    for (const { id, main, latest } of keyed) {
      const key = keyOrNull(
        statusInputOf({ collection: ctx.collection, main, latest, read: 'keys' }),
      )
      entries.set(id, { id, main, latest, key })
    }
    return entries
  }
  const compare = keyed
    .filter(
      ({ main, latest }) =>
        statusInputOf({ collection: ctx.collection, main, latest, read: 'keys' }).draft !== null,
    )
    .map(({ id }) => id)
  const [fullMains, fullLatests] = compare.length
    ? await Promise.all([
        readMains(ctx, compare, statusSelect(ctx.collection)),
        readLatest(ctx, compare, statusSelect(ctx.collection)),
      ])
    : [new Map<number, Doc>(), new Map<number, Doc>()]
  for (const { id, main, latest } of keyed) {
    const full = compare.includes(id)
    const fullMain = fullMains.get(id)
    if (full && !fullMain) continue
    const key = statusOf(
      fullMain
        ? statusInputOf({
            collection: ctx.collection,
            main: fullMain,
            latest: fullLatests.get(id) ?? null,
            read: 'full',
          })
        : statusInputOf({ collection: ctx.collection, main, latest, read: 'keys' }),
    )
    entries.set(id, { id, main, latest, key })
  }
  return entries
}

/**
 * The select of a read that needs only `parent`. Naming `version._status` is on
 * purpose: Payload 3.91 joins every array and block of a group the select does
 * not name, so `{ parent: true }` alone joins all of a course version's fields
 * (38 joins, 4 ms of query building on the request thread; with this select, 2
 * joins and 0.7 ms). The field is read and unused.
 */
export const PARENT_SELECT = { parent: true, version: { _status: true } } as const

/**
 * The ids of every row that may hold work: the ones the `KEY_WHERE` main rows
 * find, and the live ones with a copy. A version row finds the copy of a
 * document that is not live too (`LIVE_COPY` holds no `parent` path), so the
 * parents of the version hits pass a main read under the base `where`.
 */
export const candidateIds = async (ctx: ReadCtx, keys: readonly StatusKey[]) => {
  const onMain = keys.flatMap((key) =>
    KEY_WHERE[key]?.on === 'main' ? [KEY_WHERE[key].where] : [],
  )
  const onCopy = keys.filter((key) => KEY_WHERE[key]?.on !== 'main').map((key) => KEY_WHERE[key])
  const copyWhere = onCopy.every((row) => row !== undefined)
    ? { or: onCopy.map((row) => row.where) }
    : LIVE_COPY
  // An empty `or` is no condition in Payload, so a side with no key is not read.
  const none = { docs: [] }
  const [mains, copies] = await Promise.all([
    onMain.length
      ? findMain(ctx, { where: { and: [ctx.base, { or: onMain }] }, select: { id: true } })
      : none,
    onCopy.length ? findCopies(ctx, { where: copyWhere, select: PARENT_SELECT }) : none,
  ])
  const live = await liveParentIds(ctx.payload, {
    collection: ctx.collection,
    ids: [...new Set(copies.docs.map((v) => relId(v.parent) as number))],
    user: ctx.user,
    where: ctx.base,
  })
  return [...new Set([...mains.docs.map((doc) => doc.id), ...live])]
}

/**
 * One set of work: the candidates of `keys` under `ctx.base`, read keys only,
 * kept when their key waits on `side`. A candidate whose key does not wait, or
 * has none, is out of the set, as a 1b list shows it in another group. The count
 * of a source is the size of this map and its rows are made from it, so the two
 * cannot differ.
 */
export const waitingSet = async (
  ctx: ReadCtx,
  { side, keys }: { side: 'owner' | 'admin'; keys: readonly StatusKey[] },
) => {
  const ids = await candidateIds(ctx, keys)
  const rows = await keyedRows(ctx, ids, { select: { main: {}, version: {} }, read: 'keys' })
  const set = new Map<number, StatusKey>()
  for (const { id, key } of rows.values())
    if (key !== null && waitsOn(key) === side) set.set(id, key)
  return set
}
