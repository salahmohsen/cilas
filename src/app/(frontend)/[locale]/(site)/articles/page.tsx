import type { Metadata } from 'next'

import { ArticlesPage, articlesMetadata } from '@/components/article/articles-page'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ publication?: string; page?: string }>
}

// The cached index, read as an anonymous visitor. Signed-in readers are sent
// to /[locale]/signed-in/articles instead (src/proxy.ts).
export const revalidate = 3600

export const generateMetadata = async ({ searchParams }: Props): Promise<Metadata> =>
  articlesMetadata(await searchParams)

export default async function Page({ params, searchParams }: Props) {
  const [{ locale }, { publication, page }] = await Promise.all([params, searchParams])
  return (
    <ArticlesPage locale={locale} selected={publication} page={Number(page) || 1} user={null} />
  )
}
