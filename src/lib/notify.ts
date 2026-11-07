import type { Payload } from 'payload'

import type { ReactionKind } from '@/lib/space-reactions'
import { NOTIFICATION_KINDS, type NotificationKind } from '@/lib/notification-kinds'

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

/** What each reaction reads as in a sentence: "liked", "thanked you for", and so on. */
const REACTION_VERB: Record<ReactionKind, string> = {
  agree: 'liked',
  thank_you: 'thanked you for',
  celebrate: 'celebrated',
  insightful: 'found insightful',
  same_question: 'has the same question as',
  rocket: 'boosted',
}

/** The detail line of a reaction note: "Sam liked your post in Spring seminar". */
export const reactionNote = (i: {
  actor?: string
  reaction: string
  target: 'post' | 'comment'
  context: string
}): string =>
  `${i.actor ?? 'Someone'} ${REACTION_VERB[i.reaction as ReactionKind] ?? 'reacted to'} your ${i.target} in ${i.context}`

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
          title: NOTIFICATION_KINDS[note.kind].name,
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
