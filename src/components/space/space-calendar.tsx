import { getTranslations } from 'next-intl/server'

import { loadCalendarItems } from '@/actions/load-calendar-items'
import { Alert } from '@/components/arc/alert/alert'
import { openingDay } from '@/lib/calendar-items'
import { cairoDay } from '@/lib/cairo-day'

import { ScheduleCalendar } from './schedule-calendar'

export async function SpaceCalendar({
  id,
  locale,
  spaceHref,
}: {
  id: number
  locale: string
  spaceHref: string
}) {
  const result = await loadCalendarItems({ kind: 'space', id: String(id) }, locale)
  if (!result.ok) {
    const t = await getTranslations('Spaces')
    return <Alert tone="danger" title={t('calendarFailed')} />
  }
  return (
    <ScheduleCalendar
      items={result.items}
      day={openingDay(
        result.items.filter((item) => item.kind === 'session'),
        cairoDay(new Date())!,
      )}
      spaceHref={spaceHref}
    />
  )
}
