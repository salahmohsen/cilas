/**
 * The article review path (CONTEXT.md): draft → submitted → changes requested
 * → approved or rejected. Approval is the only way an article is published.
 */

export const REVIEW_STATES = [
  'draft',
  'submitted',
  'changes_requested',
  'approved',
  'rejected',
] as const
export type ReviewState = (typeof REVIEW_STATES)[number]

export type Tier = 'owner' | 'community' | 'public'

const AUTHOR_MOVES: Record<ReviewState, ReviewState[]> = {
  draft: ['submitted'],
  changes_requested: ['submitted'],
  submitted: [],
  approved: [],
  rejected: [],
}

/**
 * On a published document an owner submits a change, or a removal, from where
 * the last decision left it: approved, or a change declined.
 */
const LIVE_AUTHOR_MOVES: Partial<Record<ReviewState, ReviewState[]>> = {
  approved: ['submitted'],
  rejected: ['submitted'],
}

/**
 * Authors may only submit; admins (and trusted server calls) may do anything.
 * `live`: the document is published, and the move is about a change to it.
 */
export const canMove = (
  from: ReviewState,
  to: ReviewState,
  trusted: boolean,
  live = false,
): boolean =>
  from === to ||
  trusted ||
  AUTHOR_MOVES[from].includes(to) ||
  (live && (LIVE_AUTHOR_MOVES[from] ?? []).includes(to))

export type ReviewRequest = 'changes' | 'removal'

/** Who hears about a move: admins review submissions, authors hear decisions. */
export const notifyOn = (from: ReviewState, to: ReviewState): 'admins' | 'authors' | null => {
  if (from === to) return null
  if (to === 'submitted') return 'admins'
  if (to === 'approved' || to === 'changes_requested' || to === 'rejected') return 'authors'
  return null
}
