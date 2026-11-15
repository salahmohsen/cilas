import { Check } from 'lucide-react'
import { useLocale, useMessages, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { loadCalendarItems } from '@/actions/load-calendar-items'
import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogClose, DialogContent } from '@/components/arc/dialog/dialog'
import { Calendar } from '@/components/calendar/ui/calendar'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'
import { guardLeaving, leave } from '@/lib/leave-guard'

import { useOpenScheduleItem, useScheduleLabels } from './schedule-calendar'
import { scheduleSaveText, type ScheduleSaveMessages } from './schedule-save-text'
import { sessionTriggerProps } from './session-drawer-host'
import styles from './space-calendar-tab.module.css'
import { useScheduleSave } from './use-schedule-save'

/**
 * The Calendar tab in edit mode: draw, move and resize sessions, then Save
 * through the space's calendar parent and the shared save-then-offer
 * (`useScheduleSave`). Space events show and open, and stay as they are
 * (`readOnly`). While changes wait, Done, a tab switch, a link inside the
 * site and closing the page ask first (`lib/leave-guard.ts`).
 */
export function SpaceCalendarEditor({
  spaceId,
  courseId,
  items,
  day,
  spaceHref,
  onItems,
  onDone,
}: {
  spaceId: string
  courseId: string
  items: CalendarItem[]
  day?: string
  spaceHref: string
  /** The items as saved or reloaded now; the tab holds them. */
  onItems: (items: CalendarItem[]) => void
  /** Back to view mode, with nothing left to save. */
  onDone: () => void
}) {
  const locale = useLocale()
  const language = locale === 'ar' ? 'ar' : 'en'
  const messages = useMessages()
  const t = useTranslations('Spaces')
  const ta = useTranslations('CalendarAdmin')
  const router = useRouter()
  const labels = useScheduleLabels(
    useMemo(
      () => ({
        addNextDay: ta('addMeeting'),
        copyNextWeek: ta('newSessionNextWeek'),
        deleteBlock: ta('deleteMeeting'),
        addedNextDay: (day: string) => ta('addedMeeting', { day }),
        copiedNextWeek: (day: string) => ta('madeSessionNextWeek', { day }),
      }),
      [ta],
    ),
  )
  const text = useMemo(
    // The site's provider holds every message, these among them.
    () => scheduleSaveText(language, messages as ScheduleSaveMessages, labels),
    [language, messages, labels],
  )

  const [reloadFailed, setReloadFailed] = useState(false)
  const [unsaved, setUnsaved] = useState(0)
  const [asking, setAsking] = useState<(() => void) | null>(null)
  const done = useRef<HTMLButtonElement>(null)
  const open = useOpenScheduleItem(items, spaceHref)

  const schedule = useScheduleSave({
    parent: { kind: 'space', id: spaceId },
    courseId,
    locale,
    language,
    text,
    reload: () => {
      setReloadFailed(false)
      void loadCalendarItems({ kind: 'space', id: spaceId }, locale).then((result) => {
        if (result.ok) onItems(result.items)
        else setReloadFailed(true)
      })
    },
  })

  useEffect(() => {
    if (unsaved === 0) return
    return guardLeaving({
      ask: (go) => setAsking(() => go),
      navigate: (href) => router.push(href),
    })
  }, [unsaved, router])

  const save = async (changes: CalendarChange[]) => {
    // The save bar leaves with the changes, so the offer gives focus back to Done.
    const saved = await schedule.save(changes, items, () => done.current)
    onItems(saved)
    // The page's other server parts, like the next session beside the tab, read it again.
    router.refresh()
    return saved
  }

  return (
    <div className={styles.tab}>
      <div className={styles.actions}>
        <Button ref={done} type="button" size="sm" onClick={() => leave(onDone)}>
          <Check aria-hidden size={14} />
          {t('calendarDone')}
        </Button>
      </div>

      {schedule.failed ? <Alert tone="danger" title={text.offerFailed} /> : null}
      {reloadFailed ? <Alert tone="danger" title={t('calendarFailed')} /> : null}

      <div className="contents" {...sessionTriggerProps}>
        <Calendar
          mode="edit"
          items={items}
          day={day}
          labels={labels}
          locale={locale}
          newItemKind="session"
          onOpen={open}
          onSave={save}
          onUnsavedChange={setUnsaved}
          onSaveIntent={schedule.preload}
        />
      </div>

      {schedule.dialog}

      <Dialog
        open={asking !== null}
        onOpenChange={(next) => {
          if (!next) setAsking(null)
        }}
      >
        <DialogContent
          title={t('calendarLeaveTitle')}
          description={t('calendarLeaveBody')}
          closeLabel={ta('offer.close')}
        >
          <div className={styles.leave}>
            <DialogClose asChild>
              <Button type="button" variant="secondary" autoFocus>
                {t('calendarLeaveStay')}
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                const go = asking
                setAsking(null)
                go?.()
              }}
            >
              {t('calendarLeaveGo')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
