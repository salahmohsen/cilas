import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse, sse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ClientNotificationEvent } from '@/lib/realtime/events'
import { InboxRefresh } from '@/portal/inbox/inbox-refresh'

import { mockNetwork } from '../../../testing/msw-browser.test-utils'

import { renderWithBrowserNavigation } from '../../../testing/browser-navigation.test-utils'
import { NavCountsProvider, useNavCount } from './nav-counts'
import type { PortalNavItem } from './portal-nav'

type Message = { event: 'notification' | 'resync'; data: string }
const open: { send: (message: Message) => void; close: () => void }[] = []
let countRequests = 0
let countsResponse: () => Response | Promise<Response> = () =>
  HttpResponse.json({ total: countRequests, by: {} })

mockNetwork(
  sse<{ notification: string; resync: string }>('/api/notifications/stream', ({ client }) => {
    open.push({ send: (message) => client.send(message), close: () => client.close() })
  }),
  http.get('/api/portal/counts', () => {
    countRequests++
    return countsResponse()
  }),
)

function Count({ itemKey = 'inbox' }: { itemKey?: PortalNavItem['key'] }) {
  return <output aria-label={itemKey}>{String(useNavCount(itemKey))}</output>
}

afterEach(() => {
  cleanup()
  open.length = 0
  countRequests = 0
  countsResponse = () => HttpResponse.json({ total: countRequests, by: {} })
})

const mount = async (children?: ReactNode) => {
  const view = renderWithBrowserNavigation(
    <NavCountsProvider>
      <Count />
      <Count itemKey="articles" />
      <Count itemKey="courses" />
      <Count itemKey="home" />
      {children}
    </NavCountsProvider>,
  )
  await waitFor(() => expect(open).toHaveLength(1))
  await waitFor(() => expect(countRequests).toBe(1))
  return view
}

const countOf = (itemKey: PortalNavItem['key']) =>
  screen.getByRole('status', { name: itemKey }).textContent
const refreshes = () => countRequests - 1

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

describe('NavCountsProvider work refresh', () => {
  it('a submitted event refreshes once after 1 s', async () => {
    const view = await mount()
    await send(created('submitted'))
    await wait(QUIET - 3 * MARGIN)
    expect(refreshes()).toBe(0)
    await wait(4 * MARGIN)
    expect(refreshes()).toBe(1)
    await waitFor(() => expect(countOf('inbox')).toBe('2'))
    expect(view.browser.refreshes).toBe(0)
    await wait(QUIET + MARGIN)
    expect(refreshes()).toBe(1)
  })

  it('three events in 1 s refresh once', async () => {
    await mount()
    await send(created('submitted'))
    await wait(MARGIN)
    await send(created('approved'))
    await wait(MARGIN)
    await send(created('changes_requested'))
    await wait(QUIET + 2 * MARGIN)
    expect(refreshes()).toBe(1)
  })

  it.each(['updated', 'deleted'] as const)('a %s event does not refresh', async (op) => {
    await mount()
    await send({ ...created('submitted'), op })
    await wait(QUIET + 2 * MARGIN)
    expect(refreshes()).toBe(0)
  })

  it.each([['comment'], ['not-a-kind']])('a %s event does not refresh', async (kind) => {
    await mount()
    await send(created(kind))
    await wait(QUIET + 2 * MARGIN)
    expect(refreshes()).toBe(0)
  })

  it('an event with no doc refreshes', async () => {
    await mount()
    await send({ op: 'created', id: 9 })
    await wait(QUIET + 2 * MARGIN)
    expect(refreshes()).toBe(1)
  })

  it('a sync refreshes', async () => {
    await mount()
    await act(async () => open[0]!.send({ event: 'resync', data: '' }))
    await wait(QUIET + 2 * MARGIN)
    expect(refreshes()).toBe(1)
  })

  it('unmount cancels a pending refresh', async () => {
    const view = await mount()
    await send(created('submitted'))
    await wait(MARGIN)
    view.unmount()
    await wait(QUIET + 2 * MARGIN)
    expect(refreshes()).toBe(0)
  })
})

