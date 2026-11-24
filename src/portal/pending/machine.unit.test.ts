import { describe, expect, it } from 'vitest'
import {
  remaining,
  sends,
  startItem,
  transition,
  type PendingEvent,
  type PendingState,
} from './machine'

const input = {
  key: 'review:articles:12',
  label: 'Approving',
  request: { url: '/review', body: {} },
}
const initial = () => startItem(input, 0, 5000, false)

const events = {
  pause: { type: 'pause', cause: 'focus' },
  resume: { type: 'resume', cause: 'focus' },
  undo: { type: 'undo' },
  expire: { type: 'expire' },
  flush: { type: 'flush' },
  ok: { type: 'ok', status: 200, result: { emailed: true } },
  refused: { type: 'refused', status: 409, result: { field: 'note' } },
  error: { type: 'error', status: 500 },
  retry: { type: 'retry' },
  dismiss: { type: 'dismiss' },
} satisfies Record<PendingEvent['type'], PendingEvent>

const cases = {
  pending: { pause: 'paused', undo: 'undone', expire: 'committing', flush: 'committing' },
  paused: { pause: 'paused', resume: 'pending', undo: 'undone', flush: 'committing' },
  committing: { ok: 'sent', refused: 'undone', error: 'failed' },
  failed: { retry: 'committing', undo: 'undone', flush: 'committing' },
  sent: { dismiss: 'gone' },
  undone: { dismiss: 'gone' },
} satisfies Record<PendingState, Partial<Record<PendingEvent['type'], PendingState | 'gone'>>>

describe('pending: state machine', () => {
  it('starts pending or paused by the open overlay', () => {
    expect(initial()).toMatchObject({ state: 'pending', runningSince: 0, remainingMs: 5000 })
    expect(startItem(input, 10, 5000, true)).toMatchObject({
      state: 'paused',
      runningSince: null,
      causes: new Set(['overlay']),
    })
  })

  const states = Object.entries(cases) as [
    PendingState,
    Partial<Record<PendingEvent['type'], string>>,
  ][]
  const pairs = states.flatMap(([state, allowed]) =>
    Object.values(events).map((event) => ({
      state,
      event,
      expected: allowed[event.type] ?? 'illegal',
    })),
  )

  it.each(pairs)('$state + $event.type → $expected', ({ state, event, expected }) => {
    const item = {
      ...initial(),
      state,
      causes: state === 'paused' ? new Set(['focus'] as const) : new Set<never>(),
    }
    const next = transition(item, event, 0)
    expect(typeof next === 'string' ? next : next.state).toBe(expected)
  })

  it.each(['focus', 'tap', 'overlay'] as const)('pauses for %s', (cause) => {
    expect(transition(initial(), { type: 'pause', cause }, 1000)).toMatchObject({
      state: 'paused',
      causes: new Set([cause]),
      remainingMs: 4000,
      runningSince: null,
    })
  })

  it('stays paused until the last cause leaves', () => {
    const item = {
      ...initial(),
      state: 'paused' as const,
      causes: new Set(['focus', 'tap'] as const),
    }
    expect(transition(item, events.resume, 0)).toMatchObject({
      state: 'paused',
      causes: new Set(['tap']),
    })
  })

  it('resumes with the time left at pause', () => {
    const paused = transition(initial(), events.pause, 2000)
    if (typeof paused === 'string') throw new Error(paused)
    const resumed = transition(paused, events.resume, 9000)
    if (typeof resumed === 'string') throw new Error(resumed)
    expect(remaining(resumed, 10000)).toBe(2000)
  })

  it('expire then flush sends once', () => {
    const item = initial()
    const committing = transition(item, events.expire, 5000)
    if (typeof committing === 'string') throw new Error(committing)
    expect(sends(item, committing)).toBe(true)
    expect(transition(committing, events.flush, 5000)).toBe('illegal')
  })
})
