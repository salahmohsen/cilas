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

  return (
    <div className="flex flex-col gap-8">
      <div className="relative h-96 w-full">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 px-8 text-center">
          <p className="text-2xl font-bold text-white leading-tight">
            {t('heroQuote')}
          </p>
          <p className="text-white/80 mt-4 text-lg max-w-2xl mx-auto">
            {t('heroAttribution')}
          </p>
        </div>
        <Image
          src="/assets/images/cilas-classroom.jpg"
          alt={t('heroImageAlt')}
          width={1000}
          height={1000}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </div>
      <Suspense>
        <StudyList pageSize={STUDY_PAGE_SIZE} result={result} />
      </Suspense>
    </div>
  )
}
