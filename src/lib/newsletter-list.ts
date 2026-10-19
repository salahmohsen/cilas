import type { Payload, PayloadRequest } from 'payload'

import { env } from '@/env'

/** A mailing list as Resend sees it: the key (a secret, so env only), its segment and topic. */
export type ListTarget = {
  id: number
  name: string
  source: 'signup' | 'members'
  apiKey: string
  segmentId: string
  topicId: string | null
}

type ListDoc = {
  id: number
  name: string
  source: 'signup' | 'members'
  segment_id?: string | null
  topic_id?: string | null
}

const targetOf = (list: ListDoc): ListTarget | null =>
  env.RESEND_API_KEY && list.segment_id
    ? {
        id: list.id,
        name: list.name,
        source: list.source,
        apiKey: env.RESEND_API_KEY,
        segmentId: list.segment_id,
        topicId: list.topic_id?.trim() || null,
      }
    : null

/**
 * The list the site's signup forms add to: the Mailing list whose source is
 * the signup form (Admin → Mailing lists). Null when there is none, or no
 * RESEND_API_KEY on the server: then signup is off.
 */
export const newsletterList = async (
  payload: Payload,
  req?: PayloadRequest,
): Promise<ListTarget | null> => {
  const { docs } = await payload
    .find({
      collection: 'mailing-lists',
      where: { source: { equals: 'signup' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    .catch(() => ({ docs: [] }))
  const list = docs[0] as ListDoc | undefined
  return list ? targetOf(list) : null
}

/** A Mailing list by id, ready to send to; null when it is missing or has no segment. */
export const mailingList = async (
  payload: Payload,
  id: number,
  req?: PayloadRequest,
): Promise<ListTarget | null> => {
  const list = (await payload
    .findByID({ collection: 'mailing-lists', id, depth: 0, overrideAccess: true, req })
    .catch(() => null)) as ListDoc | null
  return list ? targetOf(list) : null
}

export const LIST_OFF =
  'The newsletter list is off: add a Mailing list whose source is the signup form, and set RESEND_API_KEY on the server.'
