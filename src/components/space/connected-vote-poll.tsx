'use client'

import { voteSetAction } from '@/lib/space-actions'

import { VotePoll, type VotePollProps } from './vote-poll'

/** The vote poll, saving through the post vote's server action. */
export function ConnectedVotePoll(props: Omit<VotePollProps, 'save'>) {
  return <VotePoll {...props} save={(form) => voteSetAction({ status: 'ok' }, form)} />
}
