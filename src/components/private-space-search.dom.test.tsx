import { act, fireEvent, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PrivateSpaceSearch, usePrivateSpaces } from '@/components/private-space-search'
import { AUTH_CHANGED } from '@/lib/auth-events'

import { messagesOf, renderWithIntl } from '../../testing/intl.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'

const text = messagesOf.en.Search
const spaces = [{ id: 1, label: 'Accessible space', href: '/en/spaces/community/1' }]
const page = (title = '<img src=x onerror=alert(1)>', account = 1) => ({
  account,
  spaces,
  results: [
    {
      id: 'post:1',
      kind: 'post',
      title,
      snippet: '<script>secret</script>',
      href: '/en/spaces/community/1/posts/1',
      space: spaces[0].label,
    },
  ],
  aggregates: { total: 1, facets: [{ id: 1, found: 1 }] },
  incomplete: false,
  hasMore: false,
})

type Answer = (body: Record<string, unknown>) => Response | Promise<Response>
const requests: { body: Record<string, unknown>; signal: AbortSignal }[] = []
const first: Answer[] = []
const arrivals: (() => void)[] = []
const ok: (value: unknown) => Answer = (value) => () => HttpResponse.json(value as never)
const hang: Answer = () => new Promise<Response>(() => {})
const refuse: Answer = () => new HttpResponse(null, { status: 401 })
let answer: Answer = ok(page())

mockNetwork(
  http.post('/api/spaces-search', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    requests.push({ body, signal: request.signal })
    const next = first.shift() ?? answer
    for (const arrived of arrivals.splice(0)) arrived()
    return next(body)
  }),
)

beforeEach(() => {
  requests.length = 0
  first.length = 0
  arrivals.length = 0
  answer = ok(page())
})

const nextRequest = () => new Promise<void>((resolve) => arrivals.push(resolve))

const defer = () => {
  let release!: (value: Response) => void
  const response = new Promise<Response>((resolve) => {
    release = resolve
  })
  return { response, release }
}

const open = () => undefined

