'use server'

import { localeOf } from '@/i18n/routing'
import config from '@payload-config'
import { getPayload } from 'payload'

import {
  mergePreferences,
  preferenceChangesSchema,
  readPreferences,
} from '@/lib/notification-preferences'
import { pushConfig } from '@/lib/push/config'
import { removeSubscription, saveSubscription, subscriptionSchema } from '@/lib/push/subscriptions'
import { currentReader } from '@/lib/reader'
import { headers } from 'next/headers'

export type SettingsResult = { ok: true } | { ok: false; error: 'auth' | 'invalid' | 'failed' }

/**
 * Saves the switches the member changed. The page sends only those, and they
 * are merged into what is stored (src/lib/notification-preferences.ts), so
 * two tabs changing different kinds do not undo each other.
 */
export async function savePreferencesAction(changes: unknown): Promise<SettingsResult> {
  const user = await currentReader()
  if (!user) return { ok: false, error: 'auth' }
  const parsed = preferenceChangesSchema.safeParse(changes)
  if (!parsed.success) return { ok: false, error: 'invalid' }
  try {
    const payload = await getPayload({ config })
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        notification_preferences: mergePreferences(
          readPreferences(user.notification_preferences),
          parsed.data,
        ),
      },
      overrideAccess: true,
    })
    return { ok: true }
  } catch {
    return { ok: false, error: 'failed' }
  }
}

/** Stores this device for the signed-in account. Off when no VAPID keys are set. */
export async function savePushSubscriptionAction(
  subscription: unknown,
  locale: string,
): Promise<SettingsResult> {
  const user = await currentReader()
  if (!user) return { ok: false, error: 'auth' }
  if (!pushConfig()) return { ok: false, error: 'failed' }
  const parsed = subscriptionSchema.safeParse(subscription)
  if (!parsed.success) return { ok: false, error: 'invalid' }
  try {
    await saveSubscription(await getPayload({ config }), user.id, parsed.data, {
      userAgent: (await headers()).get('user-agent'),
      locale: localeOf(locale),
    })
    return { ok: true }
  } catch {
    return { ok: false, error: 'failed' }
  }
}

/** Forgets this device. Safe to call for a device that was never stored. */
export async function removePushSubscriptionAction(endpoint: string): Promise<SettingsResult> {
  const user = await currentReader()
  if (!user) return { ok: false, error: 'auth' }
  if (typeof endpoint !== 'string' || !endpoint) return { ok: false, error: 'invalid' }
  try {
    await removeSubscription(await getPayload({ config }), user.id, endpoint)
    return { ok: true }
  } catch {
    return { ok: false, error: 'failed' }
  }
}
