import { describe, expect, it } from 'vitest'

import {
  calendarQuery,
  holds,
  loadedRange,
  readCalendarUrl,
} from '@/components/calendar/calendar-url'

describe('the calendar URL', () => {
  const today = '2026-11-17'

  it('reads the old views and the new ones', () => {
    expect(readCalendarUrl({ view: 'month', date: '2026-03-11' }, today)).toEqual({
      view: 'month',
      day: '2026-03-11',
    })
    expect(readCalendarUrl({ view: 'week', date: '2026-03-11' }, today).view).toBe('week')
    expect(readCalendarUrl({ view: 'agenda', date: '2026-03-11' }, today).view).toBe('agenda')
    expect(readCalendarUrl({ view: 'day', date: '2026-03-11' }, today).view).toBe('day')
    expect(readCalendarUrl({ view: '3days', date: '2026-03-11' }, today).view).toBe('threeDays')
  })

  it('falls back to the month of today for what it cannot read', () => {
    expect(readCalendarUrl({}, today)).toEqual({ view: 'month', day: today })
    expect(readCalendarUrl({ view: 'year', date: 'soon' }, today)).toEqual({
      view: 'month',
      day: today,
    })
    expect(readCalendarUrl({ view: ['week', 'day'], date: '2026-02-30' }, today)).toEqual({
      view: 'month',
      day: today,
    })
  })

  it('writes every view back to a URL that reads the same', () => {
    for (const view of ['month', 'week', 'day', 'threeDays', 'agenda'] as const) {
      const params = new URLSearchParams(calendarQuery(view, '2026-03-11'))
      expect(
        readCalendarUrl({ view: params.get('view'), date: params.get('date') }, today),
      ).toEqual({ view, day: '2026-03-11' })
    }
    expect(calendarQuery('threeDays', '2026-03-11')).toBe('?view=3days&date=2026-03-11')
  })

  it("loads the month's whole weeks and two weeks from the day: March 2026 starts on a Sunday, so its grid starts on Saturday 28 February", () => {
    expect(loadedRange('2026-03-11')).toEqual({ from: '2026-02-28', to: '2026-04-03' })
    expect(loadedRange('2026-03-30')).toEqual({ from: '2026-02-28', to: '2026-04-12' })
  })

  it('knows which views the loaded days hold', () => {
    const range = loadedRange('2026-03-11')
    expect(holds(range, 'week', '2026-03-28')).toBe(true)
    expect(holds(range, 'week', '2026-04-04')).toBe(false)
    expect(holds(range, 'month', '2026-04-01')).toBe(false)
    expect(holds(range, 'agenda', '2026-03-20')).toBe(true)
    expect(holds(range, 'agenda', '2026-03-25')).toBe(false)
  })
})
