import { pageAlternates } from '@/lib/seo'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import type { Locale } from '@/api/articles.api'
import { getCilasians } from '@/api/people.api'
import { PeoplePage } from '@/components/person/people-page'
import { COURSES_TAG } from '@/lib/revalidate-courses'

type Props = { params: Promise<{ locale: string }> }

/** Kept until a person changes (people revalidate the same tag as courses). */
const cilasiansFor = unstable_cache(
  async (locale: Locale) => getCilasians(await getPayload({ config }), locale),
  ['cilasians'],
  { tags: [COURSES_TAG], revalidate: 3600 },
)

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = await getTranslations('Cilasians')
  return {
    alternates: pageAlternates('/people/cilasians', locale),
    title: t('metaTitle'),
    description: t('intro'),
  }
}

/** CILASians on a wheel: the students and resident fellows of each cohort, the newest first. */
export default async function CilasiansPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('Cilasians')
  const people = await cilasiansFor(locale === 'ar' ? 'ar' : 'en')

  return (
    <PeoplePage
      count={t('count', { count: people.length })}
      intro={t('intro')}
      namespace="Cilasians"
      people={people.map((p) => ({
        ...p,
        eyebrow: t(`roles.${p.places[0]?.role ?? 'student'}`),
        lines: p.places.map((place, i) => ({
          key: `${place.programme}-${i}`,
          title: place.programme ?? t(`roles.${place.role}`),
          sub: [t(`roles.${place.role}`), place.title].filter(Boolean).join(' · '),
        })),
      }))}
      title={t('title')}
    />
  )
}
