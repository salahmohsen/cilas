import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const shared = vi.hoisted(() => ({
  refine: vi.fn(),
  push: vi.fn(),
  open: null as ((href: string) => void) | null,
  epoch: 1,
  report: null as
    ((summary: import('@/components/private-space-search').PrivateSearchSummary) => void) | null,
  props: null as import('@/components/search-results').SearchResultsProps | null,
  state: {
    account: 1,
    spaces: [{ id: 1, label: 'Accessible', href: '/en/spaces/community/1' }],
  } as object | null,
}))
vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: shared.push }) }))
vi.mock('@/env.client', () => ({
  clientEnv: { NEXT_PUBLIC_TYPESENSE_API_KEY: 'disposable-public-key' },
}))
vi.mock('typesense-instantsearch-adapter', () => ({
  default: class {
    searchClient = {}
  },
}))
vi.mock('react-instantsearch', () => ({
  InstantSearch: ({ children }: { children: React.ReactNode }) => children,
  Index: ({ children }: { children: React.ReactNode }) => children,
  Configure: () => null,
  useHits: () => ({ items: [], results: null }),
  useInstantSearch: () => ({ status: 'idle', error: null }),
  useSearchBox: () => ({ refine: shared.refine }),
}))
vi.mock('@/components/private-space-search', () => ({
  usePrivateSpaces: () => ({ state: shared.state, epoch: shared.epoch }),
  PrivateSpaceSearch: ({
    onSummary,
    onOpen,
  }: {
    onSummary: typeof shared.report
    onOpen: (href: string) => void
  }) => {
    shared.report = onSummary
    shared.open = onOpen
    return <p>Private results</p>
  },
}))
vi.mock('@/components/arc/segmented-control/segmented-control', () => ({
  default: ({
    options,
    onValueChange,
  }: {
    options: Array<{ value: string; label: string }>
    onValueChange: (value: string) => void
  }) => (
    <div>
      {options.map((o) => (
        <button key={o.value} onClick={() => onValueChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  ),
}))
vi.mock('@/components/search-results', () => ({
  SearchResults: (props: import('@/components/search-results').SearchResultsProps) => {
    shared.props = props
    return (
      <div>
        <input
          aria-label="Query"
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
        />
        {props.scopeControl}
        {props.privateContent}
      </div>
    )
  },
}))
import { SearchPanel } from '@/components/site-search-panel'

afterEach(() => {
  cleanup()
  shared.refine.mockClear()
  shared.push.mockClear()
  shared.open = null
  vi.unstubAllGlobals()
  shared.state = {
    account: 1,
    spaces: [{ id: 1, label: 'Accessible', href: '/en/spaces/community/1' }],
  }
  shared.epoch = 1
})
describe('private search scope routing', () => {
  it.each([
    '/en/spaces/course/another-course/posts/42',
    '/ar/spaces/community/2/posts/17',
  ])('opens a private result as a full page at %s rather than an intercepted dialog', (href) => {
    const onClose = vi.fn()
    render(<SearchPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('privateSpaces'))
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })

    shared.open?.(href)

    expect(assign).toHaveBeenCalledWith(href)
    expect(shared.push).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('uses independent facet selection and retains intent only for the same freshly authorized account', () => {
    const { rerender } = render(<SearchPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('privateSpaces'))
    expect(shared.props?.facets).toEqual([{ id: '1', label: 'Accessible', found: undefined }])
    act(() => shared.props?.onToggleFacet('1'))
    expect(shared.props?.hiddenFacets.has('1')).toBe(true)
    shared.epoch++
    rerender(<SearchPanel onClose={vi.fn()} />)
    expect(shared.props?.hiddenFacets.has('1')).toBe(true)
    act(() => shared.props?.onClearFilters())
    expect(shared.props?.hiddenFacets.size).toBe(0)
    act(() => shared.props?.onToggleFacet('1'))
    shared.state = null
    rerender(<SearchPanel onClose={vi.fn()} />)
    expect(shared.props?.facets).toEqual([])
    shared.state = {
      account: 2,
      spaces: [{ id: 1, label: 'Accessible', href: '/en/spaces/community/1' }],
    }
    rerender(<SearchPanel onClose={vi.fn()} />)
    expect(shared.props?.hiddenFacets.size).toBe(0)
  })
  it('feeds validated private totals and facets into the public components and clears them on permission changes', () => {
    const { rerender } = render(<SearchPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('privateSpaces'))
    act(() =>
      shared.report?.({
        shown: 20,
        searching: false,
        aggregates: { total: 27, facets: [{ id: 1, found: 27 }] },
      }),
    )
    expect(shared.props?.total).toBe(27)
    expect(shared.props?.facets[0].found).toBe(27)
    expect(shared.props?.seconds).toBeNull()
    act(() => shared.props?.onToggleFacet('1'))
    expect(shared.props?.total).toBe(0)
    expect(shared.props?.facets[0].found).toBe(27)
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'another query' } })
    expect(shared.props?.total).toBeNull()
    expect(shared.props?.searching).toBe(true)
    expect(shared.props?.facets[0].found).toBeUndefined()
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: '' } })
    expect(shared.props?.total).toBeNull()
    expect(shared.props?.facets[0].found).toBeUndefined()
    shared.epoch++
    shared.state = null
    rerender(<SearchPanel onClose={vi.fn()} />)
    expect(shared.props?.total).toBeNull()
  })
  it('never forwards a private query to the public adapter when permissions disappear', async () => {
    const { rerender } = render(<SearchPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('privateSpaces'))
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'private needle' } })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250))
    })
    shared.state = null
    rerender(<SearchPanel onClose={vi.fn()} />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250))
    })
    expect(shared.refine.mock.calls.every(([query]) => query === '')).toBe(true)
    expect(screen.getByText('privateUnavailable')).toBeInTheDocument()
    fireEvent.click(screen.getByText('publicSearch'))
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'public needle' } })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250))
    })
    expect(shared.refine).toHaveBeenLastCalledWith('public needle')
  })
})
