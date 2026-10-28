import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrivateSpaceSearch, usePrivateSpaces } from '@/components/private-space-search'
import { AUTH_CHANGED } from '@/lib/auth-events'

vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }))
vi.mock('@/components/arc/segmented-control/segmented-control', () => ({ default: () => null }))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const response = (value: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 401, json: async () => value }) as Response
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
const wait = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 280))
  })
}

describe('private search browser state', () => {
  it('renders source text safely and immediately hides old results when the query changes', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(page()))
    vi.stubGlobal('fetch', fetcher)
    const { rerender, container } = render(
      <PrivateSpaceSearch query="first" account={1} onOpen={vi.fn()} />,
    )
    await wait()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(container.querySelector('script, img')).toBeNull()
    fetcher.mockImplementation(() => new Promise(() => {}))
    rerender(<PrivateSpaceSearch query="second" account={1} onOpen={vi.fn()} />)
    expect(screen.queryByText('<img src=x onerror=alert(1)>')).toBeNull()
  })
  it('aborts superseded requests and discards a response even if the fetch transport ignores abort', async () => {
    let resolve!: (value: Response) => void
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((r) => {
            resolve = r
          }),
      )
      .mockResolvedValue(response(page('current')))
    vi.stubGlobal('fetch', fetcher)
    const { rerender } = render(<PrivateSpaceSearch query="first" account={1} onOpen={vi.fn()} />)
    await wait()
    const signal = fetcher.mock.calls[0][1].signal as AbortSignal
    rerender(<PrivateSpaceSearch query="second" account={1} onOpen={vi.fn()} />)
    await wait()
    expect(signal.aborted).toBe(true)
    await act(async () => resolve(response(page('stale'))))
    expect(screen.getByText('current')).toBeInTheDocument()
    expect(screen.queryByText('stale')).toBeNull()
  })
  it('drops a result returned for a different account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(page('wrong account', 2))))
    render(<PrivateSpaceSearch query="first" account={1} onOpen={vi.fn()} />)
    await wait()
    expect(screen.queryByText('wrong account')).toBeNull()
    expect(screen.getByText('privateRestart')).toBeInTheDocument()
  })
  it('invalidates rows immediately when the selected space, sort, or account changes', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(page('previous binding')))
    vi.stubGlobal('fetch', fetcher)
    const { rerender } = render(<PrivateSpaceSearch query="first" account={1} onOpen={vi.fn()} />)
    await wait()
    expect(screen.getByText('previous binding')).toBeInTheDocument()
    fetcher.mockImplementation(() => new Promise(() => {}))
    rerender(<PrivateSpaceSearch query="first" spaces={[1]} account={1} onOpen={vi.fn()} />)
    expect(screen.queryByText('previous binding')).toBeNull()
    await wait()
    expect(JSON.parse(fetcher.mock.calls.at(-1)![1].body)).toMatchObject({
      spaces: [1],
      sort: 'relevance',
    })
    fetcher.mockResolvedValue(response(page('space result')))
    rerender(
      <PrivateSpaceSearch query="first" spaces={[1]} sort="newest" account={1} onOpen={vi.fn()} />,
    )
    await wait()
    expect(screen.getByText('space result')).toBeInTheDocument()
    rerender(
      <PrivateSpaceSearch query="first" spaces={[1]} sort="newest" account={2} onOpen={vi.fn()} />,
    )
    expect(screen.queryByText('space result')).toBeNull()
  })
  it('does not revive a prior page when a filter is cleared before its debounce finishes', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(page('old result')))
    vi.stubGlobal('fetch', fetcher)
    const { rerender } = render(<PrivateSpaceSearch query="first" account={1} onOpen={vi.fn()} />)
    await wait()
    expect(screen.getByText('old result')).toBeInTheDocument()
    fetcher.mockImplementation(() => new Promise(() => {}))
    rerender(<PrivateSpaceSearch query="first" spaces={[1]} account={1} onOpen={vi.fn()} />)
    rerender(<PrivateSpaceSearch query="first" account={1} onOpen={vi.fn()} />)
    expect(screen.queryByText('old result')).toBeNull()
  })
  it('keeps an incomplete scan distinct from an empty result and offers retry after an error', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ ...page(), results: [], incomplete: true, aggregates: null }))
    vi.stubGlobal('fetch', fetcher)
    const { rerender } = render(<PrivateSpaceSearch query="first" account={1} onOpen={vi.fn()} />)
    await wait()
    expect(screen.getByText('privateIncomplete')).toBeInTheDocument()
    expect(screen.queryByText('noResultsTitle')).toBeNull()
    fetcher.mockResolvedValue(response(null, false))
    rerender(<PrivateSpaceSearch query="second" account={1} onOpen={vi.fn()} />)
    await wait()
    expect(screen.getByText('errorHint')).toBeInTheDocument()
    fetcher.mockResolvedValue(response({ ...page(), results: [] }))
    fireEvent.click(screen.getByRole('button', { name: 'privateRetry' }))
    await waitFor(() => expect(screen.getByText('noResultsTitle')).toBeInTheDocument())
    expect(screen.queryByText('privateIncomplete')).toBeNull()
  })
  it('keeps the next-page action focusable while a bounded page request is pending', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ ...page(), hasMore: true, cursor: 'next' }))
    vi.stubGlobal('fetch', fetcher)
    render(<PrivateSpaceSearch query="first" account={1} onOpen={vi.fn()} />)
    await wait()
    const next = screen.getByRole('button', { name: 'showMore' })
    next.focus()
    fetcher.mockImplementation(() => new Promise(() => {}))
    fireEvent.click(next)
    expect(next).toHaveFocus()
    expect(next).toBeEnabled()
    expect(next).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(next)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetcher.mock.calls[1][1].body).cursor).toBe('next')
  })
  it('appends the next bounded page through the shared Show more footer without losing current results', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ ...page('First result'), hasMore: true, cursor: 'next' }))
      .mockResolvedValueOnce(
        response({
          ...page('Second result'),
          results: [{ ...page('Second result').results[0], id: 'post:2' }],
        }),
      )
    vi.stubGlobal('fetch', fetcher)
    render(<PrivateSpaceSearch query="first" account={1} onOpen={vi.fn()} />)
    await wait()
    expect(screen.getByText('showing')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'showMore' }))
    await waitFor(() => expect(screen.getByText('Second result')).toBeInTheDocument())
    expect(screen.getByText('First result')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'showMore' })).toBeNull()
    expect(screen.queryByText('showingLoaded')).toBeNull()
    expect(JSON.parse(fetcher.mock.calls[1][1].body).cursor).toBe('next')
  })
  it('clears permissions and ignores stale options across visibility and focus refreshes', async () => {
    let old!: (value: Response) => void
    const fetcher = vi.fn().mockResolvedValue(response({ spaces, account: 1 }))
    vi.stubGlobal('fetch', fetcher)
    function Options() {
      const { state } = usePrivateSpaces()
      return <span>{state ? state.account : 'cleared'}</span>
    }
    render(<Options />)
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.getByText('cleared')).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          old = resolve
        }),
    )
    fireEvent(document, new Event('visibilitychange'))
    fetcher.mockResolvedValue(response({ spaces: [], account: 2 }))
    fireEvent(window, new Event('focus'))
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())
    await act(async () => old(response({ spaces, account: 1 })))
    expect(screen.queryByText('1')).toBeNull()
    vi.restoreAllMocks()
  })
  it('clears options on logout and prevents an old options response from crossing an account refresh', async () => {
    let old!: (value: Response) => void
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((r) => {
            old = r
          }),
      )
      .mockResolvedValue(response({ spaces: [], account: 2 }))
    vi.stubGlobal('fetch', fetcher)
    function Options() {
      const { state } = usePrivateSpaces()
      return <span>{state ? `${state.account}:${state.spaces.length}` : 'cleared'}</span>
    }
    render(<Options />)
    fireEvent(window, new Event(AUTH_CHANGED))
    await waitFor(() => expect(screen.getByText('2:0')).toBeInTheDocument())
    await act(async () => old(response({ spaces, account: 1 })))
    expect(screen.queryByText('1:1')).toBeNull()
    fetcher.mockResolvedValue(response(null, false))
    fireEvent(window, new Event(AUTH_CHANGED))
    await waitFor(() => expect(screen.getByText('cleared')).toBeInTheDocument())
  })
})
