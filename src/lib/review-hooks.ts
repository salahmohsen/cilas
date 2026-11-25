import { APIError } from 'payload'
import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  PayloadRequest,
} from 'payload'

import { documentHref, type DocumentTarget } from '@/lib/document-href'
import { requireRowLock, rowIdOf } from '@/lib/row-lock'
import { relId } from '@/lib/relation'
import { REVIEWED } from '@/lib/reviewed-collections'
import { toPersonIds } from '@/lib/fellow-role'
import { isAdminUser, personOf } from '@/access'
import {
  canMove,
  notifyOn,
  REVIEW_REQUESTS,
  type ReviewRequest,
  type ReviewState,
} from '@/lib/review'
import { actorOf, notify } from '@/lib/notify'
import type { NotificationKind } from '@/lib/notification-kinds'
import {
  adminRecipients,
  emailRecipients,
  ownerRecipients,
  sendReviewEmails,
} from '@/lib/review-mail'

/**
 * What `recordDraftSave` learns from the operation args and `applyReview` and
 * `notifyReview` read. It lives on `req.context` under one key, and each write
 * resets it.
 */
type ReviewWrite = {
  /** A draft write to a published document: the copy beside it, not the document. */
  live: boolean
  draftSave: boolean
  autosave: boolean
  /** The `review.request` the write sent, if it is an allowed value. */
  sentRequest: ReviewRequest | null
}

const CONTEXT_KEY = 'reviewWrite'

const reviewContext = (req: PayloadRequest): ReviewWrite =>
  (req.context[CONTEXT_KEY] ??= {
    live: false,
    draftSave: false,
    autosave: false,
    sentRequest: null,
  }) as ReviewWrite

const allowedRequest = (value: unknown): ReviewRequest | null =>
  REVIEW_REQUESTS.find((request) => request === value) ?? null

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
  noun: (typeof REVIEWED)[number]['kind']
  collection: (typeof REVIEWED)[number]['collection']
  ownersOf: (doc: Doc) => number[]
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
  // Access refuses a write with no user and no override, so it queues on no row lock.
  const locks = Boolean(req.user) || Boolean((args as { overrideAccess?: boolean }).overrideAccess)
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
  if (operation === 'restoreVersion') {
    const versionId = rowIdOf(write.id)
    if (locks) {
      const { docs } = await req.payload.db.findVersions({
        collection: collection.slug,
        where: { id: { equals: versionId } },
        limit: 1,
        pagination: false,
        req,
      })
      const parentId = relId(docs[0]?.parent)
      if (typeof parentId === 'number') await requireRowLock(req, collection.slug, parentId)
    }
  }
  const context = reviewContext(req)
  context.live = false
  // Payload fills a field the write left out from the stored document before
  // beforeChange runs, so `data.review.request` there cannot say whether the
  // write sent it. The operation args can.
  context.sentRequest = allowedRequest(write.data?.review?.request)

  if (operation === 'restoreVersion') {
    if (!trusted) write.draft = true
    context.draftSave = Boolean(write.draft)
    context.autosave = false
    return args
  }
  if (operation === 'update' && write.id === undefined && !trusted) {
    throw new APIError('Edit one document at a time.', 403)
  }
  if (operation === 'update' && write.id !== undefined) {
    const rowId = rowIdOf(write.id)
    if (locks) await requireRowLock(req, collection.slug, rowId)
    const held = !trusted || HELD.includes(write.data?.review?.status as ReviewState)
    if (held && write.data?._status !== 'published') {
      const live = await req.payload.db.findOne<Doc & { id: number }>({
        collection: collection.slug,
        where: { id: { equals: rowId } },
        req,
      })
      if (live?._status === 'published') {
        write.draft = true
        context.live = true
      }
    }
  }

  context.draftSave =
    operation === 'create'
      ? Boolean(write.draft)
      : Boolean(write.draft) && write.data?._status !== 'published'
  context.autosave = Boolean(write.autosave)
  return args
}

const nextRequest = ({
  live,
  from,
  to,
  sent,
  originalDoc,
}: {
  live: boolean
  from: ReviewState
  to: ReviewState
  sent: ReviewRequest | null
  originalDoc?: Doc
}): ReviewRequest | null => {
  const stored = originalDoc?.review?.request
  // A write that is not a draft write to a live document keeps what is stored
  // when it leaves the status alone, so a server write (admin, MCP, script)
  // with no `review` key cannot wipe a submitted removal. Any move clears it.
  if (!live) return from === to ? (stored ?? null) : null
  if (to === 'submitted')
    return from === 'submitted' ? (stored ?? sent ?? 'changes') : (sent ?? 'changes')
  if (to === 'changes_requested' || to === 'rejected') return stored ?? null
  return null
}

/**
 * The review rules (src/lib/review.ts) on every write: owners can submit,
 * withdraw or discard a live copy; only approval publishes. An admin's Publish counts as approval, so
 * admins publish as before. Server calls with no user (seeds, imports) are
 * trusted like an admin.
 */
