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
export async function OpenNow({ items, locale }: { items: OpenItem[]; locale: string }) {
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
  const posters: PosterData[] = items.map((item, i) => ({
    id: `${item.kind}-${item.href}`,
    href: `/${locale}${item.href}`,
    layout: layouts[i]!,
    label: item.kind === 'programme' ? t('programme') : item.type,
    title: item.title,
    description: item.excerpt,
    credit: item.fellows?.length ? t('with', { names: item.fellows.join(and) }) : undefined,
    image: item.image,
    meta: item.deadline
      ? { lines: [t('closesOn', { date: day(item.deadline) })], deadline: item.deadline }
      : { lines: [t('noDeadline')] },
    details: item.when ? [item.when] : [],
    action: t('apply'),
  }))

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
