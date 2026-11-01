/*
 * CILAS service worker. It does one job: show a notification when the server
 * pushes one, and open the right page when the member taps it. It has no
 * fetch handler and caches nothing, so pages and API calls always come from
 * the network. Registered only after sign-in (src/components/push/push-registrar.tsx).
 * The push body is JSON: { title, body, url, tag, icon } (src/lib/push/send.ts).
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // A body that is not JSON still deserves a notification: browsers (and
    // iOS in particular) drop a subscription that receives pushes it never shows.
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'CILAS'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      icon: typeof data.icon === 'string' ? data.icon : '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-192.png',
      // The same tag replaces an earlier notification instead of stacking.
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      data: { url: typeof data.url === 'string' ? data.url : '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Only a page of this site: a pushed address from elsewhere falls back to home.
  let target = new URL('/', self.location.origin)
  try {
    const url = new URL(event.notification.data?.url || '/', self.location.origin)
    if (url.origin === self.location.origin) target = url
  } catch {}
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((client) => new URL(client.url).origin === target.origin)
      if (open) {
        // Navigate first: focus() alone leaves the member on whatever page they had.
        const moved = 'navigate' in open ? await open.navigate(target.href).catch(() => null) : null
        await (moved ?? open).focus()
        return
      }
      await self.clients.openWindow(target.href)
    })(),
  )
})
