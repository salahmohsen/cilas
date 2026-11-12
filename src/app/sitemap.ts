import { BRIDGE_PATH } from '@/lib/paths'
import { bridgeYearPath, pathOf } from '@/lib/paths'
import config from '@payload-config'
import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'

import { getPeoplePages } from '@/api/people-pages.api'
import { listBridgeYears } from '@/api/programmes.api'
import { env } from '@/env'
import { livePeoplePages } from '@/lib/people-pages'
import { sitemapEntries, type SitePage } from '@/lib/sitemap'

// New courses and articles appear within the hour.
export const revalidate = 3600

const STATIC: SitePage[] = [
  { path: '' },
  { path: '/study' },
  { path: BRIDGE_PATH },
  { path: '/apply' },
  { path: '/articles' },
  { path: '/events' },
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
  const [courses, articles, people, years, events, peoplePages] = await Promise.all([
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
    getPeoplePages(),
  ])

  const pages = (collection: string, docs: Array<{ slug?: string | null; updatedAt?: string }>) =>
    docs.flatMap((doc) => {
      const path = pathOf(collection, doc)
      return path ? [{ path, lastModified: doc.updatedAt }] : []
    })

  return sitemapEntries(env.NEXT_PUBLIC_SERVER_URL, [
    ...STATIC,
    ...livePeoplePages(peoplePages).map(({ path }) => ({ path })),
    ...pages('courses', courses.docs),
    ...pages('articles', articles.docs),
    ...pages('people', people.docs),
    ...pages('events', events.docs),
    // The latest year is /study/bridge itself, listed above.
    ...years.slice(1).map((y) => ({ path: bridgeYearPath(y.slug) })),
  ])
}
