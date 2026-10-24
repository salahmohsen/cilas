import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { SpacePage } from '@/components/space/space-page'
import { currentReader } from '@/lib/reader'
import { spaceLanding } from '@/lib/spaces-data'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Spaces')
  return { title: t('metaTitle'), robots: { index: false } }
}

/** Spec §2: the community space has no document behind it, so no slug. */
export default async function CommunityPage({ params, searchParams }: Props) {
  const [{ locale }, { tab }] = await Promise.all([params, searchParams])
  const path = `/${locale}/spaces/community`
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(path)}`)
  const landing = await spaceLanding(await getPayload({ config }), user, 'community', '')
  if (!landing) notFound()
  return (
    <SpacePage
      locale={locale}
      user={user}
      landing={landing}
      tab={tab === 'announcements' ? 'announcements' : 'all'}
      path={path}
    />
  )
}
