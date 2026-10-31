import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { resolveCardStacks } from '@/api/card-stacks.api'

const block = (fields: Record<string, unknown>) => ({
  type: 'block',
  version: 2,
  fields: { blockType: 'cardStack', ...fields },
})
const body = (...children: unknown[]) => ({ root: { type: 'root', children } })

const articles = [
  { id: 1, title: 'Foreword', slug: 'foreword', _status: 'published' },
  { id: 2, title: 'Second', slug: 'second', _status: 'published' },
  { id: 3, title: 'Third', slug: 'third', _status: 'published' },
]
const courses = [
  {
    id: 10,
    title: 'Plato',
    slug: 'plato',
    course_type: 'CORE',
    fellows: [{ name: 'Mona' }],
    summary: 'Book by book.',
    cycle: { title: 'Fall 2026, Cairo', season: 'fall' },
  },
  {
    id: 11,
    title: 'Archives',
    slug: 'archives',
    course_type: 'WORKSHOP',
    fellows: [],
    subtitle: 'Reading the files.',
    cycle: { title: 'Fall 2026, Cairo', season: 'fall' },
    cover_image: { url: '/media/a.jpg', alt: 'Files' },
  },
]

const payload = {
  findByID: vi.fn(async () => ({ id: 7, title: 'Bridge Papers', articles: [1, 3, 2] })),
  find: vi.fn(
    async ({
      collection,
      where,
    }: {
      collection: string
      where: { and: Array<Record<string, { in?: number[] }>> }
    }) => {
      const ids = where.and[0]!.id?.in
      if (collection === 'articles') return { docs: articles.filter((a) => ids!.includes(a.id)) }
      return { docs: ids ? courses.filter((c) => ids.includes(c.id)) : courses }
    },
  ),
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
  articleCard: (a: { id: number; title: string }) => ({
    id: String(a.id),
    href: `/en/articles/${a.title}`,
    title: a.title,
    excerpt: '',
    category: 'Bridge Papers',
    date: '2026-01-01',
    dateLabel: '2026',
    readTime: 3,
    readTimeLabel: '3 min',
    author: { name: 'Mona' },
  }),
  labels: {
    collection: (t: string) => `The essays of ${t}`,
    articles: 'Related articles',
    courses: 'Courses',
    courseType: (type: string) => ({ CORE: 'Core Course', WORKSHOP: 'Workshop' })[type] ?? type,
  },
}

describe('resolveCardStacks', () => {
  it('fills a collection’s stack in its order, without the open article', async () => {
    const stacks = await resolveCardStacks(
      payload,
      body(block({ id: 'a', source: 'publication', publication: 7 })),
      options as never,
    )
    expect(stacks.a!.label).toBe('The essays of Bridge Papers')
    expect(stacks.a!.items.map((i) => [i.name, i.stat])).toEqual([
      ['Third', '1 of 2'],
      ['Second', '2 of 2'],
    ])
  })

  it('draws chosen courses with their fellows and cycle, and uses the admin’s label', async () => {
    const stacks = await resolveCardStacks(
      payload,
      body(
        { type: 'paragraph', children: [] },
        block({ id: 'c', source: 'courses', courses: [10], label: 'This autumn' }),
      ),
      options as never,
    )
    expect(stacks.c).toEqual({
      label: 'This autumn',
      layout: 'stack',
      items: [
        {
          name: 'Plato',
          role: 'Mona',
          description: 'Book by book.',
          href: '/study/plato',
          stat: 'Fall 2026, Cairo',
        },
      ],
      posts: [],
      categories: [],
      seasons: {},
    })
  })

  it('leaves out a stack with nothing to show', async () => {
    const stacks = await resolveCardStacks(
      payload,
      body(block({ id: 'x', source: 'articles', articles: [] })),
      options as never,
    )
    expect(stacks).toEqual({})
  })

  it('draws a cycle’s courses as grid posts, with a tab for each course type', async () => {
    const stacks = await resolveCardStacks(
      payload,
      body(
        block({
          id: 'g',
          layout: 'grid',
          source: 'cycle',
          cycle: { id: 5, title: 'Fall 2026, Cairo' },
        }),
      ),
      options as never,
    )
    expect(stacks.g!.layout).toBe('grid')
    expect(stacks.g!.posts).toEqual([
      {
        id: 'plato',
        href: '/en/study/plato',
        title: 'Plato',
        excerpt: 'Book by book.',
        category: 'Core Course',
        label: 'Core Course',
        date: '',
        dateLabel: '',
        readTime: 0,
        readTimeLabel: '',
        author: { name: 'Mona' },
      },
      {
        id: 'archives',
        href: '/en/study/archives',
        title: 'Archives',
        excerpt: 'Reading the files.',
        category: 'Workshop',
        label: 'Workshop',
        date: '',
        dateLabel: '',
        readTime: 0,
        readTimeLabel: '',
        author: { name: '' },
        image: { src: '/media/a.jpg', alt: 'Files' },
      },
    ])
    expect(stacks.g!.categories).toEqual(['Core Course', 'Workshop'])
    expect(stacks.g!.seasons).toEqual({ plato: 'fall', archives: 'fall' })
  })

  it('keeps the chosen order in a grid, and shows no tabs for one course type', async () => {
    const ordered = await resolveCardStacks(
      payload,
      body(block({ id: 'g', layout: 'grid', source: 'courses', courses: [11, 10] })),
      options as never,
    )
    expect(ordered.g!.posts.map((p) => p.id)).toEqual(['archives', 'plato'])
    const single = await resolveCardStacks(
      payload,
      body(block({ id: 'g', layout: 'grid', source: 'courses', courses: [10] })),
      options as never,
    )
    expect(single.g!.categories).toEqual([])
  })

  it('draws chosen articles as grid posts without tabs', async () => {
    const stacks = await resolveCardStacks(
      payload,
      body(block({ id: 'g', layout: 'grid', source: 'articles', articles: [3, 2] })),
      options as never,
    )
    expect(stacks.g!.posts.map((p) => p.title)).toEqual(['Third', 'Second'])
    expect(stacks.g!.categories).toEqual([])
  })

  it('reads a block from before the layout field as a stack', async () => {
    const stacks = await resolveCardStacks(
      payload,
      body(block({ id: 's', source: 'articles', articles: [2] })),
      options as never,
    )
    expect(stacks.s!.layout).toBe('stack')
    expect(stacks.s!.posts).toEqual([])
  })
})
