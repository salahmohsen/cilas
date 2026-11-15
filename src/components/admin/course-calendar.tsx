'use client'

import { useLocale } from '@payloadcms/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { loadCalendarItems } from '@/actions/load-calendar-items'
import { saveCalendarChanges } from '@/actions/save-calendar-changes'
import { scheduleOffers } from '@/actions/schedule-offers'
import Button from '@/components/arc/button/button'
import { Calendar } from '@/components/calendar/ui/calendar'
import { CalendarSaveRefusal } from '@/components/calendar/ui/save-refusal'
import { openingDay, type CalendarChange, type CalendarItem } from '@/lib/calendar-items'
import type { CalendarSaveError } from '@/lib/calendar-sources'
import { cairoDay } from '@/lib/cairo-day'
import { preloadable } from '@/lib/preloadable'
import type { ScheduleOffer } from '@/lib/schedule-offer'

import {
  calendarAdminText,
  type AdminLanguage,
  type CalendarAdminMessages,
} from './calendar-admin-text'
import styles from './course-calendar.module.css'
import { LeaveWarning } from './leave-warning'
import { SessionDrawer } from './session-drawer'

type Props = {
  /** Null while the course has not been saved once. */
  courseId: string | null
  language: AdminLanguage
  messages: CalendarAdminMessages
}

type Loaded =
  | { status: 'loading' }
  | { status: 'failed'; error: CalendarSaveError }
  | { status: 'ready'; items: CalendarItem[]; canEdit: boolean }

/** A save that did not happen, as the Error the calendar shows beside its Save button. */
class SaveRefused extends Error {}

const ScheduleOfferDialog = preloadable(
  () => import('@/components/space/schedule-offer-dialog').then((m) => m.ScheduleOfferDialog),
  { name: 'ScheduleOfferDialog' },
)

/** The announcements offered after a save, and where focus goes when they close. */
type Offered = { offers: ScheduleOffer[]; returnTo: () => HTMLElement | null }

/**
 * The calendar in the course's Sessions tab. It shows the course's sessions,
 * lets the people who may edit them draw, move, copy and delete meetings, and
 * opens Payload's drawer on the session that a block or a tray item names.
 * Its changes save with its own Save schedule button, not with the course:
 * sessions are not drafts, so they are not tied to the course's Save. After
 * a save that changes the schedule, here or in the session drawer, it offers
 * a prefilled announcement for the course's space (`scheduleOffers`).
 */
