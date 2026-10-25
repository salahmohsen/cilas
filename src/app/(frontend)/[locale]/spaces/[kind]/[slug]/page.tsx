import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { SpacePage } from '@/components/space/space-page'
import { currentReader } from '@/lib/reader'
import { spaceLanding } from '@/lib/spaces-data'

type Props = {
  params: Promise<{ kind: string; slug: string; locale: string }>
  searchParams: Promise<{ tab?: string; shown?: string; session?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Spaces')
  return { title: t('metaTitle'), robots: { index: false } }
}

/** Course and cohort spaces, by the slug of their course or programme. */
export default async function KindSlugPage({ params, searchParams }: Props) {
  const [{ kind, slug, locale }, { tab, shown, session }] = await Promise.all([
    params,
    searchParams,
  ])
  if (kind !== 'course' && kind !== 'cohort') notFound()
  const path = `/${locale}/spaces/${kind}/${slug}`
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(path)}`)
  const landing = await spaceLanding(await getPayload({ config }), user, kind, slug, locale)
  if (!landing) notFound()
  return (
    <SpacePage
      locale={locale}
      user={user}
      landing={landing}
      tab={tab === 'announcements' || tab === 'syllabus' || tab === 'events' ? tab : 'all'}
      shown={Math.min(Math.max(Number(shown) || 0, 0), 500)}
      path={path}
      session={session?.slice(0, 64) || null}
    />
  )
}
