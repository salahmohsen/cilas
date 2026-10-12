import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { getStudyPage, STUDY_PAGE_SIZE } from '@/api/study-index'
import { readCourseQuery } from '@/lib/course-search'
import { StudyList } from '@/components/study-list'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CoursesPage({ params, searchParams }: Props) {
  const { locale } = await params
  const raw = await searchParams
  const lang = locale === 'ar' ? 'ar' : 'en'
  const t = await getTranslations('Study')
  // The search, filters and page are worked out here: the browser gets one page.
  const url = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])),
  )
  const result = await getStudyPage(lang, readCourseQuery(url), Number(url.get('page')) || 1)

  // The whole catalogue, for the header: every course, and the first year.
  const all = result.options.type.reduce((n, o) => n + o.count, 0)
  const firstYear = result.options.year.at(-1)?.value

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 sm:px-8 sm:py-14 xl:px-0">
      <header className="study-header">
        <div className="study-header-text">
          <h1 className="study-title">{t('title')}</h1>
          {firstYear ? <p className="study-since">{t('since', { count: all, year: firstYear })}</p> : null}
          <div className="article-prose study-quote">
            <blockquote className="quote-with-source">
              <p>{t('heroQuote')}</p>
              <footer>
                <cite>{t('heroAttribution').replace(/^\s*[—–-]\s*/, '')}</cite>
              </footer>
            </blockquote>
          </div>
        </div>
        <figure className="study-figure">
          <Image
            alt={t('heroImageAlt')}
            className="study-figure-image"
            height={1536}
            priority
            sizes="(min-width: 64rem) 34rem, 100vw"
            src="/assets/images/cilas-classroom.jpg"
            width={2048}
          />
        </figure>
      </header>
      <Suspense>
        <StudyList pageSize={STUDY_PAGE_SIZE} result={result} />
      </Suspense>
    </div>
  )
}
