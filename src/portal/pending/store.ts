import type { Clock } from './clock'
import {
  remaining,
  sends,
  startItem,
  transition,
  type PauseCause,
  type PendingEvent,
  type PendingInput,
  type PendingItem,
} from './machine'

export const FINISHED_MS = 8000
/** A commit with no answer after this long fails, so a stalled network cannot hold sign-out. */
export const COMMIT_TIMEOUT_MS = 15_000
const KEEPALIVE_LIMIT = 64 * 1024

/** What a view reads of an item. `remainingMs` is the time left when it is read, not when the item last changed. */
export type PendingView = Readonly<Pick<PendingItem, 'state' | 'remainingMs' | 'status' | 'result'>>
type ManualCause = Exclude<PauseCause, 'overlay'>
export type PendingApi = {
  /** True when the item was queued. False when it was refused: sealed, or the key is already in the queue. */
  decide(input: PendingInput): boolean
  undo(key: string): void
  undoAll(): (() => void) | undefined
  retry(key: string): void
  dismiss(key: string): void
  pause(key: string, cause: ManualCause): void
  resume(key: string, cause: ManualCause): void
  overlay(open: boolean): void
  flush(): Promise<{ ok: boolean }>
  /** Refuses `decide` until the returned function runs. Sign-out holds it from its flush until it stops, or for good once it succeeds. */
  seal(): () => void
  readonly items: { key: string; label: string; view: PendingView }[]
  getView(key: string): PendingView | null
}

type QueuedItem = PendingItem & { encodedBody: string }

function sameOriginPath(url: string) {
  const origin = globalThis.location?.origin ?? 'https://pending.invalid'
  const target = new URL(url, origin)
  if (
    target.origin !== origin ||
    target.username ||
    target.password ||
    target.pathname.startsWith('//')
  ) {
    throw new Error('Pending decisions require a same-origin URL')
  }
  return target.pathname + target.search
}

