'use client'

import { useLocale } from '@payloadcms/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { loadCalendarItems } from '@/actions/load-calendar-items'
import Button from '@/components/arc/button/button'
import { Calendar } from '@/components/calendar/ui/calendar'
import { useScheduleSave } from '@/components/space/use-schedule-save'
import {
  courseWeekOf,
  openingDay,
  type CalendarChange,
  type CalendarItem,
} from '@/lib/calendar-items'
import type { CalendarSaveError } from '@/lib/calendar-sources'
import { cairoDay } from '@/lib/cairo-day'

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

/**
 * The calendar in the course's Sessions tab. It shows the course's sessions,
 * lets the people who may edit them draw, move, copy and delete meetings, and
 * opens Payload's drawer on the session that a block or a tray item names.
 * Its changes save with its own Save schedule button, not with the course:
 * sessions are not drafts, so they are not tied to the course's Save. After
 * a save that changes the schedule, here or in the session drawer, it offers
 * a prefilled announcement for the course's space (`useScheduleSave`).
 */
export function CourseCalendar({ courseId, language, messages }: Props) {
  const { code: locale } = useLocale()
  const {
    t,
    labels,
    save: text,
  } = useMemo(() => calendarAdminText(language, messages), [language, messages])

  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const [unsaved, setUnsaved] = useState(0)
  const [opened, setOpened] = useState<{
    id: number
    returnTo: string | null
    /** The items when the drawer opened, to compare with after its saves. */
    before: CalendarItem[]
  } | null>(null)
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

  const schedule = useScheduleSave({
    parent: { kind: 'course', id: courseId ?? '' },
    courseId: courseId ?? '',
    locale,
    language,
    text,
    reload: () => void load(),
  })

  if (!courseId)
    return (
      <section className={styles.root} aria-label={t('heading')}>
        <p className={styles.note}>{t('unsavedCourse')}</p>
      </section>
    )

  const items = loaded.status === 'ready' ? loaded.items : []

  const blockOf = (spanId: string) =>
    frame.current?.querySelector<HTMLElement>(`[data-span-id="${CSS.escape(spanId)}"]`) ?? null

  const save = async (changes: CalendarChange[]) => {
    // The bar and its Save button leave with the changes, so focus goes to the heading.
    const saved = await schedule.save(changes, items, () => heading.current)
    setLoaded({ status: 'ready', items: saved, canEdit: true })
    return saved
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
    if (drawerSaved.current && after) schedule.offer(before, after, back)
  }

  return (
    <section className={styles.root} aria-label={t('heading')} ref={frame}>
      <header className={styles.header}>
        <h3 className={styles.title} ref={heading} tabIndex={-1}>
          {t('heading')}
        </h3>
      </header>

      {schedule.failed ? (
        <p className={styles.note} role="alert">
          {text.offerFailed}
        </p>
      ) : null}

      {loaded.status === 'loading' ? (
        <p className={styles.note} role="status">
          {t('loading')}
        </p>
      ) : loaded.status === 'failed' ? (
        <div className={styles.note} role="alert">
          <p>
            {t('loadFailed')} {text.errorText(loaded.error)}
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
          weekLabel={(days) => {
            const week = courseWeekOf(loaded.items, days)
            return week && t('courseWeek', week)
          }}
          onOpen={open}
          {...(loaded.canEdit
            ? {
                mode: 'edit' as const,
                onSave: save,
                newItemKind: 'session',
                onUnsavedChange: setUnsaved,
                onSaveIntent: schedule.preload,
              }
            : {
                mode: 'view' as const,
                // Readers who may not edit get the details first; Open shows Payload's session.
                actionsOf: () => [
                  { id: 'open', label: labels.menu!.open, primary: true, run: open },
                ],
              })}
        />
      )}

      <LeaveWarning active={unsaved > 0} />

      {opened ? (
        <SessionDrawer
          key={opened.id}
          id={opened.id}
          onChanged={() => {
            drawerSaved.current = true
            schedule.preload()
            void load()
          }}
          onClosed={() => void closed()}
        />
      ) : null}

      {schedule.dialog}
    </section>
  )
}
