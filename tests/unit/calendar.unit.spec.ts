import { describe, expect, it } from 'vitest'

import {
  monthGrid,
  readCalendarParams,
  shiftMonth,
  viewRange,
  weekDays,
  weekStart,
} from '@/lib/calendar'

describe('calendar dates', () => {
  it('starts weeks on Saturday', () => {
    expect(weekStart('2026-03-11')).toBe('2026-03-07') // a Wednesday
    expect(weekStart('2026-03-07')).toBe('2026-03-07')
    expect(weekDays('2026-03-11')).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
    ])
  })

  it('lays a month out in whole weeks', () => {
    const grid = monthGrid('2026-03-18') // March 2026 starts on a Sunday
    expect(grid[0]).toBe('2026-02-28')
    expect(grid.at(-1)).toBe('2026-04-03')
    expect(grid.length % 7).toBe(0)
  })

  it('shifts months, clamping the day', () => {
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-15')
  })

  it('reads the view and day from the URL, falling back', () => {
    expect(readCalendarParams({ view: 'week', date: '2026-03-11' }, '2026-10-12')).toEqual({
      view: 'week',
      date: '2026-03-11',
    })
    expect(readCalendarParams({ view: 'year', date: 'soon' }, '2026-10-12')).toEqual({
      view: 'month',
      date: '2026-10-12',
    })
  })

  it('gives each view its range and its steps', () => {
    expect(viewRange('week', '2026-03-11')).toEqual({
      from: '2026-03-07',
      to: '2026-03-13',
      previous: '2026-02-28',
      next: '2026-03-14',
    })
    expect(viewRange('month', '2026-03-18')).toMatchObject({
      previous: '2026-02-01',
      next: '2026-04-01',
    })
    expect(viewRange('agenda', '2026-03-01')).toMatchObject({
      from: '2026-03-01',
      to: '2026-03-30',
    })
  })
})
