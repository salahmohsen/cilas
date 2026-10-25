/** The six space reactions, in the order the picker offers them. `agree` reads "Like". */
export const REACTION_KINDS = [
  'agree',
  'thank_you',
  'celebrate',
  'insightful',
  'same_question',
  'rocket',
] as const

export type ReactionKind = (typeof REACTION_KINDS)[number]

export type ReactionCounts = Partial<Record<ReactionKind, number>>

export const isReactionKind = (value: string): value is ReactionKind =>
  (REACTION_KINDS as readonly string[]).includes(value)
