'use client'

import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { useLocale, useMessages, useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'

import { loadCalendarItems } from '@/actions/load-calendar-items'
import { Alert } from '@/components/arc/alert/alert'
import { ButtonGroup } from '@/components/arc/button-group/button-group'
import { Button } from '@/components/arc/button/button'
import { useLeaveQuestion } from '@/components/space/leave-question'
import { scheduleSaveText, type ScheduleSaveMessages } from '@/components/space/schedule-save-text'
import { useScheduleDrafts } from '@/components/space/use-schedule-drafts'
import { useScheduleSave } from '@/components/space/use-schedule-save'
import type { CalendarItem } from '@/lib/calendar-items'
import { leave } from '@/lib/leave-guard'

import { Calendar } from './ui/calendar'
import type { CalendarLabels } from './ui/calendar-labels'
import type { CalendarView } from './ui/calendar-views'

export function PublicCalendarEditor({
  items: initial,
  spaces,
  parent,
  labels,
  day,
  view,
  onNavigate,
  onDone,
}: {
  spaces: Record<string, string>
  items: CalendarItem[]
  parent: { kind: string; id: string }
  labels: CalendarLabels
  day: string
  view: CalendarView
  onNavigate: (view: CalendarView, day: string) => void
  onDone: () => void
}) {
  const router = useRouter()
  const locale = useLocale()
  const messages = useMessages()
  const t = useTranslations('Spaces')
  const ta = useTranslations('CalendarAdmin')
  const tc = useTranslations('Calendar')
  const text = useMemo(
    () => scheduleSaveText(locale, messages as ScheduleSaveMessages, labels),
    [locale, messages, labels],
  )
  const [items, setItems] = useState(initial)
  const [unsaved, setUnsaved] = useState(0)
  const [reloadFailed, setReloadFailed] = useState(false)
  const done = useRef<HTMLButtonElement>(null)
  const staged = useScheduleDrafts(text, locale, (item) =>
    item.href ? (
      <div className="px-6 pb-4">
        <ButtonGroup
          label={item.title}
          size="sm"
          items={[
            { id: 'course', label: tc('viewCourse'), href: item.href },
            ...(item.parentId && spaces[item.parentId]
              ? [{ id: 'space', label: tc('goToSpace'), href: spaces[item.parentId] }]
              : []),
          ]}
        />
      </div>
    ) : null,
  )
  const schedule = useScheduleSave({
    parent,
    locale,
    language: locale === 'ar' ? 'ar' : 'en',
    text,
    reload: () => {
      void loadCalendarItems(parent, locale).then(
        (result) => {
          if (!result.ok) return setReloadFailed(true)
          staged.clear()
          setItems([...result.items, ...initial.filter((item) => item.readOnly)])
          setReloadFailed(false)
        },
        () => setReloadFailed(true),
      )
    },
  })
  const leaving = useLeaveQuestion(unsaved > 0, {
    title: t('calendarLeaveTitle'),
    body: t('calendarLeaveBody'),
    stay: t('calendarLeaveStay'),
    go: t('calendarLeaveGo'),
    close: ta('offer.close'),
  })
  return (
    <>
      {schedule.failed ? <Alert tone="danger" title={text.offerFailed} /> : null}
      {reloadFailed ? <Alert tone="danger" title={t('calendarFailed')} /> : null}
      <div
        className="contents"
        onPointerEnter={staged.preload}
        onPointerDown={staged.preload}
        onFocus={staged.preload}
      >
        <Calendar
          mode="edit"
          items={items}
          labels={labels}
          locale={locale}
          day={day}
          view={view}
          onNavigate={onNavigate}
          action={
            <Button
              ref={done}
              type="button"
              variant="secondary"
              size="sm"
              aria-label={tc('done')}
              onClick={() => leave(onDone)}
            >
              <Check aria-hidden size={14} />
              <span className="hidden sm:inline">{tc('done')}</span>
            </Button>
          }
          drafts={staged.drafts}
          onCancelEdits={staged.clear}
          onOpen={(_id, _block, item) => {
            if (item?.readOnly) {
              if (item.href) leave(() => router.push(item.href!))
            } else if (item) staged.open(item)
          }}
          onSave={async (changes) => {
            const saved = await schedule.save(
              changes,
              items,
              () => done.current,
              staged.changes(changes),
            )
            const next = [...saved, ...initial.filter((item) => item.readOnly)]
            staged.clear()
            setItems(next)
            return next
          }}
          onUnsavedChange={setUnsaved}
          onSaveIntent={schedule.preload}
        />
      </div>
      {staged.drawer}
      {schedule.dialog}
      {leaving.dialog}
    </>
  )
}
