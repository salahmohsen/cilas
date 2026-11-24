import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { localeOf } from '@/i18n/routing'
import { currentReader } from '@/lib/reader'
import { HomePage } from '@/portal/home/home-page'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Portal.home')
  return { title: t('metaTitle'), robots: { index: false } }
}

export default async function HomeRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/spaces`)}`)
  return <HomePage user={user} locale={localeOf(locale)} />
}
