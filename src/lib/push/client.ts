/**
 * The browser side of Web Push: what this device can do, and the steps of
 * turning it on. Used by the settings page and the sign-out. Nothing here
 * runs on the server.
 */

export const SERVICE_WORKER_URL = '/sw.js'

/** An iPhone or iPad (iPadOS 13 and later reports itself as a Mac with touch). */
export const isIos = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Whether CILAS runs from the Home Screen, which iOS needs before it allows push. */
export const isStandalone = (): boolean =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches

export type DeviceSupport = 'ok' | 'needs-home-screen' | 'unsupported'

export const deviceSupport = (): DeviceSupport => {
  if (isIos() && !isStandalone()) return 'needs-home-screen'
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    ? 'ok'
    : 'unsupported'
}

/** Registers the service worker (a second call returns the same registration). */
export const registerServiceWorker = (): Promise<ServiceWorkerRegistration> =>
  navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' })

/** This device's subscription, if it has one. */
export const currentSubscription = async (): Promise<PushSubscription | null> => {
  const registration = await navigator.serviceWorker.getRegistration('/')
  return (await registration?.pushManager.getSubscription()) ?? null
}

/** The VAPID key as the bytes `subscribe` wants. */
export const keyBytes = (base64Url: string): Uint8Array<ArrayBuffer> => {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), '=')
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/**
 * Subscribes this device. Call it from a tap: `requestPermission` must follow
 * a user action, and iOS refuses it otherwise.
 */
export const subscribeThisDevice = async (
  publicKey: string,
): Promise<
  { ok: true; subscription: PushSubscriptionJSON } | { ok: false; reason: 'denied' | 'failed' }
> => {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }
  try {
    await registerServiceWorker()
    const registration = await navigator.serviceWorker.ready
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      }))
    return { ok: true, subscription: subscription.toJSON() }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}
