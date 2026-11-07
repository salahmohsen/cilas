/** The six space reactions, in the order the picker offers them, with the label the admin shows. `agree` reads "Like". */
export const REACTION_LABELS = {
  agree: 'Like',
  thank_you: 'Thank you',
  celebrate: 'Celebrate',
  insightful: 'Insightful',
  same_question: 'Same question',
  rocket: 'Boost',
} as const

export type ReactionKind = keyof typeof REACTION_LABELS

export const REACTION_KINDS = Object.keys(REACTION_LABELS) as ReactionKind[]

export type ReactionCounts = Partial<Record<ReactionKind, number>>

export const isReactionKind = (value: string): value is ReactionKind =>
  (REACTION_KINDS as readonly string[]).includes(value)
