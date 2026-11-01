import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { ForgotForm, type ForgotMessages } from '@/components/login/forgot-form'
import { currentReader } from '@/lib/reader'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Forgot')
  return { title: t('metaTitle'), robots: { index: false } }
}

/**
 * Step one of a password reset. The sign-in page links here, and
 * /admin/forgot (Payload's own page) is sent here too (src/proxy.ts).
 */
export default async function ForgotPage({ params }: Props) {
  const { locale } = await params
  if (await currentReader()) redirect(`/${locale}/settings`)

  const t = await getTranslations('Forgot')
  const keys = [
    'title',
    'intro',
    'email',
    'submit',
    'invalidEmail',
    'failed',
    'sentTitle',
    'sentBody',
    'back',
  ] as const
  // `sentBody` keeps its {email} slot for the form to fill.
  const messages = Object.fromEntries(
    keys.map((k) => [k, k === 'sentBody' ? t.raw(k) : t(k)]),
  ) as ForgotMessages

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <ForgotForm messages={messages} />
    </div>
  )
}
