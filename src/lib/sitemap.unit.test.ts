import { describe, expect, it } from 'vitest'

import { sitemapEntries } from '@/lib/sitemap'

describe('sitemapEntries', () => {
  it('lists each page in both languages, each naming the other', () => {
    const entries = sitemapEntries('https://ci-las.org/', [
      { path: '' },
      { path: '/study/plato', lastModified: '2026-10-01T00:00:00.000Z' },
    ])
    expect(entries.map((e) => e.url)).toEqual([
      'https://ci-las.org/en',
      'https://ci-las.org/ar',
      'https://ci-las.org/en/study/plato',
      'https://ci-las.org/ar/study/plato',
    ])
    expect(entries[3]).toEqual({
      url: 'https://ci-las.org/ar/study/plato',
      lastModified: '2026-10-01T00:00:00.000Z',
      alternates: {
        languages: {
          en: 'https://ci-las.org/en/study/plato',
          ar: 'https://ci-las.org/ar/study/plato',
          'x-default': 'https://ci-las.org/en/study/plato',
        },
      },
    })
    expect(entries[0]).not.toHaveProperty('lastModified')
  })
})
