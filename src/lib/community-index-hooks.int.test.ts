import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { COMMUNITY_INDEX } from '@/lib/search-config'
import config from '@/payload.config'
import { createHooks } from '@/plugins/typesense'
import type { Indexer } from '@/plugins/typesense/indexer'

import { createTracker, uniq } from '../../testing/payload.fixture'

let payload: Payload
const { track, cleanup } = createTracker()
let author: number

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  author = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name: 'Index author', slug: uniq('index-author') },
      overrideAccess: true,
    }),
  ).id
})

afterAll(() => cleanup(payload))

describe('keeping the indexes correct', () => {
  let saves = 0
  const save = async (state: { tier: 'public' | 'community'; published: boolean }) => {
    saves += 1
    const article = track(
      'articles',
      await payload.create({
        collection: 'articles',
        data: {
          title: 'Index probe',
          slug: uniq(`index-probe-${saves}`),
          authors: [author],
          tier: state.tier,
          review: { status: state.published ? 'approved' : 'draft' },
          _status: state.published ? 'published' : 'draft',
        },
        draft: !state.published,
        overrideAccess: true,
      }),
    )
    const upserts = new Map<string, string[]>()
    const removes = new Map<string, string[]>()
    const written = Promise.withResolvers<void>()
    const writes = {
      upsert: async (index: string, documents: Array<{ id: string }>) => {
        upserts.set(
          index,
          documents.map((document) => document.id),
        )
      },
      remove: async (index: string, ids: readonly string[]) => {
        removes.set(index, [...ids])
        if (removes.size === 2) written.resolve()
      },
    }
    const req = await createLocalReq({}, payload)
    const hook = createHooks(writes as unknown as Indexer).afterChange('articles')
    await hook({ doc: article, previousDoc: {}, req } as never)
    await written.promise
    return { upserts, removes, id: String(article.id) }
  }

  it('moves an article to the community index when its tier changes', async () => {
    const { upserts, removes, id } = await save({ tier: 'community', published: true })
    expect(removes.get('articles')).toEqual([id])
    expect(upserts.get(COMMUNITY_INDEX)).toEqual([id])
    expect(removes.get(COMMUNITY_INDEX)).toEqual([])
  })

  it('moves an article back to the public index', async () => {
    const { upserts, removes, id } = await save({ tier: 'public', published: true })
    expect(removes.get(COMMUNITY_INDEX)).toEqual([id])
    expect(removes.get('articles')).toEqual([])
    expect(upserts.get('articles')).toEqual([id])
  })

  it('takes an unpublished article out of both', async () => {
    const { removes, id } = await save({ tier: 'community', published: false })
    expect(removes.get('articles')).toEqual([id])
    expect(removes.get(COMMUNITY_INDEX)).toEqual([id])
  })
})