describe('private search browser state', () => {
  it('renders source text safely and immediately hides old results when the query changes', async () => {
    const { rerender, container } = renderWithIntl(
      <PrivateSpaceSearch query="first" account={1} onOpen={open} />,
    )
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(container.querySelector('script, img')).toBeNull()
    answer = hang
    rerender(<PrivateSpaceSearch query="second" account={1} onOpen={open} />)
    expect(screen.queryByText('<img src=x onerror=alert(1)>')).toBeNull()
  })

  it('aborts superseded requests and discards the response the old request gets later', async () => {
    const stale = defer()
    first.push(() => stale.response)
    answer = ok(page('current'))
    const started = nextRequest()
    const { rerender } = renderWithIntl(
      <PrivateSpaceSearch query="first" account={1} onOpen={open} />,
    )
    await started
    rerender(<PrivateSpaceSearch query="second" account={1} onOpen={open} />)
    expect(await screen.findByText('current')).toBeInTheDocument()
    expect(requests[0]!.signal.aborted).toBe(true)
    await act(async () => stale.release(HttpResponse.json(page('stale'))))
    expect(screen.getByText('current')).toBeInTheDocument()
    expect(screen.queryByText('stale')).toBeNull()
  })

  it('drops a result returned for a different account', async () => {
    answer = ok(page('wrong account', 2))
    renderWithIntl(<PrivateSpaceSearch query="first" account={1} onOpen={open} />)
    expect(await screen.findByText(text.privateRestart)).toBeInTheDocument()
    expect(screen.queryByText('wrong account')).toBeNull()
  })

  it('invalidates rows immediately when the selected space, sort, or account changes', async () => {
    answer = ok(page('previous binding'))
    const { rerender } = renderWithIntl(
      <PrivateSpaceSearch query="first" account={1} onOpen={open} />,
    )
    expect(await screen.findByText('previous binding')).toBeInTheDocument()
    answer = hang
    const bySpace = nextRequest()
    rerender(<PrivateSpaceSearch query="first" spaces={[1]} account={1} onOpen={open} />)
    expect(screen.queryByText('previous binding')).toBeNull()
    await bySpace
    expect(requests.at(-1)!.body).toMatchObject({ spaces: [1], sort: 'relevance' })
    answer = ok(page('space result'))
    rerender(
      <PrivateSpaceSearch query="first" spaces={[1]} sort="newest" account={1} onOpen={open} />,
    )
    expect(await screen.findByText('space result')).toBeInTheDocument()
    rerender(
      <PrivateSpaceSearch query="first" spaces={[1]} sort="newest" account={2} onOpen={open} />,
    )
    expect(screen.queryByText('space result')).toBeNull()
  })

  it('does not revive a prior page when a filter is cleared before its debounce finishes', async () => {
    answer = ok(page('old result'))
    const { rerender } = renderWithIntl(
      <PrivateSpaceSearch query="first" account={1} onOpen={open} />,
    )
    expect(await screen.findByText('old result')).toBeInTheDocument()
    answer = hang
    rerender(<PrivateSpaceSearch query="first" spaces={[1]} account={1} onOpen={open} />)
    rerender(<PrivateSpaceSearch query="first" account={1} onOpen={open} />)
    expect(screen.queryByText('old result')).toBeNull()
  })

  it('keeps an incomplete scan distinct from an empty result and offers retry after an error', async () => {
    answer = ok({ ...page(), results: [], incomplete: true, aggregates: null })
    const { rerender } = renderWithIntl(
      <PrivateSpaceSearch query="first" account={1} onOpen={open} />,
    )
    expect(await screen.findByText(text.privateIncomplete)).toBeInTheDocument()
    expect(screen.queryByText(/^No results for/)).toBeNull()
    answer = refuse
    rerender(<PrivateSpaceSearch query="second" account={1} onOpen={open} />)
    expect(await screen.findByText(text.errorHint)).toBeInTheDocument()
    answer = ok({ ...page(), results: [] })
    fireEvent.click(screen.getByRole('button', { name: text.privateRetry }))
    expect(await screen.findByText(/^No results for/)).toBeInTheDocument()
    expect(screen.queryByText(text.privateIncomplete)).toBeNull()
  })

  it('keeps the next-page action focusable while a bounded page request is pending', async () => {
    answer = ok({ ...page(), hasMore: true, cursor: 'next' })
    renderWithIntl(<PrivateSpaceSearch query="first" account={1} onOpen={open} />)
    const next = await screen.findByRole('button', { name: text.showMore })
    next.focus()
    answer = hang
    const fetched = vi.spyOn(globalThis, 'fetch')
    fireEvent.click(next)
    expect(next).toHaveFocus()
    expect(next).toBeEnabled()
    expect(next).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(next)
    expect(fetched).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetched.mock.calls[0]![1]!.body as string).cursor).toBe('next')
    fetched.mockRestore()
  })

  it('appends the next bounded page through the shared Show more footer without losing current results', async () => {
    first.push(ok({ ...page('First result'), hasMore: true, cursor: 'next' }))
    answer = ok({
      ...page('Second result'),
      results: [{ ...page('Second result').results[0], id: 'post:2' }],
    })
    renderWithIntl(<PrivateSpaceSearch query="first" account={1} onOpen={open} />)
    expect(await screen.findByText('Showing 1 of 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: text.showMore }))
    expect(await screen.findByText('Second result')).toBeInTheDocument()
    expect(screen.getByText('First result')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: text.showMore })).toBeNull()
    expect(screen.queryByText(/results? shown/)).toBeNull()
    expect(requests[1]!.body.cursor).toBe('next')
  })

  it('clears options and ignores a stale options response across visibility and focus refreshes', async () => {
    function Options() {
      const { state } = usePrivateSpaces()
      return <span>{state ? state.account : 'cleared'}</span>
    }
    answer = ok({ spaces, account: 1 })
    renderWithIntl(<Options />)
    expect(await screen.findByText('1')).toBeInTheDocument()
    const old = defer()
    first.push(() => old.response)
    const refreshed = nextRequest()
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.getByText('cleared')).toBeInTheDocument()
    await refreshed
    answer = ok({ spaces: [], account: 2 })
    fireEvent(window, new Event('focus'))
    expect(await screen.findByText('2')).toBeInTheDocument()
    await act(async () => old.release(HttpResponse.json({ spaces, account: 1 })))
    expect(screen.queryByText('1')).toBeNull()
  })

  it('clears options on logout and prevents an old options response from crossing an account refresh', async () => {
    function Options() {
      const { state } = usePrivateSpaces()
      return <span>{state ? `${state.account}:${state.spaces.length}` : 'cleared'}</span>
    }
    const old = defer()
    first.push(() => old.response)
    answer = ok({ spaces: [], account: 2 })
    renderWithIntl(<Options />)
    fireEvent(window, new Event(AUTH_CHANGED))
    expect(await screen.findByText('2:0')).toBeInTheDocument()
    await act(async () => old.release(HttpResponse.json({ spaces, account: 1 })))
    expect(screen.queryByText('1:1')).toBeNull()
    answer = refuse
    fireEvent(window, new Event(AUTH_CHANGED))
    expect(await screen.findByText('cleared')).toBeInTheDocument()
  })
})
