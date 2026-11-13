'use client'

import { useLocale } from '@payloadcms/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { loadCalendarItems } from '@/actions/load-calendar-items'
import { saveCalendarChanges } from '@/actions/save-calendar-changes'
import Button from '@/components/arc/button/button'
import { Calendar } from '@/components/calendar/ui/calendar'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'
import type { CalendarSaveError } from '@/lib/calendar-sources'
import { cairoDay } from '@/lib/cairo-day'
import { lastDay, nextMeeting } from '@/lib/meetings'

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

/** The week to open on: the next meeting's, or the last one's when the course is over. */
const openingDay = (items: CalendarItem[]): string | undefined => {
  const meetings = items.flatMap((item) =>
    item.blocks.map((block) => ({
      date: block.date,
      ...(item.cancelled ? { cancelled: true as const } : {}),
    })),
  )
  return nextMeeting(meetings, cairoDay(new Date())!)?.date ?? lastDay(meetings) ?? undefined
}

/** A save that did not happen, as the Error the calendar shows beside its Save button. */
class SaveRefused extends Error {}

/**
 * The calendar in the course's Sessions tab. It shows the course's sessions,
 * lets the people who may edit them draw, move, copy and delete meetings, and
 * opens Payload's drawer on the session that a block or a tray item names.
 * Its changes save with its own Save schedule button, not with the course:
 * sessions are not drafts, so they are not tied to the course's Save.
 */
export function CourseCalendar({ courseId, language, messages }: Props) {
  const { code: locale } = useLocale()
  const { t, labels, errorText } = useMemo(
    () => calendarAdminText(language, messages),
    [language, messages],
  )

  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const [unsaved, setUnsaved] = useState(0)
  const [opened, setOpened] = useState<{ id: number; returnTo: string | null } | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const latest = useRef(0)

  const load = useCallback(async () => {
    if (!courseId) return
    // A slower answer to an older request must not replace a newer one.
    const request = ++latest.current
    const result = await loadCalendarItems({ kind: 'course', id: courseId }, locale)
    if (request !== latest.current) return
    setLoaded(
      result.ok
        ? { status: 'ready', items: result.items, canEdit: result.canEdit }
        : { status: 'failed', error: result.error },
    )
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

  const save = async (changes: CalendarChange[]) => {
    const result = await saveCalendarChanges(
      { parent: { kind: 'course', id: courseId }, changes },
      locale,
    )
    if (!result.ok) throw new SaveRefused(errorText(result.error))
    setLoaded({ status: 'ready', items: result.items, canEdit: true })
    return result.items
  }

  const open = (itemId: string) => {
    // Payload's drawer is not a native dialog, so the way back is ours to keep.
    const returnTo =
      document.activeElement?.closest<HTMLElement>('[data-span-id]')?.dataset.spanId ?? null
    setOpened({ id: Number(itemId), returnTo })
  }

  const closed = () => {
    const returnTo = opened?.returnTo
    setOpened(null)
    void load()
    if (returnTo)
      requestAnimationFrame(() =>
        frame.current
          ?.querySelector<HTMLElement>(`[data-span-id="${CSS.escape(returnTo)}"]`)
          ?.focus(),
      )
  }

  return (
    <section className={styles.root} aria-label={t('heading')} ref={frame}>
      <header className={styles.header}>
        <h3 className={styles.title}>{t('heading')}</h3>
      </header>

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
          day={openingDay(loaded.items)}
          onOpen={open}
          {...(loaded.canEdit
            ? {
                mode: 'edit' as const,
                onSave: save,
                newItemKind: 'session',
                onUnsavedChange: setUnsaved,
              }
            : { mode: 'view' as const })}
        />
      )}

      <LeaveWarning active={unsaved > 0} />

      {opened ? (
        <SessionDrawer
          key={opened.id}
          id={opened.id}
          onChanged={() => void load()}
          onClosed={closed}
        />
      ) : null}
    </section>
  )
}
