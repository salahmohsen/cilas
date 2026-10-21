import config from '@payload-config'
import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { getContactEmail } from '@/api/contact.api'
import { OutsideAdminFrame } from '@/components/admin-frame-only'
import { NewsletterSignupEnd } from '@/components/newsletter-signup-end'
import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'
import { CourseLivePreview } from './CourseLivePreview'
import { CourseView, type RelatedCourse } from './CourseView'
import { ogImages } from '@/lib/og'
import { seoDefaults } from '@/lib/seo'
import type { Course, Media, Person } from '@/payload-types'

type Params = { params: Promise<{ locale: string; slug: string }> }

// Registration open/closed is computed from today's date, so rebuild hourly.
export const revalidate = 3600

/**
 * Pre-renders every public course at build time. The route stays dynamic
 * (`dynamicParams`) so a course published after the build is still reachable
 * without a redeploy.
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

/** Meta fields win; the course's own title, summary and cover fill any gaps. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, locale } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'courses',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    joins: false,
    locale: locale as 'en' | 'ar',
    fallbackLocale: 'en',
  })
  const course = docs[0]
  if (!course) return {}

  const fallback = seoDefaults('courses', course as unknown as Record<string, unknown>)
  const meta = course.meta ?? {}
  const image = typeof meta.image === 'object' && meta.image ? meta.image : course.cover_image
  const imageUrl = typeof image === 'object' && image?.url ? image.url : undefined
  const title = meta.title || fallback.title
  const description = meta.description || fallback.description

  return {
    title,
    description,
    openGraph: { title, description, images: ogImages(imageUrl) },
    twitter: { card: 'summary_large_image', images: ogImages(imageUrl).map((i) => i.url) },
  }
}

export default async function CoursePage({ params }: Params) {
  const { slug, locale } = await params
  const { isEnabled: isPreview } = await draftMode()
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'courses',
    where: { slug: { equals: slug } },
    limit: 1,
    // Must match the `depth` given to `useLivePreview` in CourseLivePreview,
    // or populated relationships will not survive the live merge.
    depth: 2,
    // Joins are admin views (a course's enrollments, a cycle's courses); never
    // ship them to the page, where a previewing fellow would see assessments.
    joins: false,
    overrideAccess: isPreview,
    // A course without text in the site language shows its own (CONTEXT.md).
    locale: locale as 'en' | 'ar',
    fallbackLocale: locale === 'ar' ? 'en' : 'ar',
  })

  const course: Course | undefined = docs[0]

  if (!course) notFound()

  // The other published courses of the same cycle, for the end of the page.
  const cycleId = typeof course.cycle === 'object' ? course.cycle?.id : course.cycle
  const { docs: siblings } = cycleId
    ? await payload.find({
        collection: 'courses',
        where: {
          and: [
            { cycle: { equals: cycleId } },
            { id: { not_equals: course.id } },
            { tier: { equals: 'public' } },
            { _status: { equals: 'published' } },
          ],
        },
        depth: 1,
        joins: false,
        pagination: false,
        populate: {
          people: { name: true },
          media: { url: true, alt: true, filename: true, prefix: true },
        },
        select: { title: true, slug: true, course_type: true, fellows: true, cover_image: true },
        locale: locale as 'en' | 'ar',
        fallbackLocale: locale === 'ar' ? 'en' : 'ar',
      })
    : { docs: [] }
  const related: RelatedCourse[] = siblings.map((c) => {
    const cover = typeof c.cover_image === 'object' ? (c.cover_image as Media | null) : null
    return {
      id: c.id,
      slug: c.slug ?? String(c.id),
      title: c.title,
      type: c.course_type,
      fellows: (c.fellows ?? []).flatMap((f) =>
        typeof f === 'object' && f ? [(f as Person).name] : [],
      ),
      ...(cover?.url ? { image: { url: cover.url, alt: cover.alt ?? '' } } : {}),
    }
  })

  // In draft mode too (the cookie outlives a preview), but not in the admin's frame.
  const newsletter = (
    <OutsideAdminFrame>
      <NewsletterSignupEnd locale={locale as 'en' | 'ar'} />
    </OutsideAdminFrame>
  )

  // The institute's email, the share bar's mail recipient.
  const email = await getContactEmail()

  if (!isPreview) {
    return <CourseView after={newsletter} course={course} email={email} related={related} />
  }

  /*
   * In preview, `draft: true` is what returns the in-progress version. It reads
   * from the versions table, and a document that has never been saved as a draft
   * has no row there — the published document is the only record. So fall back
   * to the published read, otherwise previewing any freshly published course
   * 404s until something triggers a version write.
   */
  const { docs: drafts } = await payload.find({
    collection: 'courses',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
    joins: false,
    overrideAccess: true,
    draft: true,
    locale: locale as 'en' | 'ar',
    fallbackLocale: locale === 'ar' ? 'en' : 'ar',
  })

  return (
    <>
      <RefreshRouteOnSave />
      <CourseLivePreview
        after={newsletter}
        email={email}
        initialData={drafts[0] ?? course}
        related={related}
      />
    </>
  )
}
