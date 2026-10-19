import { APIError } from 'payload'
import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  CollectionSlug,
} from 'payload'

import { isAdminUser } from '@/access'
import { canMove, notifyOn, type ReviewState } from '@/lib/review'
import { notify, type NotificationKind } from '@/lib/notify'
import { adminRecipients, ownerRecipients, sendReviewEmail } from '@/lib/review-mail'

const DRAFT_SAVE = 'reviewDraftSave'
const AUTOSAVE = 'reviewAutosave'

type Doc = {
  id?: number
  title?: string | null
  _status?: 'draft' | 'published' | null
  review?: { status?: ReviewState | null; review_note?: string | null } | null
} & Record<string, unknown>

export type ReviewOptions = {
  /** What the documents are called in messages: "article", "course", "publication". */
  noun: string
  collection: CollectionSlug
  /** The people who own a document and hear the decisions. */
  ownersOf: (doc: Doc) => number[]
  /** What approval adds besides publishing, e.g. an article's tier and date. */
  onApprove?: (args: { data: Doc; originalDoc?: Doc; now: Date }) => Record<string, unknown>
}

/**
 * Records whether a write is a draft save ("Save draft", autosave). Payload
 * decides that from the operation args before any hook runs, and beforeChange
 * never sees it, so it goes on through `req.context`. A draft write that sets
 * `_status: 'published'` is a publish, as in Payload's own test.
 */
const recordDraftSave: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return
  const { autosave, data, draft } = args as {
    autosave?: boolean
    data?: { _status?: unknown }
    draft?: boolean
  }
  req.context[DRAFT_SAVE] =
    operation === 'create' ? Boolean(draft) : Boolean(draft) && data?._status !== 'published'
  req.context[AUTOSAVE] = Boolean(autosave)
}

/**
 * The review rules (src/lib/review.ts) on every write: an owner may only
 * submit; only approval publishes. An admin's Publish counts as approval, so
 * admins publish as before. Server calls with no user (seeds, imports) are
 * trusted like an admin.
 */
const applyReview =
  ({ noun, onApprove }: ReviewOptions): CollectionBeforeChangeHook =>
  ({ data, operation, originalDoc, req }) => {
    const trusted = !req.user || isAdminUser(req.user)
    // On create, `originalDoc` is a duplicate's source, not this document's history.
    const from: ReviewState =
      operation === 'create' ? 'draft' : (originalDoc?.review?.status ?? 'draft')
    let to: ReviewState = data.review?.status ?? from

    // A draft save writes only a version, while emails would announce the new
    // status: the status changes on a full save only. An autosave, which runs
    // while the editor picks it, keeps the old one.
    if (to !== from && req.context?.[DRAFT_SAVE]) {
      if (!req.context[AUTOSAVE]) {
        throw new APIError('Submit with the “Submit for review” button, not Save draft.', 400)
      }
      to = from
      data = { ...data, review: { ...data.review, status: from } }
    }
    if (trusted && data._status === 'published' && to === from && to !== 'approved') to = 'approved'

    if (!canMove(from, to, trusted)) {
      throw new APIError(
        `Only an admin can move a ${from.replace('_', ' ')} ${noun} to ${to.replace('_', ' ')}.`,
        403,
      )
    }
    const review = { ...data.review, status: to }
    if (to !== 'approved') return { ...data, review, _status: 'draft' }
    if (from === 'approved') return { ...data, review }
    return {
      ...data,
      review,
      _status: 'published',
      ...onApprove?.({ data, originalDoc, now: new Date() }),
    }
  }

/** The line under the bell for each move. */
const NOTES: Partial<Record<ReviewState, (noun: string, title: string) => string>> = {
  submitted: (noun, title) => `A ${noun} waits for review: “${title}”`,
  approved: (noun, title) => `Your ${noun} “${title}” was approved and published`,
  changes_requested: (noun, title) => `Changes were asked for on your ${noun} “${title}”`,
  rejected: (noun, title) => `Your ${noun} “${title}” was not accepted`,
}

/**
 * Emails admins on a submission and owners on a decision, with a link to the
 * document in the admin. Only for writes by a signed-in account: server
 * writes are silent, and `context.skipReviewEmail` opts out.
 */
const notifyReview =
  ({ noun, collection, ownersOf }: ReviewOptions): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, req }) => {
    if (!req.user || req.context?.skipReviewEmail || req.context?.[DRAFT_SAVE]) return doc
    const state: ReviewState = doc.review?.status ?? 'draft'
    const audience = notifyOn(previousDoc?.review?.status ?? 'draft', state)
    if (!audience) return doc
    const people =
      audience === 'admins' ? await adminRecipients(req) : await ownerRecipients(req, ownersOf(doc))
    const to = people.map((p) => p.email)
    await sendReviewEmail(
      req,
      to,
      state,
      doc.title ?? `Untitled ${noun}`,
      doc.review?.review_note,
      {
        noun,
        path: `/admin/collections/${collection}/${doc.id}`,
      },
    )
    // The same news under the bell (src/components/admin/notification-bell.tsx).
    const title = doc.title ?? `Untitled ${noun}`
    await notify(
      req.payload,
      people.map((p) => p.id),
      {
        kind: state as NotificationKind,
        title: NOTES[state]?.(noun, title) ?? title,
        link: `/admin/collections/${collection}/${doc.id}`,
      },
    )
    return doc
  }

/** The review path's hooks, to spread into a collection's `hooks`. */
export const reviewHooks = (options: ReviewOptions) => ({
  beforeOperation: [recordDraftSave],
  beforeChange: [applyReview(options)],
  afterChange: [notifyReview(options)],
})
