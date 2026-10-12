import { getFormatter, getTranslations } from 'next-intl/server'

import type { OpenItem } from '@/api/home.api'
import type { PosterData } from '@/components/home/poster'
import { PosterCarousel } from '@/components/home/poster-carousel'
import { Link } from '@/i18n/navigation'
import { numberingSystemOf } from '@/lib/digits'
import { posterLayouts } from '@/lib/posters'

/**
 * What people can register for today, a poster each, turning on their own.
 * With nothing open, the section says so and points to where new cycles are
 * announced.
 */
export async function OpenNow({ items, locale }: { items: OpenItem[]; locale: string }) {
  const [t, format] = await Promise.all([getTranslations('Home'), getFormatter()])
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00Z`), {
      day: 'numeric',
      month: 'long',
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
        <p className="home-lead">{items.length ? t('openText') : t('noneOpen')}</p>
      </header>

      {posters.length ? (
        <PosterCarousel label={t('openTitle')} posters={posters} />
      ) : (
        <div className="home-none">
          <p className="home-none-text">{t('noneOpenText')}</p>
          <div className="home-none-actions">
            <a className="home-action" data-outline href="#newsletter">
              {t('subscribe')}
            </a>
            <Link className="home-action" data-plain href="/study">
              {t('pastCourses')}
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
