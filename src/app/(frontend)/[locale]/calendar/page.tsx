import { localeOf } from '@/i18n/routing'
import { pageAlternates } from '@/lib/seo'
import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { publicCalendarAccess } from '@/api/public-calendar.api'
import { getCalendarItems, getCachedCalendarItems } from '@/api/calendar.api'
import { loadedRange, readCalendarUrl } from '@/components/calendar/calendar-url'
import { PublicCalendar } from '@/components/calendar/public-calendar'
import { kindOf, publicItems } from '@/components/calendar/public-items'
import { cairoDay } from '@/lib/cairo-day'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ view?: string; date?: string; edit?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = await getTranslations('Calendar')
  return {
    alternates: pageAlternates('/calendar', locale),
    title: t('metaTitle'),
    description: t('intro'),
  }
}

/**
 * The calendar: courses' meetings and events, by month, week, day or as an
 * agenda, for every visitor. The view and day are in the URL
 * (`?view=week&date=2026-03-07`), so every view can be linked to and the
 * browser's back button works. The server renders the days around the day
 * asked for, so the first view is in the HTML.
 */
export default async function CalendarPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  const lang = localeOf(locale)
  const today = cairoDay(new Date())!
  const { day } = readCalendarUrl(query, today)
  const range = loadedRange(day)
  const access = await publicCalendarAccess(query.edit === '1', lang, range)
  const [t, tf, all] = await Promise.all([
    getTranslations('Calendar'),
    getTranslations('Study.filters'),
    access.mode === 'edit'
      ? getCalendarItems(await getPayload({ config }), lang)
      : getCachedCalendarItems(lang),
  ])
  const meetings = all.filter((m) => m.date >= range.from && m.date <= range.to)
  const kinds = Object.fromEntries(
    meetings.map((m) => [
      kindOf(m),
      m.kind === 'course'
        ? { name: tf(`types.${m.type}`), open: t('viewCourse') }
        : { name: t(`eventTypes.${m.type}`), open: t('viewEvent') },
    ]),
  )

  if (access.mode === 'edit') {
    for (const item of access.items) {
      if (!kinds[item.kind])
        kinds[item.kind] = { name: tf(`types.${item.kind.slice(7)}`), open: t('viewCourse') }
    }
  }

  return (
    <div className="page-frame py-10 sm:py-14">
      <PublicCalendar
        access={access}
        items={publicItems(
          access.mode === 'edit' ? meetings.filter((m) => m.kind === 'event') : meetings,
          {
            locale: lang,
            session: (n) => t('session', { n }),
            materials: (count) => t('sessionMaterials', { count }),
            activities: (count) => t('sessionActivities', { count }),
          },
        )}
        range={range}
        today={today}
        kinds={kinds}
        months={[...new Set(all.map((m) => m.date.slice(0, 7)))]}
      />
    </div>
  )
}
