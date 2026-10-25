import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { SpacePage } from '@/components/space/space-page'
import { currentReader } from '@/lib/reader'
import { spaceLanding } from '@/lib/spaces-data'

type Props = {
  params: Promise<{ locale: string; spaceId: string }>
  searchParams: Promise<{ tab?: string; shown?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Spaces')
  return { title: t('metaTitle'), robots: { index: false } }
}

/** One community space, by its row id: it has no course or programme slug. */
export default async function CommunitySpacePage({ params, searchParams }: Props) {
  const [{ locale, spaceId }, { tab, shown }] = await Promise.all([params, searchParams])
  if (!Number.isInteger(Number(spaceId))) notFound()
  const path = `/${locale}/spaces/community/${spaceId}`
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(path)}`)
  const landing = await spaceLanding(
    await getPayload({ config }),
    user,
    'community',
    spaceId,
    locale,
  )
  if (!landing) notFound()
  return (
    <SpacePage
      locale={locale}
      user={user}
      landing={landing}
      tab={tab === 'announcements' || tab === 'events' ? tab : 'all'}
      shown={Math.min(Math.max(Number(shown) || 0, 0), 500)}
      path={path}
    />
  )
}
