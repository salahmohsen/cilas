import { BRIDGE_PATH } from '@/lib/paths'
import { localeOf } from '@/i18n/routing'
import { CAIRO } from '@/lib/cairo-day'
import { relId } from '@/lib/relation'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { getBridgeYear } from '@/api/programmes.api'
import { RenderedForm } from '@/components/forms/rendered-form'
import { Link } from '@/i18n/navigation'
import { numberingSystemOf } from '@/lib/digits'
import { registrationStatus } from '@/lib/registration'

type Props = { params: Promise<{ locale: string }> }

// Open or closed follows today's date, so rebuild hourly.
export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Apply' })
  return { title: t('metaTitle'), robots: { index: false } }
}

/**
 * Applying to the current Bridge year through its form. When applications
 * are closed the questions stay, to be read, so people can prepare.
 */
export default async function ApplyPage({ params }: Props) {
  const { locale } = await params
  const lang = localeOf(locale)
  const [t, format] = await Promise.all([getTranslations('Apply'), getFormatter()])
  const payload = await getPayload({ config })
  const year = await getBridgeYear(payload, lang)
  const registration = year?.programme.registration
  const formRef = registration?.form
  if (!year || !formRef) notFound()

  const form = await payload.findByID({
    collection: 'forms',
    id: relId(formRef),
    depth: 1,
    locale: lang,
    fallbackLocale: 'en',
  })

  const open = registrationStatus(registration) === 'open'
  const deadline = registration?.deadline
    ? format.dateTime(new Date(registration.deadline), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: CAIRO,
        numberingSystem: numberingSystemOf(locale),
      })
    : null

  return (
    <div className="apply-page mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <header className="apply-header">
        <Link className="apply-back" href={BRIDGE_PATH}>
          {year.programme.title}
        </Link>
        <h1 className="course-title mt-3">{t('title')}</h1>
      </header>

      {/* Before the questions only: hidden once the application is sent (see .apply-intro). */}
      <div className="apply-intro">
        <p className="course-status" data-open={open || undefined}>
          {open
            ? deadline
              ? t('deadline', { date: deadline })
              : null
            : t('closed', { year: year.programme.title, date: deadline ?? '' })}
        </p>
        <div className="apply-notes">
          <p>{t('english')}</p>
          <p>{t('scholarship')}</p>
        </div>
      </div>

      {/* The questions are written in English, so they read left to right on either page. */}
      <RenderedForm
        analytics={{ kind: 'programme', id: 'bridge' }}
        back={{ href: BRIDGE_PATH, label: t('backTo', { title: year.programme.title }) }}
        disabled={!open}
        form={form}
        lang="en"
        target={{ relationTo: 'programmes', value: year.programme.id }}
      />
    </div>
  )
}
