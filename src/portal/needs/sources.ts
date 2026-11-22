import { isAdminUser, mayAuthor, mayTeach } from '@/access'
import type { ReviewedCollection } from '@/lib/reviewed-fields'
import type { StatusKey } from '@/lib/review-status'
import type { User } from '@/payload-types'

export type NeedKind =
  | 'review'
  | 'edit_review'
  | 'removal_review'
  | 'applicants'
  | 'changes_requested'

export type NeedRow = {
  kind: NeedKind
  verbKey: `needs.${string}`
  href: string
  /** Null when no locale has a title: the view then writes "Untitled article" or "Untitled course". */
  label: string | null
  count: number
  owners: string[]
  /** Null on the `applicants` row. */
  collection: ReviewedCollection | null
}

export type NeedSource = 'reviewQueue' | 'applicants' | 'ownArticles' | 'ownCourses'

export type NeedsResult = { rows: NeedRow[]; failed: NeedSource[] }

/** A failed source makes the complete task total unavailable. */
export const needsTotal = ({ rows, failed }: NeedsResult) =>
  failed.length > 0 ? null : rows.reduce((sum, row) => sum + row.count, 0)

/** The sources of one reader. An admin has the queue and the applicants; any other reader has their own work. */
export const SOURCES_OF = (user: User): NeedSource[] => {
  if (isAdminUser(user)) return ['reviewQueue', 'applicants']
  return [
    ...(mayAuthor(user) ? (['ownArticles'] as const) : []),
    ...(mayTeach(user) ? (['ownCourses'] as const) : []),
  ]
}

export const KIND_OF_KEY: Partial<Record<StatusKey, NeedKind>> = {
  submitted: 'review',
  published_edits: 'edit_review',
  published_removal: 'removal_review',
  changes_requested: 'changes_requested',
  published_edits_returned: 'changes_requested',
}

export const VERB_OF: Record<NeedKind, `needs.${string}`> = {
  review: 'needs.review',
  edit_review: 'needs.editReview',
  removal_review: 'needs.removalReview',
  applicants: 'needs.applicants',
  changes_requested: 'needs.changesRequested',
}

/**
 * The candidate keys of an owner's set: a subset of the owner list's `workKeys`,
 * the keys that can give an owner-waiting key. Each has a `KEY_WHERE` row, so the
 * all-copies read (`LIVE_COPY`) is never needed.
 *
 * `changes_requested` and `published_edits_returned` wait on the owner. `submitted`
 * waits on an admin, so it gives an owner-waiting id only for a not-live row whose
 * main row and latest version are out of step, a state Payload cannot write (a
 * save moves both together). It stays because the set is the owner list's Needs you
 * group, which reads it too: the same candidates, so the same set.
 */
export const OWNER_SET_KEYS: readonly StatusKey[] = [
  'submitted',
  'changes_requested',
  'published_edits_returned',
]
