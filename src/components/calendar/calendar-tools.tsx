'use client'

import { CalendarPlus, Copy, Download, Rss } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu'
import { Select } from '@/components/select'
import { useRouter } from '@/i18n/navigation'
import { localDigits } from '@/lib/digits'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/** Going straight to any month: a month and a year, each a select that goes there when picked. */
export function CalendarJump({
  view,
  date,
  years,
}: {
  view: 'month' | 'week' | 'agenda'
  date: string
  /** The years the calendar has something in, oldest first. */
  years: number[]
}) {
  const t = useTranslations('Calendar')
  const locale = useLocale()
  const router = useRouter()
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const monthName = (m: number) =>
    new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, m - 1, 1)))
  const go = (y: number, m: number) => router.push(`/calendar?view=${view}&date=${y}-${String(m).padStart(2, '0')}-01`)

  const yearList = years.includes(year) ? years : [...years, year].sort()

  return (
    <div className="cal-jump flex items-center gap-2">
      <Select
        className="cal-select"
        hideLabel
        items={MONTHS.map((m) => ({ value: String(m), label: monthName(m) }))}
        label={t('month')}
        onValueChange={(m) => go(year, Number(m))}
        searchable={false}
        value={String(month)}
      />
      <Select
        className="cal-select"
        hideLabel
        items={yearList.map((y) => ({ value: String(y), label: localDigits(y, locale) }))}
        label={t('year')}
        onValueChange={(y) => go(Number(y), month)}
        searchable={false}
        value={String(year)}
      />
    </div>
  )
}

/** Taking the calendar away: subscribing to its feed in a calendar app, downloading it, or copying the feed's address. */
export function CalendarFeed({ feedPath }: { /** `/en/calendar.ics`. */ feedPath: string }) {
  const t = useTranslations('Calendar')
  const [announce, setAnnounce] = useState('')
  const feedUrl = () => `${window.location.origin}${feedPath}`

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu
        icon={<CalendarPlus aria-hidden size={16} />}
        items={[
          {
            label: t('subscribe'),
            icon: <Rss aria-hidden size={16} />,
            onSelect: () => {
              window.location.href = feedUrl().replace(/^https?:/, 'webcal:')
            },
          },
          {
            label: t('download'),
            icon: <Download aria-hidden size={16} />,
            onSelect: () => {
              // A file, not a page: a link asked to download it.
              const link = document.createElement('a')
              link.href = `${feedPath}?download`
              link.download = ''
              link.click()
            },
          },
          {
            label: t('copyFeed'),
            icon: <Copy aria-hidden size={16} />,
            onSelect: () => {
              navigator.clipboard
                .writeText(feedUrl())
                .then(() => setAnnounce(t('copied')))
                .catch(() => setAnnounce(t('copyFailed')))
            },
          },
        ]}
        label={t('feed')}
      />
      <span aria-live="polite" className="text-xs text-[var(--text-muted)]">
        {announce}
      </span>
    </div>
  )
}
