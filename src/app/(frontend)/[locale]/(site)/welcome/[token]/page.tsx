import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { ResetForm } from '@/components/login/reset-form'
import { resetMessages } from '@/components/login/reset-messages'

type Props = { params: Promise<{ locale: string; token: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Welcome')
  // The token is in the address, so the page keeps it out of Referer headers.
  return { title: t('metaTitle'), robots: { index: false }, referrer: 'no-referrer' }
}

/**
 * Where an invitation or an acceptance email for a new account lands: the
 * person sets their first password (src/lib/invitation.ts). The same form as
 * a reset, with its own words; the link works for seven days.
 */
export default async function WelcomePage({ params }: Props) {
  const { locale, token } = await params
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <ResetForm locale={locale} messages={await resetMessages('Welcome')} token={token} />
    </div>
  )
}
