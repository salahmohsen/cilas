// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type { Client } from 'typesense'
import type { User } from '@/payload-types'
import {
  CursorReset,
  inputSchema,
  projection,
  type SearchDocument,
  type Source,
} from '@/lib/private-search/model'
import { searchPrivate, SelectionDenied } from '@/lib/private-search/search'

const shared = vi.hoisted(() => ({
  ids: [1, 2],
  generation: 'spaces_search_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
}))
vi.mock('@/lib/private-search/generation', () => ({
  activeGeneration: async () => shared.generation,
}))
vi.mock('@/lib/spaces', () => ({
  requestReadState: async () => ({ ids: shared.ids, gated: new Map() }),
}))
const user = { id: 1, roles: ['member'], person: 1 } as User
let sources: Source[]
let documents: SearchDocument[]
let files: object[]
const find = vi.fn(async (args: { collection: string; where?: { id?: { in: number[] } } }) => {
  if (args.collection === 'spaces')
    return { docs: shared.ids.map((id) => ({ id, kind: 'community', name: `Space ${id}` })) }
  if (args.collection === 'space-posts')
    return { docs: sources.filter((row) => args.where?.id?.in.includes(row.id)) }
  if (args.collection === 'space-comments') return { docs: [] }
  if (args.collection === 'space-files') return { docs: files }
  throw new Error('Unexpected collection')
})
const search = vi.fn(async (args: { offset: number; per_page: number }) => ({
  hits: documents.slice(args.offset, args.offset + args.per_page).map((document) => ({ document })),
  // Deliberately untrusted; only validated rows may influence counts.
  found: 99999,
}))
const payload = { find } as unknown as Payload
const client = { collections: () => ({ documents: () => ({ search }) }) } as unknown as Client
const run = (extra: object = {}) =>
  searchPrivate({
    payload,
    user,
    client,
    input: inputSchema.parse({ query: 'needle', ...extra }),
    secret: 'disposable-secret',
  })

beforeEach(() => {
  shared.ids = [1, 2]
  shared.generation = 'spaces_search_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  sources = [
    { id: 1, space: 1, body: 'needle Zulu', updatedAt: '2026-10-28T00:00:00Z' },
    { id: 2, space: 2, body: 'needle Alpha', updatedAt: '2026-10-28T00:00:00Z' },
  ]
  documents = sources.map((source) => projection('post', source)!)
  files = []
  find.mockClear()
  search.mockClear()
})

describe('validated private aggregates and selections', () => {
  it('counts across readable spaces independently of selection, supports none, and rejects forged IDs', async () => {
    expect((await run({ spaces: [1] })).aggregates).toEqual({
      total: 1,
      facets: [
        { id: 1, found: 1 },
        { id: 2, found: 1 },
      ],
    })
    const none = await run({ spaces: [] })
    expect(none.results).toEqual([])
    expect(none.aggregates?.total).toBe(0)
    expect(none.aggregates?.facets.map((facet) => facet.found)).toEqual([1, 1])
    await expect(run({ spaces: [1, 3] })).rejects.toBeInstanceOf(SelectionDenied)
    expect((await run({ spaces: [2, 1, 1] })).results).toHaveLength(2)
  })

  it('excludes stale revisions, unreadable candidates and deleted threads from exact counts', async () => {
    sources[0].body = 'edited without indexing'
    documents.push(
      projection('post', {
        id: 3,
        space: 3,
        body: 'needle secret',
        updatedAt: '2026-10-28T00:00:00Z',
      })!,
    )
    const page = await run()
    expect(page.results.map((row) => row.id)).toEqual(['post:2'])
    expect(page.aggregates).toEqual({
      total: 1,
      facets: [
        { id: 1, found: 0 },
        { id: 2, found: 1 },
      ],
    })
    sources[1].deleted_at = 'today'
    expect((await run()).aggregates?.total).toBe(0)
  })

  it('keeps bounded scans and returns unknown aggregates instead of false zeroes', async () => {
    documents = Array.from({ length: 205 }, (_, index) =>
      projection('post', {
        id: index + 1000,
        space: 1,
        body: 'needle ghost',
        updatedAt: '2026-10-28T00:00:00Z',
      })!,
    )
    const page = await run()
    expect(page.results).toEqual([])
    expect(page.incomplete).toBe(true)
    expect(page.aggregates).toBeNull()
    expect(search).toHaveBeenCalledTimes(5)
  })

  it('uses browsing for short queries and globally sorts validated titles for A–Z', async () => {
    const page = await run({ query: '', sort: 'alpha' })
    expect(search.mock.calls[0][0]).toMatchObject({ q: '*' })
    expect(page.results.map((row) => row.id)).toEqual(['post:2', 'post:1'])
  })

  it('keeps exact totals larger than one page, binds selection into cursors, and pages without duplicates', async () => {
    sources = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      space: 1,
      body: `needle ${index}`,
      updatedAt: '2026-10-28T00:00:00Z',
    }))
    documents = sources.map((source) => projection('post', source)!)
    const first = await run({ spaces: [1, 2] })
    expect(first.results).toHaveLength(20)
    expect(first.aggregates?.total).toBe(25)
    const next = await run({ spaces: [2, 1], cursor: first.cursor })
    expect(next.results).toHaveLength(5)
    expect(next.results.every((row) => !first.results.some((prior) => prior.id === row.id))).toBe(
      true,
    )
    await expect(run({ spaces: [1], cursor: first.cursor })).rejects.toBeInstanceOf(CursorReset)
  })

  it('returns only authorized result-owned image routes, never raw storage URLs', async () => {
    files = [
      { id: 11, space: 2, post: 1, filename: 'wrong-space.png', mimeType: 'image/png' },
      { id: 12, space: 1, post: 99, filename: 'unrelated.png', mimeType: 'image/png' },
      {
        id: 13,
        space: 1,
        post: 1,
        filename: 'authorized image.png',
        mimeType: 'image/png',
        url: 'https://private-storage/secret',
      },
    ]
    const page = await run({ spaces: [1] })
    expect(page.results[0].image).toBe('/api/space-files/file/authorized%20image.png')
    expect(JSON.stringify(page)).not.toContain('https://private-storage')
    const mediaRead = find.mock.calls.find(([args]) => args.collection === 'space-files')![0]
    expect(mediaRead).toMatchObject({ overrideAccess: false, user })
    expect(search.mock.calls[0][0]).not.toHaveProperty('facet_by')
  })
})
