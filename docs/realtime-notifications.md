# Realtime notifications

A new notification reaches the recipient's open tabs within a second and shows a
toast. Read and dismiss changes sync across tabs too. No Redis and no paid
service: Postgres carries the events and each app instance streams them to its
own browsers with Server-Sent Events (SSE).

## Flow

```
notify() / REST PATCH / DELETE on `notifications`
  └─ afterChange / afterDelete hook (src/lib/realtime/publish.ts)
       └─ select pg_notify('cilas_notifications', <event JSON>)   -- in the save's transaction
            └─ every app instance: one pg connection, LISTEN cilas_notifications
                 (src/lib/realtime/hub.ts)
                 └─ in-memory fan-out by recipient id
                      └─ GET /api/notifications/stream  (SSE, src/app/(frontend)/api/notifications/stream/route.ts)
                           └─ one EventSource per tab (src/lib/realtime/stream-client.ts)
                                ├─ site bell + Arc toast stack (src/components/site-notifications.tsx)
                                └─ admin bell + Payload toast (src/components/admin/notification-bell.tsx)
```

## The event

```ts
type NotificationEvent = {
  op: 'created' | 'updated' | 'deleted'
  id: number // notifications row id
  recipient: number // users id; the stream strips it before sending
  origin?: string // tab id that caused the change (header x-cilas-tab)
  doc?: StoredNotification // the row at depth 0; absent on delete or if > ~7.8 KB
}
```

Defined in `src/lib/realtime/events.ts`. On the wire it is `event: notification`
with the JSON as `data`. A second event, `resync`, tells tabs to refetch because
the instance lost its database listener for a while.

## Why SSE and LISTEN/NOTIFY

- **SSE over WebSockets:** traffic is one way (server to browser). SSE is plain
  HTTP, passes Traefik and Cloudflare without upgrade handling, sends the
  Payload cookie automatically, and the browser reconnects by itself. Writes
  stay on the existing REST and server-action paths.
- **SSE over polling:** the old bells polled every 60 seconds per tab. Now a
  change arrives at once and an idle tab costs one open socket plus a 25-second
  heartbeat.
- **LISTEN/NOTIFY over Redis:** Postgres is already there. Every instance hears
  every event, so it works with more than one container. `pg_notify` runs in the
  save's transaction: it is delivered on commit and dropped on rollback.

Each instance holds **one** extra Postgres connection (application name
`cilas-notifications`) outside Payload's pool, not one per tab.

## Reliability

- **Heartbeat:** a `: ping` comment every 25 seconds keeps proxies from closing
  the idle stream (Cloudflare closes after 100 seconds of silence).
- **Reconnect:** the stream sends `retry: 3000`. The browser reconnects by itself
  after a network drop. A non-200 reply (a 502 from Traefik during a deploy, a 401) closes an EventSource for good, so the client reopens it with backoff
  from 3 to 60 seconds.
- **Missed events:** there is no event log, so no `Last-Event-ID`. Instead each
  reconnect after the first refetches the list (`sync`), and so does a tab that
  becomes visible again. When the server's listener reconnects, it sends
  `resync` to every open stream.
- **Session expiry:** the server ends each stream after 15 minutes. The browser
  reconnects, which checks the session again; a signed-out tab gets a 401.
- **No toast for the causing tab:** each tab tags its same-origin writes with
  `x-cilas-tab`. The hook reads it from the REST request or, for Local API calls
  inside a request, through `next/headers`. The tab still updates its list, but
  shows no toast for its own action.

There is no per-user toast setting yet. The only stored preference is the email
digest (`space-preferences`). Toasts pause while the tab is hidden and respect
reduced motion (Arc toast stack).

## Deployment notes (Dokploy, Traefik, Cloudflare)

No Traefik label is needed with the defaults:

- Go's reverse proxy flushes `text/event-stream` responses after each write, so
  Traefik does not buffer the stream.
- Entrypoint `respondingTimeouts`: `readTimeout` 60s applies to reading the
  request only, `writeTimeout` is 0 (no limit), `idleTimeout` 180s applies to
  idle keep-alive connections, not to an open stream. Do not set a non-zero
  `writeTimeout` on the web entrypoint: it would cut every stream.
- Dokploy adds no compress middleware. If one is added, set
  `excludedContentTypes=text/event-stream`, for example
  `traefik.http.middlewares.<name>.compress.excludedcontenttypes=text/event-stream`.
- Next's own gzip skips the stream because of `Cache-Control: no-transform`.
  `X-Accel-Buffering: no` covers nginx-style proxies.
- Cloudflare (Tunnel and proxy) streams `text/event-stream` and the heartbeat
  stays under its 100-second idle limit.

Database:

- LISTEN needs a session connection. If `DATABASE_URL` goes through a
  transaction pooler (PgBouncer in transaction mode, Neon's pooled host), set
  `DATABASE_LISTEN_URL` to a direct connection.
- Count one more connection per app instance against `max_connections`.
- Previews share the production database, so preview instances also hear
  production events. They deliver them only to tabs signed in as the recipient
  on that preview.

## Checking it

```sh
# 401 without a session
curl -i http://localhost:3000/api/notifications/stream
# with a session cookie: "retry: 3000", ": connected", then events and pings
curl -N -b cookies.txt http://localhost:3000/api/notifications/stream
# fire a raw event to every instance (a test payload)
psql "$DATABASE_URL" -c "select pg_notify('cilas_notifications', '{\"op\":\"deleted\",\"id\":0,\"recipient\":1}')"
```
