import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { sse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useNotificationFeed } from '@/components/use-notification-feed'
import type { ClientNotificationEvent } from '@/lib/realtime/events'

import { mockNetwork } from '../../testing/msw-browser.test-utils'

type Client = { send: (message: { event?: string; data: string }) => void }
const open: Client[] = []
mockNetwork(
  sse('/api/notifications/stream', ({ client }) => {
    open.push(client)
  }),
)

afterEach(() => {
  cleanup()
  open.length = 0
})

const connected = (count: number) => waitFor(() => expect(open).toHaveLength(count))
const notification = (event: ClientNotificationEvent) => ({
  event: 'notification',
  data: JSON.stringify(event),
})

describe('notification feed lifecycle', () => {
  it('loads once, forwards stream events to the latest handler, and cleans up', async () => {
    const load = vi.fn()
    const first = vi.fn()
    const next = vi.fn()
    const view = renderHook(({ onEvent }) => useNotificationFeed({ load, onEvent }), {
      initialProps: { onEvent: first },
    })
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    await connected(1)
    view.rerender({ onEvent: next })
    const event = { id: 7, op: 'deleted' } satisfies ClientNotificationEvent
    act(() => open[0]!.send(notification(event)))
    await waitFor(() => expect(next).toHaveBeenCalledWith(event))
    expect(first).not.toHaveBeenCalled()
    act(() => open[0]!.send({ event: 'resync', data: '' }))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    expect(open).toHaveLength(1)
    view.unmount()
    const afterUnmount = renderHook(() => useNotificationFeed({ load: vi.fn(), onEvent: vi.fn() }))
    await connected(2)
    expect(next).toHaveBeenCalledTimes(1)
    afterUnmount.unmount()
  })

  it('reloads when the tab becomes visible and detaches when the account is disabled', async () => {
    const load = vi.fn()
    const view = renderHook(
      ({ enabled }) => useNotificationFeed({ load, onEvent: vi.fn(), enabled }),
      { initialProps: { enabled: true } },
    )
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(load).toHaveBeenCalledTimes(2)
    view.rerender({ enabled: false })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('resubscribes for another account', async () => {
    const view = renderHook(
      ({ account }) => useNotificationFeed({ load: vi.fn(), onEvent: vi.fn(), account }),
      { initialProps: { account: 1 } },
    )
    view.rerender({ account: 2 })
    await connected(1)
    view.unmount()
  })

  it('cancels the initial load on unmount', async () => {
    const load = vi.fn()
    renderHook(() => useNotificationFeed({ load, onEvent: vi.fn() })).unmount()
    const later = vi.fn()
    renderHook(() => useNotificationFeed({ load: later, onEvent: vi.fn() }))
    await waitFor(() => expect(later).toHaveBeenCalledTimes(1))
    expect(load).not.toHaveBeenCalled()
  })
})
