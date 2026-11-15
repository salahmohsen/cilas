import { describe, expect, it, vi } from 'vitest'

import type { CalendarItem } from '@/lib/calendar'

const items: CalendarItem[] = [
  {
    key: 's1-2026-03-03-1900',
    kind: 'course',
    title: 'Held course',
    href: '/study/held',
    type: 'lab',
    date: '2026-03-03',
    start: '19:00',
    end: '21:00',
    session: 1,
  },
  {
    key: 's2-2019-02-07-day',
    kind: 'course',
    title: 'Archive course',
    href: '/study/archive',
    type: 'lab',
    date: '2019-02-07',
    session: 1,
    approximate: true,
  },
]

vi.mock('@/api/calendar.api', () => ({ getCachedCalendarItems: async () => items }))
vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_SERVER_URL: 'https://cilas.test' } }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}))

const { GET } = await import('@/app/(frontend)/[locale]/calendar.ics/route')

describe('the calendar feed', () => {
  it('leaves approximate meetings out and keeps held ones', async () => {
    const res = await GET(new Request('https://cilas.test/en/calendar.ics'), {
      params: Promise.resolve({ locale: 'en' }),
    })
    const ics = await res.text()
    expect(ics).toContain('SUMMARY:Held course')
    expect(ics).not.toContain('Archive course')
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
  })
})
