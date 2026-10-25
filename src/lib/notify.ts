import type { Payload } from 'payload'

export type NotificationKind =
  | 'submitted'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'removed'
  | 'application'
  | 'mention'
  | 'comment'
  | 'reply'
  | 'announcement'
  | 'moderation'
  | 'report'
  | 'event_changed'

/**
 * The short name of each event. The bells show this (translated by kind on the
 * site) and keep a stored `title` only when the row was written before the
 * registry was, so the row text always reads as short label with context in
 * `description`.
 */
export const EVENT_NAMES: Record<NotificationKind, string> = {
  submitted: 'Review requested',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  rejected: 'Rejected',
  removed: 'Removed',
  application: 'New application',
  mention: 'Mentioned you',
  comment: 'New comment',
  reply: 'New reply',
  announcement: 'New announcement',
  moderation: 'Moderation issue',
  report: 'New report',
  event_changed: 'Event changed',
}

/**
 * The person an event belongs to, as a snapshot: name and photo are read once
 * at event time, so a row keeps its avatar even if the person or their media
 * change or go away later.
 */
export type NotificationActor = { id: number; name?: string; photo?: string }

/** Reads one person once for the avatar snapshot. A failed read leaves the id only. */
export const actorOf = async (
  payload: Payload,
  person: number | null | undefined,
): Promise<NotificationActor | undefined> => {
  if (typeof person !== 'number') return undefined
  try {
    const doc = await payload.findByID({
      collection: 'people',
      id: person,
      depth: 1,
      overrideAccess: true,
      select: { name: true, photo: true },
    })
    const photo = (doc.photo as { url?: string } | null | undefined)?.url
    return { id: person, name: doc.name ?? undefined, photo: photo ?? undefined }
  } catch (error) {
    payload.logger.error({ err: error, msg: `Snapshot of person ${person} for a failed note` })
    return { id: person }
  }
}

/**
 * Leaves a notification for each account, beside the email it gets. A failed
 * write is logged, never thrown: a notification must not undo a save. The
 * event kind carries the short title; `description` carries the context.
 */
export const notify = async (
  payload: Payload,
  recipients: number[],
  note: {
    kind: NotificationKind
    description?: string
    link?: string
    actor?: NotificationActor
  },
): Promise<void> => {
  for (const recipient of new Set(recipients)) {
    await payload
      .create({
        collection: 'notifications',
        data: {
          recipient,
          kind: note.kind,
          title: EVENT_NAMES[note.kind],
          description: note.description,
          link: note.link,
          actor_name: note.actor?.name,
          actor_photo: note.actor?.photo,
        },
        overrideAccess: true,
      })
      .catch((error) =>
        payload.logger.error({ err: error, msg: `Notification for user ${recipient} failed` }),
      )
  }
}
