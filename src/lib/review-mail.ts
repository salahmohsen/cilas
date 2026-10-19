import type { PayloadRequest } from 'payload'

import { getEmailSettings } from '@/emails/settings'
import { reviewMail } from '@/emails/transactional'
import { env } from '@/env'
import type { ReviewState } from '@/lib/review'

export type Recipient = { id: number; email: string }

const recipientsOf = (docs: Array<{ id: number; email?: string | null }>): Recipient[] =>
  docs.flatMap((d) => (d.email ? [{ id: d.id, email: d.email }] : []))

/** Accounts that review submissions: admins and super admins. */
export const adminRecipients = async (req: PayloadRequest): Promise<Recipient[]> => {
  const { docs } = await req.payload.find({
    collection: 'users',
    where: { roles: { in: ['admin', 'super_admin'] } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
  })
  return recipientsOf(docs)
}

/** Accounts linked to a document's owners (authors, fellows, editors); people without one get nothing. */
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

/** Sends one review notification. A failed send is logged, never thrown. */
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
