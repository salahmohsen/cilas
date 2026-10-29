import { getFormatter, getTranslations } from 'next-intl/server'

import type { OpenItem } from '@/api/home.api'
import type { PosterData } from '@/components/home/poster'
import { PosterCarousel } from '@/components/home/poster-carousel'
import { numberingSystemOf } from '@/lib/digits'
import { posterLayouts } from '@/lib/posters'

/**
 * What people can register for today, a poster each, turning on their own.
 * The page leaves the section out when nothing is open.
 */
/**
 * What is open as posters, the nearest deadline first: shared by the home
 * page's carousel and the Open for registration page (/apply).
 */
export async function openPosters(items: OpenItem[], locale: string): Promise<PosterData[]> {
  const [t, format] = await Promise.all([getTranslations('Home'), getFormatter()])
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), {
      day: 'numeric',
      // Short, so the date and the time left share one line in the poster's strip.
      month: 'short',
      timeZone: 'Africa/Cairo',
      numberingSystem: numberingSystemOf(locale),
    })
  const and = locale === 'ar' ? ' و' : ' & '
  const layouts = posterLayouts(items.length)
  return items.map((item, i) => ({
    id: `${item.kind}-${item.href}`,
    href: `/${locale}${item.href}`,
    layout: layouts[i]!,
    label: item.kind === 'programme' ? t('programme') : item.type,
    separateLabel: true,
    title: item.title,
    credit: item.fellows?.length ? t('with', { names: item.fellows.join(and) }) : undefined,
    image: item.image,
    meta: item.deadline
      ? { lines: [t('closesOn', { date: day(item.deadline) })], deadline: item.deadline }
      : { lines: [t('noDeadline')] },
    details: item.when ? [item.when] : [],
    action: t('apply'),
  }))
}

export async function OpenNow({ items, locale }: { items: OpenItem[]; locale: string }) {
  const [t, posters] = await Promise.all([getTranslations('Home'), openPosters(items, locale)])
  return (
    <section aria-labelledby="home-open" className="home-section" id="open">
      <header className="home-section-header">
        <h2 className="home-heading" id="home-open">
          {t('openTitle')}
        </h2>
        <p className="home-lead">{t('openText')}</p>
      </header>

      <PosterCarousel label={t('openTitle')} posters={posters} />
    </section>
  )
}
