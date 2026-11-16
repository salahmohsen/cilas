'use client'

import { ExternalLink, Pencil } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, type ReactNode } from 'react'

import type { CalendarAction } from '@/components/calendar/ui/block-details'
import { Calendar } from '@/components/calendar/ui/calendar'
import type { CalendarHostLabels } from '@/components/calendar/ui/calendar-labels'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import { courseWeekOf, type CalendarItem } from '@/lib/calendar-items'
import { leave } from '@/lib/leave-guard'

import { openSession, preloadSessionEdit, sessionTriggerProps } from './session-drawer-host'

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
 * What a block's details offer in a course space: a session opens in the
 * drawer, and on its Edit form for the people who may edit; a space event
 * opens its post.
 */
export function useScheduleActions(
  items: CalendarItem[],
  spaceHref: string,
  canEdit: boolean,
): (item: CalendarItem) => CalendarAction[] {
  const t = useTranslations('Spaces')
  const tc = useTranslations('CalendarUi')
  const open = useOpenScheduleItem(items, spaceHref)
  return (item) =>
    item.kind === 'space-event'
      ? [
          {
            id: 'open',
            label: t('calendarOpenPost'),
            icon: <ExternalLink aria-hidden size={14} />,
            primary: true,
            run: open,
          },
        ]
      : [
          ...(canEdit
            ? [
                {
                  id: 'edit',
                  label: t('calendarEdit'),
                  icon: <Pencil aria-hidden size={14} />,
                  preload: preloadSessionEdit,
                  run: (id: string) => openSession(id, 'edit'),
                },
              ]
            : []),
          { id: 'open', label: tc('menuOpen'), primary: true, run: open },
        ]
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
  canEdit = false,
  course = items,
}: {
  items: CalendarItem[]
  /** All of the course's items, which the course week counts; a schedule block shows only some. */
  course?: CalendarItem[]
  marked?: string[]
  day?: string
  spaceHref: string
  /** The tab's Edit button, for the people who may edit. */
  action?: ReactNode
  /** Whether the reader may edit the sessions: their details offer Edit. */
  canEdit?: boolean
}) {
  const locale = useLocale()
  const labels = useScheduleLabels()
  const markedSet = useMemo(() => new Set(marked), [marked])
  const open = useOpenScheduleItem(items, spaceHref)
  const weekLabel = useCourseWeek(course)
  const actionsOf = useScheduleActions(items, spaceHref, canEdit)
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
        actionsOf={actionsOf}
      />
    </div>
  )
}
