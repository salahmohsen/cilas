import { getTranslations } from 'next-intl/server'

import { loadCalendarItems } from '@/actions/load-calendar-items'
import { Alert } from '@/components/arc/alert/alert'
import { openingDay } from '@/lib/calendar-items'
import { cairoDay } from '@/lib/cairo-day'

import { ConnectedSpaceCalendarTab } from './connected-space-calendar-tab'

/**
 * The Calendar tab of a course space: read on the server for everyone, with
 * Edit for the people the sessions collection lets edit (`canEdit`).
 */
export async function SpaceCalendar({
  id,
  courseId,
  locale,
  spaceHref,
}: {
  id: number
  courseId: number
  locale: string
  spaceHref: string
}) {
  const result = await loadCalendarItems({ kind: 'space', id: String(id) }, locale)
  if (!result.ok) {
    const t = await getTranslations('Spaces')
    return <Alert tone="danger" title={t('calendarFailed')} />
  }
  return (
    <ConnectedSpaceCalendarTab
      spaceId={String(id)}
      courseId={String(courseId)}
      items={result.items}
      canEdit={result.canEdit}
      day={openingDay(
        result.items.filter((item) => item.kind === 'session'),
        cairoDay(new Date())!,
      )}
      spaceHref={spaceHref}
    />
  )
}
