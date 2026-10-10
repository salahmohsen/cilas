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

const LABELS: Record<ReviewState, string> = {
  draft: 'draft',
  submitted: 'submitted',
  changes_requested: 'changes requested',
  approved: 'approved',
  rejected: 'rejected',
}

/** Authors may only submit; admins (and trusted server calls) may do anything. */
export const canMove = (from: ReviewState, to: ReviewState, trusted: boolean): boolean =>
  from === to || trusted || AUTHOR_MOVES[from].includes(to)

type ReviewData = {
  tier?: Tier | null
  requested_tier?: Exclude<Tier, 'owner'> | null
  published_date?: string | null
}

type Patch = { _status?: 'draft' | 'published'; tier?: Tier; published_date?: string }

/**
 * What a review move changes. Every state but approved keeps the article a
 * draft; moving into approved publishes it at the admin's tier, or else the
 * requested one.
 */
export const reviewPatch = ({
  from,
  to,
  trusted,
  data,
  now,
}: {
  from: ReviewState
  to: ReviewState
  trusted: boolean
  data: ReviewData
  now: Date
}): { error: string } | { patch: Patch } => {
  if (!canMove(from, to, trusted)) {
    return { error: `Only an admin can move a ${LABELS[from]} article to ${LABELS[to]}.` }
  }
  if (to !== 'approved') return { patch: { _status: 'draft' } }
  if (from === 'approved') return { patch: {} }
  return {
    patch: {
      _status: 'published',
      tier: data.tier && data.tier !== 'owner' ? data.tier : (data.requested_tier ?? 'community'),
      published_date: data.published_date ?? now.toISOString(),
    },
  }
}

/** Who hears about a move: admins review submissions, authors hear decisions. */
export const notifyOn = (from: ReviewState, to: ReviewState): 'admins' | 'authors' | null => {
  if (from === to) return null
  if (to === 'submitted') return 'admins'
  if (to === 'approved' || to === 'changes_requested' || to === 'rejected') return 'authors'
  return null
}

const MESSAGES: Partial<Record<ReviewState, { subject: string; text: string }>> = {
  submitted: { subject: 'Submitted for review', text: 'was submitted for review.' },
  approved: { subject: 'Published', text: 'was approved and is now published.' },
  changes_requested: {
    subject: 'Changes requested',
    text: 'needs changes before it can be published.',
  },
  rejected: { subject: 'Not accepted', text: 'was not accepted for publication.' },
}

/** Plain-text notification for a review state. */
export const reviewEmail = (
  state: ReviewState,
  title: string,
  note?: string | null,
): { subject: string; text: string } => {
  const message = MESSAGES[state] ?? { subject: 'Review update', text: `is now ${LABELS[state]}.` }
  return {
    subject: `${message.subject}: ${title}`,
    text: `"${title}" ${message.text}${note ? `\n\nNote from the editor:\n${note}` : ''}`,
  }
}
