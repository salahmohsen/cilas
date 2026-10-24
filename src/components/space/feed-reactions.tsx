'use client'

import { useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  Reactions,
  type ReactionCounts,
  type ReactionKind,
} from '@/components/arc/reactions/reactions'
import { reactionToggleAction } from '@/app/(frontend)/[locale]/spaces/actions'

type State = { counts: ReactionCounts; mine: ReactionKind[] }

const toggled = (state: State, kind: ReactionKind): State => {
  const on = !state.mine.includes(kind)
  return {
    counts: { ...state.counts, [kind]: Math.max(0, (state.counts[kind] ?? 0) + (on ? 1 : -1)) },
    mine: on ? [...state.mine, kind] : state.mine.filter((k) => k !== kind),
  }
}

/**
 * The four reactions on a post or a comment. The tap shows at once; when the
 * action fails, the transition ends and the server's counts come back.
 */
export function FeedReactions({
  target,
  counts,
  mine,
  labels,
  disabled,
}: {
  target: { post: number } | { comment: number }
  counts: ReactionCounts
  mine: ReactionKind[]
  labels: Record<ReactionKind, string>
  disabled: boolean
}) {
  const [, start] = useTransition()
  const [state, apply] = useOptimistic({ counts, mine }, toggled)
  const router = useRouter()
  return (
    <Reactions
      counts={state.counts}
      mine={state.mine}
      labels={labels}
      onToggle={(kind) => {
        if (disabled) return
        const form = new FormData()
        if ('post' in target) form.set('post', String(target.post))
        else form.set('comment', String(target.comment))
        form.set('reaction', kind)
        form.set('on', String(!state.mine.includes(kind)))
        start(async () => {
          apply(kind)
          const result = await reactionToggleAction({ status: 'ok' }, form)
          if (result.status === 'ok') router.refresh()
        })
      }}
    />
  )
}
