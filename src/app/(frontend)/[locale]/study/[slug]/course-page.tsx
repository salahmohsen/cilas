import { courseWhere, getCourseForReading } from '@/api/courses.api'
import type { Locale } from '@/i18n/routing'
import { mediaCover } from '@/lib/media-image'
import { detailPath, pathOf } from '@/lib/paths'
import { currentReader } from '@/lib/reader'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import type { Reader } from '@/lib/reader'
import { getContactEmail } from '@/api/contact.api'
import { OutsideAdminFrame } from '@/components/admin-frame-only'
import { NewsletterSignupEnd } from '@/components/newsletter-signup-end'
import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'
import { RichTextScope } from '@/components/rich-text-scope'
import { Schema } from '@/components/schema'
import { breadcrumbSchema, courseSchema } from '@/lib/schema'
import { buildPageMetadata, seoDefaults } from '@/lib/seo'
import type { Media, Person } from '@/payload-types'
import { CourseLivePreview } from './CourseLivePreview'
import { CourseView, type RelatedCourse } from './CourseView'

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
    where: courseWhere(reader, slug),
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

  return buildPageMetadata({
    title,
    description,
    image: imageUrl,
    path: detailPath('courses', String(course.slug)),
    locale,
  })
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
  if (isPreview) reader = await currentReader()
  const reading = await getCourseForReading(payload, slug, {
    locale: locale as Locale,
    reader,
    preview: isPreview,
  })
  if (!reading) notFound()
  const { course, siblings, previewCourse } = reading
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
      ...(cover?.url ? { image: mediaCover(cover) } : {}),
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

  if (!previewCourse) {
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
        <RichTextScope data={course} locale={locale} user={reader}>
          <CourseView after={newsletter} course={course} email={email} related={related} />
        </RichTextScope>
      </>
    )
  }

  return (
    <>
      <RefreshRouteOnSave />
      <RichTextScope data={previewCourse ?? course} locale={locale} user={reader}>
        <CourseLivePreview
          after={newsletter}
          email={email}
          initialData={previewCourse ?? course}
          related={related}
        />
      </RichTextScope>
    </>
  )
}
