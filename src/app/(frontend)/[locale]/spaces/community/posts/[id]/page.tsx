import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { currentReader } from '@/lib/reader'
import { spaceLanding } from '@/lib/spaces-data'

type Props = { params: Promise<{ id: string; locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Spaces')
  return { title: t('metaTitle'), robots: { index: false } }
}

/** The old address of a community post. */
export default async function CommunityPostPage({ params }: Props) {
  const { id, locale } = await params
  const postId = Number(id)
  if (!Number.isInteger(postId)) notFound()
  const spacePath = `/${locale}/spaces/community`
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`${spacePath}/posts/${postId}`)}`)
  const landing = await spaceLanding(await getPayload({ config }), user, 'community', '', locale)
  if (!landing) notFound()
  redirect(`${spacePath}/${landing.space.id}/posts/${postId}`)
}
