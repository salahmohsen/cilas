import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { resolveRichTextReferences } from '@/lib/resolve-rich-text-references'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { createTracker, uniq } from '../../testing/payload.fixture'

let payload: Payload
const { track, cleanup } = createTracker()
let published: { id: number; slug: string }
let draft: { id: number }

const text = (value: string) => ({
  type: 'text',
  version: 1,
  text: value,
  format: 0,
  mode: 'normal',
  detail: 0,
  style: '',
})
const paragraph = (children: unknown[]) => ({
  type: 'paragraph',
  version: 1,
  children,
  format: '',
  direction: null,
  indent: 0,
})
const doc = (children: unknown[]) => ({
  root: { type: 'root', version: 1, children, format: '', direction: null, indent: 0 },
})
const mention = (id: number) => ({
  type: 'inlineBlock',
  version: 1,
  fields: { blockType: 'mention', id: 'm', label: 'Read Plato', type: 'article', article: id },
})
const related = (id: number) => ({
  type: 'block',
  version: 2,
  fields: { blockType: 'relatedContent', document: { relationTo: 'articles', value: id } },
})
const columns = (id: number) => ({
  type: 'block',
  version: 2,
  fields: {
    blockType: 'columns',
    columnCount: '2',
    first: doc([paragraph([text('First '), mention(id)])]),
    second: doc([paragraph([text('Second')])]),
  },
})
const internalLink = (id: number) => ({
  type: 'link',
  version: 3,
  fields: { linkType: 'internal', doc: { relationTo: 'articles', value: id } },
  children: [text('Original article')],
})

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const author = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name: 'Reference author', slug: uniq('reference-author'), visible: true },
      overrideAccess: true,
    }),
  ).id
  const slug = uniq('reference-published')
  published = {
    id: track(
      'articles',
      await payload.create({
        collection: 'articles',
        data: {
          title: 'Plato',
          slug,
          authors: [author],
          tier: 'public',
          review: { status: 'approved' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    ).id,
    slug,
  }
  draft = {
    id: track(
      'articles',
      await payload.create({
        collection: 'articles',
        draft: true,
        data: { title: 'Secret', slug: uniq('reference-draft'), authors: [author], tier: 'public' },
        overrideAccess: true,
      }),
    ).id,
  }
})

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('reference authorization', () => {
  it('batches nested mentions, cards and links and rechecks supplied documents', async () => {
    const find = vi.spyOn(payload, 'find')
    const resolved = await resolveRichTextReferences(
      payload,
      [
        doc([
          columns(published.id),
          related(published.id),
          paragraph([internalLink(published.id)]),
        ]),
      ],
      { locale: 'en' },
    )
    const articleReads = find.mock.calls.filter(([query]) => query.collection === 'articles')
    expect(articleReads).toHaveLength(1)
    expect(articleReads[0]![0]).toMatchObject({
      overrideAccess: false,
      user: null,
      draft: false,
      where: { id: { in: [published.id] } },
    })
    expect(resolved[`articles:${published.id}`]?.href).toBe(`/articles/${published.slug}`)
    find.mockRestore()
  })

  it('omits a draft even when the query returns it', async () => {
    const admin = { id: -1, roles: ['admin'], collection: 'users' } as unknown as User
    const found = await payload.find({
      collection: 'articles',
      where: { id: { equals: draft.id } },
      draft: false,
      user: admin,
      overrideAccess: false,
      depth: 0,
    })
    expect(found.docs.map((article) => article.id)).toEqual([draft.id])
    expect(
      await resolveRichTextReferences(payload, doc([related(draft.id)]), {
        locale: 'en',
        user: admin,
      }),
    ).toEqual({})
  })
})
