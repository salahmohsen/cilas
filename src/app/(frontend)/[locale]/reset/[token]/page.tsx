import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { ResetForm, type ResetMessages } from '@/components/login/reset-form'

type Props = { params: Promise<{ locale: string; token: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Reset')
  // The token is in the address, so the page keeps it out of Referer headers.
  return { title: t('metaTitle'), robots: { index: false }, referrer: 'no-referrer' }
}

/**
 * Step two of a password reset: where the email's link lands. The email links
 * to /admin/reset/<token>, which src/proxy.ts sends here in the reader's language.
 */
export default async function ResetPage({ params }: Props) {
  const { locale, token } = await params
  const t = await getTranslations('Reset')
  const keys = [
    'title',
    'intro',
    'password',
    'confirm',
    'submit',
    'tooShort',
    'mismatch',
    'invalid',
    'failed',
    'requestNew',
    'showPassword',
    'hidePassword',
    'back',
  ] as const
  const messages = Object.fromEntries(keys.map((k) => [k, t(k)])) as ResetMessages

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <ResetForm locale={locale} messages={messages} token={token} />
    </div>
  )
}
