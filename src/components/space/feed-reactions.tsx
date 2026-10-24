'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  Reactions,
  type ReactionCounts,
  type ReactionKind,
} from '@/components/arc/reactions/reactions'
import { reactionToggleAction } from '@/app/(frontend)/[locale]/spaces/actions'

export function FeedReactions({
  post,
  counts,
  mine,
  labels,
  disabled,
}: {
  post: number
  counts: ReactionCounts
  mine: ReactionKind[]
  labels: Record<ReactionKind, string>
  disabled: boolean
}) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <Reactions
      counts={counts}
      mine={mine}
      labels={labels}
      busy={pending}
      onToggle={(kind) => {
        if (disabled || pending) return
        const form = new FormData()
        form.set('post', String(post))
        form.set('reaction', kind)
        form.set('on', String(!mine.includes(kind)))
        start(async () => {
          await reactionToggleAction({ status: 'ok' }, form)
          router.refresh()
        })
      }}
    />
  )
}
