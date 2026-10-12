import config from '@payload-config'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import type { Locale } from '@/api/articles.api'
import { getCalendarItems } from '@/api/calendar.api'
import { AgendaView, calendarLabels, MonthView, WeekView } from '@/components/calendar/calendar-views'
import { Link } from '@/i18n/navigation'
import { cairoDay } from '@/lib/cairo-day'
import { CALENDAR_VIEWS, monthStart, readCalendarParams, viewRange, type CalendarView } from '@/lib/calendar'
import { COURSES_TAG } from '@/lib/revalidate-courses'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ view?: string; date?: string }>
}

/** Every meeting and event, built once per language and kept until a course changes. */
const itemsFor = unstable_cache(
  async (locale: Locale) => getCalendarItems(await getPayload({ config }), locale),
  ['calendar-items'],
  { tags: [COURSES_TAG], revalidate: 3600 },
)

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Calendar')
  return { title: t('metaTitle'), description: t('intro') }
}

const UTC = (day: string) => new Date(`${day}T00:00:00Z`)

/**
 * The calendar: courses' meetings and events by month, week or as an
 * agenda. The view and day are in the URL (`?view=week&date=2026-03-07`),
 * so every view can be linked to and the browser's back button works.
 */
export default async function CalendarPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  const [t, format, labels] = await Promise.all([getTranslations('Calendar'), getFormatter(), calendarLabels()])
  const today = cairoDay(new Date())!
  const { view, date } = readCalendarParams(query, today)
  const range = viewRange(view, date)
  const all = await itemsFor(locale === 'ar' ? 'ar' : 'en')
  const items = all.filter((i) => i.date >= range.from && i.date <= range.to)
  // In a month, the days outside it belong to its neighbours: the phone list skips them.
  const month = monthStart(date).slice(0, 7)

  const href = (v: CalendarView, d: string) => `/calendar?view=${v}&date=${d}`
  const title =
    view === 'month'
      ? format.dateTime(UTC(date), { month: 'long', year: 'numeric', timeZone: 'UTC', numberingSystem: 'latn' })
      : `${format.dateTime(UTC(range.from), { day: 'numeric', month: 'short', timeZone: 'UTC', numberingSystem: 'latn' })} – ${format.dateTime(UTC(range.to), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', numberingSystem: 'latn' })}`

  // Nothing here: point to the nearest time that has something.
  const after = all.find((i) => i.date > range.to)
  const before = [...all].reverse().find((i) => i.date < range.from)
  const nearest = after ?? before

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-14 xl:px-0">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm text-[var(--text-muted)]">{t('title')}</p>
          <h1 className="mt-1 text-[clamp(1.8rem,3.6vw,2.6rem)] leading-tight font-semibold tracking-tight rtl:tracking-normal">
            {title}
          </h1>
        </div>
        <nav aria-label={t('navigation')} className="flex flex-wrap items-center gap-3">
          <div className="cal-switch" role="group" aria-label={t('views')}>
            {CALENDAR_VIEWS.map((v) => (
              <Link aria-current={v === view ? 'page' : undefined} href={href(v, date)} key={v}>
                {t(`view.${v}`)}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Link aria-label={t('previous')} className="cal-step" href={href(view, range.previous)}>
              <ChevronLeft aria-hidden className="rtl:-scale-x-100" size={18} />
            </Link>
            <Link className="cal-today" href={href(view, today)}>
              {t('today')}
            </Link>
            <Link aria-label={t('next')} className="cal-step" href={href(view, range.next)}>
              <ChevronRight aria-hidden className="rtl:-scale-x-100" size={18} />
            </Link>
          </div>
        </nav>
      </header>

      <div className="mt-8">
        {!items.length ? (
          <p className="cal-empty">
            {t('empty')}{' '}
            {nearest ? (
              <Link className="underline underline-offset-4" href={href(view, nearest.date)}>
                {t(after ? 'nextOn' : 'lastOn', {
                  date: format.dateTime(UTC(nearest.date), { dateStyle: 'long', timeZone: 'UTC', numberingSystem: 'latn' }),
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
        {view === 'week' ? <WeekView date={date} items={items} labels={labels} today={today} /> : null}
        {view === 'agenda' ? <AgendaView items={items} labels={labels} /> : null}
      </div>
    </div>
  )
}
