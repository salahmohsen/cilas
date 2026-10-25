import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { currentReader } from '@/lib/reader'
import { spaceLanding } from '@/lib/spaces-data'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string; shown?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Spaces')
  return { title: t('metaTitle'), robots: { index: false } }
}

/** The old address: sends the reader to the first community space they may open. */
export default async function CommunityPage({ params, searchParams }: Props) {
  const [{ locale }, { tab, shown }] = await Promise.all([params, searchParams])
  const path = `/${locale}/spaces/community`
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(path)}`)
  const landing = await spaceLanding(await getPayload({ config }), user, 'community', '', locale)
  if (!landing) notFound()
  const query = new URLSearchParams()
  if (tab) query.set('tab', tab)
  if (shown) query.set('shown', shown)
  redirect(`${path}/${landing.space.id}${query.size ? `?${query}` : ''}`)
}
