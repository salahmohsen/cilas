import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'

import { addDays, cairoNow, weekStartOf } from '@/components/calendar/ui/calendar-time'
import type { CalendarItem } from '@/lib/calendar-items'

import { CalendarDev } from './calendar-dev'

export const metadata: Metadata = { title: 'Calendar dev', robots: { index: false } }

const sampleItems = (week: string): CalendarItem[] => {
  const day = (offset: number) => addDays(week, offset)
  const item = (
    id: string,
    kind: string,
    tone: string,
    title: string,
    blocks: CalendarItem['blocks'],
    cancelled = false,
  ): CalendarItem => ({ id, kind, tone, title, cancelled, version: 'v1', blocks })
  return [
    item('week-3', 'session', 'yellow', 'Week 3', [
      { id: 'tue', date: day(3), start_time: '19:00', end_time: '21:00' },
      { id: 'thu', date: day(5), start_time: '19:00', end_time: '21:00' },
    ]),
    item('studio', 'session', 'yellow', 'Studio lab', [
      { id: 'sat', date: day(0), start_time: '10:00', end_time: '13:00' },
    ]),
    item('reading', 'event', 'blue', 'Reading group', [
      { id: 'tue', date: day(3), start_time: '18:30', end_time: '20:00' },
    ]),
    item('seminar', 'event', 'green', 'Seminar', [
      { id: 'tue', date: day(3), start_time: '19:30', end_time: '20:30' },
    ]),
    item('open-day', 'event', 'pink', 'Open day', [
      { id: 'wed', date: day(4), start_time: null, end_time: null },
    ]),
    item(
      'film',
      'event',
      'blue',
      'Film night',
      [{ id: 'fri', date: day(6), start_time: '17:00', end_time: '19:00' }],
      true,
    ),
    item('week-4', 'session', 'yellow', 'Week 4', []),
    item('guest-talk', 'event', 'blue', 'Guest talk', []),
  ]
}

type Props = { searchParams: Promise<{ mode?: string; fail?: string; width?: string }> }

export default async function CalendarDevPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const query = await searchParams
  const locale = await getLocale()
  return (
    <CalendarDev
      items={sampleItems(weekStartOf(cairoNow().date))}
      locale={locale}
      initialMode={query.mode === 'edit' ? 'edit' : 'view'}
      failSave={query.fail === '1'}
      phone={query.width === 'phone'}
    />
  )
}
