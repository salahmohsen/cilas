import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { PostPage } from '@/components/space/post-page'
import { currentReader } from '@/lib/reader'
import { spaceLanding } from '@/lib/spaces-data'

type Props = { params: Promise<{ kind: string; slug: string; id: string; locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Spaces')
  return { title: t('metaTitle'), robots: { index: false } }
}

/** A post in a course or cohort space. */
export default async function KindSlugPostPage({ params }: Props) {
  const { kind, slug, id, locale } = await params
  const postId = Number(id)
  if ((kind !== 'course' && kind !== 'cohort') || !Number.isInteger(postId)) notFound()
  const spacePath = `/${locale}/spaces/${kind}/${slug}`
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`${spacePath}/posts/${postId}`)}`)
  const landing = await spaceLanding(await getPayload({ config }), user, kind, slug, locale)
  if (!landing) notFound()
  return (
    <PostPage locale={locale} user={user} landing={landing} postId={postId} spacePath={spacePath} />
  )
}
