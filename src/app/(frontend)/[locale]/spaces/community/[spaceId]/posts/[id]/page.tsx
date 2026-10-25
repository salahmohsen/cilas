import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { PostPage } from '@/components/space/post-page'
import { currentReader } from '@/lib/reader'
import { spaceLanding } from '@/lib/spaces-data'

type Props = { params: Promise<{ id: string; locale: string; spaceId: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Spaces')
  return { title: t('metaTitle'), robots: { index: false } }
}

/** A post in one community space. */
export default async function CommunitySpacePostPage({ params }: Props) {
  const { id, locale, spaceId } = await params
  const postId = Number(id)
  if (!Number.isInteger(postId) || !Number.isInteger(Number(spaceId))) notFound()
  const spacePath = `/${locale}/spaces/community/${spaceId}`
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`${spacePath}/posts/${postId}`)}`)
  const landing = await spaceLanding(
    await getPayload({ config }),
    user,
    'community',
    spaceId,
    locale,
  )
  if (!landing) notFound()
  return (
    <PostPage locale={locale} user={user} landing={landing} postId={postId} spacePath={spacePath} />
  )
}
