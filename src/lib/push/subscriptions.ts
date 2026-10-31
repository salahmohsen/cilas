import type { Payload } from 'payload'
import { z } from 'zod'

/**
 * The push services browsers use: Chrome, Edge, Opera, Brave and Samsung (FCM),
 * Firefox (Mozilla autopush), Safari (Apple) and old Edge (WNS). The server
 * POSTs to the stored endpoint, so an address of any other host would let a
 * member make the server call it.
 */
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
] as const

/** Whether the address is an https address on a known push service. */
export const isPushServiceEndpoint = (endpoint: string): boolean => {
  try {
    const url = new URL(endpoint)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      PUSH_SERVICE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))
    )
  } catch {
    return false
  }
}

/** What the browser's `PushSubscription.toJSON()` gives, checked on arrival. */
export const subscriptionSchema = z.object({
  endpoint: z.url().max(2048).refine(isPushServiceEndpoint, 'Not a push service address'),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
})
export type SubscriptionInput = z.infer<typeof subscriptionSchema>

/**
 * Stores a device for an account. The endpoint is unique, so a device that
 * signs in as someone else moves to them instead of staying with the last
 * account.
 */
export const saveSubscription = async (
  payload: Payload,
  userId: number,
  input: SubscriptionInput,
  extra: { userAgent?: string | null; locale?: 'en' | 'ar' },
): Promise<void> => {
  const data = {
    user: userId,
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    user_agent: extra.userAgent?.slice(0, 300) ?? null,
    locale: extra.locale ?? 'en',
  }
  const { docs } = await payload.find({
    collection: 'push-subscriptions',
    where: { endpoint: { equals: input.endpoint } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  if (docs[0]) {
    await payload.update({
      collection: 'push-subscriptions',
      id: docs[0].id,
      data,
      overrideAccess: true,
    })
  } else {
    await payload.create({ collection: 'push-subscriptions', data, overrideAccess: true })
  }
}

/** Forgets one device of the account. Another account's device is left alone. */
export const removeSubscription = async (
  payload: Payload,
  userId: number,
  endpoint: string,
): Promise<void> => {
  await payload.delete({
    collection: 'push-subscriptions',
    where: { and: [{ endpoint: { equals: endpoint } }, { user: { equals: userId } }] },
    overrideAccess: true,
  })
}
