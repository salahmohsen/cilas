'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useTransition } from 'react'

import { Calendar } from '@/components/calendar/ui/calendar'
import type { CalendarView } from '@/components/calendar/ui/calendar-views'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import { Link } from '@/i18n/navigation'
import type { CalendarItem } from '@/lib/calendar-items'

import { CalendarFeed, CalendarJump } from './calendar-tools'
import { calendarQuery, holds, readCalendarUrl, viewDays, type DayRange } from './calendar-url'

type Props = {
  /** The items of the days loaded, `range`. */
  items: CalendarItem[]
  range: DayRange
  /** Today in Cairo, as the server saw it, so the first render matches. */
  today: string
  /** What the legend calls each kind: "Thematic course", "Talk". */
  kinds: Record<string, string>
  /** The months that have something, `YYYY-MM`, oldest first: the way out of an empty view. */
  months: string[]
}

const monthOfDay = (day: string) => day.slice(0, 7)

/**
 * The public calendar, view only, for every visitor. Its view and day live in
 * the URL. A move within the days loaded only writes the URL; a move past them
 * asks the server for the days around the new place.
 */
export function PublicCalendar({ items, range, today, kinds, months }: Props) {
  const t = useTranslations('Calendar')
  const locale = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const { view, day } = readCalendarUrl(
    { view: params.get('view'), date: params.get('date') },
    today,
  )

  const kind = useCallback((value: string) => kinds[value] ?? value, [kinds])
  const labels = useCalendarLabels({ kind, newItem: '' })

  const load = useCallback(
    (to: CalendarView, at: string, replace = false) =>
      startTransition(() =>
        router[replace ? 'replace' : 'push'](`/${locale}/calendar${calendarQuery(to, at)}`, {
          scroll: false,
        }),
      ),
    [router, locale],
  )

  // Back or forward to a place the page did not load (a rare history entry): load it.
  useEffect(() => {
    if (!holds(range, view, day)) load(view, day, true)
  }, [range, view, day, load])

  const navigate = (to: CalendarView, at: string) => {
    if (holds(range, to, at)) window.history.pushState(null, '', calendarQuery(to, at))
    else load(to, at)
  }

  // An empty month points to the nearest month that has something.
  const days = viewDays(view, day)
  const empty =
    view === 'month' &&
    !items.some((item) =>
      item.blocks.some((block) => block.date >= days.from && block.date <= days.to),
    )
  const next = months.find((month) => month > monthOfDay(day))
  const last = months.findLast((month) => month < monthOfDay(day))
  const nearest = empty ? (next ?? last) : undefined
  const monthName = (month: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${month}-01T00:00:00Z`),
    )

  return (
    <div className="grid gap-4">
      {/* On a phone the feed is an icon beside the title, and the month and year take a row. */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="me-auto text-2xl font-medium">{t('title')}</h1>
        <div className="order-last w-full sm:order-none sm:w-auto">
          <CalendarJump
            day={day}
            years={[
              ...new Set([...months, monthOfDay(today)].map((month) => Number(month.slice(0, 4)))),
            ].toSorted()}
            onJump={(at) => load(view, at)}
          />
        </div>
        <div className="sm:hidden">
          <CalendarFeed feedPath={`/${locale}/calendar.ics`} iconOnly />
        </div>
        <div className="hidden sm:block">
          <CalendarFeed feedPath={`/${locale}/calendar.ics`} />
        </div>
      </div>

      {nearest ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {t('empty')}{' '}
          <Link
            className="underline underline-offset-4"
            href={`/calendar${calendarQuery('month', `${nearest}-01`)}`}
            scroll={false}
          >
            {t(next ? 'nextOn' : 'lastOn', { date: monthName(nearest) })}
          </Link>
        </p>
      ) : null}

      <Calendar
        mode="view"
        items={items}
        labels={labels}
        locale={locale}
        view={view}
        day={day}
        onNavigate={navigate}
        onOpen={(id) => {
          const href = items.find((item) => item.id === id)?.href
          if (href) router.push(href)
        }}
        actionsOf={(item) =>
          item.href
            ? [
                {
                  id: 'open',
                  label: t(item.kind.startsWith('event:') ? 'viewEvent' : 'viewCourse'),
                  href: item.href,
                  primary: true,
                },
              ]
            : []
        }
      />
    </div>
  )
}
