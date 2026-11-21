import type { Payload, Where } from 'payload'

import type { User } from '@/payload-types'

import type { ReviewRequest, ReviewState } from './review'
import { REVIEWED_FIELDS, type ReviewedCollection } from './reviewed-fields'

export const STATUS_KEYS = [
  'draft',
  'submitted',
  'changes_requested',
  'rejected',
  'published',
  'published_unsent',
  'published_edits',
  'published_removal',
  'published_edits_returned',
  'published_edits_declined',
  'published_removal_kept',
] as const

export type StatusKey = (typeof STATUS_KEYS)[number]

export type ReviewedDoc = {
  id: number
  _status?: 'draft' | 'published' | null
  updatedAt: string
  review?: { status?: ReviewState | null; request?: ReviewRequest | null } | null
} & Record<string, unknown>

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const canonical = (value: unknown): unknown => {
  // A Date has no own keys, so it would read as an empty object.
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
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

/** `keys`: read with `KEY_SELECT`, no reviewed field. `full`: every field of `statusSelect(collection)`. */
export type RowRead = 'keys' | 'full'

export type StatusInput = {
  collection: ReviewedCollection
  doc: ReviewedDoc
  draft: ReviewedDoc | null
  read: RowRead
}

/**
 * A document that is not live has a main row that is not published: one never
 * published, or one an admin took down. A row with no `_status` is not live
 * either. Takes the main row only.
 */
export const neverPublished = (main: ReviewedDoc): boolean => main._status !== 'published'

const WAITS_ON: Record<StatusKey, 'owner' | 'admin' | null> = {
  draft: null,
  submitted: 'admin',
  changes_requested: 'owner',
  rejected: null,
  published: null,
  published_unsent: null,
  published_edits: 'admin',
  published_removal: 'admin',
  published_edits_returned: 'owner',
  published_edits_declined: null,
  published_removal_kept: null,
}

/** The one Needs you predicate. */
export const waitsOn = (key: StatusKey): 'owner' | 'admin' | null => WAITS_ON[key]

const NOT_LIVE_KEYS: Partial<Record<ReviewState, StatusKey>> = {
  draft: 'draft',
  submitted: 'submitted',
  changes_requested: 'changes_requested',
  rejected: 'rejected',
}

export const statusOf = (
  { collection, doc, draft, read }: StatusInput,
  warn: (message: string) => void = console.warn,
): StatusKey => {
  if (doc._status !== 'published') {
    const state = doc.review?.status
    if (!state) return 'draft'
    const key = NOT_LIVE_KEYS[state]
    if (key) return key
    warn(`Document ${doc.id} is not live with review.status ${state}; reading it as draft`)
    return 'draft'
  }
  if (!draft) return 'published'
  const request = draft.review?.request
  const unsent = () => {
    if (read === 'keys') throw new Error('statusOf compares fields only on full rows')
    return hasUnsentEdits(draft, doc, REVIEWED_FIELDS[collection])
  }
  switch (draft.review?.status) {
    case 'submitted':
      return request === 'removal' ? 'published_removal' : 'published_edits'
    case 'changes_requested':
      return 'published_edits_returned'
    case 'rejected':
      if (request !== 'removal') return 'published_edits_declined'
      return unsent() ? 'published_unsent' : 'published_removal_kept'
    default:
      return unsent() ? 'published_unsent' : 'published'
  }
}

/**
 * Builds `StatusInput` from the two rows that hold a document's state. `main`
 * is a `find` row with `draft: false`. `latest` is the `version` of the latest
 * version with its `id` set to the parent id, or null. A draft save never writes
 * the main row, so only the main row says whether the document is live and only
 * the latest version holds the newest fields.
 */
export const statusInputOf = ({
  collection,
  main,
  latest,
  read,
}: {
  collection: ReviewedCollection
  main: ReviewedDoc
  latest: ReviewedDoc | null
  read: RowRead
}): StatusInput => {
  if (neverPublished(main)) return { collection, doc: latest ?? main, draft: null, read }
  return { collection, doc: main, draft: latest?._status === 'draft' ? latest : null, read }
}

/** The fields `statusInputOf` and `statusOf` read when no field compare is needed. */
export const KEY_SELECT = { title: true, review: true, updatedAt: true, _status: true } as const

/** `KEY_SELECT` plus each reviewed field: what a field compare also needs. A main row's select. */
export const statusSelect = (collection: ReviewedCollection) => ({
  ...KEY_SELECT,
  ...Object.fromEntries(REVIEWED_FIELDS[collection].map((field) => [field, true as const])),
})

/**
 * Main rows that are not live: a draft, or no `_status` at all, as
 * `statusInputOf` reads it. Not `not_equals`: SQL drops nulls from it.
 */
export const NOT_LIVE: Where = {
  or: [{ _status: { equals: 'draft' } }, { _status: { exists: false } }],
}

/**
 * Version rows: the latest version of a live document is a draft copy. The
 * term `parent._status` is left out on purpose: Payload joins the parent and
 * adds the parent collection's read access to each branch of the version
 * access, and for an owner reading with `overrideAccess: false` that was one
 * query with 1368 joins, which put Postgres into recovery. So this `where`
 * also matches the versions of a document that is not live. A caller keeps
 * only the versions whose parent is live with `liveParentIds`, one main read.
 */
export const LIVE_COPY: Where = {
  and: [{ latest: { equals: true } }, { 'version._status': { equals: 'draft' } }],
}

const onMain = (where: Where) => ({ on: 'main' as const, where: { and: [NOT_LIVE, where] } })
const onVersion = (where: Where) => ({
  on: 'version' as const,
  where: { and: [LIVE_COPY, where] },
})
const mainStatus = (status: ReviewState) => onMain({ 'review.status': { equals: status } })

/**
 * The rows a query reads to find each key without a field compare. The
 * `draft` row also holds a not-live `approved` row and a row with no status,
 * as `statusOf` reads them. A key that needs a field compare has no row.
 *
 * A `version` row holds no `parent.*` path (see `LIVE_COPY`). A version that
 * a `version` row finds may belong to a document that is not live: keep only
 * the versions whose parent is in `liveParentIds`, read under the caller's own
 * gated `where`.
 */
export const KEY_WHERE: {
  readonly [K in StatusKey]?: { on: 'main' | 'version'; where: Where }
} = {
  draft: onMain({
    or: [
      { 'review.status': { in: ['draft', 'approved'] } },
      { 'review.status': { exists: false } },
    ],
  }),
  submitted: mainStatus('submitted'),
  changes_requested: mainStatus('changes_requested'),
  rejected: mainStatus('rejected'),
  published_edits: onVersion({
    and: [
      { 'version.review.status': { equals: 'submitted' } },
      { 'version.review.request': { not_equals: 'removal' } },
    ],
  }),
  published_removal: onVersion({
    and: [
      { 'version.review.status': { equals: 'submitted' } },
      { 'version.review.request': { equals: 'removal' } },
    ],
  }),
  published_edits_returned: onVersion({
    'version.review.status': { equals: 'changes_requested' },
  }),
}

/**
 * The ids, out of `ids`, of the documents that are live: one main read with
 * `_status: published`, `id in ids`, `select: { id: true }`, `depth: 0` and
 * `pagination: false`. Use it to keep the versions a `KEY_WHERE` `version` row
 * finds. `where` is the caller's own gated `where` for the main read, so the
 * read stays inside what that reader may see; `user` is the reader, null for
 * a server read that overrides access.
 */
export const liveParentIds = async (
  payload: Payload,
  {
    collection,
    ids,
    user,
    where,
  }: { collection: ReviewedCollection; ids: readonly number[]; user: User | null; where?: Where },
): Promise<Set<number>> => {
  if (ids.length === 0) return new Set()
  const { docs } = (await payload.find({
    collection,
    where: {
      and: [
        ...(where ? [where] : []),
        { _status: { equals: 'published' } },
        { id: { in: [...ids] } },
      ],
    },
    draft: false,
    select: { id: true },
    depth: 0,
    pagination: false,
    ...(user ? { user, overrideAccess: false } : { overrideAccess: true }),
  } as never)) as unknown as { docs: { id: number }[] }
  return new Set(docs.map((doc) => doc.id))
}

export type StatusTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger'

export type StatusIcon =
  | 'pencil-line'
  | 'clock'
  | 'message-square-warning'
  | 'circle-x'
  | 'globe'
  | 'file-pen'
  | 'file-clock'
  | 'archive-x'
  | 'archive-restore'

export type StatusBadge = { tone: StatusTone; icon: StatusIcon; labelKey: `status.${string}` }

const PUBLISHED_BADGE: StatusBadge = {
  tone: 'success',
  icon: 'globe',
  labelKey: 'status.published',
}

const BADGES: Record<StatusKey, StatusBadge[]> = {
  draft: [{ tone: 'neutral', icon: 'pencil-line', labelKey: 'status.draft' }],
  submitted: [{ tone: 'info', icon: 'clock', labelKey: 'status.submitted' }],
  changes_requested: [
    { tone: 'warning', icon: 'message-square-warning', labelKey: 'status.changesRequested' },
  ],
  rejected: [{ tone: 'danger', icon: 'circle-x', labelKey: 'status.declined' }],
  published: [PUBLISHED_BADGE],
  published_unsent: [
    PUBLISHED_BADGE,
    { tone: 'neutral', icon: 'file-pen', labelKey: 'status.unsentEdits' },
  ],
  published_edits: [
    PUBLISHED_BADGE,
    { tone: 'info', icon: 'file-clock', labelKey: 'status.editsInReview' },
  ],
  published_removal: [
    PUBLISHED_BADGE,
    { tone: 'neutral', icon: 'archive-x', labelKey: 'status.removalRequested' },
  ],
  published_edits_returned: [
    PUBLISHED_BADGE,
    { tone: 'warning', icon: 'message-square-warning', labelKey: 'status.changesRequested' },
  ],
  published_edits_declined: [
    PUBLISHED_BADGE,
    { tone: 'danger', icon: 'circle-x', labelKey: 'status.editsDeclined' },
  ],
  published_removal_kept: [
    PUBLISHED_BADGE,
    { tone: 'neutral', icon: 'archive-restore', labelKey: 'status.keptOnSite' },
  ],
}

/** One badge, or two on a live key (Published first). Keys sit under `Portal.`. */
export const statusBadge = (key: StatusKey): StatusBadge[] => BADGES[key]

type NextLine = { labelKey: `next.${string}` }

const OWNER_LINES: Record<StatusKey, NextLine> = {
  draft: { labelKey: 'next.owner.draft' },
  submitted: { labelKey: 'next.owner.submitted' },
  changes_requested: { labelKey: 'next.owner.changesRequested' },
  rejected: { labelKey: 'next.owner.rejected' },
  published: { labelKey: 'next.owner.published' },
  published_unsent: { labelKey: 'next.owner.publishedUnsent' },
  published_edits: { labelKey: 'next.owner.publishedEdits' },
  published_removal: { labelKey: 'next.owner.publishedRemoval' },
  published_edits_returned: { labelKey: 'next.owner.publishedEditsReturned' },
  published_edits_declined: { labelKey: 'next.owner.publishedEditsDeclined' },
  published_removal_kept: { labelKey: 'next.owner.publishedRemovalKept' },
}

const ADMIN_LINES: Record<StatusKey, NextLine | null> = {
  draft: null,
  submitted: { labelKey: 'next.admin.submitted' },
  changes_requested: { labelKey: 'next.admin.changesRequested' },
  rejected: null,
  published: null,
  published_unsent: null,
  published_edits: { labelKey: 'next.admin.publishedEdits' },
  published_removal: { labelKey: 'next.admin.publishedRemoval' },
  published_edits_returned: { labelKey: 'next.admin.publishedEditsReturned' },
  published_edits_declined: null,
  published_removal_kept: null,
}

/** The next-action line for a viewer, or null when nothing waits on them. Keys sit under `Portal.`. */
export const nextAction = (key: StatusKey, viewer: 'owner' | 'admin'): NextLine | null =>
  viewer === 'owner' ? OWNER_LINES[key] : ADMIN_LINES[key]
