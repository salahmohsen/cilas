import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import type { Locale } from '@/api/articles.api'
import { getFellows } from '@/api/people.api'
import { FellowsWheel } from '@/components/person/fellows-wheel'
import { COURSES_TAG } from '@/lib/revalidate-courses'

type Props = { params: Promise<{ locale: string }> }

/** Built from the courses, so it is kept until a course or person changes. */
const fellowsFor = unstable_cache(
  async (locale: Locale) => getFellows(await getPayload({ config }), locale),
  ['fellows'],
  { tags: [COURSES_TAG], revalidate: 3600 },
)

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Fellows')
  return { title: t('metaTitle'), description: t('intro') }
}

/** CILAS's fellows on a wheel: everyone who has taught here, the most recent first. */
export default async function FellowsPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('Fellows')
  const fellows = await fellowsFor(locale === 'ar' ? 'ar' : 'en')

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8 sm:py-16 xl:px-0">
      <header className="max-w-2xl">
        <h1 className="text-[clamp(2rem,4.2vw,3.1rem)] leading-[1.08] font-semibold tracking-[-0.02em] rtl:leading-[1.3] rtl:tracking-normal">
          {t('title')}
        </h1>
        <p className="mt-4 text-lg text-[var(--text-secondary)]">{t('intro')}</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{t('count', { count: fellows.length })}</p>
      </header>
      <div className="mt-10">
        <FellowsWheel fellows={fellows} />
      </div>
    </div>
  )
}
