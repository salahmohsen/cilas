import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { PUBLIC_LAYOUT_PATTERNS } from '@/lib/paths'

import { runInRequest } from '../../testing/next-request.test-utils'
import { createTracker, uniq } from '../../testing/payload.fixture'

let payload: Payload
let authorId: number
const { track, cleanup } = createTracker()

beforeAll(async () => {
  payload = await getPayload({ config })
  const author = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name: 'Cache test author', slug: uniq('cache-test-author') },
    }),
  )
  authorId = author.id
})

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

const createArticle = async (key: string, draft = false) =>
  track(
    'articles',
    await payload.create({
      collection: 'articles',
      draft: draft ? true : undefined,
      data: {
        title: 'Cache test article',
        slug: uniq(key),
        authors: [authorId],
        tier: 'public',
        review: { status: draft ? 'draft' : 'approved' },
        _status: draft ? 'draft' : 'published',
      },
    }),
  )

const articleTags = (slug: string | null | undefined) => [
  '_N_T_/sitemap.xml',
  '_N_T_/llms.txt',
  '_N_T_/llms-full.txt',
  '_N_T_/en',
  '_N_T_/en/articles',
  `_N_T_/en/articles/${slug}`,
  '_N_T_/ar',
  '_N_T_/ar/articles',
  `_N_T_/ar/articles/${slug}`,
  `_N_T_${PUBLIC_LAYOUT_PATTERNS.article}/layout`,
]

describe('public cache invalidation', () => {
  it('keeps public caches when a new draft is saved', async () => {
    const { result, revalidated } = await runInRequest(() => createArticle('cache-new-draft', true))
    expect(result._status).toBe('draft')
    expect(revalidated).toEqual([])
  })

  it.each([
    ['draft save', false],
    ['autosave', true],
  ] as const)('keeps public caches on a %s of a published article', async (name, autosave) => {
    const { id } = await createArticle(autosave ? 'cache-autosave' : 'cache-draft-save')
    const title = `New title after ${name}`
    const { result, revalidated } = await runInRequest(() =>
      payload.update({ collection: 'articles', id, draft: true, autosave, data: { title } }),
    )
    expect(result.title).toBe(title)
    expect(await payload.findByID({ collection: 'articles', id })).toMatchObject({
      title: 'Cache test article',
      _status: 'published',
    })
    expect(revalidated).toEqual([])
  })

  it('invalidates article caches when a draft is published', async () => {
    const { id, slug } = await createArticle('cache-publish', true)
    const { result, revalidated } = await runInRequest(() =>
      payload.update({
        collection: 'articles',
        id,
        draft: true,
        data: { _status: 'published' },
      }),
    )
    expect(result._status).toBe('published')
    expect(revalidated).toEqual(articleTags(slug))
  })

  it('invalidates article caches when the article is unpublished', async () => {
    const { id, slug } = await createArticle('cache-unpublish')
    const { result, revalidated } = await runInRequest(() =>
      payload.update({ collection: 'articles', id, data: { _status: 'draft' } }),
    )
    expect(result._status).toBe('draft')
    expect(revalidated).toEqual(articleTags(slug))
  })

  it('invalidates article caches when the public article tier changes', async () => {
    const { id, slug } = await createArticle('cache-tier')
    const { result, revalidated } = await runInRequest(() =>
      payload.update({ collection: 'articles', id, data: { tier: 'community' } }),
    )
    expect(result.tier).toBe('community')
    expect(revalidated).toEqual(articleTags(slug))
  })

  it('invalidates article caches when the article is deleted', async () => {
    const { id, slug } = await createArticle('cache-delete')
    const { revalidated } = await runInRequest(() => payload.delete({ collection: 'articles', id }))
    expect(revalidated).toEqual(articleTags(slug))
  })

  it('invalidates Bridge routes only when the programme write updates the public copy', async () => {
    const { id } = track(
      'programmes',
      await payload.create({
        collection: 'programmes',
        data: {
          title: 'Cache test programme',
          slug: uniq('cache-programme'),
          kind: 'bridge',
          _status: 'published',
        },
      }),
    )
    const update = (draft: boolean) =>
      runInRequest(() =>
        payload.update({
          collection: 'programmes',
          id,
          draft,
          data: { title: 'Updated programme' },
        }),
      )

    expect((await update(true)).revalidated).toEqual([])
    expect((await update(false)).revalidated).toEqual([
      '_N_T_/sitemap.xml',
      '_N_T_/en',
      '_N_T_/en/apply',
      '_N_T_/en/study/bridge',
      '_N_T_/en/study/bridge/apply',
      '_N_T_/ar',
      '_N_T_/ar/apply',
      '_N_T_/ar/study/bridge',
      '_N_T_/ar/study/bridge/apply',
    ])
  })
})
