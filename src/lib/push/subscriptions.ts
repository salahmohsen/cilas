import type { Payload } from 'payload'
import { z } from 'zod'

/** What the browser's `PushSubscription.toJSON()` gives, checked on arrival. */
export const subscriptionSchema = z.object({
  endpoint: z
    .url()
    .max(2048)
    .regex(/^https:\/\//),
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