describe('NavCountsProvider request lifecycle', () => {
  it.each([
    { total: 5, by: {}, expected: ['5', 'null', 'null'] },
    { total: 3, by: { ownArticles: 2, ownCourses: 1 }, expected: ['3', '2', '1'] },
    { total: 4, by: { reviewQueue: 3, applicants: 1 }, expected: ['4', 'null', 'null'] },
    { total: null, by: { ownArticles: null }, expected: ['null', 'null', 'null'] },
  ])(
    'maps the total and the reader’s own sources to items ($total)',
    async ({ total, by, expected }) => {
      let settle!: () => void
      const pending = new Promise<void>((resolve) => {
        settle = resolve
      })
      countsResponse = async () => {
        await pending
        return HttpResponse.json({ total, by })
      }
      await mount()
      await act(async () => settle())
      await waitFor(() => {
        expect(countOf('inbox')).toBe(expected[0])
        expect(countOf('articles')).toBe(expected[1])
        expect(countOf('courses')).toBe(expected[2])
      })
      expect(countOf('home')).toBe('null')
    },
  )

  it('spaces focus reads for nav counts and Inbox rows 30 seconds apart', async () => {
    const view = await mount(<InboxRefresh />)
    await waitFor(() => expect(countOf('inbox')).toBe('1'))
    const focus = () => window.dispatchEvent(new Event('focus'))
    vi.useFakeTimers({ toFake: ['performance'] })
    const fetch = vi.spyOn(window, 'fetch')
    try {
      focus()
      await waitFor(() => expect(countOf('inbox')).toBe('2'))
      expect(view.browser.refreshes).toBe(1)

      vi.advanceTimersByTime(29_999)
      focus()
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(view.browser.refreshes).toBe(1)

      await send(created('submitted'))
      await waitFor(() => expect(countOf('inbox')).toBe('3'), { timeout: QUIET + 4 * MARGIN })
      await waitFor(() => expect(view.browser.refreshes).toBe(2))
      focus()
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(view.browser.refreshes).toBe(2)

      vi.advanceTimersByTime(1)
      focus()
      await waitFor(() => expect(countOf('inbox')).toBe('4'))
      expect(view.browser.refreshes).toBe(3)

      view.unmount()
      vi.advanceTimersByTime(30_000)
      focus()
      expect(view.browser.refreshes).toBe(3)
    } finally {
      fetch.mockRestore()
      vi.useRealTimers()
    }
  })

  it('clears a loaded count after an error on focus', async () => {
    await mount()
    await waitFor(() => expect(countOf('inbox')).toBe('1'))
    countsResponse = () => new HttpResponse(null, { status: 500 })
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(countOf('inbox')).toBe('null'))
    expect(countRequests).toBe(2)
  })

  it('coalesces work while a request is pending and skips overlapping focus reads', async () => {
    let settle!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => {
      settle = resolve
    })
    countsResponse = () => (countRequests === 1 ? pending : HttpResponse.json({ total: 4, by: {} }))
    await mount()
    window.dispatchEvent(new Event('focus'))
    await send(created('submitted'))
    await wait(QUIET + MARGIN)
    expect(countRequests).toBe(1)
    expect(countOf('inbox')).toBe('null')
    await act(async () => settle(HttpResponse.json({ total: 3, by: {} })))
    await waitFor(() => expect(countOf('inbox')).toBe('4'))
    expect(countRequests).toBe(2)
  })

  it('aborts the browser fetch on unmount', async () => {
    let settle!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => {
      settle = resolve
    })
    countsResponse = () => pending
    const fetch = vi.spyOn(window, 'fetch')
    try {
      const view = await mount()
      const call = fetch.mock.calls.find(([input]) => input === '/api/portal/counts')
      const signal = call?.[1]?.signal
      expect(signal?.aborted).toBe(false)
      view.unmount()
      expect(signal?.aborted).toBe(true)
    } finally {
      fetch.mockRestore()
      settle(HttpResponse.json({ total: 1, by: {} }))
    }
  })
})
