import { CAIRO, cairoNoon } from '@/lib/cairo-day'
import { type Locale } from '@/i18n/routing'
import { pageAlternates } from '@/lib/seo'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import type { Reader } from '@/api/articles.api'
import { getOpenNow } from '@/api/home.api'
import { OpenGrid, type OpenPost } from '@/components/open-grid'
import { Link } from '@/i18n/navigation'
import { numberingSystemOf } from '@/lib/digits'

/** Shared by the cached page and the signed-in one. */
export async function openMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = await getTranslations('Home')
  return {
    alternates: pageAlternates('/apply', locale),
    title: t('openTitle'),
    description: t('openText'),
  }
}

/**
 * Open for registration: every programme and course that can still be
 * joined, programmes (the Bridge) first, then courses by the nearest
 * deadline. The header's Apply leads here while anything is open. `reader`
 * is null on the cached page; the signed-in page passes the account, which
 * adds `community` courses.
 */
export async function OpenPage({ locale, reader }: { locale: string; reader: Reader }) {
  const payload = await getPayload({ config })
  const [t, format, items] = await Promise.all([
    getTranslations('Home'),
    getFormatter(),
    getOpenNow(payload, locale as Locale, reader),
  ])
  const day = (iso: string) =>
    format.dateTime(cairoNoon(iso), {
      day: 'numeric',
      month: 'long',
      timeZone: CAIRO,
      numberingSystem: numberingSystemOf(locale),
    })
  const and = locale === 'ar' ? ' و' : ' & '

  const posts: OpenPost[] = items.map((item, i) => {
    const kind = item.kind === 'programme' ? t('programme') : (item.type ?? t('programme'))
    return {
      id: `${item.kind}-${i}`,
      href: `/${locale}${item.href}`,
      title: item.title,
      excerpt: item.when ?? '',
      category: kind,
      label: kind,
      // The deadline stands where a post's date would; the given order keeps ours.
      date: item.deadline ?? '9999-12-31',
      dateLabel: item.deadline ? t('closesOn', { date: day(item.deadline) }) : t('noDeadline'),
      readTime: 0,
      readTimeLabel: '',
      author: { name: item.fellows?.length ? item.fellows.join(and) : 'CILAS' },
      image: item.image,
      // A programme (the Bridge) leads, as the large card.
      featured: item.kind === 'programme',
    }
  })
  const categories = ['All', ...new Set(posts.map((p) => p.category))]

  return (
    <div className="page-frame flex flex-col gap-10 py-10 sm:py-14">
      <header className="home-section-header">
        <h1 className="home-heading">{t('openTitle')}</h1>
        <p className="home-lead">{posts.length ? t('openText') : t('noneOpen')}</p>
      </header>
      {posts.length ? (
        <OpenGrid categories={categories} posts={posts} title={t('openTitle')} />
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
