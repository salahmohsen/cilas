'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

import { Calendar } from '@/components/calendar/ui/calendar'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import { openSession, sessionTriggerProps } from './session-drawer-host'

/**
 * A course space's calendar, view only: the Calendar tab and a post's
 * schedule block. A session's block opens the session drawer; a space
 * event's block opens its post.
 */
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
    // `contents`: the wrapper only listens, for the drawer's chunk and the block focus returns to.
    <div className="contents" {...sessionTriggerProps}>
      <Calendar
        mode="view"
        items={items}
        marked={markedSet}
        day={day}
        labels={labels}
        locale={locale}
        onOpen={(itemId) => {
          const item = items.find((item) => item.id === itemId)
          if (!item) return
          if (item.kind === 'space-event') router.push(`${spaceHref}/posts/${item.blocks[0]!.id}`)
          else openSession(itemId)
        }}
      />
    </div>
  )
}
