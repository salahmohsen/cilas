import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { currentReader } from '@/lib/reader'
import { spaceHref } from '@/lib/space-ref'
import { spaceLanding } from '@/lib/spaces-data'
import { loadPost, PostArticle } from './post-article'

type Params = { locale: string; id: string; spaceId?: string; kind?: string; slug?: string }

/** The intercepted route uses the same space and post access checks as the full page. */
export async function PostDialogPage({ params }: { params: Promise<Params> }) {
  const { locale, id, spaceId, kind, slug } = await params
  const postId = Number(id)
  const community = spaceId !== undefined || kind === 'community'
  const spaceKey = spaceId ?? slug
  if (
    !Number.isInteger(postId) ||
    (community ? !Number.isInteger(Number(spaceKey)) : kind !== 'course' && kind !== 'cohort')
  )
    notFound()
  const spaceKind = community ? 'community' : kind
  if (spaceKind !== 'community' && spaceKind !== 'course' && spaceKind !== 'cohort') notFound()
  const user = await currentReader()
  if (!user) notFound()
  const payload = await getPayload({ config })
  const landing = await spaceLanding(payload, user, spaceKind, spaceKey!, locale)
  if (!landing) notFound()
  const loaded = await loadPost(payload, user, landing.space, postId, locale)
  if (!loaded) notFound()
  const href = spaceHref(landing.space, { slug }, { locale: locale === 'ar' ? 'ar' : 'en', postId })
  return <PostArticle user={user} view={loaded.view} context={loaded.context} href={href} dialog />
}
