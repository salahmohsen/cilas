import { env } from '@/env'

export type PushConfig = { publicKey: string; privateKey: string; subject: string }

/**
 * The VAPID identity of this site, or null when push is off. Both keys are
 * needed; the app builds and runs without them and the settings page hides
 * the device switch.
 */
export const pushConfig = (
  source: {
    VAPID_PUBLIC_KEY?: string
    VAPID_PRIVATE_KEY?: string
    VAPID_SUBJECT?: string
    EMAIL_FROM_ADDRESS: string
  } = env,
): PushConfig | null =>
  source.VAPID_PUBLIC_KEY && source.VAPID_PRIVATE_KEY
    ? {
        publicKey: source.VAPID_PUBLIC_KEY,
        privateKey: source.VAPID_PRIVATE_KEY,
        subject: source.VAPID_SUBJECT ?? `mailto:${source.EMAIL_FROM_ADDRESS}`,
      }
    : null
