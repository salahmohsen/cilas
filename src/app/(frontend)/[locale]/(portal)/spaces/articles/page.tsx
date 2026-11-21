import type { Metadata } from 'next'

import type { Locale } from '@/i18n/routing'
import { ListPage, listMetadata } from '@/portal/lists/list-page'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  return listMetadata('articles')
}

export default async function ArticlesListPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  return <ListPage collection="articles" locale={locale as Locale} searchParams={query} />
}
