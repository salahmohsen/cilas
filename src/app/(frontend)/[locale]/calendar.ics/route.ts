import { getTranslations } from 'next-intl/server'

import { getCachedCalendarItems } from '@/api/calendar.api'
import { env } from '@/env'
import { buildIcs } from '@/lib/ics'

/**
 * The calendar as an iCalendar feed, in the site language: `/en/calendar.ics`
 * to download or for a calendar app to subscribe to (webcal://…).
 */
export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const lang = locale === 'ar' ? 'ar' : 'en'
  const [t, tf] = await Promise.all([
    getTranslations({ locale: lang, namespace: 'Calendar' }),
    getTranslations({ locale: lang, namespace: 'Study.filters' }),
  ])
  const items = await getCachedCalendarItems(lang)
  const origin = env.NEXT_PUBLIC_SERVER_URL || new URL(request.url).origin
  const ics = buildIcs(
    items.map((item) => ({
      uid: `${item.key}@cilas`,
      title: item.starts ? `${t('starts')}: ${item.title}` : item.title,
      date: item.date,
      start: item.start,
      end: item.end,
      ...(item.href ? { url: `${origin}/${lang}${item.href}` } : {}),
      description: [
        item.kind === 'course' ? tf(`types.${item.type}`) : t(`eventTypes.${item.type}`),
        item.session ? t('session', { n: item.session }) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      cancelled: item.cancelled,
    })),
    { name: t('feedName') },
  )
  const download = new URL(request.url).searchParams.has('download')
  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      ...(download ? { 'content-disposition': `attachment; filename="cilas-calendar-${lang}.ics"` } : {}),
    },
  })
}
