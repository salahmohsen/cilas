import config from '@payload-config'
import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload, type Where } from 'payload'
import React from 'react'

import { siteTiers } from '@/access'
import type { Reader } from '@/api/articles.api'
import { getContactEmail } from '@/api/contact.api'
import { OutsideAdminFrame } from '@/components/admin-frame-only'
import { NewsletterSignupEnd } from '@/components/newsletter-signup-end'
import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'
import { Schema } from '@/components/schema'
import { CourseLivePreview } from './CourseLivePreview'
import { CourseView, type RelatedCourse } from './CourseView'
import { pathOf } from '@/lib/paths'
import { breadcrumbSchema, courseSchema } from '@/lib/schema'
import { ogImages } from '@/lib/og'
import { pageAlternates, seoDefaults } from '@/lib/seo'
import type { Course, Media, Person } from '@/payload-types'

/**
 * A course the site shows `reader`: published, in a tier they may see. An
 * owner-only course shows only in the admin's preview.
 */
const shownTo = (reader: Reader, slug: string): Where => ({
  and: [
    { slug: { equals: slug } },
    { tier: { in: siteTiers(reader) } },
    { _status: { equals: 'published' } },
  ],
})

/**
 * Meta fields win; the course's own title, summary and cover fill any gaps.
 * Shared by the cached page and the signed-in one.
 */
export async function courseMetadata(
  locale: string,
  slug: string,
  reader: Reader,
): Promise<Metadata> {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'courses',
    where: shownTo(reader, slug),
    limit: 1,
    depth: 1,
    joins: false,
    locale: locale as 'en' | 'ar',
    fallbackLocale: 'en',
    overrideAccess: false,
    user: reader,
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
    alternates: pageAlternates(`/study/${course.slug}`, locale),
    openGraph: { title, description, images: ogImages(imageUrl) },
    twitter: { card: 'summary_large_image', images: ogImages(imageUrl).map((i) => i.url) },
  }
}

/**
 * A course page. `reader` is null on the cached page; the signed-in page
 * passes the account, which adds `community` courses.
 */
export async function CoursePage({
  locale,
  slug,
  reader,
}: {
  locale: string
  slug: string
  reader: Reader
}) {
  const { isEnabled: isPreview } = await draftMode()
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'courses',
    // The admin's preview shows any course; the site only what the reader may see.
    where: isPreview ? { slug: { equals: slug } } : shownTo(reader, slug),
    limit: 1,
    // Must match the `depth` given to `useLivePreview` in CourseLivePreview,
    // or populated relationships will not survive the live merge.
    depth: 2,
    // Joins are admin views (a course's enrollments, a cycle's courses); never
    // ship them to the page, where a previewing fellow would see assessments.
    joins: false,
    overrideAccess: isPreview,
    user: reader,
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
            { tier: { in: siteTiers(reader) } },
            { _status: { equals: 'published' } },
          ],
        },
        depth: 1,
        joins: false,
        pagination: false,
        populate: {
          people: { name: true },
          media: { url: true, alt: true, focalX: true, focalY: true, filename: true, prefix: true },
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
      ...(cover?.url
        ? {
            image: {
              url: cover.url,
              alt: cover.alt ?? '',
              focalX: cover.focalX,
              focalY: cover.focalY,
            },
          }
        : {}),
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
    // The course as data a search engine reads; the admin's preview skips it.
    const [tm, ts] = await Promise.all([getTranslations('Meta'), getTranslations('Study')])
    const schema = courseSchema({
      course,
      locale,
      siteName: tm('siteName'),
      instructors: (course.fellows ?? []).flatMap((p) => (typeof p === 'object' && p ? [p] : [])),
    })
    // Where it sits: home, the study list, this course.
    const crumb = breadcrumbSchema([
      { name: tm('siteName'), path: '/' },
      { name: ts('title'), path: `/${locale}/study` },
      { name: course.title, path: pathOf('courses', course, locale) },
    ])
    return (
      <>
        <Schema data={schema ? [schema, crumb] : [crumb]} />
        <CourseView after={newsletter} course={course} email={email} related={related} />
      </>
    )
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
