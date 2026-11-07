import { localeOf } from '@/i18n/routing'
import { getCourse } from '@/api/courses.api'
import { CAIRO } from '@/lib/cairo-day'
import { detailPath } from '@/lib/paths'
import { relId } from '@/lib/relation'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import type { Reader } from '@/lib/reader'
import { PayloadForm } from '@/components/forms/payload-form'
import { ResolvedRichTextField as RichTextField } from '@/components/resolved-rich-text-field'
import { Link } from '@/i18n/navigation'
import { numberingSystemOf } from '@/lib/digits'
import { registrationStatus } from '@/lib/registration'
import type { Cycle, Form } from '@/payload-types'

/** Shared by the cached page and the signed-in one. */
export async function courseApplyMetadata(
  locale: string,
  slug: string,
  reader: Reader,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Apply' })
  const course = await getCourse(await getPayload({ config }), slug, {
    locale: localeOf(locale),
    reader,
    depth: 1,
  })
  return course
    ? { title: t('courseTitle', { title: course.title }), robots: { index: false } }
    : {}
}

/**
 * Applying to a course through its site form: its own, or its cycle's, then
 * the course's own questions (Questions for applicants). The submission names
 * the course, so an admin can accept it into an enrollment. `reader` is null
 * on the cached page; the signed-in page passes the account (`community` courses).
 */
export async function CourseApplyPage({
  locale,
  slug,
  reader,
}: {
  locale: string
  slug: string
  reader: Reader
}) {
  const lang = localeOf(locale)
  const [t, format] = await Promise.all([getTranslations('Apply'), getFormatter()])
  const payload = await getPayload({ config })
  const course = await getCourse(payload, slug, { locale: lang, reader, depth: 1 })
  if (!course) notFound()

  const cycle = typeof course.cycle === 'object' ? (course.cycle as Cycle | null) : null
  const method = course.registration?.method ?? cycle?.registration?.method
  const formRef = course.registration?.form ?? cycle?.registration?.form
  if (method !== 'form' || !formRef) notFound()

  const shared: Form = await payload.findByID({
    collection: 'forms',
    id: relId(formRef),
    depth: 1,
    locale: lang,
    fallbackLocale: 'en',
  })
  // The course's own questions after the form's. Their names take a prefix,
  // so none can overwrite an answer to the shared form.
  const extra = (course.applicant_questions ?? []).map((q) => ({
    ...q,
    name: `course_${q.name}`,
  })) as unknown as NonNullable<Form['fields']>
  const form: Form = { ...shared, fields: [...(shared.fields ?? []), ...extra] }

  const open = registrationStatus(course.registration, cycle?.registration) === 'open'
  const deadlineDay = course.registration?.deadline ?? cycle?.registration?.deadline
  const deadline = deadlineDay
    ? format.dateTime(new Date(deadlineDay), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: CAIRO,
        numberingSystem: numberingSystemOf(locale),
      })
    : null

  // The form's text blocks and its confirmation, rendered here and handed to the form.
  const notes: Record<string, ReactNode> = {}
  for (const block of form.fields ?? []) {
    if (block.blockType === 'message' && block.message && block.id) {
      notes[block.id] = <RichTextField className="article-prose" data={block.message} />
    }
  }
  const confirmation = form.confirmationMessage ? (
    <RichTextField className="article-prose" data={form.confirmationMessage} />
  ) : null

  const back = detailPath('courses', String(course.slug))
  return (
    <div className="apply-page mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <header className="apply-header">
        <Link className="apply-back" href={back}>
          {course.title}
        </Link>
        <h1 className="course-title mt-3">{t('courseTitle', { title: course.title })}</h1>
      </header>

      {/* Before the questions only: hidden once the application is sent (see .apply-intro). */}
      <div className="apply-intro">
        <p className="course-status" data-open={open || undefined}>
          {open ? (deadline ? t('deadline', { date: deadline }) : null) : t('courseClosed')}
        </p>
      </div>

      <PayloadForm
        analytics={{ kind: 'course', id: course.slug }}
        back={{ href: back, label: t('backTo', { title: course.title }) }}
        confirmation={confirmation}
        disabled={!open}
        form={form}
        notes={notes}
        target={{ relationTo: 'courses', value: course.id }}
      />
    </div>
  )
}
