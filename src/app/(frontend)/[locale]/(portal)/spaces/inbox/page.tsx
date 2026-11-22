import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { localeOf } from '@/i18n/routing'
import { currentReader } from '@/lib/reader'
import { InboxPage } from '@/portal/inbox/inbox-page'
import { latestPagesOf } from '@/portal/needs/latest'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Portal')
  return { title: t('inbox.metaTitle'), robots: { index: false } }
}

export default async function InboxRoute({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/spaces/inbox`)}`)
  const focus = query.focus
  return (
    <InboxPage
      user={user}
      locale={localeOf(locale)}
      pages={latestPagesOf(query.latest)}
      focus={(Array.isArray(focus) ? focus[0] : focus) === 'latest'}
    />
  )
}
