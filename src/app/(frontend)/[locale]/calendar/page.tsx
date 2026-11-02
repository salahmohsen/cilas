import { pageAlternates } from '@/lib/seo'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'

import { getCachedCalendarItems } from '@/api/calendar.api'
import { CalendarFeed, CalendarJump } from '@/components/calendar/calendar-tools'
import {
  AgendaView,
  calendarLabels,
  CalendarLegend,
  MonthView,
  WeekView,
} from '@/components/calendar/calendar-views'
import { Link } from '@/i18n/navigation'
import { cairoDay } from '@/lib/cairo-day'
import { numberingSystemOf } from '@/lib/digits'
import {
  CALENDAR_VIEWS,
  monthStart,
  readCalendarParams,
  viewRange,
  type CalendarView,
} from '@/lib/calendar'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ view?: string; date?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = await getTranslations('Calendar')
  return {
    alternates: pageAlternates('/calendar', locale),
    title: t('metaTitle'),
    description: t('intro'),
  }
}

const UTC = (day: string) => new Date(`${day}T00:00:00Z`)

/** Every year from the first the calendar has to the last (or this one): none skipped, so any month can be reached. */
const yearsOf = (years: number[]) => {
  const first = Math.min(...years),
    last = Math.max(...years)
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

/**
 * The calendar: courses' meetings and events by month, week or as an
 * agenda. The view and day are in the URL (`?view=week&date=2026-03-07`),
 * so every view can be linked to and the browser's back button works.
 */
export default async function CalendarPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  const [t, format, labels] = await Promise.all([
    getTranslations('Calendar'),
    getFormatter(),
    calendarLabels(),
  ])
  const today = cairoDay(new Date())!
  const { view, date } = readCalendarParams(query, today)
  const range = viewRange(view, date)
  const nu = numberingSystemOf(locale)
  const all = await getCachedCalendarItems(locale === 'ar' ? 'ar' : 'en')
  const items = all.filter((i) => i.date >= range.from && i.date <= range.to)
  // In a month, the days outside it belong to its neighbours: the phone list skips them.
  const month = monthStart(date).slice(0, 7)

  const href = (v: CalendarView, d: string) => `/calendar?view=${v}&date=${d}`
  const title =
    view === 'month'
      ? format.dateTime(UTC(date), {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
          numberingSystem: nu,
        })
      : `${format.dateTime(UTC(range.from), { day: 'numeric', month: 'short', timeZone: 'UTC', numberingSystem: nu })} – ${format.dateTime(UTC(range.to), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', numberingSystem: nu })}`

  // Nothing here: point to the nearest time that has something.
  const after = all.find((i) => i.date > range.to)
  const before = [...all].reverse().find((i) => i.date < range.from)
  const nearest = after ?? before

  return (
    <div className="page-frame cal-page py-10 sm:py-14">
      {/* One poster card, as the study page's header is: the title on yellow, the way around the
          calendar beside it, the views and the feed across the foot. */}
      <header className="cal-head">
        <div className="cal-head-title">
          <p className="sr-only">{t('title')}</p>
          <h1 className="cal-title">{title}</h1>
          <p className="cal-head-count">{t('inView', { count: items.length })}</p>
        </div>
        <CalendarLegend items={items} label={t('legend')} labels={labels} />
        <div className="cal-head-nav">
          <nav aria-label={t('navigation')} className="cal-head-controls">
            {/* Time runs left to right on a calendar's arrows in either language:
              next is always the right arrow. */}
            <div className="flex items-center gap-1" dir="ltr">
              <Link
                aria-label={t('previous')}
                className="cal-step"
                href={href(view, range.previous)}
              >
                <ChevronLeft aria-hidden size={18} />
              </Link>
              <Link className="cal-today" href={href(view, today)}>
                {t('today')}
              </Link>
              <Link aria-label={t('next')} className="cal-step" href={href(view, range.next)}>
                <ChevronRight aria-hidden size={18} />
              </Link>
            </div>
            <CalendarJump
              date={date}
              view={view}
              years={yearsOf(
                all.map((i) => Number(i.date.slice(0, 4))).concat(Number(today.slice(0, 4))),
              )}
            />
          </nav>
        </div>
        <div className="cal-head-foot">
          <div className="cal-head-views">
            <div className="cal-switch" role="group" aria-label={t('views')}>
              {CALENDAR_VIEWS.map((v) => (
                <Link aria-current={v === view ? 'page' : undefined} href={href(v, date)} key={v}>
                  {t(`view.${v}`)}
                </Link>
              ))}
            </div>
          </div>
          <div className="cal-head-feed">
            <CalendarFeed feedPath={`/${locale}/calendar.ics`} />
          </div>
        </div>
      </header>

      <div className="mt-6">
        {!items.length ? (
          <p className="cal-empty">
            {t('empty')}{' '}
            {nearest ? (
              <Link className="underline underline-offset-4" href={href(view, nearest.date)}>
                {t(after ? 'nextOn' : 'lastOn', {
                  date: format.dateTime(UTC(nearest.date), {
                    dateStyle: 'long',
                    timeZone: 'UTC',
                    numberingSystem: nu,
                  }),
                })}
              </Link>
            ) : null}
          </p>
        ) : null}

        {view === 'month' ? (
          <>
            <div className="hidden md:block">
              <MonthView date={date} items={items} labels={labels} today={today} />
            </div>
            {/* A phone has no room for seven columns: the month is a list. */}
            <div className="md:hidden">
              <AgendaView items={items.filter((i) => i.date.startsWith(month))} labels={labels} />
            </div>
          </>
        ) : null}
        {view === 'week' ? (
          <WeekView date={date} items={items} labels={labels} today={today} />
        ) : null}
        {view === 'agenda' ? <AgendaView items={items} labels={labels} /> : null}
      </div>
    </div>
  )
}
