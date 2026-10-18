import type { Payload, PayloadRequest } from 'payload'

import { env } from '@/env'

/**
 * Where the newsletter list is: the Resend API key (a secret, so env only)
 * and the segment, from Email settings → Newsletter, or else the
 * RESEND_AUDIENCE_ID env variable. Null when either is missing.
 */
export const newsletterList = async (
  payload: Payload,
  req?: PayloadRequest,
): Promise<{ apiKey: string; segmentId: string } | null> => {
  const settings = (await payload
    .findGlobal({ slug: 'email-settings', depth: 0, overrideAccess: true, req })
    .catch(() => null)) as { segment_id?: string | null } | null
  const segmentId = settings?.segment_id?.trim() || env.RESEND_AUDIENCE_ID
  return env.RESEND_API_KEY && segmentId ? { apiKey: env.RESEND_API_KEY, segmentId } : null
}

export const LIST_OFF =
  'The newsletter list is off: set the Resend segment in Email settings → Newsletter, and RESEND_API_KEY on the server.'
