import type { FindOptions, Payload, SelectType, Where } from 'payload'

import { relId } from '@/lib/relation'
import {
  KEY_SELECT,
  KEY_WHERE,
  LIVE_COPY,
  liveParentIds,
  statusInputOf,
  statusOf,
  statusSelect,
  STATUS_KEYS,
  waitsOn,
  type ReviewedDoc,
  type StatusKey,
} from '@/lib/review-status'
import type { ReviewedCollection } from '@/lib/reviewed-fields'
import type { User } from '@/payload-types'

/** The keys that wait on one side. Derived from `waitsOn`, so no list is written by hand. */
export const waitingKeys = (side: 'owner' | 'admin'): StatusKey[] =>
  STATUS_KEYS.filter((key) => waitsOn(key) === side)

/**
 * The candidate keys the admin queue reads: the 1b admin list's `workKeys('admin')`
 * (`src/portal/lists/groups.ts`). `src/lib` cannot import `groups.ts`, so this is a
 * pinned copy, and `sources.unit.test.ts` fails when the two differ.
 */
export const ADMIN_LIST_KEYS: readonly StatusKey[] = [
  'draft',
  'submitted',
  'changes_requested',
  'published_edits',
  'published_removal',
  'published_edits_returned',
]

export type Doc = ReviewedDoc
type Version = {
  parent: number | { id: number }
  version: { updatedAt: string } & Record<string, unknown>
}
type Found = { docs: Doc[]; totalDocs: number; hasNextPage: boolean }

/** What a read needs: the reader (null is a server read that overrides access), the collection, and the base `where`. */
export type ReadCtx = {
  payload: Payload
  user: User | null
  collection: ReviewedCollection
  base: Where
}

export type Entry = { id: number; main: Doc; latest: Doc | null; key: StatusKey }

export type Selected = Record<string, true>
type Gated = 'collection' | 'user' | 'overrideAccess'
type MainArgs = Omit<FindOptions<ReviewedCollection, SelectType>, Gated | 'draft'>
type CopyArgs = Omit<Parameters<Payload['findVersions']>[0], Gated>

/** A reader gets a gated read. No reader is the admin projection (Deviation 17): `overrideAccess: true`. */
export const gate = ({ user }: { user: User | null }) =>
  user ? ({ user, overrideAccess: false } as const) : ({ overrideAccess: true } as const)

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

type KeyedOptions = { select: { main: Selected; version: Selected } }

/**
 * Reads the rows and their latest versions in two steps. Step one reads the
 * fields every row needs: `KEY_SELECT` plus the caller's. Step two reads the
 * reviewed fields, only for a live row with a draft copy, because only those
 * need a field compare. The main read keeps `base` in its `and`: it is the one
 * base check of every candidate, and an id with no main row inside `base` gets
 * no entry.
 */
export const keyedRows = async (
  ctx: ReadCtx,
  ids: number[],
  { select }: KeyedOptions & { read: 'full' },
) => {
  const entries = new Map<number, Entry>()
  if (ids.length === 0) return entries
  const mains = await readMains(ctx, ids, { ...KEY_SELECT, ...select.main })
  const latests = await readLatest(ctx, ids, { ...KEY_SELECT, ...select.version })
  const keyed = ids.flatMap((id) => {
    const main = mains.get(id)
    return main ? [{ id, main, latest: latests.get(id) ?? null }] : []
  })
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
  const [mains, copies] = await Promise.all([
    findMain(ctx, { where: { and: [ctx.base, { or: onMain }] }, select: { id: true } }),
    findCopies(ctx, { where: copyWhere, select: { parent: true } }),
  ])
  const live = await liveParentIds(ctx.payload, {
    collection: ctx.collection,
    ids: [...new Set(copies.docs.map((v) => relId(v.parent) as number))],
    user: ctx.user,
    where: ctx.base,
  })
  return [...new Set([...mains.docs.map((doc) => doc.id), ...live])]
}
