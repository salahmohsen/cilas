import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import { getCachedCalendarItems, getReaderCalendarItems } from '@/api/calendar.api'
import { loadedRange, readCalendarUrl } from '@/components/calendar/calendar-url'
import { PublicCalendar } from '@/components/calendar/public-calendar'
import { publicItems, publicKinds } from '@/components/calendar/public-items'
import { ConnectedScheduleActions } from '@/components/space/connected-schedule-actions'
import { localeOf } from '@/i18n/routing'
import { cairoDay } from '@/lib/cairo-day'
import { readerCourseIds } from '@/lib/reader-courses'
import type { User } from '@/payload-types'

import {
  MINE,
  mergeMeetings,
  OTHER,
  ownCourseIdsOf,
  portalItems,
  presetHidden,
} from './portal-items'

type Props = {
  user: User
  locale: string
  query: { view?: string; date?: string }
}

/**
 * The reader's calendar: the public courses and events from the cached list,
 * and the reader's own courses from one gated read that runs beside it, never
 * inside it. Courses start as Your courses and Other courses, with Other
 * courses off when the reader has a course of their own to show.
 */
export async function PortalCalendarPage({ user, locale, query }: Props) {
  const lang = localeOf(locale)
  const today = cairoDay(new Date())!
  const { day } = readCalendarUrl(query, today)
  const range = loadedRange(day)
  const payload = await getPayload({ config })
  const [t, tp, publicList, own] = await Promise.all([
    getTranslations('Calendar'),
    getTranslations('Portal.calendar'),
    getCachedCalendarItems(lang),
    readerCourseIds(payload, user).then((ids) => getReaderCalendarItems(payload, lang, user, ids)),
  ])
  const all = mergeMeetings(publicList, own)
  const meetings = all.filter((m) => m.date >= range.from && m.date <= range.to)
  const ownIds = ownCourseIdsOf(own)
  const items = portalItems(
    publicItems(meetings, {
      locale: lang,
      session: (n) => t('session', { n }),
      materials: (count) => t('sessionMaterials', { count }),
      activities: (count) => t('sessionActivities', { count }),
    }),
    ownIds,
  )
  const kinds = {
    ...publicKinds(
      meetings.filter((m) => m.kind === 'event'),
      {
        course: (type) => type,
        event: (type) => t(`eventTypes.${type}`),
        viewCourse: t('viewCourse'),
        viewEvent: t('viewEvent'),
      },
    ),
    [MINE]: { name: tp('yourCourses'), open: t('viewCourse') },
    [OTHER]: { name: tp('otherCourses'), open: t('viewCourse') },
  }

  return (
    <div className="py-6 sm:px-4 sm:py-8">
      <ConnectedScheduleActions>
        <PublicCalendar
          path="/spaces/calendar"
          readOnly
          access={{ mode: 'view', canEdit: false }}
          items={items}
          range={range}
          today={today}
          kinds={kinds}
          months={[...new Set(all.map((m) => m.date.slice(0, 7)))]}
          defaultHiddenKinds={presetHidden(ownIds)}
        />
      </ConnectedScheduleActions>
    </div>
  )
}
