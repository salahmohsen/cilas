import type { Payload } from 'payload'

export type NotificationKind =
  | 'submitted'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'application'
  | 'mention'
  | 'comment'
  | 'reply'
  | 'announcement'
  | 'moderation'
  | 'report'
  | 'question'

/**
 * Leaves a notification for each account, beside the email it gets. A failed
 * write is logged, never thrown: a notification must not undo a save.
 */
export const notify = async (
  payload: Payload,
  recipients: number[],
  note: { kind: NotificationKind; title: string; link?: string },
): Promise<void> => {
  for (const recipient of new Set(recipients)) {
    await payload
      .create({ collection: 'notifications', data: { recipient, ...note }, overrideAccess: true })
      .catch((error) =>
        payload.logger.error({ err: error, msg: `Notification for user ${recipient} failed` }),
      )
  }
}
