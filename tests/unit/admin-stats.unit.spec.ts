import { describe, expect, it } from 'vitest'

import {
  bucketByDay,
  bucketByWeek,
  countBy,
  percentChange,
  periodChange,
  totalOf,
} from '@/lib/admin-stats'

// Wednesday 14 October 2026, midday in Cairo.
const NOW = new Date('2026-10-14T10:00:00Z')

describe('bucketByDay', () => {
  it('returns one zero point per day when there is no data', () => {
    const points = bucketByDay([], 7, NOW)
    expect(points).toHaveLength(7)
    expect(points.map((p) => p.value)).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(points.at(-1)?.key).toBe('2026-10-14')
    expect(points[0]?.key).toBe('2026-10-08')
  })

  it('counts timestamps on their Cairo day', () => {
    const points = bucketByDay(
      [
        '2026-10-13T21:30:00Z', // 00:30 on the 14th in Cairo
        '2026-10-14T08:00:00Z',
        '2026-10-12T09:00:00Z',
      ],
      3,
      NOW,
    )
    expect(points.map((p) => [p.key, p.value])).toEqual([
      ['2026-10-12', 1],
      ['2026-10-13', 0],
      ['2026-10-14', 2],
    ])
  })

  it('ignores dates outside the window, empty values and bad dates', () => {
    const points = bucketByDay(
      ['2026-01-01', null, undefined, 'garbage', '2026-10-15T12:00:00Z'],
      7,
      NOW,
    )
    expect(totalOf(points)).toBe(0)
  })

  it('writes readable labels', () => {
    const [point] = bucketByDay([], 1, NOW)
    expect(point?.label).toBe('Wed, Oct 14')
    expect(point?.axisLabel).toBe('Oct 14')
  })
})

describe('bucketByWeek', () => {
  it('starts each week on Saturday and ends with the current week', () => {
    const points = bucketByWeek(['2026-10-10T09:00:00Z', '2026-10-14T09:00:00Z'], 2, NOW)
    // 10 October 2026 is a Saturday.
    expect(points.map((p) => [p.key, p.value])).toEqual([
      ['2026-10-03', 0],
      ['2026-10-10', 2],
    ])
  })

  it('returns zero points for no data', () => {
    expect(totalOf(bucketByWeek([], 4, NOW))).toBe(0)
    expect(bucketByWeek([], 4, NOW)).toHaveLength(4)
  })
})

describe('percentChange', () => {
  it('signs a rise and a fall', () => {
    expect(percentChange(12, 10)).toBe('+20%')
    expect(percentChange(8, 10)).toBe('-20%')
    expect(percentChange(10, 10)).toBe('0%')
  })

  it('has no figure without a baseline', () => {
    expect(percentChange(5, 0)).toBeNull()
    expect(percentChange(0, 0)).toBeNull()
  })
})

describe('periodChange', () => {
  it('compares the last days with the days before them', () => {
    const dates = [
      '2026-10-14T09:00:00Z',
      '2026-10-13T09:00:00Z',
      '2026-10-12T09:00:00Z',
      '2026-10-10T09:00:00Z',
    ]
    // Last 3 days: 3. The 3 days before: 1.
    expect(periodChange(dates, 3, NOW)).toBe('+200%')
  })

  it('is null on empty data', () => {
    expect(periodChange([], 7, NOW)).toBeNull()
  })
})

describe('countBy', () => {
  it('groups by a key and skips items without one', () => {
    expect(countBy(['a', 'b', 'a', '', undefined], (s) => s)).toEqual({ a: 2, b: 1 })
  })

  it('returns an empty record for no items', () => {
    expect(countBy([], () => 'x')).toEqual({})
  })
})
