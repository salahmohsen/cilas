import { TAB_HEADER, type ClientNotificationEvent } from './events'

/**
 * The browser side of the live notifications (docs/realtime-notifications.md):
 * one EventSource per tab, shared by every bell on the page, opened while at
 * least one listens.
 */
export type StreamListener = {
  event?: (event: ClientNotificationEvent) => void
  /** The stream came back after a gap: refetch, events may have been missed. */
  sync?: () => void
}

const STREAM = '/api/notifications/stream'
const FIRST_RETRY = 3_000

const listeners = new Set<StreamListener>()
let source: EventSource | null = null
let retry: ReturnType<typeof setTimeout> | undefined
let delay = FIRST_RETRY
let connectedBefore = false
let tab: string | undefined
let tagged = false

/** This tab's id, sent on its writes so the event they cause shows it no toast. */
export const tabId = () =>
  (tab ??=
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2))

/**
 * Names this tab on its same-origin writes (REST, server actions), so the
 * server can mark the events they cause. Reads and other origins pass as they are.
 */
const tagWrites = () => {
  if (tagged) return
  tagged = true
  const original = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const request = input instanceof Request ? input : null
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
    const url = new URL(request?.url ?? String(input), window.location.href)
    if (method === 'GET' || method === 'HEAD' || url.origin !== window.location.origin) {
      return original(input, init)
    }
    const headers = new Headers(init?.headers ?? request?.headers)
    headers.set(TAB_HEADER, tabId())
    return original(input, { ...init, headers })
  }
}

const each = (run: (listener: StreamListener) => void) => listeners.forEach(run)

const connect = () => {
  if (source || !listeners.size) return
  const es = new EventSource(STREAM, { withCredentials: true })
  source = es
  es.addEventListener('open', () => {
    delay = FIRST_RETRY
    // The first connection follows the bells' own first load.
    if (connectedBefore) each((l) => l.sync?.())
    connectedBefore = true
  })
  es.addEventListener('resync', () => each((l) => l.sync?.()))
  es.addEventListener('notification', (message) => {
    let event: ClientNotificationEvent
    try {
      event = JSON.parse((message as MessageEvent<string>).data) as ClientNotificationEvent
    } catch {
      return
    }
    each((l) => l.event?.(event))
  })
  es.addEventListener('error', () => {
    // While CONNECTING the browser retries by itself. A 502 during a deploy
    // or a 401 closes the source for good, so try again later.
    if (es.readyState !== EventSource.CLOSED) return
    es.close()
    source = null
    clearTimeout(retry)
    retry = setTimeout(connect, delay)
    delay = Math.min(delay * 2, 60_000)
  })
}

/** Listens to the tab's stream; returns the removal. The last removal closes it. */
export const subscribeNotifications = (listener: StreamListener): (() => void) => {
  listeners.add(listener)
  tagWrites()
  connect()
  return () => {
    listeners.delete(listener)
    if (listeners.size) return
    clearTimeout(retry)
    source?.close()
    source = null
    connectedBefore = false
  }
}
