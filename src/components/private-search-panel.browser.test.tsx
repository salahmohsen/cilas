import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { SearchPanel } from '@/components/site-search-panel'
import { announceAuthChange } from '@/lib/auth-events'
import { mockNetwork } from '../../testing/msw-browser.test-utils'
import { IntlProvider, messagesOf } from '../../testing/intl.test-utils'
import { renderWithNavigation } from '../../testing/navigation.test-utils'

const t = messagesOf.en.Search

type Space = { id: number; label: string; href: string }
const accessible = { id: 1, label: 'Accessible', href: '/en/spaces/community/1' } satisfies Space

let account: number | null = 1
let spaces: Space[] = [accessible]
const privateQueries: string[] = []
const publicQueries: string[] = []
let privateSeen: (query: string) => void = () => {}
let publicSeen: (query: string) => void = () => {}

mockNetwork(
  http.post('/api/community-search-key', () => HttpResponse.json({ key: null })),
  http.post('/api/spaces-search', async ({ request }) => {
    const body = (await request.json()) as { options?: boolean; query?: string }
    if (account === null) return new HttpResponse(null, { status: 401 })
    if (body.options) return HttpResponse.json({ account, spaces })
    privateQueries.push(body.query ?? '')
    privateSeen(body.query ?? '')
    return HttpResponse.json({
      account,
      spaces,
      results: [],
      hasMore: false,
      incomplete: false,
      aggregates: { total: 27, facets: [{ id: 1, found: 27 }] },
    })
  }),
  http.post(/\/multi_search/, async ({ request }) => {
    const { searches } = (await request.json()) as { searches: { q?: string }[] }
    for (const search of searches) {
      publicQueries.push(search.q ?? '')
      publicSeen(search.q ?? '')
    }
    return HttpResponse.json({
      results: searches.map(() => ({
        found: 0,
        hits: [],
        out_of: 0,
        page: 1,
        search_time_ms: 1,
        request_params: { q: '' },
        facet_counts: [],
      })),
    })
  }),
)

afterEach(() => {
  cleanup()
  account = 1
  spaces = [accessible]
  privateQueries.length = 0
  publicQueries.length = 0
})

const open = () =>
  renderWithNavigation(
    <IntlProvider>
      <SearchPanel onClose={() => {}} />
    </IntlProvider>,
    { url: '/en' },
  )

const arrival = (watch: (resolve: (query: string) => void) => void, wanted: string) =>
  new Promise<void>((resolve) =>
    watch((query) => {
      if (query === wanted) resolve()
    }),
  )

const privateScope = async () => {
  fireEvent.click(await screen.findByText(t.privateSpaces))
  return screen.findByRole('checkbox', { name: 'Accessible' })
}

const authChanged = () => act(async () => announceAuthChange())

describe('private search scope routing', () => {
  it('keeps a hidden space only for the same freshly authorized account', async () => {
    open()
    const facet = await privateScope()
    expect(facet).toBeChecked()
    fireEvent.click(facet)
    await waitFor(() => expect(facet).not.toBeChecked())
    await authChanged()
    expect(await screen.findByRole('checkbox', { name: 'Accessible' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(screen.getByRole('checkbox', { name: 'Accessible' })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Accessible' }))
    account = 2
    await authChanged()
    expect(await screen.findByRole('checkbox', { name: 'Accessible' })).toBeChecked()
  })

  it('feeds validated private counts into the filters, drops them when the question changes, and clears them when permissions go', async () => {
    open()
    await privateScope()
    expect((await screen.findAllByText('27')).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'another query' } })
    expect(screen.queryAllByText('27')).toEqual([])
    expect((await screen.findAllByText('27')).length).toBeGreaterThan(0)
    account = null
    await authChanged()
    expect(await screen.findByText(t.privateUnavailable)).toBeInTheDocument()
    expect(screen.queryAllByText('27')).toEqual([])
  })

  it('never forwards a private query to the public adapter when permissions disappear', async () => {
    open()
    await privateScope()
    const searched = arrival((resolve) => (privateSeen = resolve), 'private needle')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'private needle' } })
    await searched
    account = null
    await authChanged()
    expect(await screen.findByText(t.privateUnavailable)).toBeInTheDocument()
    fireEvent.click(screen.getByText(t.publicSearch))
    const forwarded = arrival((resolve) => (publicSeen = resolve), 'public needle')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'public needle' } })
    await forwarded
    expect(publicQueries).not.toContain('private needle')
  })
})
