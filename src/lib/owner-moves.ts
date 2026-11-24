import { APIError, createLocalReq, NotFound, type Payload, type PayloadRequest } from 'payload'

import type { User } from '@/payload-types'

import { inTransaction } from './in-transaction'
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
  { ok: true; restoreFrom?: number } | { ok: false; reason: 'decided' | 'refused' | 'busy' }

type Target = { collection: ReviewedCollection; id: number }

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

/** The newest copy of a document, every locale. `access` is a gated read or `overrideAccess: true`. */
const latestCopy = async (
  payload: Payload,
  collection: ReviewedCollection,
  id: number,
  access: Record<string, unknown>,
) => {
  const { docs } = await payload.findVersions({
    collection,
    where: { parent: { equals: id }, latest: { equals: true } },
    sort: '-updatedAt',
    limit: 1,
    depth: 0,
    locale: 'all',
    ...access,
  })
  return docs[0]
}

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
  const latest = await latestCopy(payload, collection, id, as)
  const copy = latest?.version as unknown as
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
  return latest ? Number(latest.id) : undefined
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
  if (!Number.isSafeInteger(from)) return false
  const version = await payload
    .findVersionByID({ collection, id: String(from), ...as })
    .catch((error) => (error instanceof NotFound ? null : Promise.reject(error)))
  if (!version || relId(version.parent) !== id) return false
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
  const version = await latestCopy(payload, collection, id, { overrideAccess: true })
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
    const req = await createLocalReq({ user }, payload)
    return await inTransaction(req, async () => {
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
    if (error instanceof APIError && error.status === 409) return { ok: false, reason: 'busy' }
    if (!(error instanceof APIError) || error.status !== 403) throw error
    const decided = move.move === 'withdraw' && (await decidedByAdmin(payload, target))
    return { ok: false, reason: decided ? 'decided' : 'refused' }
  }
}
