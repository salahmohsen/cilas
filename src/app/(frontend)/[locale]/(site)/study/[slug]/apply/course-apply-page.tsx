import { localeOf } from '@/i18n/routing'
import { getCourse } from '@/api/courses.api'
import { CAIRO } from '@/lib/cairo-day'
import { detailPath } from '@/lib/paths'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import type { Reader } from '@/lib/reader'
import { RenderedForm } from '@/components/forms/rendered-form'
import { Link } from '@/i18n/navigation'
import { numberingSystemOf } from '@/lib/digits'
import { resolveApplicationTarget } from '@/forms/application-target'
import { applicationContext } from '@/forms/application-context'
import type { Cycle } from '@/payload-types'

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
  const context = resolveApplicationTarget({ kind: 'courses', target: course }, cycle)
  const { registration, formId, submitTarget } = context
  const { method } = registration
  if (method !== 'form' || !formId || !submitTarget) notFound()

  const shared = await payload.findByID({
    collection: 'forms',
    id: formId,
    depth: 1,
    locale: lang,
    fallbackLocale: 'en',
  })
  const application = await applicationContext(payload, context, lang, reader)

  const open = context.open
  const deadlineDay = registration.deadline
  const deadline = deadlineDay
    ? format.dateTime(new Date(deadlineDay), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: CAIRO,
        numberingSystem: numberingSystemOf(locale),
      })
    : null

  const back = detailPath('courses', String(course.slug))
  return (
    <div className="apply-page mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <header className="apply-header">
        <Link className="apply-back" href={back}>
          {course.title}
        </Link>
        <h1 className="course-title mt-3">{t('courseTitle', { title: course.title })}</h1>
      </header>

      <div className="apply-intro">
        <p className="course-status" data-open={open || undefined}>
          {open ? (deadline ? t('deadline', { date: deadline }) : null) : t('courseClosed')}
        </p>
      </div>

      <RenderedForm
        analytics={{ kind: 'course', id: course.slug }}
        back={{ href: back, label: t('backTo', { title: course.title }) }}
        disabled={!open}
        form={shared}
        target={submitTarget}
        application={application}
      />
    </div>
  )
}
