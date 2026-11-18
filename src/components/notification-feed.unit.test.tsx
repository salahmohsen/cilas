import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNotificationFeed } from '@/components/use-notification-feed'
import type { ClientNotificationEvent } from '@/lib/realtime/events'

const stream = vi.hoisted(() => ({ subscribe: vi.fn(), unsubscribe: vi.fn() }))
vi.mock('@/lib/realtime/stream-client', () => ({ subscribeNotifications: stream.subscribe }))

beforeEach(() => {
  vi.useFakeTimers()
  stream.subscribe.mockReset().mockReturnValue(stream.unsubscribe)
  stream.unsubscribe.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('notification feed lifecycle', () => {
  it('loads once, forwards stream events to the latest handler, and cleans up', () => {
    const load = vi.fn()
    const first = vi.fn()
    const next = vi.fn()
    const view = renderHook(({ onEvent }) => useNotificationFeed({ load, onEvent }), {
      initialProps: { onEvent: first },
    })
    act(() => vi.runOnlyPendingTimers())
    expect(load).toHaveBeenCalledTimes(1)
    view.rerender({ onEvent: next })
    const handlers = stream.subscribe.mock.calls[0]![0]
    const event = { id: 7, op: 'deleted' } as ClientNotificationEvent
    act(() => handlers.event(event))
    expect(first).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(event)
    act(() => handlers.sync())
    expect(load).toHaveBeenCalledTimes(2)
    expect(stream.subscribe).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(stream.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('reloads only when visible and detaches when the account is disabled', () => {
    const load = vi.fn()
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const view = renderHook(
      ({ enabled }) => useNotificationFeed({ load, onEvent: vi.fn(), enabled }),
      { initialProps: { enabled: true } },
    )
    act(() => vi.runOnlyPendingTimers())
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(load).toHaveBeenCalledTimes(1)
    visibility.mockReturnValue('visible')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(load).toHaveBeenCalledTimes(2)
    view.rerender({ enabled: false })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(load).toHaveBeenCalledTimes(2)
    expect(stream.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('cancels the initial load on unmount and resubscribes for another account', () => {
    const load = vi.fn()
    const view = renderHook(
      ({ account }) => useNotificationFeed({ load, onEvent: vi.fn(), account }),
      { initialProps: { account: 1 } },
    )
    view.rerender({ account: 2 })
    expect(stream.unsubscribe).toHaveBeenCalledTimes(1)
    expect(stream.subscribe).toHaveBeenCalledTimes(2)
    view.unmount()
    act(() => vi.runOnlyPendingTimers())
    expect(load).not.toHaveBeenCalled()
  })
})
