'use client'

import { useOptimistic, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Hand, Heart, Lightbulb, ThumbsUp, type LucideIcon } from 'lucide-react'

import { Reactions, type Reaction } from '@/components/arc/reactions/reactions'
import { reactionToggleAction } from '@/app/(frontend)/[locale]/spaces/actions'
import {
  REACTION_KINDS,
  isReactionKind,
  type ReactionCounts,
  type ReactionKind,
} from '@/lib/space-reactions'

const ICON: Record<ReactionKind, LucideIcon> = {
  agree: ThumbsUp,
  thank_you: Heart,
  insightful: Lightbulb,
  same_question: Hand,
}

type State = { counts: ReactionCounts; mine: ReactionKind[] }

const toggled = (state: State, change: { kind: ReactionKind; on: boolean }): State => ({
  counts: {
    ...state.counts,
    [change.kind]: Math.max(0, (state.counts[change.kind] ?? 0) + (change.on ? 1 : -1)),
  },
  mine: change.on ? [...state.mine, change.kind] : state.mine.filter((k) => k !== change.kind),
})

/**
 * The four reactions on a post (spec §4), drawn by Arc's reaction bar. The tap
 * shows at once; when the action fails, the transition ends and the server's
 * counts come back.
 */
export function FeedReactions({
  post,
  counts,
  mine,
  disabled,
}: {
  post: number
  counts: ReactionCounts
  mine: ReactionKind[]
  disabled: boolean
}) {
  const t = useTranslations('SpaceReactions')
  const [, start] = useTransition()
  const [state, apply] = useOptimistic({ counts, mine }, toggled)
  const router = useRouter()
  const value: Reaction[] = REACTION_KINDS.filter((k) => (state.counts[k] ?? 0) > 0).map((k) => ({
    id: k,
    count: state.counts[k] ?? 0,
    reacted: state.mine.includes(k),
  }))
  const options = REACTION_KINDS.map((k) => ({ id: k, label: t(k), icon: ICON[k] }))
  return (
    <Reactions
      options={options}
      value={value}
      label={t('label')}
      labels={{
        add: t('add'),
        picker: t('picker'),
        toolbar: t('label'),
        pill: (option, count, own) => t('pill', { option, count, own: String(own) }),
        added: (option, count) => t('added', { option, count }),
        removed: (option, count) => t('removed', { option, count }),
      }}
      onValueChange={(_, change) => {
        if (disabled || !isReactionKind(change.id)) return
        const kind = change.id
        const form = new FormData()
        form.set('post', String(post))
        form.set('reaction', kind)
        form.set('on', String(change.reacted))
        start(async () => {
          apply({ kind, on: change.reacted })
          const result = await reactionToggleAction({ status: 'ok' }, form)
          if (result.status === 'ok') router.refresh()
        })
      }}
    />
  )
}
