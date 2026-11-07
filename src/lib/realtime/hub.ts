import pg from 'pg'

import { env } from '@/env'

import { backoff } from './backoff'
import {
  NOTIFICATION_CHANNEL,
  type ClientNotificationEvent,
  type NotificationEvent,
} from './events'

/** One open stream: a tab of a signed-in account. */
export type Sink = {
  event: (event: ClientNotificationEvent) => void
  /** Events may have been missed (the listener reconnected): refetch. */
  resync: () => void
}

type Hub = {
  sinks: Map<number, Set<Sink>>
  client: pg.Client | null
  connecting: Promise<void> | null
  retry: ReturnType<typeof setTimeout> | null
  delay: number
}

// One hub per process; the global keeps it across dev reloads of this module.
const scope = globalThis as typeof globalThis & { __cilasNotificationHub?: Hub }
const hub: Hub = (scope.__cilasNotificationHub ??= {
  sinks: new Map(),
  client: null,
  connecting: null,
  retry: null,
  delay: 1_000,
})

const log = (msg: string, err?: unknown) =>
  err ? console.error(`[notifications] ${msg}`, err) : console.info(`[notifications] ${msg}`)

const deliver = (raw: string | undefined) => {
  if (!raw) return
  let event: NotificationEvent
  try {
    event = JSON.parse(raw) as NotificationEvent
  } catch {
    return
  }
  const sinks = hub.sinks.get(event.recipient)
  if (!sinks) return
  const { recipient: _, ...forClient } = event
  for (const sink of sinks) sink.event(forClient)
}

const resyncAll = () => {
  for (const sinks of hub.sinks.values()) for (const sink of sinks) sink.resync()
}

const scheduleReconnect = () => {
  if (hub.retry) return
  const wait = hub.delay
  hub.delay = backoff(hub.delay, 30_000)
  hub.retry = setTimeout(() => {
    hub.retry = null
    void connect()
  }, wait)
}

/**
 * The instance's one LISTEN connection, outside Payload's pool so a held
 * connection never starves queries. After a drop it reconnects with backoff
 * and tells every open tab to refetch what it may have missed.
 */
const connect = (): Promise<void> => {
  if (hub.client || hub.connecting) return hub.connecting ?? Promise.resolve()
  const client = new pg.Client({
    connectionString: env.DATABASE_LISTEN_URL ?? env.DATABASE_URL,
    keepAlive: true,
    application_name: 'cilas-notifications',
  })
  const drop = (err?: unknown) => {
    if (hub.client !== client) return
    log('listener lost, reconnecting', err)
    hub.client = null
    client.end().catch(() => {})
    scheduleReconnect()
  }
  // Attached before connecting: pg emits `error` on a dead socket, and with no
  // listener that throws and stops the process. While connecting, `drop` does
  // nothing: the failed connect or LISTEN query below schedules the retry.
  client.on('notification', (msg) => deliver(msg.payload))
  client.on('error', drop)
  client.on('end', () => drop())
  hub.connecting = client
    .connect()
    .then(() => client.query(`LISTEN ${NOTIFICATION_CHANNEL}`))
    .then(() => {
      const recovered = hub.delay > 1_000
      hub.client = client
      hub.delay = 1_000
      log('listening')
      if (recovered) resyncAll()
    })
    .catch((err) => {
      client.end().catch(() => {})
      log('listener failed to connect', err)
      scheduleReconnect()
    })
    .finally(() => {
      hub.connecting = null
    })
  return hub.connecting
}

/** Adds a tab's stream for an account; returns its removal. */
export const subscribe = (recipient: number, sink: Sink): (() => void) => {
  let set = hub.sinks.get(recipient)
  if (!set) hub.sinks.set(recipient, (set = new Set()))
  set.add(sink)
  void connect()
  return () => {
    set.delete(sink)
    if (!set.size) hub.sinks.delete(recipient)
  }
}
