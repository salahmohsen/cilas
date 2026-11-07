import { bridgeYearPath } from '@/lib/paths'
import config from '@payload-config'
import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'

import { listBridgeYears } from '@/api/programmes.api'
import { env } from '@/env'
import { pathOf } from '@/lib/paths'
import { sitemapEntries, type SitePage } from '@/lib/sitemap'

// New courses and articles appear within the hour.
export const revalidate = 3600

const STATIC: SitePage[] = [
  { path: '' },
  { path: '/study' },
  { path: '/study/bridge' },
  { path: '/apply' },
  { path: '/articles' },
  { path: '/events' },
  { path: '/people/fellows' },
  { path: '/people/cilasians' },
  { path: '/governance' },
  { path: '/calendar' },
  { path: '/contact' },
]

/**
 * Every public page, in English and Arabic. Documents are read as an
 * anonymous visitor (`overrideAccess: false`), so drafts, members-only
 * articles and hidden people stay out.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config })
  const anonymous = { overrideAccess: false, depth: 0, pagination: false, locale: 'en' } as const
  const [courses, articles, people, years, events] = await Promise.all([
    payload.find({
      collection: 'courses',
      where: { and: [{ tier: { equals: 'public' } }, { _status: { equals: 'published' } }] },
      select: { slug: true, updatedAt: true },
      ...anonymous,
    }),
    payload.find({
      collection: 'articles',
      where: { _status: { equals: 'published' } },
      select: { slug: true, updatedAt: true },
      ...anonymous,
    }),
    payload.find({ collection: 'people', select: { slug: true, updatedAt: true }, ...anonymous }),
    listBridgeYears(payload, 'en'),
    payload.find({
      collection: 'events',
      where: { tier: { equals: 'public' } },
      select: { slug: true, updatedAt: true },
      ...anonymous,
    }),
  ])

  const pages = (collection: string, docs: Array<{ slug?: string | null; updatedAt?: string }>) =>
    docs.flatMap((doc) => {
      const path = pathOf(collection, doc)
      return path ? [{ path, lastModified: doc.updatedAt }] : []
    })

  return sitemapEntries(env.NEXT_PUBLIC_SERVER_URL, [
    ...STATIC,
    ...pages('courses', courses.docs),
    ...pages('articles', articles.docs),
    ...pages('people', people.docs),
    ...pages('events', events.docs),
    // The latest year is /study/bridge itself, listed above.
    ...years.slice(1).map((y) => ({ path: bridgeYearPath(y.slug) })),
  ])
}
