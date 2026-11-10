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
import { courseRegistration } from '@/lib/registration'
import type { Cycle, Form } from '@/payload-types'

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
  const registration = courseRegistration(course, cycle)
  const { method, formId } = registration
  if (method !== 'form' || !formId) notFound()

  const shared = await payload.findByID({
    collection: 'forms',
    id: formId,
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
  const form = { ...shared, fields: [...(shared.fields ?? []), ...extra] }

  const open = registration.status === 'open'
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
        form={form}
        target={
          course.registration?.mode === 'own'
            ? { relationTo: 'courses', value: course.id }
            : { relationTo: 'cycles', value: cycle!.id }
        }
        courseChoice={
          course.registration?.mode === 'own'
            ? undefined
            : {
                course: course.id,
                amount: registration.price?.options?.find((option) => option.default)?.amount,
                questionNames: (course.applicant_questions ?? []).map((q) => q.name),
              }
        }
      />
    </div>
  )
}
