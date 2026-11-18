'use client'

import { Pencil } from 'lucide-react'
import { useLocale, useMessages, useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useSyncExternalStore, useTransition } from 'react'

import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { leave } from '@/lib/leave-guard'
import { Calendar } from '@/components/calendar/ui/calendar'
import type { CalendarView } from '@/components/calendar/ui/calendar-views'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import { scheduleSaveText, type ScheduleSaveMessages } from '@/components/space/schedule-save-text'
import { useScheduleOffer } from '@/components/space/use-schedule-save'
import { useSessionCancellation } from '@/components/space/use-session-cancellation'
import { Link } from '@/i18n/navigation'
import type { CalendarItem } from '@/lib/calendar-items'

import { mergePublicEditItems } from './public-items'

import { usePublicCalendarAccess } from './use-public-calendar-access'
import { PublicCalendarEditor } from './public-calendar-editor'
import { CalendarFeed, CalendarJump } from './calendar-tools'
import { calendarQuery, holds, readCalendarUrl, viewDays, type DayRange } from './calendar-url'

type Props = {
  access?:
    | { mode: 'view'; canEdit: boolean }
    | { mode: 'edit'; canEdit: true; parent: { kind: string; id: string }; items: CalendarItem[] }
  /** The items of the days loaded, `range`. */
  items: CalendarItem[]
  range: DayRange
  /** Today in Cairo, as the server saw it, so the first render matches. */
  today: string
  /** Each kind's name in the legend ("Thematic course") and its link's label ("View course"). */
  kinds: Record<string, { name: string; open: string }>
  /** The months that have something, `YYYY-MM`, oldest first: the way out of an empty view. */
  months: string[]
}

const monthOfDay = (day: string) => day.slice(0, 7)

/** Fired after the page writes its own URL, so the URL it reads is never behind. */
const PUSHED = 'calendar:pushed'

const onHistory = (change: () => void) => {
  window.addEventListener('popstate', change)
  window.addEventListener(PUSHED, change)
  return () => {
    window.removeEventListener('popstate', change)
    window.removeEventListener(PUSHED, change)
  }
}

/**
 * The public calendar for visitors and admins. Its view and day live in
 * the URL. A move within the days loaded only writes the URL; a move past them
 * asks the server for the days around the new place.
 */
