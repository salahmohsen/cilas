import type { CollectionBeforeChangeHook } from 'payload'

export const CHOICE_DECISIONS = ['pending', 'accepted', 'rejected'] as const
export type ChoiceDecision = (typeof CHOICE_DECISIONS)[number]
export type SubmissionStatus = 'new' | 'accepted' | 'rejected'

type Decided = { decision?: ChoiceDecision | null; decided_at?: string | null }

/**
 * The status of a submission, from the decisions on its courses. It is new
 * while any course waits. Once every course is decided it is accepted if any
 * course was accepted, else rejected, and it is decided when the last course was.
 */
export function deriveStatus(choices: readonly Decided[]): {
  status: SubmissionStatus
  decided_at: string | null
} {
  if (!choices.length || choices.some((c) => (c.decision ?? 'pending') === 'pending')) {
    return { status: 'new', decided_at: null }
  }
  const last = choices.reduce<string | null>(
    (latest, c) =>
      c.decided_at && (!latest || Date.parse(c.decided_at) > Date.parse(latest))
        ? c.decided_at
        : latest,
    null,
  )
  return {
    status: choices.some((c) => c.decision === 'accepted') ? 'accepted' : 'rejected',
    decided_at: last,
  }
}

/**
 * Keeps `status` and `decided_at` true to the course decisions whenever the
 * choices are saved, so an edit made outside the decision endpoints cannot
 * leave them behind.
 */
export const syncStatus: CollectionBeforeChangeHook = ({ data, operation }) => {
  if (operation !== 'update' || !Array.isArray(data.choices) || !data.choices.length) return data
  return { ...data, ...deriveStatus(data.choices) }
}
