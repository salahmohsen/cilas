import { APIError } from 'payload'
import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  CollectionSlug,
} from 'payload'

import { isAdminUser, personOf } from '@/access'
import { canMove, notifyOn, type ReviewRequest, type ReviewState } from '@/lib/review'
import { actorOf, notify, type NotificationKind } from '@/lib/notify'
import { adminRecipients, ownerRecipients, sendReviewEmail } from '@/lib/review-mail'

const DRAFT_SAVE = 'reviewDraftSave'
const AUTOSAVE = 'reviewAutosave'
const LIVE = 'reviewLive'

/** Decisions that leave a published document as it is: the change waits, or is sent back. */
const HELD: ReviewState[] = ['submitted', 'changes_requested', 'rejected']

type Doc = {
  id?: number
  title?: string | null
  _status?: 'draft' | 'published' | null
  review?: {
    status?: ReviewState | null
    request?: ReviewRequest | null
    review_note?: string | null
  } | null
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
 * Keeps a published document as approved: an owner's edit to it, and an
 * admin's "Request changes" or "Decline" on such an edit, save a draft beside
 * it rather than overwrite it. Only approval publishes the draft; until then
 * the site shows the published one. Bulk edits have no one document to keep,
 * so owners make them one at a time. A restored version is a draft for them
 * too.
 *
 * Then records whether the write is a draft save ("Save draft", autosave).
 * Payload decides that from the operation args before any hook runs, and
 * beforeChange never sees it, so it goes on through `req.context`. A draft
 * write that sets `_status: 'published'` is a publish, as in Payload's own
 * test.
 */
const recordDraftSave: CollectionBeforeOperationHook = async ({
  args,
  collection,
  operation,
  req,
}) => {
  if (operation !== 'create' && operation !== 'update' && operation !== 'restoreVersion') {
    return args
  }
  const trusted = !req.user || isAdminUser(req.user)
  const write = args as {
    autosave?: boolean
    data?: Doc
    draft?: boolean
    duplicateFromID?: number | string
    id?: number | string
  }
  if (operation === 'create' && write.duplicateFromID != null) {
    write.draft = true
    write.data = { ...write.data, _status: 'draft', review: { status: 'draft' } }
  }
  req.context[LIVE] = false

  if (operation === 'restoreVersion') {
    if (!trusted) write.draft = true
    req.context[DRAFT_SAVE] = Boolean(write.draft)
    req.context[AUTOSAVE] = false
    return args
  }
  if (operation === 'update' && write.id === undefined && !trusted) {
    throw new APIError('Edit one document at a time.', 403)
  }
  if (operation === 'update' && write.id !== undefined) {
    const held = !trusted || HELD.includes(write.data?.review?.status as ReviewState)
    if (held && write.data?._status !== 'published') {
      const live = await req.payload.db.findOne<Doc & { id: number }>({
        collection: collection.slug,
        where: { id: { equals: write.id } },
        req,
      })
      if (live?._status === 'published') {
        write.draft = true
        req.context[LIVE] = true
      }
    }
  }

  req.context[DRAFT_SAVE] =
    operation === 'create'
      ? Boolean(write.draft)
      : Boolean(write.draft) && write.data?._status !== 'published'
  req.context[AUTOSAVE] = Boolean(write.autosave)
  return args
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
    // Set by recordDraftSave: a write to a published document, kept as a draft.
    const live = Boolean(req.context?.[LIVE])
    // On create, `originalDoc` is a duplicate's source, not this document's
    // history. On a published document it is the latest draft, if there is one.
    const from: ReviewState =
      operation === 'create' ? 'draft' : (originalDoc?.review?.status ?? 'draft')
    let to: ReviewState = data.review?.status ?? from

    // A draft save writes only a version, while emails would announce the new
    // status: the status changes on a full save only. An autosave, which runs
    // while the editor picks it, keeps the old one. On a published document
    // every write is a draft save, so there the buttons may change it.
    if (to !== from && req.context?.[DRAFT_SAVE]) {
      if (req.context[AUTOSAVE]) {
        to = from
        data = { ...data, review: { ...data.review, status: from } }
      } else if (!live) {
        throw new APIError('Submit with the “Submit for review” button, not Save draft.', 400)
      }
    }
    if (trusted && data._status === 'published' && to === from && to !== 'approved') to = 'approved'

    // Submitted, a change to a published document waits for the admin
    // unchanged, as a submitted draft does (WITH_OWNER).
    if (!trusted && from === 'submitted') {
      throw new APIError(
        `This ${noun} waits for review. An admin decides before it changes again.`,
        403,
      )
    }
    // Decided, a draft that was never published stays as the admin left it
    // (WITH_OWNER), as a submitted one does; OWNER_EDITS leaves both to us.
    if (
      !trusted &&
      !live &&
      operation === 'update' &&
      (from === 'approved' || from === 'rejected')
    ) {
      throw new APIError(`This ${noun} was ${from}. Only an admin can change it now.`, 403)
    }
    if (!canMove(from, to, trusted, live)) {
      throw new APIError(
        `Only an admin can move a ${from.replace('_', ' ')} ${noun} to ${to.replace('_', ' ')}.`,
        403,
      )
    }
    // What the owner asks of a published document holds only while it waits.
    const request: ReviewRequest | null =
      live && to === 'submitted'
        ? (data.review?.request ?? originalDoc?.review?.request ?? 'changes')
        : null
    const review = { ...data.review, status: to, request }
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

/** The bell's lines for a removal request and its outcome. */
const REMOVAL_NOTES: Partial<Record<ReviewState, (noun: string, title: string) => string>> = {
  submitted: (noun, title) => `Removal asked for a published ${noun}: “${title}”`,
  draft: (noun, title) => `Your ${noun} “${title}” was taken off the site, as you asked`,
  rejected: (noun, title) => `Your ${noun} “${title}” stays on the site`,
}

/**
 * Emails admins on a submission and owners on a decision, with a link to the
 * document in the admin. Only for writes by a signed-in account: server
 * writes are silent, and `context.skipReviewEmail` opts out. A change to a
 * published document is all draft saves, and is announced like any other.
 */
const notifyReview =
  ({ noun, collection, ownersOf }: ReviewOptions): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, req }) => {
    if (!req.user || req.context?.skipReviewEmail) return doc
    if (req.context?.[DRAFT_SAVE] && !req.context[LIVE]) return doc
    const state: ReviewState = doc.review?.status ?? 'draft'
    const before: ReviewState = previousDoc?.review?.status ?? 'draft'
    const removal = (state === 'submitted' ? doc : previousDoc)?.review?.request === 'removal'
    // An approved removal takes the document down to a draft: tell its owners.
    const audience =
      removal && before === 'submitted' && state === 'draft' ? 'authors' : notifyOn(before, state)
    if (!audience) return doc
    const people =
      audience === 'admins' ? await adminRecipients(req) : await ownerRecipients(req, ownersOf(doc))
    const title = doc.title ?? `Untitled ${noun}`
    const path = `/admin/collections/${collection}/${doc.id}`
    // The emails have a text per decision, and none says "taken down": an
    // approved removal is told under the bell only.
    if (!(removal && state === 'draft')) {
      await sendReviewEmail(
        req,
        people.map((p) => p.email),
        state,
        removal ? `${title} (removal from the site)` : title,
        doc.review?.review_note,
        { noun, path },
      )
    }
    // The bell (src/components/admin/notification-bell.tsx) takes the short
    // name by kind, and `line` is the detail under it.
    const line = (removal ? REMOVAL_NOTES : NOTES)[state]?.(noun, title) ?? title
    // The bell's avatar is the submitter's for admins, the decider's for owners.
    const actingPerson = audience === 'admins' ? ownersOf(doc)[0] : personOf(req.user)
    await notify(
      req.payload,
      people.map((p) => p.id),
      {
        kind: (removal && state === 'draft' ? 'removed' : state) as NotificationKind,
        description: line,
        link: path,
        actor: await actorOf(req.payload, actingPerson),
      },
    )
    return doc
  }

/**
 * Whoever has published work has a public profile: on approval, the owners'
 * people are shown on the site (People → Show on the site). An admin can
 * hide one again afterwards.
 */
const publishOwners =
  ({ ownersOf }: ReviewOptions): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, req }) => {
    if (doc.review?.status !== 'approved' || previousDoc?.review?.status === 'approved') return doc
    const people = ownersOf(doc)
    if (!people.length) return doc
    await req.payload.update({
      collection: 'people',
      where: { and: [{ id: { in: people } }, { visible: { not_equals: true } }] },
      data: { visible: true },
      overrideAccess: true,
      req,
    })
    return doc
  }

/** The review path's hooks, to spread into a collection's `hooks`. */
export const reviewHooks = (options: ReviewOptions) => ({
  beforeOperation: [recordDraftSave],
  beforeChange: [applyReview(options)],
  afterChange: [publishOwners(options), notifyReview(options)],
})
