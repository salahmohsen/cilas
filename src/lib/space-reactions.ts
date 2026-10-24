/** The four space reactions (spec §4), in the order the picker offers them. */
export const REACTION_KINDS = ['agree', 'thank_you', 'insightful', 'same_question'] as const

export type ReactionKind = (typeof REACTION_KINDS)[number]

export type ReactionCounts = Partial<Record<ReactionKind, number>>

export const isReactionKind = (value: string): value is ReactionKind =>
  (REACTION_KINDS as readonly string[]).includes(value)
