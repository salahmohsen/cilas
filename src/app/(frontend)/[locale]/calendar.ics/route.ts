import { localeOf } from '@/i18n/routing'
import { getTranslations } from 'next-intl/server'

import { getCachedCalendarItems } from '@/api/calendar.api'
import { env } from '@/env'
import { calendarFeed } from '@/lib/calendar-feed'

/**
 * The calendar as an iCalendar feed, in the site language: `/en/calendar.ics`
 * to download or for a calendar app to subscribe to (webcal://…).
 */
export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const lang = localeOf(locale)
  const [t, tf] = await Promise.all([
    getTranslations({ locale: lang, namespace: 'Calendar' }),
    getTranslations({ locale: lang, namespace: 'Study.filters' }),
  ])
  const items = await getCachedCalendarItems(lang)
  return calendarFeed(items, {
    request,
    lang,
    origin: env.NEXT_PUBLIC_SERVER_URL || new URL(request.url).origin,
    t: (key, values) => t(key as never, values as never),
    tf: (key) => tf(key as never),
  })
}
