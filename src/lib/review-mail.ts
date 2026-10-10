import type { PayloadRequest } from 'payload'

import { reviewEmail, type ReviewState } from '@/lib/review'

const emailsOf = (docs: Array<{ email?: string | null }>): string[] =>
  docs.map((d) => d.email).filter((e): e is string => Boolean(e))

/** Accounts that review submissions. */
export const adminEmails = async (req: PayloadRequest): Promise<string[]> => {
  const { docs } = await req.payload.find({
    collection: 'users',
    where: { roles: { in: ['admin', 'super_admin'] } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
  })
  return emailsOf(docs)
}

/** Accounts linked to an article's authors; authors without one get no mail. */
export const authorEmails = async (req: PayloadRequest, people: number[]): Promise<string[]> => {
  if (!people.length) return []
  const { docs } = await req.payload.find({
    collection: 'users',
    where: { person: { in: people } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
  })
  return emailsOf(docs)
}

/** Sends one review notification. A failed send is logged, never thrown. */
export const sendReviewEmail = async (
  req: PayloadRequest,
  to: string[],
  state: ReviewState,
  title: string,
  note?: string | null,
): Promise<void> => {
  if (!to.length) return
  try {
    await req.payload.sendEmail({ to, ...reviewEmail(state, title, note) })
  } catch (error) {
    req.payload.logger.error({ err: error, msg: `Review email for "${title}" failed` })
  }
}