export function createPendingStore({
  clock,
  fetcher,
  undoMs,
  refresh,
}: {
  clock: Clock
  fetcher: typeof fetch
  undoMs: number
  refresh: () => void
}) {
  let items = new Map<string, QueuedItem>()
  let overlays = 0
  let seals = 0
  const timers = new Map<string, number>()
  const inflight = new Map<string, Promise<boolean>>()
  const listeners = new Set<() => void>()
  // One view per item object keeps the snapshot of `useSyncExternalStore` stable between changes.
  const views = new WeakMap<PendingItem, PendingView>()
  const notify = () => listeners.forEach((listener) => listener())

  function clearTimer(key: string) {
    const id = timers.get(key)
    if (id === undefined) return
    clock.clearTimeout(id)
    timers.delete(key)
  }

  function armTimer(item: PendingItem, now: number) {
    const { key, state } = item
    clearTimer(key)
    if (state === 'pending') {
      timers.set(
        key,
        clock.setTimeout(() => dispatch(key, { type: 'expire' }), remaining(item, now)),
      )
    } else if (state === 'sent' || state === 'undone') {
      timers.set(
        key,
        clock.setTimeout(() => dispatch(key, { type: 'dismiss' }), FINISHED_MS),
      )
    }
  }

  async function send(item: QueuedItem): Promise<PendingEvent> {
    const controller = new AbortController()
    const timer = clock.setTimeout(() => controller.abort(), COMMIT_TIMEOUT_MS)
    // A fetcher may ignore the signal, so the race is what bounds the wait.
    const timedOut = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('Commit timed out')), {
        once: true,
      })
    })
    async function request(): Promise<PendingEvent> {
      const response = await fetcher(item.request.url, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: item.encodedBody,
        signal: controller.signal,
      })
      const { status } = response
      if (response.ok)
        return { type: 'ok', status, result: await response.json().catch(() => null) }
      if (status === 400 || status === 409) {
        return { type: 'refused', status, result: await response.json().catch(() => null) }
      }
      return { type: 'error', status }
    }
    try {
      return await Promise.race([request(), timedOut])
    } catch {
      return { type: 'error' }
    } finally {
      clock.clearTimeout(timer)
    }
  }

  function commit(item: QueuedItem) {
    const { key } = item
    const outcome = send(item).then((event) => {
      if (items.get(key) === item) {
        inflight.delete(key)
        dispatch(key, event)
        if (event.type === 'refused') refresh()
      }
      return event.type !== 'error'
    })
    inflight.set(key, outcome)
  }

  function dispatch(key: string, event: PendingEvent): boolean {
    const before = items.get(key)
    if (!before) return false
    const now = clock.now()
    const after = transition(before, event, now)
    if (after === 'illegal') return false
    if (after === before) return true
    items = new Map(items)
    if (after === 'gone') {
      items.delete(key)
      clearTimer(key)
    } else {
      const item = { ...after, encodedBody: before.encodedBody }
      items.set(key, item)
      armTimer(item, now)
      if (sends(before, item)) commit(item)
    }
    notify()
    return true
  }

  function reset() {
    for (const key of timers.keys()) clearTimer(key)
    inflight.clear()
    if (items.size === 0) return
    items = new Map()
    notify()
  }

  function viewOf(item: PendingItem): PendingView {
    let view = views.get(item)
    if (!view) {
      view = {
        state: item.state,
        status: item.status,
        result: item.result,
        get remainingMs() {
          return remaining(item, clock.now())
        },
      }
      views.set(item, view)
    }
    return view
  }

  const api: PendingApi = {
    decide(input) {
      if (seals > 0 || items.has(input.key)) return false
      const encodedBody = JSON.stringify(input.request.body)
      if (
        encodedBody === undefined ||
        new TextEncoder().encode(encodedBody).length >= KEEPALIVE_LIMIT
      ) {
        throw new Error('Pending decision body must be JSON under 64 KB')
      }
      const url = sameOriginPath(input.request.url)
      const now = clock.now()
      const item = {
        ...startItem(
          { ...input, request: { url, body: input.request.body } },
          now,
          undoMs,
          overlays > 0,
        ),
        encodedBody,
      }
      items = new Map(items).set(item.key, item)
      armTimer(item, now)
      notify()
      return true
    },
    undo(key) {
      dispatch(key, { type: 'undo' })
    },
    undoAll() {
      let first: PendingItem | undefined
      for (const item of items.values()) {
        if (item.state !== 'pending' && item.state !== 'paused') continue
        if (dispatch(item.key, { type: 'undo' })) first ??= item
      }
      return first?.focus
    },
    retry(key) {
      dispatch(key, { type: 'retry' })
    },
    dismiss(key) {
      dispatch(key, { type: 'dismiss' })
    },
    pause(key, cause) {
      dispatch(key, { type: 'pause', cause })
    },
    resume(key, cause) {
      dispatch(key, { type: 'resume', cause })
    },
    overlay(open) {
      const wasOpen = overlays > 0
      overlays = Math.max(0, overlays + (open ? 1 : -1))
      if (wasOpen === overlays > 0) return
      for (const key of items.keys()) {
        dispatch(key, { type: open ? 'pause' : 'resume', cause: 'overlay' })
      }
    },
    seal() {
      seals += 1
      let released = false
      return () => {
        if (released) return
        released = true
        seals -= 1
      }
    },
    async flush() {
      for (const key of items.keys()) dispatch(key, { type: 'flush' })
      const outcomes = await Promise.allSettled(inflight.values())
      return { ok: outcomes.every((outcome) => outcome.status === 'fulfilled' && outcome.value) }
    },
    getView(key) {
      const item = items.get(key)
      return item ? viewOf(item) : null
    },
    get items() {
      return Array.from(items.values(), (item) => ({
        key: item.key,
        label: item.label,
        view: viewOf(item),
      }))
    },
  }

  return Object.assign(api, {
    undoMs,
    clock,
    getSnapshot: (): ReadonlyMap<string, PendingItem> => items,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    reset,
    destroy() {
      listeners.clear()
      reset()
    },
  })
}
