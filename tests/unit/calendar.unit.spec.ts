import { describe, expect, it } from 'vitest'

import type { CalendarItem } from '@/lib/calendar'
import {
  courseItems,
  monthGrid,
  readCalendarParams,
  shiftMonth,
  summariseDay,
  toneOf,
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

describe('summariseDay', () => {
  const cover = (n: number) => ({ url: `/c${n}.jpg`, alt: '' })
  const item = (key: string, over: Partial<CalendarItem> = {}): CalendarItem => ({
    key,
    kind: 'course',
    title: key,
    href: null,
    date: '2026-03-07',
    type: 'thematic',
    ...over,
  })

  it('lists two items and counts the rest', () => {
    const day = summariseDay([item('a'), item('b'), item('c'), item('d')])
    expect(day.listed.map((i) => i.key)).toEqual(['a', 'b'])
    expect(day.hidden).toBe(2)
  })

  it('shows a shared picture once and skips cancelled meetings', () => {
    const day = summariseDay([
      item('a', { cover: cover(1) }),
      item('b', { cover: cover(1) }),
      item('c', { cover: cover(2), cancelled: true }),
      item('d'),
    ])
    expect(day.covers.map((c) => c.url)).toEqual(['/c1.jpg'])
  })

  it('turns through at most six covers', () => {
    const day = summariseDay([1, 2, 3, 4, 5, 6, 7].map((n) => item(`k${n}`, { cover: cover(n) })))
    expect(day.covers).toHaveLength(6)
  })
})

describe('toneOf', () => {
  it('gives a course and an event type their poster colour, and an unknown type a neutral one', () => {
    expect(toneOf({ type: 'core' })).toBe('#ffb71b')
    expect(toneOf({ type: 'talk' })).toBe('#1782ea')
    expect(toneOf({ type: 'something-new' })).toContain('--border')
  })
})

describe('courseItems', () => {
  const base = { kind: 'course' as const, title: 'A course', href: '/study/a', type: 'lab' }

  it('places every meeting with its session number, cancelled ones marked, all-day ones untimed', () => {
    const items = courseItems(base, [
      { id: 8, meetings: [{ date: '2026-03-10', start_time: '19:00', end_time: '21:00' }] },
      { id: 5, meetings: [{ date: '2026-03-03', start_time: '19:00', end_time: '21:00' }] },
      { id: 9, cancelled: true, meetings: [{ date: '2026-03-17' }] },
    ])
    expect(items).toEqual([
      {
        ...base,
        key: 's5-2026-03-03-1900',
        date: '2026-03-03',
        start: '19:00',
        end: '21:00',
        session: 1,
      },
      {
        ...base,
        key: 's8-2026-03-10-1900',
        date: '2026-03-10',
        start: '19:00',
        end: '21:00',
        session: 2,
      },
      { ...base, key: 's9-2026-03-17-day', date: '2026-03-17', session: 3, cancelled: true },
    ])
  })

  it("keeps a meeting's key when another session is added before it", () => {
    const later = { id: 8, meetings: [{ date: '2026-03-10', start_time: '19:00' }] }
    const before = courseItems(base, [later])
    const after = courseItems(base, [{ id: 12, meetings: [{ date: '2026-03-03' }] }, later])
    expect(after[1]!.key).toBe(before[0]!.key)
    expect(after[1]!.session).toBe(2)
  })

  it('places nothing for a course with no meeting', () => {
    expect(courseItems(base, [])).toEqual([])
    expect(courseItems(base, [{ id: 1, meetings: [] }])).toEqual([])
  })
})
