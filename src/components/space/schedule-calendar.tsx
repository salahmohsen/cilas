'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

import { Calendar } from '@/components/calendar/ui/calendar'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import { sessionPostsHref } from './session-chip'

/** The calendar of a schedule block, view only; a block opens the posts about its session, as a session chip does. */
export function ScheduleCalendar({
  items,
  marked = [],
  day,
  spaceHref,
}: {
  items: CalendarItem[]
  marked?: string[]
  day?: string
  spaceHref: string
}) {
  const t = useTranslations('SpacePost')
  const locale = useLocale()
  const router = useRouter()
  const ts = useTranslations('Spaces')
  const kind = useCallback(
    (value: string) => (value === 'space-event' ? ts('calendarEvents') : t('scheduleKind')),
    [t, ts],
  )
  const labels = useCalendarLabels({ kind, newItem: t('scheduleKind') })
  const markedSet = useMemo(() => new Set(marked), [marked])
  return (
    <Calendar
      mode="view"
      items={items}
      marked={markedSet}
      day={day}
      labels={labels}
      locale={locale}
      onOpen={(itemId) => {
        const item = items.find((item) => item.id === itemId)
        if (item)
          router.push(
            item.kind === 'space-event'
              ? `${spaceHref}/posts/${item.blocks[0]!.id}`
              : sessionPostsHref(spaceHref, itemId),
          )
      }}
    />
  )
}
