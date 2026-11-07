import { localeOf } from '@/i18n/routing'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { getStudyPage, STUDY_PAGE_SIZE } from '@/api/study-index'
import { readCourseQuery } from '@/lib/course-search'
import { Schema } from '@/components/schema'
import { StudyList } from '@/components/study-list'
import { itemListSchema, absoluteUrl } from '@/lib/schema'
import { pageAlternates } from '@/lib/seo'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale }, raw] = await Promise.all([params, searchParams])
  const t = await getTranslations('Study')
  const query = readCourseQuery(
    new URLSearchParams(
      Object.entries(raw).flatMap(([key, value]) =>
        typeof value === 'string' ? [[key, value]] : [],
      ),
    ),
  )
  const result = await getStudyPage(localeOf(locale), query, Number(raw.page) || 1)
  const canonicalQuery = new URLSearchParams(query)
  if (result.page > 1) canonicalQuery.set('page', String(result.page))
  return {
    title: `${t('title')} · CILAS`,
    description: t('heroQuote'),
    alternates: pageAlternates(`/study${canonicalQuery.size ? `?${canonicalQuery}` : ''}`, locale),
    ...(Object.keys(query).length ? { robots: { index: false } } : {}),
  }
}

export default async function CoursesPage({ params, searchParams }: Props) {
  const { locale } = await params
  const raw = await searchParams
  const lang = localeOf(locale)
  const t = await getTranslations('Study')
  // The search, filters and page are worked out here: the browser gets one page.
  const url = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])),
  )
  const result = await getStudyPage(lang, readCourseQuery(url), Number(url.get('page')) || 1)

  // What a search engine reads: the courses this page of the list shows, in
  // its order, each entry pointing at its course page (the paired summary
  // page Google's course-list carousel asks for).
  const list = itemListSchema(result.rows.map((row) => absoluteUrl(row.href)))

  // The whole catalogue, for the header: every course, and the first year.
  const all = result.options.type.reduce((n, o) => n + o.count, 0)
  const firstYear = result.options.year.at(-1)?.value

  return (
    <div className="page-frame flex flex-col gap-12 py-10 sm:py-14">
      {list ? <Schema data={list} /> : null}
      <Suspense>
        <StudyList
          intro={
            firstYear ? (
              <p className="study-since">{t('since', { count: all, year: firstYear })}</p>
            ) : null
          }
          pageSize={STUDY_PAGE_SIZE}
          quote={
            <div className="article-prose study-quote">
              <blockquote className="quote-with-source">
                <p>{t('heroQuote')}</p>
                <footer>
                  <cite>{t('heroAttribution').replace(/^\s*[—–-]\s*/, '')}</cite>
                </footer>
              </blockquote>
            </div>
          }
          result={result}
          title={t('title')}
        />
      </Suspense>
    </div>
  )
}
