import type { CSSProperties } from 'react'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'

import type { CalendarItem } from '@/api/calendar.api'
import { Card } from '@/components/arc/card/card'
import { DayCovers } from '@/components/calendar/day-covers'
import { Link } from '@/i18n/navigation'
import { monthGrid, monthStart, summariseDay, toneOf, weekDays } from '@/lib/calendar'
import { localDigits, numberingSystemOf, timeDir } from '@/lib/digits'
import { focalPointStyle } from '@/lib/media-image'

type Labels = {
  type: (item: CalendarItem) => string
  session: (n: number) => string
  starts: string
  more: (n: number) => string
  cancelled: string
  close: string
  open: (date: string, count: number) => string
  /** A time or number the views build themselves, in the page's digits. */
  digits: (text: string) => string
  /** The direction a time is held in, for its digits. */
  timeDir: 'ltr' | undefined
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
  const classes = [className, item.cancelled ? 'line-through opacity-60' : null]
    .filter(Boolean)
    .join(' ')
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
 * The month: whole weeks, Saturday to Friday. A day is a card as on the
 * Open for registration page: its cover on top (turning to the next when the
 * day has several), then up to two courses by name.
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
  const [format, nu] = await Promise.all([getFormatter(), getLocale().then(numberingSystemOf)])
  const days = monthGrid(date)
  const month = monthStart(date).slice(0, 7)
  const map = byDay(items)
  const weekday = (day: string) => format.dateTime(UTC(day), { weekday: 'short', timeZone: 'UTC' })
  const number = (day: string) => format.number(Number(day.slice(8)), { numberingSystem: nu })
  const longDate = (day: string) =>
    format.dateTime(UTC(day), { dateStyle: 'full', timeZone: 'UTC', numberingSystem: nu })

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
          const { covers, listed, hidden } = summariseDay(all)
          const outside = !day.startsWith(month)
          return (
            <div
              className="cal-day"
              data-outside={outside || undefined}
              data-today={day === today || undefined}
              key={day}
              role="gridcell"
            >
              {all.length ? (
                // A day with something opens, growing into that day's agenda.
                <Card
                  className="cal-day-card"
                  closeLabel={labels.close}
                  data-cover={covers.length ? '' : undefined}
                  details={<DayAgenda items={all} labels={labels} />}
                  media={covers.length ? <DayCovers covers={covers} /> : undefined}
                  preview={
                    <>
                      <ul className="cal-day-items">
                        {listed.map((item) => (
                          <li
                            className="cal-item"
                            data-cancelled={item.cancelled || undefined}
                            key={item.key}
                            style={{ '--tone': toneOf(item) } as CSSProperties}
                          >
                            <span className="cal-item-type">{labels.type(item)}</span>
                            {timeOf(item) ? (
                              <span className="cal-item-when" dir={labels.timeDir}>
                                {labels.digits(timeOf(item)!)}
                              </span>
                            ) : item.starts ? (
                              <span className="cal-item-when">{labels.starts}</span>
                            ) : null}
                            <span className="cal-item-title" dir="auto">
                              {item.title}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {hidden ? <span className="cal-more">{labels.more(hidden)}</span> : null}
                    </>
                  }
                  panelTitle={longDate(day)}
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

/** One day's agenda, the quick look's list, as boxes ruled like the Open for registration cards. */
function DayAgenda({ items, labels }: { items: CalendarItem[]; labels: Labels }) {
  return (
    <ul className="cal-slots">
      {items.map((item) => (
        <Slot item={item} key={item.key} labels={labels} />
      ))}
    </ul>
  )
}

/** One course or event of the quick look and the agenda: type and time, the name, a picture at the end. */
function Slot({ item, labels }: { item: CalendarItem; labels: Labels }) {
  return (
    <li
      className="cal-slot"
      data-cancelled={item.cancelled || undefined}
      style={{ '--tone': toneOf(item) } as CSSProperties}
    >
      <span className="cal-item-type">{labels.type(item)}</span>
      {item.start || item.starts ? (
        <span className="cal-item-when" dir={item.start ? labels.timeDir : undefined}>
          {item.start
            ? labels.digits(`${item.start}${item.end ? `–${item.end}` : ''}`)
            : labels.starts}
        </span>
      ) : null}
      <ItemTitle className="cal-slot-title" item={item} />
      {item.session || item.cancelled ? (
        <span className="cal-slot-note">
          {[
            item.session ? labels.session(item.session) : null,
            item.cancelled ? labels.cancelled : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      ) : null}
      {item.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="cal-slot-cover"
          loading="lazy"
          src={item.cover.url}
          style={focalPointStyle(item.cover)}
        />
      ) : null}
    </li>
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
  const [format, nu] = await Promise.all([getFormatter(), getLocale().then(numberingSystemOf)])
  const map = byDay(items)
  return (
    <div className="cal-week">
      {weekDays(date).map((day) => (
        <section
          aria-label={format.dateTime(UTC(day), {
            dateStyle: 'full',
            timeZone: 'UTC',
            numberingSystem: nu,
          })}
          className="cal-week-day"
          data-today={day === today || undefined}
          key={day}
        >
          <header className="cal-week-head">
            <span className="cal-weekday">
              {format.dateTime(UTC(day), { weekday: 'long', timeZone: 'UTC' })}
            </span>
            <span className="cal-day-number">
              {format.number(Number(day.slice(8)), { numberingSystem: nu })}
            </span>
          </header>
          <ul className="grid gap-3">
            {(map.get(day) ?? []).map((item) => (
              <li className="cal-card" key={item.key}>
                {item.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={item.cover.alt}
                    className="cal-card-cover"
                    loading="lazy"
                    src={item.cover.url}
                    style={focalPointStyle(item.cover)}
                  />
                ) : null}
                <div className="p-3">
                  <p className="cal-time" dir={item.start ? labels.timeDir : undefined}>
                    {item.start
                      ? labels.digits(`${item.start}${item.end ? `–${item.end}` : ''}`)
                      : item.starts
                        ? labels.starts
                        : ''}
                  </p>
                  <ItemTitle className="mt-1 block text-sm font-medium" item={item} />
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {[
                      labels.type(item),
                      item.session ? labels.session(item.session) : null,
                      item.cancelled ? labels.cancelled : null,
                    ]
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

/** The agenda: the days that have something, each a box with its date on top and its items under it. */
export async function AgendaView({ items, labels }: { items: CalendarItem[]; labels: Labels }) {
  const [format, nu] = await Promise.all([getFormatter(), getLocale().then(numberingSystemOf)])
  const map = byDay(items)
  return (
    <ol className="cal-agenda">
      {[...map.entries()].map(([day, dayItems]) => (
        <li className="cal-agenda-day" key={day}>
          <div className="cal-agenda-date">
            <span className="cal-day-number">
              {format.number(Number(day.slice(8)), { numberingSystem: nu })}
            </span>
            <span className="cal-agenda-when">
              <span>{format.dateTime(UTC(day), { weekday: 'long', timeZone: 'UTC' })}</span>
              <span>
                {format.dateTime(UTC(day), {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                  numberingSystem: nu,
                })}
              </span>
            </span>
          </div>
          <DayAgenda items={dayItems} labels={labels} />
        </li>
      ))}
    </ol>
  )
}

/** The labels the views share, in the site language. */
export const calendarLabels = async (): Promise<Labels> => {
  const [t, tf, locale] = await Promise.all([
    getTranslations('Calendar'),
    getTranslations('Study.filters'),
    getLocale(),
  ])
  return {
    type: (item) =>
      item.kind === 'course' ? tf(`types.${item.type}`) : t(`eventTypes.${item.type}`),
    session: (n) => t('session', { n }),
    starts: t('starts'),
    more: (n) => t('more', { count: n }),
    cancelled: t('cancelled'),
    close: t('close'),
    open: (date, count) => t('openDay', { date, count }),
    digits: (text) => localDigits(text, locale),
    timeDir: timeDir(locale),
  }
}
