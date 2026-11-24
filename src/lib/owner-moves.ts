import {
  APIError,
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from 'payload'

import type { User } from '@/payload-types'

import { lockRow } from './lock-row'
import { relId } from './relation'
import { statusInputOf, statusOf, waitsOn, type ReviewedDoc } from './review-status'
import { REVIEWED_FIELDS, type ReviewedCollection } from './reviewed-fields'

export type OwnerMove =
  /** Submitted to draft: a new submission, edits, or a removal request. */
  | { move: 'withdraw' }
  /** A live document: the copy goes to submitted with `request: removal`. */
  | { move: 'requestRemoval' }
  /** A live document: the copy takes the live row's reviewed fields. */
  | { move: 'discard' }
  /** A live document: the copy takes the reviewed fields of version `from`. */
  | { move: 'restore'; from: number }

export type OwnerMoveResult =
  /** `restoreFrom` is set by `discard`: the version id before the discard. */
  { ok: true; restoreFrom?: number } | { ok: false; reason: 'decided' | 'refused' }

type Target = { collection: ReviewedCollection; id: number }

const inTransaction = async <T>(
  payload: Payload,
  user: User,
  run: (req: PayloadRequest) => Promise<T>,
): Promise<T> => {
  const req = await createLocalReq({ user }, payload)
  const owns = await initTransaction(req)
  try {
    const result = await run(req)
    if (owns) await commitTransaction(req)
    return result
  } catch (error) {
    if (owns) await killTransaction(req)
    throw error
  }
}

/** The reviewed fields of a row, every locale, as a write. */
const reviewedFieldsOf = (collection: ReviewedCollection, row: Record<string, unknown>) =>
  Object.fromEntries(
    REVIEWED_FIELDS[collection]
      .filter((field) => row[field] !== undefined)
      .map((field) => [field, row[field]]),
  )

/** Gated reads and writes of every locale. Payload types `locale: 'all'` for reads only. */
const READ_ALL = (req: PayloadRequest, user: User) =>
  ({ req, user, overrideAccess: false, depth: 0, locale: 'all' }) as const
const LOCALE_ALL = 'all' as unknown as 'en'

const discard = async (
  req: PayloadRequest,
  user: User,
  { collection, id }: Target,
): Promise<number | undefined> => {
  const { payload } = req
  const as = READ_ALL(req, user)
  // The lock first: the version read below is then the version this write replaces.
  await lockRow(req, collection, id)
  const main = (await payload.findByID({
    collection,
    id,
    draft: false,
    ...as,
  })) as unknown as Record<string, unknown>
  const { docs } = await payload.findVersions({
    collection,
    where: { parent: { equals: id }, latest: { equals: true } },
    sort: '-updatedAt',
    limit: 1,
    ...as,
  })
  const copy = docs[0]?.version as unknown as
    | { review?: { status?: string | null } | null }
    | undefined
  const returned =
    copy?.review?.status === 'changes_requested' || copy?.review?.status === 'rejected'
  await payload.update({
    collection,
    id,
    draft: true,
    data: {
      ...reviewedFieldsOf(collection, main),
      ...(returned ? { review: { status: 'draft' } } : {}),
    } as never,
    ...as,
    locale: LOCALE_ALL,
  })
  return docs[0] ? Number(docs[0].id) : undefined
}

const restore = async (
  req: PayloadRequest,
  user: User,
  { collection, id }: Target,
  from: number,
): Promise<boolean> => {
  const { payload } = req
  const as = READ_ALL(req, user)
  await lockRow(req, collection, id)
  const version = await payload.findVersionByID({ collection, id: String(from), ...as })
  if (relId(version?.parent) !== id) return false
  await payload.update({
    collection,
    id,
    draft: true,
    data: reviewedFieldsOf(
      collection,
      version.version as unknown as Record<string, unknown>,
    ) as never,
    ...as,
    locale: LOCALE_ALL,
  })
  return true
}

/** True when the document no longer waits on an admin: one decided it first. */
const decidedByAdmin = async (payload: Payload, { collection, id }: Target) => {
  const read = { id, depth: 0, locale: 'all', overrideAccess: true } as const
  const main = (await payload.findByID({
    collection,
    draft: false,
    ...read,
  })) as unknown as ReviewedDoc
  const {
    docs: [version],
  } = await payload.findVersions({
    collection,
    where: { parent: { equals: id }, latest: { equals: true } },
    sort: '-updatedAt',
    limit: 1,
    depth: 0,
    locale: 'all',
    overrideAccess: true,
  })
  const latest = version ? ({ ...version.version, id } as unknown as ReviewedDoc) : null
  const key = statusOf(statusInputOf({ collection, main, latest, read: 'full' }), () => undefined)
  return waitsOn(key) !== 'admin'
}

/**
 * The moves an owner makes on their own submission. Every write runs as the
 * owner with access checks on, so the review rules (`applyReview`) and the row
 * lock (`recordDraftSave`) apply. A refusal is a result, any other error throws.
 */
export const ownerMove = async (
  payload: Payload,
  user: User,
  target: Target,
  move: OwnerMove,
): Promise<OwnerMoveResult> => {
  const { collection, id } = target
  try {
    return await inTransaction(payload, user, async (req) => {
      const write = (data: Record<string, unknown>, draft = true) =>
        payload.update({
          collection,
          id,
          data: data as never,
          draft,
          req,
          user,
          overrideAccess: false,
          depth: 0,
        })
      switch (move.move) {
        case 'withdraw':
          // A full save on a document that is not live. On a live one the
          // review hook turns it into a draft save.
          await write({ review: { status: 'draft' } }, false)
          return { ok: true } as const
        case 'requestRemoval':
          await write({ review: { status: 'submitted', request: 'removal' } })
          return { ok: true } as const
        case 'discard':
          return { ok: true, restoreFrom: await discard(req, user, target) } as const
        case 'restore':
          return (await restore(req, user, target, move.from))
            ? ({ ok: true } as const)
            : ({ ok: false, reason: 'refused' } as const)
      }
    })
  } catch (error) {
    if (!(error instanceof APIError) || error.status !== 403) throw error
    const decided = move.move === 'withdraw' && (await decidedByAdmin(payload, target))
    return { ok: false, reason: decided ? 'decided' : 'refused' }
  }
}
