import { describe, expect, it } from 'vitest'

import { adminCreateHref, documentHref } from './document-href'

const collections = ['articles', 'courses', 'publications'] as const
const viewers = ['owner', 'admin', 'fellow'] as const
const waiting = [true, false] as const
const locales = ['en', 'ar'] as const

const rows = collections.flatMap((collection) =>
  viewers.flatMap((viewer) =>
    waiting.flatMap((wait) => locales.map((locale) => [collection, viewer, wait, locale] as const)),
  ),
)

describe('documentHref', () => {
  it.each(rows)(
    'documentHref gives the admin URL for %s, %s, waiting %s, %s',
    (collection, viewer, wait, locale) => {
      expect(documentHref({ collection, id: 42, viewer, waiting: wait, locale })).toBe(
        `/admin/collections/${collection}/42`,
      )
    },
  )
})

describe('adminCreateHref', () => {
  it.each(collections)('adminCreateHref gives the create page for %s', (collection) => {
    expect(adminCreateHref(collection)).toBe(`/admin/collections/${collection}/create`)
  })
})
