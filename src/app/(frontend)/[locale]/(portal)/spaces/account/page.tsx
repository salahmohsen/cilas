import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { ACCOUNT_PATH } from '@/lib/account-path'
import { currentReader } from '@/lib/reader'
import { AccountPage } from '@/portal/account/account-page'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Settings')
  return { title: t('metaTitle'), robots: { index: false } }
}

/** Profile, sign-in and notifications, inside the portal shell. */
export default async function AccountRoute({ params }: Props) {
  const { locale } = await params
  const user = await currentReader()
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}${ACCOUNT_PATH}`)}`)
  }
  return <AccountPage user={user} />
}
