import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import type { Locale } from '@/api/articles.api'
import { getOpenNow } from '@/api/home.api'
import { OpenGrid, type OpenPost } from '@/components/open-grid'
import { Link } from '@/i18n/navigation'
import { numberingSystemOf } from '@/lib/digits'

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
  const [t, format, items] = await Promise.all([
    getTranslations('Home'),
    getFormatter(),
    getOpenNow(payload, locale as Locale),
  ])
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), {
      day: 'numeric',
      month: 'long',
      timeZone: 'Africa/Cairo',
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8 sm:py-14 xl:px-0">
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
