import { detailPath } from '@/lib/paths'
import { type Locale } from '@/i18n/routing'
import { pageAlternates } from '@/lib/seo'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { getFellows } from '@/api/people.api'
import { PeoplePage } from '@/components/person/people-page'
import { SEASON_ICONS } from '@/components/season-icon'
import type { Season } from '@/lib/cycle'
import { localDigits } from '@/lib/digits'
import { PUBLIC_LISTS_TAG } from '@/lib/paths'

type Props = { params: Promise<{ locale: string }> }

/** How many of a fellow's courses the panel lists. */
const COURSES_SHOWN = 4

/** Built from the courses, so it is kept until a course or person changes. */
const fellowsFor = unstable_cache(
  async (locale: Locale) => getFellows(await getPayload({ config }), locale),
  ['fellows'],
  { tags: [PUBLIC_LISTS_TAG], revalidate: 3600 },
)

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = await getTranslations('Fellows')
  return {
    alternates: pageAlternates('/people/fellows', locale),
    title: t('metaTitle'),
    description: t('intro'),
  }
}

/** CILAS's fellows on a wheel: everyone who has taught here, the most recent first. */
export default async function FellowsPage({ params }: Props) {
  const { locale } = await params
  const [t, tf] = await Promise.all([getTranslations('Fellows'), getTranslations('Study.filters')])
  const fellows = await fellowsFor(locale === 'ar' ? 'ar' : 'en')

  return (
    <PeoplePage
      count={t('count', { count: fellows.length })}
      intro={t('intro')}
      namespace="Fellows"
      people={fellows.map((f) => ({
        ...f,
        eyebrow: t('fellow'),
        lines: f.courses.slice(0, COURSES_SHOWN).map((c) => {
          const Icon = c.season ? SEASON_ICONS[c.season as Season] : null
          return {
            key: c.slug,
            title: c.title,
            href: detailPath('courses', String(c.slug)),
            ...(c.season && c.year
              ? { sub: `${tf(`seasons.${c.season}`)} ${localDigits(c.year, locale)}` }
              : {}),
            ...(Icon
              ? {
                  icon: (
                    <Icon
                      aria-hidden
                      className="course-season mt-0.5"
                      data-season={c.season}
                      size={16}
                      strokeWidth={1.5}
                    />
                  ),
                }
              : {}),
          }
        }),
      }))}
      title={t('title')}
    />
  )
}
