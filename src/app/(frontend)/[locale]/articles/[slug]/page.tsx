import config from '@payload-config'
import type { Metadata } from 'next'
import { getPayload } from 'payload'

import { articleMetadata } from '@/app/(frontend)/[locale]/articles/[slug]/metadata'
import { ArticlePage } from '@/components/article/article-page'
import { routing } from '@/i18n/routing'
import { withShareCard } from '@/lib/seo'

type Props = { params: Promise<{ locale: string; slug: string }> }

// The cached page, read as an anonymous visitor. Signed-in readers are sent to
// /[locale]/signed-in/articles/[slug] instead (src/proxy.ts).
export const revalidate = 3600

export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'articles',
    where: { _status: { equals: 'published' } },
    limit: 0,
    select: { slug: true },
    depth: 0,
    overrideAccess: false,
  })
  return routing.locales.flatMap((locale) => docs.map((doc) => ({ locale, slug: doc.slug })))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return withShareCard(await articleMetadata({ ...(await params), user: null }))
}

export default async function Page({ params }: Props) {
  return <ArticlePage {...await params} user={null} />
}
