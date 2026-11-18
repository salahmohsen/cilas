import { describe, expect, it, vi } from 'vitest'
import { courseItems } from '@/lib/calendar'
import { eventItems } from '@/lib/events'
import { GET } from '@/app/(frontend)/[locale]/calendar.ics/route'

const { load } = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('@/api/calendar.api', () => ({ getCachedCalendarItems: load }))
vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_SERVER_URL: 'https://ci-las.org' } }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))

describe('calendar feed route', () => {
  it('publishes stable session updates and keeps event UIDs', async () => {
    const base = { kind: 'course' as const, title: 'Course', href: '/study/course', type: 'lab' }
    const session = {
      id: 8,
      updatedAt: '2026-11-17T10:00:00Z',
      meetings: [{ id: 'row8', date: '2026-11-17', start_time: '19:00' }],
    }
    const events = eventItems(
      4,
      { ...base, kind: 'event' },
      { start_date: '2026-11-17', start_precision: 'day' },
    )
    const request = () =>
      GET(new Request('https://ci-las.org/en/calendar.ics'), {
        params: Promise.resolve({ locale: 'en' }),
      })
    load.mockResolvedValue([...courseItems(base, [session]), ...events])
    const before = await (await request()).text()
    load.mockResolvedValue([
      ...courseItems(base, [
        {
          ...session,
          cancelled: true,
          updatedAt: '2026-11-17T10:00:02Z',
          meetings: [{ ...session.meetings[0], date: '2026-11-18', start_time: '20:00' }],
        },
      ]),
      ...events,
    ])
    const response = await request()
    const after = await response.text()
    expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    expect(before).toContain('UID:session-meeting-row8@cilas.org\r\n')
    expect(after).toContain('UID:session-meeting-row8@cilas.org\r\n')
    expect(before).toContain('UID:e4-day@cilas\r\n')
    expect(after).toContain('UID:e4-day@cilas\r\n')
    expect(after).toContain('STATUS:CANCELLED\r\n')
    expect(after).toContain('LAST-MODIFIED:20261117T100002Z\r\n')
    expect(Number(/SEQUENCE:(\d+)/.exec(after)![1])).toBeGreaterThan(
      Number(/SEQUENCE:(\d+)/.exec(before)![1]),
    )
  })
})
