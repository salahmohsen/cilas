import type { Metadata } from 'next'

import type { Locale } from '@/i18n/routing'
import { ListPage, listMetadata } from '@/portal/lists/list-page'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  return listMetadata('courses')
}

export default async function CoursesListPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  return <ListPage collection="courses" locale={locale as Locale} searchParams={query} />
}
