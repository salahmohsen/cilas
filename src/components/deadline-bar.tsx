'use client'

import { useLocale, useTranslations } from 'next-intl'

import { AnnouncementBar } from '@/components/arc/announcement-bar/announcement-bar'
import { DeadlineCountdown } from '@/components/home/deadline-countdown'

export type Deadline = { id: string; title: string; href: string; deadline: string }

/**
 * A bar over every page, above the site header, while registration is open
 * somewhere with a deadline: what closes, and when. Several take turns;
 * dismissing hides the bar until the set of deadlines changes.
 */
export function DeadlineBar({ items }: { items: Deadline[] }) {
  const t = useTranslations('Home')
  const tc = useTranslations('Home.controls')
  const locale = useLocale()
  if (!items.length) return null
  return (
    <AnnouncementBar
      controls={items.length > 1}
      // A new set of deadlines brings the bar back.
      id={`home-deadlines-${items.map((i) => i.id).join('-')}`}
      label={t('announcement')}
      labels={{
        previous: tc('previous'),
        next: tc('next'),
        pause: tc('pause'),
        resume: tc('resume'),
        dismiss: tc('dismiss'),
        position: (position, total) => tc('position', { position, total }),
      }}
      messages={items.map((item) => ({
        id: item.id,
        // The words and the time left are one group; the action sits further off.
        message: (
          <span className="deadline-message">
            <span>
              <span dir="auto">{item.title}</span> {t('announcementClosesIn')}
            </span>
            <DeadlineCountdown deadline={item.deadline} />
          </span>
        ),
        action: { label: t('details'), href: `/${locale}${item.href}` },
      }))}
      tone="inverted"
    />
  )
}