const applyReview =
  ({ noun, onApprove }: ReviewOptions): CollectionBeforeChangeHook =>
  ({ data, operation, originalDoc, req }) => {
    const trusted = !req.user || isAdminUser(req.user)
    const { live, draftSave, autosave, sentRequest } = reviewContext(req)
    // On create, `originalDoc` is a duplicate's source, not this document's
    // history. On a published document it is the latest draft, if there is one.
    const from: ReviewState =
      operation === 'create' ? 'draft' : (originalDoc?.review?.status ?? 'draft')
    let to: ReviewState = data.review?.status ?? from

    // A draft save writes only a version, while emails would announce the new
    // status: the status changes on a full save only. An autosave, which runs
    // while the editor picks it, keeps the old one. On a published document
    // every write is a draft save, so there the buttons may change it.
    if (to !== from && draftSave) {
      if (autosave) {
        to = from
        data = { ...data, review: { ...data.review, status: from } }
      } else if (!live) {
        throw new APIError('Submit with the “Submit for review” button, not Save draft.', 400)
      }
    }
    if (trusted && data._status === 'published' && to === from && to !== 'approved') to = 'approved'

    // A submission stays frozen for the admin until the owner withdraws it.
    if (!trusted && from === 'submitted' && to !== 'draft') {
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
    // What the owner asks of a published document. A move into `submitted`
    // takes the write's `request`, else `changes`, never the stored one (a kept
    // removal would pass `removal` to a later edit). A write that stays at
    // `submitted` keeps the stored one. A decision that returns or declines the
    // copy keeps only the stored one, so an owner save cannot change it. Approval
    // and a move to draft clear it.
    const request = nextRequest({ live, from, to, sent: sentRequest, originalDoc })
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

/** Where an approved article went, by its tier. */
const ARTICLE_PUBLISHED: Partial<Record<string, string>> = {
  community: 'was published for the community',
  public: 'was published on the public site',
}

/** The line under the bell for each move. */
const NOTES: Partial<Record<ReviewState, (noun: string, title: string, doc: Doc) => string>> = {
  submitted: (noun, title) => `A ${noun} waits for review: “${title}”`,
  approved: (noun, title, doc) =>
    `Your ${noun} “${title}” ${
      (noun === 'article' && ARTICLE_PUBLISHED[String(doc.tier)]) || 'was approved and published'
    }`,
  changes_requested: (noun, title) => `Changes were asked for on your ${noun} “${title}”`,
  rejected: (noun, title) => `Your ${noun} “${title}” was not accepted`,
}

/** The bell's lines for a removal request and its outcome. */
const REMOVAL_NOTES: Partial<Record<ReviewState, (noun: string, title: string) => string>> = {
  submitted: (noun, title) => `Removal asked for a published ${noun}: “${title}”`,
  draft: (noun, title) => `Your ${noun} “${title}” was taken off the site, as you asked`,
  rejected: (noun, title) => `Your ${noun} “${title}” stays on the site`,
}

const withdrawnNote = (title: string, removal: boolean) =>
  removal ? `Removal request withdrawn: “${title}”` : `Submission withdrawn: “${title}”`

/**
 * Emails admins on a submission and owners on a decision, with a link to the
 * document in the admin. Only for writes by a signed-in account: server
 * writes are silent. A change to a
 * published document is all draft saves, and is announced like any other.
 */
const notifyReview =
  ({ noun, collection, ownersOf }: ReviewOptions): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, req }) => {
    if (!req.user) return doc
    const { draftSave, live } = reviewContext(req)
    if (draftSave && !live) return doc
    const byAdmin = isAdminUser(req.user)
    const state: ReviewState = doc.review?.status ?? 'draft'
    const before: ReviewState = previousDoc?.review?.status ?? 'draft'
    const asked = state === 'submitted' ? doc : before === 'submitted' ? previousDoc : null
    const removal = asked?.review?.request === 'removal'
    const title = doc.title ?? `Untitled ${noun}`
    const returnedToDraft = before === 'submitted' && state === 'draft'
    if (!byAdmin && returnedToDraft) {
      const people = await adminRecipients(req)
      await notify(
        req.payload,
        people.map((p) => p.id),
        {
          kind: 'withdrawn',
          description: withdrawnNote(title, removal),
          link: documentHref({
            collection,
            id: doc.id,
            viewer: 'admin',
            waiting: false,
          }),
          actor: await actorOf(req.payload, personOf(req.user)),
        },
        req,
      )
      return doc
    }
    const removed = byAdmin && removal && returnedToDraft
    const audience = removed ? 'authors' : notifyOn(before, state)
    if (!audience) return doc
    const people =
      audience === 'admins' ? await adminRecipients(req) : await ownerRecipients(req, ownersOf(doc))
    const target: DocumentTarget = {
      collection,
      id: doc.id,
      viewer: audience === 'admins' ? 'admin' : 'owner',
      waiting: audience === 'admins',
    }
    // The emails have a text per decision, and none says "taken down": an
    // approved removal is told under the bell only.
    if (!removed) {
      await sendReviewEmails(
        req,
        await emailRecipients(req, people, state),
        state,
        removal ? `${title} (removal from the site)` : title,
        doc.review?.review_note,
        { noun, target },
      )
    }
    // The bell (src/components/admin/notification-bell.tsx) takes the short
    // name by kind, and `line` is the detail under it.
    const line = (removal ? REMOVAL_NOTES : NOTES)[state]?.(noun, title, doc) ?? title
    // The bell's avatar is the submitter's for admins, the decider's for owners.
    const actingPerson = audience === 'admins' ? ownersOf(doc)[0] : personOf(req.user)
    await notify(
      req.payload,
      people.map((p) => p.id),
      {
        kind: (removed ? 'removed' : state) as NotificationKind,
        description: line,
        link: documentHref(target),
        actor: await actorOf(req.payload, actingPerson),
      },
      req,
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
export const reviewHooks = (
  kind: ReviewOptions['noun'],
  extra: Pick<ReviewOptions, 'onApprove'> = {},
) => {
  const entry = REVIEWED.find((item) => item.kind === kind)!
  const options: ReviewOptions = {
    noun: entry.kind,
    collection: entry.collection,
    ownersOf: (doc) => toPersonIds(doc[entry.owners] as never),
    ...extra,
  }
  return {
    beforeOperation: [recordDraftSave],
    beforeChange: [applyReview(options)],
    afterChange: [publishOwners(options), notifyReview(options)],
  }
}