export function CourseCalendar({ courseId, language, messages }: Props) {
  const { code: locale } = useLocale()
  const { t, labels, offerLabels, errorText } = useMemo(
    () => calendarAdminText(language, messages),
    [language, messages],
  )

  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const [unsaved, setUnsaved] = useState(0)
  const [opened, setOpened] = useState<{
    id: number
    returnTo: string | null
    /** The items when the drawer opened, to compare with after its saves. */
    before: CalendarItem[]
  } | null>(null)
  const [offered, setOffered] = useState<Offered | null>(null)
  const [offerFailed, setOfferFailed] = useState(false)
  const frame = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const latest = useRef(0)
  const drawerSaved = useRef(false)

  /** Loads the items and shows them; resolves to them, or null when they did not load or a newer load won. */
  const load = useCallback(async (): Promise<CalendarItem[] | null> => {
    if (!courseId) return null
    // A slower answer to an older request must not replace a newer one.
    const request = ++latest.current
    const result = await loadCalendarItems({ kind: 'course', id: courseId }, locale)
    if (request !== latest.current) return null
    setLoaded(
      result.ok
        ? { status: 'ready', items: result.items, canEdit: result.canEdit }
        : { status: 'failed', error: result.error },
    )
    return result.ok ? result.items : null
  }, [courseId, locale])

  useEffect(() => {
    void load()
  }, [load])

  if (!courseId)
    return (
      <section className={styles.root} aria-label={t('heading')}>
        <p className={styles.note}>{t('unsavedCourse')}</p>
      </section>
    )

  const items = loaded.status === 'ready' ? loaded.items : []

  const blockOf = (spanId: string) =>
    frame.current?.querySelector<HTMLElement>(`[data-span-id="${CSS.escape(spanId)}"]`) ?? null

  /** Offers an announcement when the save changed what counts; nothing when it did not. */
  const offer = (before: CalendarItem[], after: CalendarItem[], returnTo: Offered['returnTo']) => {
    setOfferFailed(false)
    scheduleOffers({ courseId, before, after }, locale).then(
      (offers) => setOffered(offers.length ? { offers, returnTo } : null),
      (error: unknown) => {
        console.error('schedule offer failed', error)
        setOfferFailed(true)
      },
    )
  }

  const save = async (changes: CalendarChange[]) => {
    const result = await saveCalendarChanges(
      { parent: { kind: 'course', id: courseId }, changes },
      locale,
    )
    if (!result.ok) {
      if (result.error.code === 'stale')
        throw new CalendarSaveRefusal(errorText(result.error), {
          label: t('reloadAndLose'),
          then: () => void load(),
        })
      throw new SaveRefused(errorText(result.error))
    }
    setLoaded({ status: 'ready', items: result.items, canEdit: true })
    // The bar and its Save button leave with the changes, so focus goes to the heading.
    offer(items, result.items, () => heading.current)
    return result.items
  }

  const open = (itemId: string) => {
    // Payload's drawer is not a native dialog, so the way back is ours to keep.
    const returnTo =
      document.activeElement?.closest<HTMLElement>('[data-span-id]')?.dataset.spanId ?? null
    drawerSaved.current = false
    setOpened({ id: Number(itemId), returnTo, before: items })
  }

  // Payload's drawer keeps focus inside it, so the offer waits until it closes.
  const closed = async () => {
    if (!opened) return
    const { returnTo, before } = opened
    setOpened(null)
    const back = () => (returnTo ? blockOf(returnTo) : heading.current)
    if (returnTo) requestAnimationFrame(() => back()?.focus())
    const after = await load()
    if (drawerSaved.current && after) offer(before, after, back)
  }

  return (
    <section className={styles.root} aria-label={t('heading')} ref={frame}>
      <header className={styles.header}>
        <h3 className={styles.title} ref={heading} tabIndex={-1}>
          {t('heading')}
        </h3>
      </header>

      {offerFailed ? (
        <p className={styles.note} role="alert">
          {t('offer.failed')}
        </p>
      ) : null}

      {loaded.status === 'loading' ? (
        <p className={styles.note} role="status">
          {t('loading')}
        </p>
      ) : loaded.status === 'failed' ? (
        <div className={styles.note} role="alert">
          <p>
            {t('loadFailed')} {errorText(loaded.error)}
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <Calendar
          items={loaded.items}
          labels={labels}
          locale={language}
          day={openingDay(loaded.items, cairoDay(new Date())!)}
          onOpen={open}
          {...(loaded.canEdit
            ? {
                mode: 'edit' as const,
                onSave: save,
                newItemKind: 'session',
                onUnsavedChange: setUnsaved,
                onSaveIntent: ScheduleOfferDialog.preload,
              }
            : { mode: 'view' as const })}
        />
      )}

      <LeaveWarning active={unsaved > 0} />

      {opened ? (
        <SessionDrawer
          key={opened.id}
          id={opened.id}
          onChanged={() => {
            drawerSaved.current = true
            ScheduleOfferDialog.preload()
            void load()
          }}
          onClosed={() => void closed()}
        />
      ) : null}

      {offered ? (
        <ScheduleOfferDialog
          offers={offered.offers}
          labels={offerLabels}
          locale={language}
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          onClose={() => setOffered(null)}
          returnFocus={offered.returnTo}
        />
      ) : null}
    </section>
  )
}
