import { describe, expect, it } from 'vitest'

import { personPagePaths } from '@/lib/revalidate-people'

describe('personPagePaths', () => {
  it('lists the page in each language', () => {
    expect(personPagePaths({ slug: 'amal' })).toEqual(['/en/people/amal', '/ar/people/amal'])
  })

  it('adds the previous slug when it changed, once when it did not', () => {
    expect(personPagePaths({ slug: 'new' }, { slug: 'old' })).toEqual([
      '/en/people/new',
      '/en/people/old',
      '/ar/people/new',
      '/ar/people/old',
    ])
    expect(personPagePaths({ slug: 'a' }, { slug: 'a' })).toHaveLength(2)
  })

  it('skips a person without a slug', () => {
    expect(personPagePaths({ slug: null })).toEqual([])
  })
})
