import React, { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchResults } from '@/components/search-results'
import { useSearchFilters } from '@/components/search-filters'
import { PrivateSpaceSearch, type PrivateSearchSummary } from '@/components/private-space-search'
import type { SearchSort } from '@/lib/search-config'

vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }))
vi.mock('react-instantsearch', () => ({ Highlight: () => null, Snippet: () => null }))
const onOpen = vi.fn()
const onClose = vi.fn()
const choices = [
  { id: '7', label: 'Accessible space' },
  { id: '8', label: 'مساحة أخرى' },
]
function Harness({ privateScope = true }: { privateScope?: boolean }) {
  const [query, setQuery] = useState('needle')
  const [summary, setSummary] = useState<PrivateSearchSummary>({
    shown: 0,
    searching: true,
    aggregates: null,
  })
  const [sort, setSort] = useState<SearchSort>('relevance')
  const filters = useSearchFilters(
    privateScope ? 'member:1' : 'public',
    choices.map((choice) => choice.id),
  )
  const selected = choices
    .filter((choice) => !filters.hidden.has(choice.id))
    .map((choice) => Number(choice.id))
  return (
    <div role="dialog" aria-label="Search">
      <SearchResults
        query={query}
        onQueryChange={setQuery}
        onClose={onClose}
        filterLabel={privateScope ? 'spaceLabel' : undefined}
        facets={choices.map((choice) => ({
          ...choice,
          found: privateScope
            ? summary.aggregates?.facets.find((facet) => String(facet.id) === choice.id)?.found
            : 1,
        }))}
        hiddenFacets={filters.hidden}
        onToggleFacet={filters.toggle}
        onClearFilters={filters.clear}
        rows={[]}
        sectionOf={() => ({ label: '', icon: null })}
        total={privateScope ? (summary.aggregates?.total ?? null) : 2}
        hasMore={false}
        onShowMore={() => {}}
        seconds={null}
        searching={privateScope && summary.searching}
        failed={false}
        sort={sort}
        onSortChange={setSort}
        onOpen={() => {}}
        privateContent={
          privateScope ? (
            <PrivateSpaceSearch
              query={query}
              spaces={selected}
              sort={sort}
              account={1}
              onOpen={onOpen}
              onSummary={setSummary}
            />
          ) : undefined
        }
      />
    </div>
  )
}
const page = {
  account: 1,
  spaces: [],
  incomplete: false,
  hasMore: false,
  aggregates: {
    total: 2,
    facets: [
      { id: 7, found: 1 },
      { id: 8, found: 1 },
    ],
  },
  results: [
    {
      id: 'post:1',
      kind: 'post',
      spaceId: 7,
      updatedAt: 1,
      title: 'Current result',
      snippet: '<script>plain text</script>',
      space: 'Accessible space',
      href: '/en/spaces/community/7/posts/1',
    },
  ],
}
const response = (value = page) => ({ ok: true, json: async () => value }) as Response
const settle = async () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 280))
  })
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
  onOpen.mockClear()
  onClose.mockClear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('shared search filters', () => {
  it.each([true, false])(
    'supports independent selections, none and clear with the same state in private=%s',
    async (privateScope) => {
      const { container } = render(<Harness privateScope={privateScope} />)
      expect(container.querySelector('select')).toBeNull()
      const lane = within(screen.getByRole('complementary'))
      const first = lane.getByRole('checkbox', { name: choices[0].label })
      const second = lane.getByRole('checkbox', { name: choices[1].label })
      expect(first).toBeChecked()
      expect(second).toBeChecked()
      fireEvent.click(first)
      expect(first).not.toBeChecked()
      expect(second).toBeChecked()
      fireEvent.click(second)
      expect(second).not.toBeChecked()
      await settle()
      if (privateScope)
        expect(JSON.parse(vi.mocked(fetch).mock.calls.at(-1)![1]!.body as string).spaces).toEqual(
          [],
        )
      fireEvent.click(lane.getByRole('button', { name: 'clearAll' }))
      expect(first).toBeChecked()
      expect(second).toBeChecked()
      expect(lane.queryByRole('button', { name: 'clearAll' })).toBeNull()
      await settle()
      if (privateScope)
        expect(JSON.parse(vi.mocked(fetch).mock.calls.at(-1)![1]!.body as string).spaces).toEqual([
          7, 8,
        ])
    },
  )

  it('disables checked zero-match spaces but keeps unchecked zero-match spaces enabled', async () => {
    render(<Harness />)
    const lane = within(screen.getByRole('complementary'))
    const second = lane.getByRole('checkbox', { name: choices[1].label })
    fireEvent.click(second)
    vi.mocked(fetch).mockResolvedValue(
      response({
        ...page,
        aggregates: {
          total: 1,
          facets: [
            { id: 7, found: 1 },
            { id: 8, found: 0 },
          ],
        },
      }),
    )
    await settle()
    expect(second).not.toBeChecked()
    expect(second).toBeEnabled()
    fireEvent.click(second)
    await settle()
    expect(second).toBeChecked()
    expect(second).toBeDisabled()
    expect(lane.getAllByText('0').length).toBeGreaterThan(0)
  })

  it('leaves unknown counts enabled and never presents a fabricated zero', async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({ ...page, aggregates: null, incomplete: true } as never),
    )
    render(<Harness />)
    await settle()
    const lane = within(screen.getByRole('complementary'))
    expect(lane.getByRole('checkbox', { name: choices[1].label })).toBeEnabled()
    expect(lane.queryByText('0')).toBeNull()
    expect(screen.getAllByText('privateIncomplete').length).toBeGreaterThan(0)
  })

  it('uses counted choices and the same Show results action in the mobile sheet, restoring focus on close', async () => {
    render(<Harness />)
    await settle()
    const trigger = screen.getByRole('button', { name: 'filters' })
    fireEvent.click(trigger)
    const sheet = within(screen.getByRole('dialog', { name: 'filters' }))
    fireEvent.click(sheet.getByRole('checkbox', { name: choices[1].label }))
    await settle()
    fireEvent.click(sheet.getByRole('button', { name: 'showResults' }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450))
    })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'filters' })).toBeNull(), {
      timeout: 4000,
    })
    expect(screen.getByRole('searchbox')).toHaveValue('needle')
    await waitFor(() => expect(trigger).toHaveFocus())
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'filters' }), { key: 'Escape' })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450))
    })
    expect(screen.getByRole('searchbox')).toHaveValue('needle')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shares sort keys, result navigation, safe text, and image/icon presentation', async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({
        ...page,
        results: [{ ...page.results[0], image: '/api/space-files/file/safe.png' }],
      } as never),
    )
    const { container } = render(<Harness />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'sortRelevance' }), { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: 'sortNewest' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.keyDown(screen.getByRole('button', { name: 'sortNewest' }), { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: 'sortAlpha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await settle()
    expect(JSON.parse(vi.mocked(fetch).mock.calls.at(-1)![1]!.body as string).sort).toBe('alpha')
    const query = screen.getByRole('searchbox')
    query.focus()
    fireEvent.keyDown(query, { key: 'ArrowDown' })
    const result = screen.getByRole('button', { name: /Current result/ })
    expect(result).toHaveFocus()
    fireEvent.click(result)
    expect(onOpen).toHaveBeenCalledWith(page.results[0].href)
    fireEvent.keyDown(result, { key: 'ArrowUp' })
    expect(query).toHaveFocus()
    expect(screen.getByText('<script>plain text</script>')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    const image = container.querySelector('img')!
    expect(new URL(image.src).pathname).toBe('/api/space-files/file/safe.png')
    expect(image).not.toHaveAttribute('srcset')
    fireEvent.error(image)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('button', { name: /Current result/ })).toBeVisible()
  })

  it('shows the authoritative total in the shared animated header and shown-of-total footer', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        response({
          ...page,
          hasMore: true,
          cursor: 'next',
          aggregates: { ...page.aggregates, total: 42 },
        } as never),
      )
      .mockResolvedValueOnce(
        response({
          ...page,
          aggregates: { ...page.aggregates, total: 42 },
          results: [{ ...page.results[0], id: 'post:2', title: 'Second result' }],
        }),
      )
    const { container } = render(<Harness />)
    await settle()
    const header = container.querySelector('strong[aria-hidden="true"]') as HTMLElement
    expect(within(header).getAllByText('42').length).toBeGreaterThan(0)
    expect(within(header).getByText('resultsOnly')).toBeInTheDocument()
    expect(screen.getAllByText('showing').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'showMore' }))
    await settle()
    expect(screen.getByText('Current result')).toBeInTheDocument()
    expect(screen.getByText('Second result')).toBeInTheDocument()
    expect(within(header).getAllByText('42').length).toBeGreaterThan(0)
  })
})
