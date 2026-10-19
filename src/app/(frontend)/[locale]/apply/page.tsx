import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import type { Locale } from '@/api/articles.api'
import { getOpenNow } from '@/api/home.api'
import { Poster } from '@/components/home/poster'
import { openPosters } from '@/components/home/open-now'
import { Link } from '@/i18n/navigation'

// What is open follows deadlines: worked out every five minutes, as /api/open is.
export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Home')
  return { title: t('openTitle'), description: t('openText') }
}

/**
 * Open for registration: every programme and course that can still be
 * joined, programmes (the Bridge) first, then courses by the nearest
 * deadline. The header's Apply leads here while anything is open.
 */
export default async function ApplyPage({ params }: Props) {
  const { locale } = await params
  const payload = await getPayload({ config })
  const [t, items] = await Promise.all([
    getTranslations('Home'),
    getOpenNow(payload, locale as Locale),
  ])
  const posters = await openPosters(items, locale)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8 sm:py-14 xl:px-0">
      <header className="home-section-header">
        <h1 className="home-heading">{t('openTitle')}</h1>
        <p className="home-lead">{posters.length ? t('openText') : t('noneOpen')}</p>
      </header>
      {posters.length ? (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posters.map((poster) => (
            <li key={poster.id}>
              <Poster poster={poster} />
            </li>
          ))}
        </ul>
      ) : (
        <p>
          <Link className="bridge-link" href="/study">
            {t('browseCourses')}
          </Link>
        </p>
      )}
    </div>
  )
}
