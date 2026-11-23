import { describe, expect, it } from 'vitest'

import { PUBLIC_LAYOUT_PATTERNS, revalidationOf } from '@/lib/paths'

const LOCALES = ['en', 'ar']

describe('revalidationOf', () => {
  it('lists a person page in each language', () => {
    expect(revalidationOf('people', LOCALES, { slug: 'amal' }).paths).toEqual([
      '/en/people/amal',
      '/ar/people/amal',
    ])
  })

  it('adds the previous slug when it changed, once when it did not', () => {
    expect(revalidationOf('people', LOCALES, { slug: 'new' }, { slug: 'old' }).paths).toEqual([
      '/en/people/new',
      '/en/people/old',
      '/ar/people/new',
      '/ar/people/old',
    ])
    expect(revalidationOf('people', LOCALES, { slug: 'a' }, { slug: 'a' }).paths).toHaveLength(2)
  })

  it('skips a person without a slug', () => {
    expect(revalidationOf('people', LOCALES, { slug: null }).paths).toEqual([])
  })

  it('adds the list pages and the sitemap to an event', () => {
    const { paths, tag } = revalidationOf('events', LOCALES, { slug: 'talk' })
    expect(paths).toContain('/sitemap.xml')
    expect(paths).toContain('/ar/calendar')
    expect(paths).toContain('/en/events/talk')
    expect(tag).toBe(true)
  })

  it('drops both article slugs, listings, related cards and text exports', () => {
    const { paths, layouts } = revalidationOf('articles', LOCALES, { slug: 'new' }, { slug: 'old' })
    expect(paths).toEqual([
      '/sitemap.xml',
      '/llms.txt',
      '/llms-full.txt',
      '/en',
      '/en/articles',
      '/en/articles/new',
      '/en/articles/old',
      '/ar',
      '/ar/articles',
      '/ar/articles/new',
      '/ar/articles/old',
    ])
    expect(layouts).toEqual([PUBLIC_LAYOUT_PATTERNS.article])
  })

  it('drops pages that show programmes and their registration information', () => {
    const { paths, layouts } = revalidationOf('programmes', LOCALES, {})
    expect(paths).toEqual([
      '/sitemap.xml',
      '/en',
      '/en/apply',
      '/en/study/bridge',
      '/en/study/bridge/apply',
      '/ar',
      '/ar/apply',
      '/ar/study/bridge',
      '/ar/study/bridge/apply',
    ])
    expect(layouts).toEqual([])
  })

  it('drops pages that render information from forms', () => {
    const { paths, layouts } = revalidationOf('forms', LOCALES, {})
    expect(paths).toEqual([
      '/en',
      '/en/contact',
      '/en/study/bridge/apply',
      '/ar',
      '/ar/contact',
      '/ar/study/bridge/apply',
    ])
    expect(layouts).toEqual([])
  })

  it('only drops the tag for a collection without pages', () => {
    expect(revalidationOf('cycles', LOCALES, { slug: 'x' })).toEqual({
      paths: [],
      layouts: [],
      tag: true,
    })
  })
})
