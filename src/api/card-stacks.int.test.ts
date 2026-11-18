import { readFile } from 'node:fs/promises'

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resolveCardStacks } from '@/api/card-stacks.api'
import config from '@/payload.config'
import type { Article, Course, Media } from '@/payload-types'

import { createTracker, uniq } from '../../testing/payload.fixture'

const block = (fields: Record<string, unknown>) => ({
  type: 'block',
  version: 2,
  fields: { blockType: 'cardStack', ...fields },
})
const body = (...children: unknown[]) => ({ root: { type: 'root', children } })

let payload: Payload
const { track, cleanup } = createTracker()

let first: Article
let second: Article
let third: Article
let archives: Course
let plato: Course
let publication: number
let cycle: { id: number; title: string; season: string }
let cover: Media

const person = async (name: string) =>
  track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name, slug: uniq(name.toLowerCase().replace(/\W+/g, '-')) },
      overrideAccess: true,
    }),
  ).id

const article = async (title: string, author: number) =>
  track(
    'articles',
    await payload.create({
      collection: 'articles',
      data: {
        title,
        slug: uniq(title.toLowerCase()),
        authors: [author],
        tier: 'public',
        review: { status: 'approved' },
      },
      overrideAccess: true,
    }),
  )

const course = async (data: Record<string, unknown>) =>
  track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        tier: 'public',
        cycle: cycle.id,
        registration: { mode: 'closed' },
        _status: 'published',
        ...data,
      } as never,
      depth: 1,
      overrideAccess: true,
    }),
  )

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const author = await person('Card stack author')
  const fellow = await person('Mona')
  first = await article('Foreword', author)
  second = await article('Second', author)
  third = await article('Third', author)
  publication = track(
    'publications',
    await payload.create({
      collection: 'publications',
      data: {
        kind: 'other',
        title: 'Bridge Papers',
        slug: uniq('bridge-papers'),
        articles: [first.id, third.id, second.id],
        _status: 'published',
      },
      overrideAccess: true,
    }),
  ).id
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Card stack place', slug: uniq('card-stack-place'), city: uniq('Probe') },
      overrideAccess: true,
    }),
  ).id
  const made = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2037, place, start_date: '2037-10-04' },
      overrideAccess: true,
    }),
  )
  cycle = { id: made.id, title: made.title as string, season: made.season }
  const data = await readFile(new URL('../../testing/files/pixel.png', import.meta.url))
  cover = track(
    'media',
    await payload.create({
      collection: 'media',
      data: { alt: 'Files' },
      file: { name: `${uniq('cover')}.png`, mimetype: 'image/png', data, size: data.length },
      overrideAccess: true,
    }),
  )
  plato = await course({
    title: 'Plato',
    slug: uniq('plato'),
    course_type: 'CORE',
    fellows: [fellow],
    subtitle: 'Book by book.',
  })
  archives = await course({
    title: 'Archives',
    slug: uniq('archives'),
    course_type: 'WORKSHOP',
    fellows: [],
    subtitle: 'Reading the files.',
    cover_image: cover.id,
  })
})

afterAll(async () => {
  await cleanup(payload)
})

const options = {
  locale: 'en' as const,
  user: null,
  get current() {
    return first.id
  },
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
      body(block({ id: 'a', source: 'publication', publication })),
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
        block({ id: 'c', source: 'courses', courses: [plato.id], label: 'This autumn' }),
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
          href: `/study/${plato.slug}`,
          stat: cycle.title,
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
          cycle: { id: cycle.id, title: cycle.title },
        }),
      ),
      options as never,
    )
    expect(stacks.g!.layout).toBe('grid')
    expect(stacks.g!.posts).toEqual([
      {
        id: archives.slug,
        href: `/en/study/${archives.slug}`,
        title: 'Archives',
        excerpt: 'Reading the files.',
        category: 'Workshop',
        label: 'Workshop',
        date: '',
        dateLabel: '',
        readTime: 0,
        readTimeLabel: '',
        author: { name: '' },
        image: { src: cover.url, alt: 'Files', focalX: cover.focalX, focalY: cover.focalY },
      },
      {
        id: plato.slug,
        href: `/en/study/${plato.slug}`,
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
    ])
    expect(stacks.g!.categories).toEqual(['Core Course', 'Workshop'])
    expect(stacks.g!.seasons).toEqual({ [plato.slug!]: 'fall', [archives.slug!]: 'fall' })
  })

  it('keeps the chosen order in a grid, and shows no tabs for one course type', async () => {
    const ordered = await resolveCardStacks(
      payload,
      body(block({ id: 'g', layout: 'grid', source: 'courses', courses: [archives.id, plato.id] })),
      options as never,
    )
    expect(ordered.g!.posts.map((p) => p.id)).toEqual([archives.slug, plato.slug])
    const single = await resolveCardStacks(
      payload,
      body(block({ id: 'g', layout: 'grid', source: 'courses', courses: [plato.id] })),
      options as never,
    )
    expect(single.g!.categories).toEqual([])
  })

  it('draws chosen articles as grid posts without tabs', async () => {
    const stacks = await resolveCardStacks(
      payload,
      body(block({ id: 'g', layout: 'grid', source: 'articles', articles: [third.id, second.id] })),
      options as never,
    )
    expect(stacks.g!.posts.map((p) => p.title)).toEqual(['Third', 'Second'])
    expect(stacks.g!.categories).toEqual([])
  })

  it('reads a block from before the layout field as a stack', async () => {
    const stacks = await resolveCardStacks(
      payload,
      body(block({ id: 's', source: 'articles', articles: [second.id] })),
      options as never,
    )
    expect(stacks.s!.layout).toBe('stack')
    expect(stacks.s!.posts).toEqual([])
  })
})
