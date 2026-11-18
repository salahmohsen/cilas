import type { Locale } from '@/i18n/routing'
import type { CalendarMeeting } from '@/lib/calendar'
import { buildIcs } from '@/lib/ics'

type Words = {
  t: (key: string, values?: { n: number }) => string
  tf: (key: string) => string
}

/**
 * The calendar as an iCalendar response, in the site language. `origin` is the
 * site's address, which each entry's link starts with.
 */
export const calendarFeed = (
  items: CalendarMeeting[],
  { request, lang, origin, t, tf }: { request: Request; lang: Locale; origin: string } & Words,
) => {
  const ics = buildIcs(
    items.map((item) => ({
      uid: item.feed ? item.feed.uid : `${item.key}@cilas`,
      updatedAt: item.feed?.updatedAt,
      title: item.title,
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
      ...(download
        ? { 'content-disposition': `attachment; filename="cilas-calendar-${lang}.ics"` }
        : {}),
    },
  })
}
