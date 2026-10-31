import { removePushSubscriptionAction } from '@/app/(frontend)/[locale]/settings/actions'
import { currentSubscription } from '@/lib/push/client'

/**
 * Called before sign-out: this device's push subscription leaves the account
 * (on the server, then in the browser), so a shared device does not keep
 * showing the last person's alerts. Never throws and never waits long: a
 * failure must not keep anyone signed in.
 */
export const forgetThisDevice = async (): Promise<void> => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const subscription = await Promise.race([
      currentSubscription(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ])
    if (!subscription) return
    await removePushSubscriptionAction(subscription.endpoint).catch(() => null)
    await subscription.unsubscribe().catch(() => null)
  } catch {}
}
