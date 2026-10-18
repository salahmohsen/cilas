import type { Metadata } from 'next'

import { ArticlePage, articleMetadata } from '@/components/article/article-page'
import { currentReader } from '@/lib/reader'

type Props = { params: Promise<{ locale: string; slug: string }> }

/**
 * An article for a signed-in reader, rendered per request. The visitor keeps
 * the /articles/[slug] address: src/proxy.ts rewrites here when the request
 * carries Payload's cookie. An expired cookie reads as anonymous.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meta = await articleMetadata({ ...(await params), user: await currentReader() })
  // Only reached through the rewrite; the public address is the canonical one.
  return { ...meta, robots: { index: false } }
}

export default async function Page({ params }: Props) {
  return <ArticlePage {...await params} user={await currentReader()} />
}
