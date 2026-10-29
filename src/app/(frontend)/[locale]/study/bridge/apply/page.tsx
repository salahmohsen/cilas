import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { getBridgeYear } from '@/api/programmes.api'
import { PayloadForm } from '@/components/forms/payload-form'
import { ResolvedRichTextField as RichTextField } from '@/components/resolved-rich-text-field'
import { Link } from '@/i18n/navigation'
import { numberingSystemOf } from '@/lib/digits'
import { registrationStatus } from '@/lib/registration'
import type { Form } from '@/payload-types'

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
  const lang = locale === 'ar' ? 'ar' : 'en'
  const [t, format] = await Promise.all([getTranslations('Apply'), getFormatter()])
  const payload = await getPayload({ config })
  const year = await getBridgeYear(payload, lang)
  const registration = year?.programme.registration
  const formRef = registration?.form
  if (!year || !formRef) notFound()

  const form: Form = await payload.findByID({
    collection: 'forms',
    id: typeof formRef === 'object' ? formRef.id : formRef,
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
        timeZone: 'Africa/Cairo',
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

  return (
    <div className="apply-page mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <header className="apply-header">
        <Link className="apply-back" href="/study/bridge">
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
      <PayloadForm
        back={{ href: '/study/bridge', label: t('backTo', { title: year.programme.title }) }}
        confirmation={confirmation}
        disabled={!open}
        form={form}
        lang="en"
        notes={notes}
        target={{ relationTo: 'programmes', value: year.programme.id }}
      />
    </div>
  )
}
