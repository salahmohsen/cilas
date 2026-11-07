import { ADMIN_ROLES } from '@/access'
import type { PayloadRequest } from 'payload'

import { getEmailSettings } from '@/emails/settings'
import { reviewMail } from '@/emails/transactional'
import { env } from '@/env'
import { readPreferences, wantsChannel } from '@/lib/notification-preferences'
import type { ReviewState } from '@/lib/review'

export type Recipient = { id: number; email: string }

const recipientsOf = (docs: Array<{ id: number; email?: string | null }>): Recipient[] =>
  docs.flatMap((d) => (d.email ? [{ id: d.id, email: d.email }] : []))

export const adminRecipients = async (req: PayloadRequest): Promise<Recipient[]> => {
  const { docs } = await req.payload.find({
    collection: 'users',
    where: { roles: { in: ADMIN_ROLES } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
  })
  return recipientsOf(docs)
}

export const ownerRecipients = async (
  req: PayloadRequest,
  people: number[],
): Promise<Recipient[]> => {
  if (!people.length) return []
  const { docs } = await req.payload.find({
    collection: 'users',
    where: { person: { in: people } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
  })
  return recipientsOf(docs)
}

/**
 * The recipients who have not turned this kind's email off (Settings →
 * Notifications). A failed read keeps everyone: the default is to send.
 */
export const emailRecipients = async (
  req: PayloadRequest,
  people: Recipient[],
  kind: string,
): Promise<Recipient[]> => {
  if (!people.length) return people
  try {
    const { docs } = await req.payload.find({
      collection: 'users',
      where: { id: { in: people.map((p) => p.id) } },
      depth: 0,
      limit: people.length,
      pagination: false,
      overrideAccess: true,
      select: { notification_preferences: true },
      req,
    })
    const refused = new Set(
      docs
        .filter((u) => !wantsChannel(readPreferences(u.notification_preferences), 'email', kind))
        .map((u) => u.id),
    )
    return people.filter((p) => !refused.has(p.id))
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Email preferences not read; sending to all' })
    return people
  }
}

export const sendReviewEmail = async (
  req: PayloadRequest,
  to: string[],
  state: ReviewState,
  title: string,
  note?: string | null,
  about: { noun?: string; path?: string } = {},
): Promise<void> => {
  if (!to.length) return
  try {
    const url = about.path
      ? `${env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')}${about.path}`
      : undefined
    const mail = await reviewMail(await getEmailSettings(req.payload, req), state, title, note, {
      noun: about.noun,
      url,
    })
    await req.payload.sendEmail({ to, ...mail })
  } catch (error) {
    req.payload.logger.error({ err: error, msg: `Review email for "${title}" failed` })
  }
}
