import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { resolveCardStacks } from '@/api/card-stacks.api'

const block = (fields: Record<string, unknown>) => ({ type: 'block', version: 2, fields: { blockType: 'cardStack', ...fields } })
const body = (...children: unknown[]) => ({ root: { type: 'root', children } })

const articles = [
  { id: 1, title: 'Foreword', slug: 'foreword', _status: 'published' },
  { id: 2, title: 'Second', slug: 'second', _status: 'published' },
  { id: 3, title: 'Third', slug: 'third', _status: 'published' },
]
const courses = [
  { id: 10, title: 'Plato', slug: 'plato', fellows: [{ name: 'Mona' }], summary: 'Book by book.', cycle: { title: 'Fall 2026, Cairo' } },
]

const payload = {
  findByID: vi.fn(async () => ({ id: 7, title: 'Bridge Papers', articles: [1, 3, 2] })),
  find: vi.fn(async ({ collection, where }: { collection: string; where: { and: Array<Record<string, { in?: number[] }>> } }) => {
    if (collection === 'articles') {
      const ids = where.and[0]!.id!.in!
      return { docs: articles.filter((a) => ids.includes(a.id)) }
    }
    return { docs: courses }
  }),
} as unknown as Payload

const options = {
  locale: 'en' as const,
  user: null,
  current: 1,
  articleItem: (a: { title: string }, i: number, total: number) => ({
    name: a.title,
    role: '',
    description: '',
    href: `/articles/${a.title}`,
    stat: `${i + 1} of ${total}`,
  }),
  labels: { collection: (t: string) => `The essays of ${t}`, articles: 'Related articles', courses: 'Courses' },
}

describe('resolveCardStacks', () => {
  it('fills a collection’s stack in its order, without the open article', async () => {
    const stacks = await resolveCardStacks(payload, body(block({ id: 'a', source: 'publication', publication: 7 })), options as never)
    expect(stacks.a!.label).toBe('The essays of Bridge Papers')
    expect(stacks.a!.items.map((i) => [i.name, i.stat])).toEqual([
      ['Third', '1 of 2'],
      ['Second', '2 of 2'],
    ])
  })

  it('draws chosen courses with their fellows and cycle, and uses the admin’s label', async () => {
    const stacks = await resolveCardStacks(
      payload,
      body({ type: 'paragraph', children: [] }, block({ id: 'c', source: 'courses', courses: [10], label: 'This autumn' })),
      options as never,
    )
    expect(stacks.c).toEqual({
      label: 'This autumn',
      items: [{ name: 'Plato', role: 'Mona', description: 'Book by book.', href: '/study/plato', stat: 'Fall 2026, Cairo' }],
    })
  })

  it('leaves out a stack with nothing to show', async () => {
    const stacks = await resolveCardStacks(payload, body(block({ id: 'x', source: 'articles', articles: [] })), options as never)
    expect(stacks).toEqual({})
  })
})