export function PublicCalendar({ items, range, today, kinds, months, access }: Props) {
  const t = useTranslations('Calendar')
  const ta = useTranslations('CalendarAdmin')
  const te = useTranslations('SessionEdit')
  const messages = useMessages()
  const editing = access?.mode === 'edit'
  const locale = useLocale()
  const viewer = usePublicCalendarAccess(
    [...items, ...(access?.mode === 'edit' ? access.items : [])].flatMap(
      (item) => item.parentId ?? [],
    ),
    locale,
  )
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  // The URL is read from the window: on a quick Back after a push, Next has not
  // yet given `useSearchParams` the pushed URL, and the calendar would not move.
  const search = useSyncExternalStore(
    onHistory,
    () => window.location.search,
    () => `?${params.toString()}`,
  )
  const query = new URLSearchParams(search)
  const { view, day } = readCalendarUrl({ view: query.get('view'), date: query.get('date') }, today)

  const kind = useCallback((value: string) => kinds[value]?.name ?? value, [kinds])
  const menu = useMemo(
    () =>
      editing
        ? {
            addNextDay: ta('addMeeting'),
            copyNextWeek: ta('newSessionNextWeek'),
            deleteBlock: ta('deleteMeeting'),
            addedNextDay: (day: string) => ta('addedMeeting', { day }),
            copiedNextWeek: (day: string) => ta('madeSessionNextWeek', { day }),
          }
        : undefined,
    [editing, ta],
  )
  const labels = useCalendarLabels({ kind, newItem: '', menu })
  const text = useMemo(
    () => scheduleSaveText(locale, messages as ScheduleSaveMessages, labels),
    [locale, messages, labels],
  )
  const offering = useScheduleOffer({
    locale,
    language: locale === 'ar' ? 'ar' : 'en',
    text,
  })
  const cancellation = useSessionCancellation({ locale, text, offer: offering.offer })

  const load = useCallback(
    (to: CalendarView, at: string, replace = false) =>
      startTransition(() =>
        router[replace ? 'replace' : 'push'](
          `/${locale}/calendar${calendarQuery(to, at)}${editing ? '&edit=1' : ''}`,
          {
            scroll: false,
          },
        ),
      ),
    [router, locale, editing],
  )

  // Back or forward to a place the page did not load (a rare history entry): load it.
  useEffect(() => {
    if (!holds(range, view, day)) load(view, day, true)
  }, [range, view, day, load])

  const navigate = (to: CalendarView, at: string) => {
    if (!holds(range, to, at)) return leave(() => load(to, at))
    // A day chosen in the month is not a new place: Back leaves the month, not each day.
    const sameMonth = to === 'month' && view === 'month' && monthOfDay(at) === monthOfDay(day)
    window.history[sameMonth ? 'replaceState' : 'pushState'](
      null,
      '',
      `${calendarQuery(to, at)}${editing ? '&edit=1' : ''}`,
    )
    window.dispatchEvent(new Event(PUSHED))
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
            onJump={(at) => leave(() => load(view, at))}
          />
        </div>
        <div className="sm:hidden">
          <CalendarFeed feedPath={`/${locale}/calendar.ics`} iconOnly />
        </div>
        <div className="hidden sm:block">
          <CalendarFeed feedPath={`/${locale}/calendar.ics`} />
        </div>
      </div>

      {cancellation.error ? <Alert tone="danger" title={cancellation.error} /> : null}
      {offering.failed ? <Alert tone="danger" title={text.offerFailed} /> : null}

      {nearest && !editing ? (
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

      {access?.mode === 'edit' ? (
        <PublicCalendarEditor
          key={`${range.from}/${range.to}`}
          items={mergePublicEditItems(access.items, items)}
          parent={access.parent}
          labels={labels}
          day={day}
          view={view}
          onNavigate={navigate}
          spaces={viewer.spaces}
          onDone={() =>
            router.push(`/${locale}/calendar${calendarQuery(view, day)}`, { scroll: false })
          }
        />
      ) : (
        <Calendar
          mode="view"
          action={
            viewer.canEdit ? (
              <Button
                type="button"
                size="sm"
                aria-label={t('edit')}
                onClick={() =>
                  router.push(`/${locale}/calendar${calendarQuery(view, day)}&edit=1`, {
                    scroll: false,
                  })
                }
              >
                <Pencil aria-hidden size={14} />
                <span className="hidden sm:inline">{t('edit')}</span>
              </Button>
            ) : undefined
          }
          items={items}
          labels={labels}
          locale={locale}
          view={view}
          day={day}
          today={today}
          panelOpenInMonth
          onNavigate={navigate}
          onOpen={(id) => {
            const href = items.find((item) => item.id === id)?.href
            if (href) router.push(href)
          }}
          actionsOf={({ href, kind, parentId, sessionId, cancelled }) => {
            const open = kinds[kind]?.open
            if (!href || !open) return []
            const mayCancel = Boolean(sessionId && parentId && viewer.editable.includes(parentId))
            return [
              { id: 'open', label: open, href },
              ...(parentId && viewer.spaces[parentId]
                ? [{ id: 'space', label: t('goToSpace'), href: viewer.spaces[parentId]! }]
                : []),
              ...(mayCancel
                ? [
                    {
                      id: 'cancel',
                      label: cancelled ? te('restoreSession') : te('cancelSession'),
                      menu: true as const,
                      danger: !cancelled,
                      ...(cancelled
                        ? {}
                        : {
                            confirm: { title: te('cancelSessionTitle'), keep: te('keepSession') },
                          }),
                      run: () =>
                        void cancellation
                          .run({ id: sessionId!, courseId: parentId!, cancelled: !cancelled }, () =>
                            document.querySelector<HTMLElement>('[data-panel-heading]'),
                          )
                          .then((done) => done && router.refresh()),
                    },
                  ]
                : []),
            ]
          }}
        />
      )}
      {offering.dialog}
    </div>
  )
}
