import type { Metadata } from 'next'

import { ArticlesPage, articlesMetadata } from '@/components/article/articles-page'
import { currentReader } from '@/lib/reader'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ publication?: string; page?: string }>
}

/** The article index for a signed-in reader, with `community` articles (src/proxy.ts). */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return {
    ...(await articlesMetadata(await searchParams, await currentReader())),
    robots: { index: false },
  }
}

export default async function Page({ params, searchParams }: Props) {
  const [{ locale }, { publication, page }] = await Promise.all([params, searchParams])
  return (
    <ArticlesPage
      locale={locale}
      selected={publication}
      page={Number(page) || 1}
      user={await currentReader()}
    />
  )
}
