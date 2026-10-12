import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { getStudyCards, searchStudy } from '@/api/study-index'
import { StudyList } from '@/components/study-list'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CoursesPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { q } = await searchParams
  const lang = locale === 'ar' ? 'ar' : 'en'
  const t = await getTranslations('Study')
  const courses = await getStudyCards(lang)
  // A search in the URL is answered here, so the first render is already filtered.
  const search = typeof q === 'string' && q.trim() ? { q: q.trim(), ids: await searchStudy(lang, q) } : undefined

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
        <StudyList courses={courses} initialSearch={search} />
      </Suspense>
    </div>
  )
}
