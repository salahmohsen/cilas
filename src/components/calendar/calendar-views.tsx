import { getFormatter, getTranslations } from 'next-intl/server'

import type { CalendarItem } from '@/api/calendar.api'
import { Link } from '@/i18n/navigation'
import { monthGrid, monthStart, weekDays } from '@/lib/calendar'

/** How many items a month's day cell lists before "+N more". */
const IN_CELL = 3

type Labels = {
  type: (item: CalendarItem) => string
  session: (n: number) => string
  starts: string
  more: (n: number) => string
  cancelled: string
}

const byDay = (items: CalendarItem[]) => {
  const map = new Map<string, CalendarItem[]>()
  for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item])
  return map
}

const UTC = (day: string) => new Date(`${day}T00:00:00Z`)

/** "18:00", or nothing for an item without a time. */
const timeOf = (item: CalendarItem) => (item.start ? item.start : null)

/** An item's title, linked to its course when it has a page. */
function ItemTitle({ item, className }: { item: CalendarItem; className?: string }) {
  const title = (
    <span className={item.cancelled ? 'line-through opacity-60' : undefined} dir="auto">
      {item.title}
    </span>
  )
  return item.href ? (
    <Link className={`underline-offset-4 hover:underline ${className ?? ''}`} href={item.href}>
      {title}
    </Link>
  ) : (
    <span className={className}>{title}</span>
  )
}

/**
 * The month: whole weeks, Saturday to Friday. A day a course with a cover
 * meets takes that cover as its ground; its items sit on it in white.
 */
export async function MonthView({
  date,
  today,
  items,
  labels,
}: {
  date: string
  today: string
  items: CalendarItem[]
  labels: Labels
}) {
  const format = await getFormatter()
  const days = monthGrid(date)
  const month = monthStart(date).slice(0, 7)
  const map = byDay(items)
  const weekday = (day: string) => format.dateTime(UTC(day), { weekday: 'short', timeZone: 'UTC' })

  return (
    <div className="cal-month" role="grid">
      <div className="cal-month-head" role="row">
        {days.slice(0, 7).map((d) => (
          <div className="cal-weekday" key={d} role="columnheader">
            {weekday(d)}
          </div>
        ))}
      </div>
      <div className="cal-month-body">
        {days.map((day) => {
          const dayItems = map.get(day) ?? []
          const cover = dayItems.find((i) => i.cover && !i.cancelled)?.cover
          const outside = !day.startsWith(month)
          return (
            <div
              aria-label={format.dateTime(UTC(day), { dateStyle: 'full', timeZone: 'UTC' })}
              className="cal-day"
              data-cover={cover ? '' : undefined}
              data-outside={outside || undefined}
              data-today={day === today || undefined}
              key={day}
              role="gridcell"
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={cover.alt} className="cal-day-cover" loading="lazy" src={cover.url} />
              ) : null}
              <span className="cal-day-number">{format.number(Number(day.slice(8)), { numberingSystem: 'latn' })}</span>
              {dayItems.length ? (
                <ul className="cal-day-items">
                  {dayItems.slice(0, IN_CELL).map((item) => (
                    <li key={item.key}>
                      {timeOf(item) ? (
                        <span className="cal-time" dir="ltr">
                          {timeOf(item)}
                        </span>
                      ) : item.starts ? (
                        <span className="cal-time">{labels.starts}</span>
                      ) : null}
                      <ItemTitle item={item} />
                    </li>
                  ))}
                  {dayItems.length > IN_CELL ? (
                    <li>
                      <Link className="cal-more" href={`/calendar?view=agenda&date=${day}`}>
                        {labels.more(dayItems.length - IN_CELL)}
                      </Link>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The week: seven columns, each day's items in time order with their cover. */
export async function WeekView({
  date,
  today,
  items,
  labels,
}: {
  date: string
  today: string
  items: CalendarItem[]
  labels: Labels
}) {
  const format = await getFormatter()
  const map = byDay(items)
  return (
    <div className="cal-week">
      {weekDays(date).map((day) => (
        <section aria-label={format.dateTime(UTC(day), { dateStyle: 'full', timeZone: 'UTC' })} className="cal-week-day" data-today={day === today || undefined} key={day}>
          <header className="cal-week-head">
            <span className="cal-weekday">{format.dateTime(UTC(day), { weekday: 'long', timeZone: 'UTC' })}</span>
            <span className="cal-day-number">{format.number(Number(day.slice(8)), { numberingSystem: 'latn' })}</span>
          </header>
          <ul className="grid gap-3">
            {(map.get(day) ?? []).map((item) => (
              <li className="cal-card" key={item.key}>
                {item.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={item.cover.alt} className="cal-card-cover" loading="lazy" src={item.cover.url} />
                ) : null}
                <div className="p-3">
                  <p className="cal-time" dir={item.start ? 'ltr' : undefined}>
                    {item.start ? `${item.start}${item.end ? `–${item.end}` : ''}` : item.starts ? labels.starts : ''}
                  </p>
                  <ItemTitle className="mt-1 block text-sm font-medium" item={item} />
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {[labels.type(item), item.session ? labels.session(item.session) : null, item.cancelled ? labels.cancelled : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** The agenda: the days that have something, each with its items in time order. */
export async function AgendaView({ items, labels }: { items: CalendarItem[]; labels: Labels }) {
  const format = await getFormatter()
  const map = byDay(items)
  return (
    <ol className="cal-agenda">
      {[...map.entries()].map(([day, dayItems]) => (
        <li className="cal-agenda-day" key={day}>
          <div className="cal-agenda-date">
            <span className="cal-day-number">{format.number(Number(day.slice(8)), { numberingSystem: 'latn' })}</span>
            <span className="text-sm leading-snug text-[var(--text-muted)]">
              {format.dateTime(UTC(day), { weekday: 'long', timeZone: 'UTC' })}
              <br />
              {format.dateTime(UTC(day), { month: 'long', year: 'numeric', timeZone: 'UTC', numberingSystem: 'latn' })}
            </span>
          </div>
          <ul className="grid gap-2">
            {dayItems.map((item) => (
              <li className="cal-agenda-item" key={item.key}>
                <span className="cal-time" dir={item.start ? 'ltr' : undefined}>
                  {item.start ? `${item.start}${item.end ? `–${item.end}` : ''}` : item.starts ? labels.starts : ''}
                </span>
                {item.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={item.cover.alt} className="cal-agenda-cover" loading="lazy" src={item.cover.url} />
                ) : null}
                <span className="min-w-0">
                  <ItemTitle className="block font-medium" item={item} />
                  <span className="block text-xs text-[var(--text-muted)]">
                    {[labels.type(item), item.session ? labels.session(item.session) : null, item.cancelled ? labels.cancelled : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

/** The labels the views share, in the site language. */
export const calendarLabels = async (): Promise<Labels> => {
  const [t, tf] = await Promise.all([getTranslations('Calendar'), getTranslations('Study.filters')])
  return {
    type: (item) => (item.kind === 'course' ? tf(`types.${item.type}`) : t(`eventTypes.${item.type}`)),
    session: (n) => t('session', { n }),
    starts: t('starts'),
    more: (n) => t('more', { count: n }),
    cancelled: t('cancelled'),
  }
}
