import { subscribe } from '@/lib/realtime/hub'
import { currentReader } from '@/lib/reader'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A comment line this often keeps Traefik, Cloudflare and other proxies from
// closing an idle stream (Cloudflare closes after 100 seconds of silence).
const HEARTBEAT_MS = 25_000
// The stream ends after this long and the browser reconnects, so a signed-out
// or expired session stops getting events.
const MAX_AGE_MS = 15 * 60_000

/**
 * The signed-in account's live notifications as Server-Sent Events
 * (docs/realtime-notifications.md). Static, so it wins over Payload's
 * /api/[...slug]. Each event is one `notifications` row change; `resync`
 * asks the tab to refetch after this instance lost its database listener.
 */
export async function GET(request: Request) {
  const user = await currentReader()
  if (!user) return new Response('Sign in first.', { status: 401 })

  const encoder = new TextEncoder()
  let close = () => {}
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true
      const send = (text: string) => {
        if (!open) return
        try {
          controller.enqueue(encoder.encode(text))
        } catch {
          close()
        }
      }
      const unsubscribe = subscribe(user.id, {
        event: (event) => send(`event: notification\ndata: ${JSON.stringify(event)}\n\n`),
        resync: () => send('event: resync\ndata: {}\n\n'),
      })
      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS)
      const expire = setTimeout(() => close(), MAX_AGE_MS)
      close = () => {
        if (!open) return
        open = false
        clearInterval(heartbeat)
        clearTimeout(expire)
        unsubscribe()
        try {
          controller.close()
        } catch {}
      }
      request.signal.addEventListener('abort', () => close(), { once: true })
      // The browser waits this long before it reconnects.
      send('retry: 3000\n: connected\n\n')
    },
    cancel() {
      close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // no-transform: Next's gzip (and other proxies) skip the stream.
      'Cache-Control': 'no-cache, no-store, no-transform',
      // nginx-style proxies: do not buffer.
      'X-Accel-Buffering': 'no',
    },
  })
}
