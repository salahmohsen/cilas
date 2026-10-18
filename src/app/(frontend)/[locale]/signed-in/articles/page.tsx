import type { Metadata } from 'next'

import { ArticlesPage, articlesMetadata } from '@/components/article/articles-page'
import { currentReader } from '@/lib/reader'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ publication?: string }>
}

/** The article index for a signed-in reader, with `community` articles (src/proxy.ts). */
export async function generateMetadata(): Promise<Metadata> {
  return { ...(await articlesMetadata()), robots: { index: false } }
}

export default async function Page({ params, searchParams }: Props) {
  const [{ locale }, { publication }] = await Promise.all([params, searchParams])
  return <ArticlesPage locale={locale} selected={publication} user={await currentReader()} />
}
