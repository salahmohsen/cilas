import { act, cleanup, render, waitFor } from '@testing-library/react'
import { sse } from 'msw'
import {
  AppRouterContext,
  type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { afterEach, describe, expect, it } from 'vitest'

import type { ClientNotificationEvent } from '@/lib/realtime/events'

import { mockNetwork } from '../../../testing/msw-browser.test-utils'
import { WorkRefresh } from './work-refresh'

type Message = { event: 'notification' | 'resync'; data: string }
const open: { send: (message: Message) => void; close: () => void }[] = []
mockNetwork(
  sse<{ notification: string; resync: string }>('/api/notifications/stream', ({ client }) => {
    open.push({ send: (message) => client.send(message), close: () => client.close() })
  }),
)

let refreshed = 0
const router = {
  refresh: () => void refreshed++,
  push: () => {},
  replace: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => {},
  bfcacheId: 'test',
} satisfies AppRouterInstance

afterEach(() => {
  cleanup()
  open.length = 0
  refreshed = 0
})

const mount = async () => {
  const view = render(
    <AppRouterContext.Provider value={router}>
      <WorkRefresh />
    </AppRouterContext.Provider>,
  )
  await waitFor(() => expect(open).toHaveLength(1))
  return view
}

const created = (kind: string) =>
  ({
    op: 'created',
    id: 1,
    doc: { id: 1, kind, title: 't', createdAt: '2026-01-01T00:00:00.000Z' },
  }) satisfies ClientNotificationEvent
const send = (event: ClientNotificationEvent) =>
  act(() => open[0]!.send({ event: 'notification', data: JSON.stringify(event) }))
const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)))

const QUIET = 1_000
const MARGIN = 250

describe('WorkRefresh', () => {
  it('a submitted event refreshes once after 1 s', async () => {
    await mount()
    await send(created('submitted'))
    await wait(QUIET - 3 * MARGIN)
    expect(refreshed).toBe(0)
    await wait(4 * MARGIN)
    expect(refreshed).toBe(1)
    await wait(QUIET + MARGIN)
    expect(refreshed).toBe(1)
  })

  it('three events in 1 s refresh once', async () => {
    await mount()
    await send(created('submitted'))
    await wait(MARGIN)
    await send(created('approved'))
    await wait(MARGIN)
    await send(created('changes_requested'))
    await wait(QUIET + 2 * MARGIN)
    expect(refreshed).toBe(1)
  })

  it.each(['updated', 'deleted'] as const)('a %s event does not refresh', async (op) => {
    await mount()
    await send({ ...created('submitted'), op })
    await wait(QUIET + 2 * MARGIN)
    expect(refreshed).toBe(0)
  })

  it.each([['comment'], ['not-a-kind']])('a %s event does not refresh', async (kind) => {
    await mount()
    await send(created(kind))
    await wait(QUIET + 2 * MARGIN)
    expect(refreshed).toBe(0)
  })

  it('an event with no doc refreshes', async () => {
    await mount()
    await send({ op: 'created', id: 9 })
    await wait(QUIET + 2 * MARGIN)
    expect(refreshed).toBe(1)
  })

  it('a sync refreshes', async () => {
    await mount()
    await act(async () => open[0]!.send({ event: 'resync', data: '' }))
    await wait(QUIET + 2 * MARGIN)
    expect(refreshed).toBe(1)
  })

  it('unmount cancels a pending refresh', async () => {
    const view = await mount()
    await send(created('submitted'))
    await wait(MARGIN)
    view.unmount()
    await wait(QUIET + 2 * MARGIN)
    expect(refreshed).toBe(0)
  })
})
