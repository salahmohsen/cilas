'use client'

import { useState } from 'react'

import styles from './reactions.module.css'

export type ReactionKind = 'agree' | 'thank_you' | 'insightful' | 'same_question'

export const REACTION_KINDS: ReactionKind[] = ['agree', 'thank_you', 'insightful', 'same_question']

export type ReactionCounts = Partial<Record<ReactionKind, number>>
export type ReactionNames = { [K in ReactionKind]?: string[] } | Record<string, never>

export type ReactionsProps = {
  counts: ReactionCounts
  names?: ReactionNames
  mine?: ReactionKind[]
  labels: Record<ReactionKind, string>
  /** Over a row, or long-press, names show (spec §4). */
  onToggle: (kind: ReactionKind) => void
  busy?: boolean
}

/**
 * Arc `reactions`: the four space reactions as chips (Agree = thumbs up,
 * Thank you = heart, Insightful = lightbulb, Same question = hand), counts
 * and names, no points and no "seen by" (spec §4). Hover shows names.
 */
export function Reactions({
  counts,
  names = {},
  mine = [],
  labels,
  onToggle,
  busy = false,
}: ReactionsProps) {
  const [hovering, setHovering] = useState<ReactionKind | null>(null)
  return (
    <div className={styles.wrapper} data-busy={busy}>
      {REACTION_KINDS.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={mine.includes(k)}
          className={styles.chip}
          data-on={mine.includes(k)}
          onMouseEnter={() => setHovering(k)}
          onMouseLeave={() => setHovering(null)}
          onFocus={() => setHovering(k)}
          onBlur={() => setHovering(null)}
          onClick={() => onToggle(k)}
        >
          <span className={styles.icon} aria-hidden="true">
            {ICON[k]}
          </span>
          <span className={styles.count}>{countOf(counts, k)}</span>
          <span className={styles.srOnly}>{labels[k]}</span>
          {hovering === k && (names[k]?.length ?? 0) > 0 && (
            <span role="tooltip" className={styles.names}>
              {names[k]!.join(', ')}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

const countOf = (counts: ReactionCounts, k: ReactionKind) => {
  const n = counts[k]
  return Number(n ?? 0)
}

const ICON: Record<ReactionKind, string> = {
  agree: '👍',
  thank_you: '❤️',
  insightful: '💡',
  same_question: '✋',
}
