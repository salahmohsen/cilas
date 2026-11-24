export type PendingState = 'pending' | 'paused' | 'committing' | 'sent' | 'failed' | 'undone'
export type PauseCause = 'focus' | 'tap' | 'overlay'
export type PendingRequest = { url: string; body: unknown }
export type PendingInput = {
  key: string
  label: string
  request: PendingRequest
  focus?: () => void
  toastLine?: (seconds: number) => string
}
export type PendingItem = PendingInput & {
  state: PendingState
  causes: ReadonlySet<PauseCause>
  remainingMs: number
  runningSince: number | null
  status?: number
  result?: unknown
}

export type PendingEvent =
  | { type: 'pause'; cause: PauseCause }
  | { type: 'resume'; cause: PauseCause }
  | { type: 'undo' }
  | { type: 'expire' }
  | { type: 'flush' }
  | { type: 'ok'; status: number; result: unknown }
  | { type: 'refused'; status: 400 | 409; result: unknown }
  | { type: 'error'; status?: number }
  | { type: 'retry' }
  | { type: 'dismiss' }

export const startItem = (
  input: PendingInput,
  now: number,
  undoMs: number,
  overlayOpen: boolean,
): PendingItem => ({
  ...input,
  state: overlayOpen ? 'paused' : 'pending',
  causes: new Set(overlayOpen ? ['overlay'] : []),
  remainingMs: undoMs,
  runningSince: overlayOpen ? null : now,
})

export const remaining = (item: PendingItem, now: number) =>
  item.runningSince === null
    ? item.remainingMs
    : Math.max(0, item.remainingMs - (now - item.runningSince))

export const sends = (before: PendingItem, after: PendingItem) =>
  before.state !== 'committing' && after.state === 'committing'

const stop = (item: PendingItem, state: PendingState): PendingItem => ({
  ...item,
  state,
  causes: new Set(),
  remainingMs: 0,
  runningSince: null,
  status: undefined,
  result: undefined,
})

const pause = (item: PendingItem, event: PendingEvent, now: number): PendingItem => {
  if (event.type !== 'pause' || item.causes.has(event.cause)) return item
  return {
    ...item,
    state: 'paused',
    causes: new Set([...item.causes, event.cause]),
    remainingMs: remaining(item, now),
    runningSince: null,
  }
}

const resume = (item: PendingItem, event: PendingEvent, now: number): PendingItem => {
  if (event.type !== 'resume' || !item.causes.has(event.cause)) return item
  const causes = new Set(item.causes)
  causes.delete(event.cause)
  return causes.size > 0
    ? { ...item, causes }
    : { ...item, causes, state: 'pending', runningSince: now }
}

const undo = (item: PendingItem) => stop(item, 'undone')
const commit = (item: PendingItem) => stop(item, 'committing')
const dismiss = () => 'gone' as const
type Move = (item: PendingItem, event: PendingEvent, now: number) => PendingItem | 'gone'

const TRANSITIONS: Record<PendingState, Partial<Record<PendingEvent['type'], Move>>> = {
  pending: { pause, undo, expire: commit, flush: commit },
  paused: { pause, resume, undo, flush: commit },
  committing: {
    ok: (item, event) =>
      event.type === 'ok'
        ? { ...stop(item, 'sent'), status: event.status, result: event.result }
        : item,
    refused: (item, event) =>
      event.type === 'refused'
        ? { ...undo(item), status: event.status, result: event.result }
        : item,
    error: (item, event) =>
      event.type === 'error' ? { ...stop(item, 'failed'), status: event.status } : item,
  },
  failed: { retry: commit, undo, flush: commit },
  sent: { dismiss },
  undone: { dismiss },
}

export const transition = (item: PendingItem, event: PendingEvent, now: number) =>
  TRANSITIONS[item.state][event.type]?.(item, event, now) ?? 'illegal'
