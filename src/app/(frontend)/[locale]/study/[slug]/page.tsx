import config from '@payload-config'
import type { Metadata } from 'next'
import { getPayload } from 'payload'

import { CoursePage, courseMetadata } from './course-page'

type Params = { params: Promise<{ locale: string; slug: string }> }

// Registration open/closed is computed from today's date, so rebuild hourly.
export const revalidate = 3600

/**
 * Pre-renders every public course at build time. The route stays dynamic
 * (`dynamicParams`) so a course published after the build is still reachable
 * without a redeploy. A signed-in reader gets the uncached page instead
 * (src/proxy.ts), which also shows `community` courses.
 */
export async function generateStaticParams() {
  // One page per site language (the [locale] layout lists the languages).
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'courses',
    where: { and: [{ tier: { equals: 'public' } }, { _status: { equals: 'published' } }] },
    limit: 0,
    select: { slug: true },
    depth: 0,
  })

  return docs.map((doc) => ({ slug: doc.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, locale } = await params
  return courseMetadata(locale, slug, null)
}

export default async function Page({ params }: Params) {
  const { slug, locale } = await params
  return <CoursePage locale={locale} reader={null} slug={slug} />
}
