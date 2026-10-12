import { getFormatter, getTranslations } from 'next-intl/server'

import type { OpenItem } from '@/api/home.api'
import { DeadlineCountdown } from '@/components/home/deadline-countdown'
import { Link } from '@/i18n/navigation'
import { numberingSystemOf } from '@/lib/digits'

/**
 * What people can register for today, each with the time left. With
 * nothing open, the section says so and points to where new cycles are
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

  return (
    <section aria-labelledby="home-open" className="home-section" id="open">
      <header className="home-section-header">
        <h2 className="home-heading" id="home-open">
          {t('openTitle')}
        </h2>
        <p className="home-lead">{items.length ? t('openText') : t('noneOpen')}</p>
      </header>

      {items.length ? (
        <ul className="home-open-list">
          {items.map((item) => (
            <li className="home-open-item" key={`${item.kind}-${item.href}`}>
              {item.image ? (
                // Covers come from the storage host, as on course pages.
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="home-open-image" loading="lazy" src={item.image.src} />
              ) : (
                <span aria-hidden className="home-open-image" />
              )}
              <div className="home-open-copy">
                <p className="home-open-meta">
                  {item.kind === 'programme' ? t('programme') : item.sublabel}
                </p>
                <h3 className="home-open-title" dir="auto">
                  {/* The whole row is the link's target; the title names it. */}
                  <Link className="home-open-link" href={item.href}>
                    {item.title}
                  </Link>
                </h3>
                {item.excerpt ? (
                  <p className="home-open-excerpt" dir="auto">
                    {item.excerpt}
                  </p>
                ) : null}
              </div>
              <div className="home-open-deadline">
                {item.deadline ? (
                  <>
                    <span className="home-open-deadline-label">{t('closesIn')}</span>
                    <DeadlineCountdown deadline={item.deadline} />
                    <span className="home-open-deadline-date">
                      {t('closesOn', { date: day(item.deadline) })}
                    </span>
                  </>
                ) : (
                  <span className="home-open-deadline-label">{t('noDeadline')}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
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
