import { getFormatter, getTranslations } from 'next-intl/server'

import type { CalendarItem } from '@/api/calendar.api'
import { Card } from '@/components/arc/card/card'
import { Link } from '@/i18n/navigation'
import { monthGrid, monthStart, weekDays } from '@/lib/calendar'

/** How many items a month's day cell lists before "+N more": fewer over a cover, to keep it legible. */
const IN_CELL = 3
const IN_COVER_CELL = 1

type Labels = {
  type: (item: CalendarItem) => string
  session: (n: number) => string
  starts: string
  more: (n: number) => string
  cancelled: string
  close: string
  open: (date: string, count: number) => string
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
  // dir=auto on the title itself: a title in the other script keeps its own
  // order, and its clamp's ellipsis falls at its own end.
  const classes = [className, item.cancelled ? 'line-through opacity-60' : null].filter(Boolean).join(' ')
  return item.href ? (
    <Link className={`underline-offset-4 hover:underline ${classes}`} dir="auto" href={item.href}>
      {item.title}
    </Link>
  ) : (
    <span className={classes} dir="auto">
      {item.title}
    </span>
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
  const number = (day: string) => format.number(Number(day.slice(8)), { numberingSystem: 'latn' })
  const longDate = (day: string) =>
    format.dateTime(UTC(day), { dateStyle: 'full', timeZone: 'UTC', numberingSystem: 'latn' })

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
          const all = map.get(day) ?? []
          const owner = all.find((i) => i.cover && !i.cancelled)
          const cover = owner?.cover
          // The course whose cover the day shows comes first, so its name is on it.
          const dayItems = owner ? [owner, ...all.filter((i) => i !== owner)] : all
          const outside = !day.startsWith(month)
          const shown = cover ? IN_COVER_CELL : IN_CELL
          return (
            <div
              className="cal-day"
              data-cover={cover ? '' : undefined}
              data-outside={outside || undefined}
              data-today={day === today || undefined}
              key={day}
              role="gridcell"
            >
              {dayItems.length ? (
                // A day with something opens, growing into that day's agenda.
                <Card
                  className="cal-day-card"
                  closeLabel={labels.close}
                  data-cover={cover ? '' : undefined}
                  details={<DayAgenda heading={longDate(day)} items={all} labels={labels} />}
                  media={
                    cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className="cal-cover-img" decoding="async" src={cover.url} />
                    ) : undefined
                  }
                  preview={
                    <ul className="cal-day-items">
                      {dayItems.slice(0, shown).map((item, i) => (
                        <li className="cal-item" key={item.key}>
                          <span className="cal-item-head">
                            {timeOf(item) ? (
                              <span className="cal-item-when" dir="ltr">
                                {timeOf(item)}
                              </span>
                            ) : item.starts ? (
                              <span className="cal-item-when">{labels.starts}</span>
                            ) : (
                              <span />
                            )}
                            {i === shown - 1 && dayItems.length > shown ? (
                              <span className="cal-more">{labels.more(dayItems.length - shown)}</span>
                            ) : null}
                          </span>
                          <span className="cal-item-title" dir="auto">
                            {item.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  }
                  title={number(day)}
                  triggerLabel={labels.open(longDate(day), all.length)}
                />
              ) : (
                <span className="cal-day-number">{number(day)}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** One day's agenda: what the quick look of a month's day lists. */
function DayAgenda({ heading, items, labels }: { heading: string; items: CalendarItem[]; labels: Labels }) {
  return (
    <div>
      <p className="text-sm text-[var(--text-muted)]">{heading}</p>
      <ul className="mt-4 grid gap-3">
        {items.map((item) => (
          <li className="cal-agenda-item" key={item.key}>
            <span className="cal-time" dir={item.start ? 'ltr' : undefined}>
              {item.start ? `${item.start}${item.end ? `–${item.end}` : ''}` : item.starts ? labels.starts : ''}
            </span>
            {item.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="cal-agenda-cover" loading="lazy" src={item.cover.url} />
            ) : null}
            <span className="min-w-0">
              <ItemTitle className="block font-medium text-[var(--foreground)]" item={item} />
              <span className="block text-xs text-[var(--text-muted)]">
                {[labels.type(item), item.session ? labels.session(item.session) : null, item.cancelled ? labels.cancelled : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </li>
        ))}
      </ul>
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
    close: t('close'),
    open: (date, count) => t('openDay', { date, count }),
  }
}
