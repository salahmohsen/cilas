import { createTranslator } from 'next-intl'
import { describe, expect, it } from 'vitest'

import { calendarFeed } from '@/lib/calendar-feed'
import { courseItems } from '@/lib/calendar'
import { eventItems } from '@/lib/events'

import { messagesOf } from '../../testing/intl.test-utils'

const words = {
  t: createTranslator({ locale: 'en', messages: messagesOf.en, namespace: 'Calendar' }),
  tf: createTranslator({ locale: 'en', messages: messagesOf.en, namespace: 'Study.filters' }),
}

describe('calendar feed', () => {
  it('publishes stable session updates and keeps event UIDs', async () => {
    const base = { kind: 'course' as const, title: 'Course', href: '/study/course', type: 'lab' }
    const session = {
      id: 8,
      updatedAt: '2026-11-17T10:00:00Z',
      meetings: [{ id: 'row8', date: '2026-11-17', start_time: '19:00' }],
    }
    const events = eventItems(
      4,
      { ...base, kind: 'event', type: 'talk' },
      { start_date: '2026-11-17', start_precision: 'day' },
    )
    const request = (items: Parameters<typeof calendarFeed>[0]) =>
      calendarFeed(items, {
        request: new Request('https://ci-las.org/en/calendar.ics'),
        lang: 'en',
        origin: 'https://ci-las.org',
        t: (key, values) => words.t(key as never, values as never),
        tf: (key) => words.tf(key as never),
      })
    const before = await request([...courseItems(base, [session]), ...events]).text()
    const response = request([
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
    expect(before).toContain('URL:https://ci-las.org/en/study/course')
    expect(before).toContain('DESCRIPTION:Talk')
  })
})
