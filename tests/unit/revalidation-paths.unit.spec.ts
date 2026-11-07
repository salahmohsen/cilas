import { describe, expect, it } from 'vitest'

import { revalidationOf } from '@/lib/paths'

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

  it('only drops the tag for a collection without pages', () => {
    expect(revalidationOf('cycles', LOCALES, { slug: 'x' })).toEqual({ paths: [], tag: true })
  })
})
