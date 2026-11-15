'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, type ReactNode } from 'react'

import { Calendar } from '@/components/calendar/ui/calendar'
import type { CalendarHostLabels } from '@/components/calendar/ui/calendar-labels'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import { courseWeekOf, type CalendarItem } from '@/lib/calendar-items'
import { leave } from '@/lib/leave-guard'

import { openSession, sessionTriggerProps } from './session-drawer-host'

/**
 * A course space calendar's words; `menu` gives edit mode its block menu
 * and its "New session" button.
 */
export function useScheduleLabels(menu?: CalendarHostLabels['menu']) {
  const t = useTranslations('SpacePost')
  const ts = useTranslations('Spaces')
  const ta = useTranslations('CalendarAdmin')
  const kind = useCallback(
    (value: string) => (value === 'space-event' ? ts('calendarEvents') : t('scheduleKind')),
    [t, ts],
  )
  return useCalendarLabels({
    kind,
    newItem: t('scheduleKind'),
    create: menu && ta('newSession'),
    menu,
  })
}

/** The course week a course space calendar shows, from its sessions: "Week 3 of 8". */
export function useCourseWeek(items: CalendarItem[]) {
  const t = useTranslations('CalendarAdmin')
  return (days: string[]) => {
    const week = courseWeekOf(
      items.filter((item) => item.kind === 'session'),
      days,
    )
    return week && t('courseWeek', week)
  }
}

/**
 * What a block of a course space calendar opens: a session's block, the
 * session drawer; a space event's block, its post (after the leave guard's
 * question, while edits wait).
 */
export function useOpenScheduleItem(items: CalendarItem[], spaceHref: string) {
  const router = useRouter()
  return (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId)
    if (!item) return
    if (item.kind === 'space-event')
      leave(() => router.push(`${spaceHref}/posts/${item.blocks[0]!.id}`))
    else openSession(itemId)
  }
}

/**
 * A course space's calendar, view only: the Calendar tab and a post's
 * schedule block.
 */
export function ScheduleCalendar({
  items,
  marked = [],
  day,
  spaceHref,
  action,
}: {
  items: CalendarItem[]
  marked?: string[]
  day?: string
  spaceHref: string
  /** The tab's Edit button, for the people who may edit. */
  action?: ReactNode
}) {
  const locale = useLocale()
  const labels = useScheduleLabels()
  const markedSet = useMemo(() => new Set(marked), [marked])
  const open = useOpenScheduleItem(items, spaceHref)
  const weekLabel = useCourseWeek(items)
  return (
    // `contents`: the wrapper only listens, for the drawer's chunk and the block focus returns to.
    <div className="contents" {...sessionTriggerProps}>
      <Calendar
        mode="view"
        items={items}
        marked={markedSet}
        day={day}
        labels={labels}
        locale={locale}
        weekLabel={weekLabel}
        action={action}
        onOpen={open}
      />
    </div>
  )
}
