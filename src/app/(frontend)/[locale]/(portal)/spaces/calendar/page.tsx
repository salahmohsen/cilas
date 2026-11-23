import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { currentReader } from '@/lib/reader'
import { PortalCalendarPage } from '@/portal/calendar/calendar-page'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ view?: string; date?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Calendar')
  return { title: t('metaTitle'), robots: { index: false } }
}

/** The Calendar tab: the reader's own courses and the public events, inside the portal shell. */
export default async function CalendarRoute({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  const user = await currentReader()
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/spaces/calendar`)}`)
  }
  return <PortalCalendarPage user={user} locale={locale} query={query} />
}
