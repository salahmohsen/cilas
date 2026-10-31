import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { resolveMentions } from '@/api/mentions.api'

const mention = (fields: Record<string, unknown>) => ({
  type: 'inlineBlock',
  version: 1,
  fields: { blockType: 'mention', ...fields },
})
const body = (...children: unknown[]) => ({
  root: { type: 'root', children: [{ type: 'paragraph', children }] },
})

const docs: Record<string, Array<Record<string, unknown>>> = {
  people: [{ id: 1, name: 'Mona', slug: 'mona' }],
  courses: [
    {
      id: 10,
      title: 'Plato',
      slug: 'plato',
      _status: 'published',
      summary: 'Book by book.',
      fellows: [{ name: 'Mona' }],
      cycle: { title: 'Fall 2026' },
    },
    { id: 11, title: 'Draft', slug: 'draft', _status: 'draft' },
  ],
}

const payload = {
  find: vi.fn(
    async ({ collection, where }: { collection: string; where: { id: { in: number[] } } }) => ({
      docs: (docs[collection] ?? []).filter((d) => where.id.in.includes(d.id as number)),
    }),
  ),
} as unknown as Payload

describe('resolveMentions', () => {
  it('links what the reader may open and previews it', async () => {
    const out = await resolveMentions(
      payload,
      body(
        mention({ id: 'a', type: 'person', person: 1, label: 'Mona' }),
        mention({ id: 'b', type: 'course', course: 10, label: 'Plato' }),
      ),
      { locale: 'en', user: null },
    )
    expect(out.a).toEqual({
      href: '/people/mona',
      preview: { kind: 'person', title: 'Mona', meta: null, text: null, image: null },
    })
    expect(out.b!.href).toBe('/study/plato')
    expect(out.b!.preview.meta).toBe('Mona · Fall 2026')
  })

  it('leaves drafts and missing targets out, so they stay plain words', async () => {
    const out = await resolveMentions(
      payload,
      body(
        mention({ id: 'c', type: 'course', course: 11, label: 'Draft' }),
        mention({ id: 'd', type: 'person', person: 99, label: 'Nobody' }),
      ),
      { locale: 'en', user: null },
    )
    expect(out).toEqual({})
  })

  it('reads as the reader, without drafts', async () => {
    await resolveMentions(
      payload,
      body(mention({ id: 'e', type: 'person', person: 1, label: 'Mona' })),
      { locale: 'en', user: null },
    )
    expect(payload.find).toHaveBeenLastCalledWith(
      expect.objectContaining({ overrideAccess: false, draft: false, user: null }),
    )
  })
})
