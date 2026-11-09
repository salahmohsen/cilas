// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'typesense'

import { communityParentKey, communitySearchKey } from '@/lib/community-search'
import { COMMUNITY_INDEX } from '@/lib/search-config'
import { createIndexer } from '@/plugins/typesense/indexer'
import { fieldsOf, physicalNameOf } from '@/plugins/typesense/schema'

const disposable =
  process.env.DATABASE_URL === 'postgres://search_test:disposable@localhost:55439/cilas_search_test'
const node = { host: '127.0.0.1', port: 18109, protocol: 'http' } as const
const clientFor = (apiKey: string) =>
  new Client({ apiKey, nodes: [node], numRetries: 0, logLevel: 'silent' })
const admin = clientFor('disposable-search-test-key')

describe.skipIf(!disposable)('community search keys against real Typesense', () => {
  const physical = physicalNameOf(COMMUNITY_INDEX)
  let publicKey: string
  let parentKey: string
  const created: number[] = []

  const search = (key: string) =>
    clientFor(key)
      .collections(COMMUNITY_INDEX)
      .documents()
      .search({ q: '*', query_by: 'title_en' })
      .then(
        (result) => ({ status: 200, found: result.found }),
        (error: { httpStatus?: number }) => ({ status: error.httpStatus ?? 0, found: 0 }),
      )

  beforeAll(async () => {
    await admin
      .collections(physical)
      .delete()
      .catch(() => undefined)
    await admin.collections().create({ name: physical, fields: fieldsOf('articles') })
    await admin.aliases().upsert(COMMUNITY_INDEX, { collection_name: physical })
    await admin.collections(physical).documents().create({
      id: '1',
      slug: 'a',
      updatedAt: 1,
      sortTitle_en: 'a',
      sortTitle_ar: 'a',
      title_en: 'Community only',
      title_ar: '',
      owner_en: '',
      owner_ar: '',
      body_en: 'text',
      body_ar: '',
    })
    const publicDoc = await admin.keys().create({
      description: 'test public',
      actions: ['documents:search'],
      collections: ['^(courses|articles|people)(_[0-9a-f]{8})?$'],
    })
    created.push(publicDoc.id)
    publicKey = publicDoc.value as string
    parentKey = communityParentKey('disposable-search-test-key')
    await createIndexer(admin).ensureCommunityKey(parentKey)
  })

  afterAll(async () => {
    for (const id of created)
      await admin
        .keys(id)
        .delete()
        .catch(() => undefined)
    await admin
      .aliases(COMMUNITY_INDEX)
      .delete()
      .catch(() => undefined)
    await admin
      .collections(physical)
      .delete()
      .catch(() => undefined)
  })

  it('registers the derived key once, for search only', async () => {
    await createIndexer(admin).ensureCommunityKey(parentKey)
    const { keys } = await admin.keys().retrieve()
    const ours = keys.filter((key) => key.description === 'CILAS community articles search')
    expect(ours).toHaveLength(1)
    expect(ours[0].actions).toEqual(['documents:search'])
    expect(ours[0].collections).toEqual(['^community_articles(_[0-9a-f]{8})?$'])
    created.push(ours[0].id)
  })

  it('refuses the public browser key', async () => {
    expect((await search(publicKey)).status).toBe(401)
  })

  it('answers a signed-in reader key', async () => {
    expect(await search(communitySearchKey(parentKey).key)).toEqual({ status: 200, found: 1 })
  })

  it('refuses an expired key', async () => {
    const hourAgo = Date.now() - 3_600_000
    expect((await search(communitySearchKey(parentKey, hourAgo).key)).status).toBe(401)
  })
})
