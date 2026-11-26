import { describe, expect, it } from 'vitest'

import { clientEnv } from '@/env.client'

import {
  adminCreateHref,
  applicantsHref,
  absoluteLink,
  documentHref,
  localizedLink,
} from './document-href'

const collections = ['articles', 'courses', 'publications'] as const
const viewers = ['owner', 'admin'] as const
const waiting = [true, false] as const

const rows = [...collections, 'users' as const].flatMap((collection) =>
  viewers.flatMap((viewer) => waiting.map((wait) => [collection, viewer, wait] as const)),
)

describe('documentHref', () => {
  it.each(rows)('gives the admin URL for %s, %s, waiting %s', (collection, viewer, wait) => {
    expect(documentHref({ collection, id: 42, viewer, waiting: wait })).toBe(
      `/admin/collections/${collection}/42`,
    )
  })
})

describe('adminCreateHref', () => {
  it.each(collections)('gives the create page for %s', (collection) => {
    expect(adminCreateHref(collection)).toBe(`/admin/collections/${collection}/create`)
  })
})

describe('applicantsHref', () => {
  it('opens an individual application', () => {
    expect(applicantsHref({ application: 4 })).toBe('/admin/applicants?application=4')
  })

  it('opens applicants for a course', () => {
    expect(applicantsHref({ course: 3 })).toBe('/admin/applicants?course=3')
  })
})

describe('localizedLink', () => {
  it.each(['en', 'ar'] as const)('prefixes a Spaces path with %s', (locale) => {
    expect(localizedLink('/spaces/review/articles/5', locale)).toBe(
      `/${locale}/spaces/review/articles/5`,
    )
  })

  it('keeps other paths and already localized links', () => {
    expect(localizedLink('/admin/collections/users/3', 'ar')).toBe('/admin/collections/users/3')
    expect(localizedLink('/spaceship', 'ar')).toBe('/spaceship')
    expect(localizedLink('/en/spaces/groups/3', 'ar')).toBe('/en/spaces/groups/3')
  })
})

describe('absoluteLink', () => {
  it('adds the site URL and joins the path with one slash', () => {
    expect(absoluteLink('/spaces?view=admin', 'ar')).toBe(
      new URL('/ar/spaces?view=admin', clientEnv.NEXT_PUBLIC_SERVER_URL).href,
    )
    expect(absoluteLink('/admin/collections/users/3', 'ar')).toBe(
      new URL('/admin/collections/users/3', clientEnv.NEXT_PUBLIC_SERVER_URL).href,
    )
  })
})

// @ts-expect-error A fellow is not a document viewer.
const invalidViewer: Parameters<typeof documentHref>[0]['viewer'] = 'fellow'
void invalidViewer
