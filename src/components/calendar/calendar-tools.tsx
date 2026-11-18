'use client'

import { CalendarPlus, Check, Copy, Download, Rss } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu'
import { Input } from '@/components/arc/input/input'
import { useCopyFeedback } from '@/components/arc/lib/use-copy-feedback'
import { Select } from '@/components/select'
import { track } from '@/lib/analytics/track'
import { localDigits } from '@/lib/digits'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/** Going straight to any month: a month and a year, each a select that goes there when picked. */
export function CalendarJump({
  day,
  years,
  onJump,
}: {
  day: string
  /** The years the calendar has something in, oldest first. */
  years: number[]
  /** Goes to the first day of the month picked. */
  onJump: (day: string) => void
}) {
  const t = useTranslations('Calendar')
  const locale = useLocale()
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  const monthName = (m: number) =>
    new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2000, m - 1, 1)),
    )
  const go = (y: number, m: number) => onJump(`${y}-${String(m).padStart(2, '0')}-01`)

  const yearList = years.includes(year) ? years : [...years, year].toSorted()

  return (
    <div className="flex items-center gap-2">
      <Select
        hideLabel
        items={MONTHS.map((m) => ({ value: String(m), label: monthName(m) }))}
        label={t('month')}
        onValueChange={(m) => go(year, Number(m))}
        searchable={false}
        value={String(month)}
      />
      <Select
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
export function CalendarFeed({
  feedPath,
  iconOnly,
}: {
  /** `/en/calendar.ics`. */
  feedPath: string
  /** Only the icon shows; the label stays its name. */
  iconOnly?: boolean
}) {
  const t = useTranslations('Calendar')
  const [announce, setAnnounce] = useState('')
  const [manualUrl, setManualUrl] = useState('')
  const { state, copy } = useCopyFeedback(2500)
  useEffect(() => {
    if (state === 'idle') setAnnounce('')
  }, [state])
  const feedUrl = () => `${window.location.origin}${feedPath}`

  return (
    <div>
      <DropdownMenu
        icon={
          state === 'copied' ? (
            <Check aria-hidden size={16} />
          ) : (
            <CalendarPlus aria-hidden size={16} />
          )
        }
        items={[
          {
            label: t('subscribe'),
            icon: <Rss aria-hidden size={16} />,
            onSelect: () => {
              track('calendar_added', { source: 'feed-subscribe' })
              window.location.href = feedUrl().replace(/^https?:/, 'webcal:')
            },
          },
          {
            label: t('download'),
            icon: <Download aria-hidden size={16} />,
            onSelect: () => {
              track('calendar_added', { source: 'feed-download' })
              // A file, not a page: a link asked to download it.
              const link = document.createElement('a')
              link.href = `${feedPath}?download`
              link.download = ''
              link.click()
            },
          },
          {
            label: state === 'copied' ? t('copied') : t('copyFeed'),
            icon: <Copy aria-hidden size={16} />,
            onSelect: async () => {
              const url = feedUrl()
              const ok = await copy(url)
              setManualUrl(ok ? '' : url)
              const message = t(ok ? 'copied' : 'copyFailed')
              setAnnounce((previous) => (previous === message ? `${message}\u00a0` : message))
            },
          },
        ]}
        label={state === 'copied' ? t('copied') : t('feed')}
        iconOnly={iconOnly}
      />
      <span role="status" aria-live="polite" className="block text-sm">
        {announce}
      </span>
      {manualUrl && (
        <Input
          label={t('feedUrl')}
          value={manualUrl}
          readOnly
          dir="ltr"
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  )
}
