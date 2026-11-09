import { describe, expect, it, vi } from 'vitest'

import { COMMUNITY_KEY_SECONDS, communitySearchKey } from '@/lib/community-search'
import { COMMUNITY_INDEX } from '@/lib/search-config'
import { withCommunity, type SearchHit } from '@/lib/search-rows'
import { accessFor, createHooks } from '@/plugins/typesense'
import { toSearchDocument } from '@/plugins/typesense/documents'
import type { Indexer } from '@/plugins/typesense/indexer'
import { fieldsOf, physicalNameOf } from '@/plugins/typesense/schema'

const PUBLIC_KEY_COLLECTIONS = /^(courses|articles|people)(_[0-9a-f]{8})?$/

describe('community index', () => {
  it('has the articles schema under a name the public key does not cover', () => {
    const physical = physicalNameOf(COMMUNITY_INDEX)
    expect(physical).toMatch(/^community_articles_[0-9a-f]{8}$/)
    expect(physical.slice(-8)).toBe(physicalNameOf('articles').slice(-8))
    expect(fieldsOf('articles').length).toBeGreaterThan(0)
    expect(PUBLIC_KEY_COLLECTIONS.test(COMMUNITY_INDEX)).toBe(false)
    expect(PUBLIC_KEY_COLLECTIONS.test(physical)).toBe(false)
  })

  it('reads only published community articles', () => {
    const access = accessFor(COMMUNITY_INDEX, { id: { in: ['1'] } })
    expect(access.where).toEqual({
      and: [
        { tier: { equals: 'community' } },
        { _status: { equals: 'published' } },
        { id: { in: ['1'] } },
      ],
    })
  })

  it('keeps the public index on the anonymous read rules', () => {
    expect(accessFor('articles')).toMatchObject({ overrideAccess: false })
    expect(accessFor('articles')).not.toHaveProperty('where')
  })

  it('leaves hidden people out of a row', () => {
    const doc = {
      id: 1,
      title: 'A title',
      slug: 'a',
      authors: [
        { id: 2, name: 'Shown', visible: true },
        { id: 3, name: 'Hidden', visible: false },
      ],
    }
    const row = toSearchDocument('articles', { en: doc, ar: {} })
    expect(row?.contributors).toContain('Shown')
    expect(row?.contributors).not.toContain('Hidden')
  })
})

describe('keeping the indexes correct', () => {
  const save = (live: { public: boolean; community: boolean }) => {
    const article = { id: 7, title: 'A title', slug: 'a' }
    const find = vi.fn(async ({ overrideAccess }: { overrideAccess: boolean }) => {
      const held = overrideAccess ? live.community : live.public
      return { docs: held ? [article] : [], hasNextPage: false }
    })
    const indexer = {
      upsert: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    } as unknown as Indexer
    const req = { payload: { find, logger: { error: vi.fn() } }, transactionID: undefined }
    const hook = createHooks(indexer).afterChange('articles')
    return { indexer, run: () => hook({ doc: article, previousDoc: {}, req } as never) }
  }
  const ids = (documents: Array<{ id: string }>) => documents.map((document) => document.id)

  it('moves an article to the community index when its tier changes', async () => {
    const { indexer, run } = save({ public: false, community: true })
    await run()
    expect(indexer.remove).toHaveBeenCalledWith('articles', ['7'])
    const upserted = vi.mocked(indexer.upsert).mock.calls.find(([i]) => i === COMMUNITY_INDEX)
    expect(ids(upserted?.[1] ?? [])).toEqual(['7'])
    expect(indexer.remove).toHaveBeenCalledWith(COMMUNITY_INDEX, [])
  })

  it('moves an article back to the public index', async () => {
    const { indexer, run } = save({ public: true, community: false })
    await run()
    expect(indexer.remove).toHaveBeenCalledWith(COMMUNITY_INDEX, ['7'])
    expect(indexer.remove).toHaveBeenCalledWith('articles', [])
  })

  it('takes an unpublished article out of both', async () => {
    const { indexer, run } = save({ public: false, community: false })
    await run()
    expect(indexer.remove).toHaveBeenCalledWith('articles', ['7'])
    expect(indexer.remove).toHaveBeenCalledWith(COMMUNITY_INDEX, ['7'])
  })
})

describe('the signed-in search key', () => {
  it('carries its own end time', () => {
    const now = Date.UTC(2026, 10, 9)
    const { key, expiresIn } = communitySearchKey('parent-search-key', now)
    expect(expiresIn).toBe(COMMUNITY_KEY_SECONDS)
    const decoded = Buffer.from(key, 'base64').toString('utf8')
    expect(decoded).toContain(`"expires_at":${now / 1000 + COMMUNITY_KEY_SECONDS}`)
    expect(decoded).not.toContain('parent-search-key')
  })
})

describe('results for a signed-in reader', () => {
  const hit = (objectID: string): SearchHit => ({ objectID })

  it('alternates both lists and adds their totals', () => {
    const merged = withCommunity(
      { hits: [hit('p1'), hit('p2')], found: 5 },
      { hits: [hit('c1')], found: 1 },
    )
    expect(merged?.hits.map((entry) => entry.objectID)).toEqual(['p1', 'c1', 'p2'])
    expect(merged?.found).toBe(6)
  })

  it('leaves the public list alone without community results', () => {
    const articles = { hits: [hit('p1')], found: 1 }
    expect(withCommunity(articles, undefined)).toBe(articles)
  })
})
