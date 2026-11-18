import { describe, expect, it } from 'vitest'

import {
  allDayBars,
  blocksOf,
  hourRange,
  scrollTargetOf,
  upNext,
} from '@/components/calendar/ui/calendar-model'
import { weekOf } from '@/components/calendar/ui/calendar-time'
import type { CalendarItem } from '@/lib/calendar-items'

const at = (track: string, start: number, end: number) => ({
  id: `${track}-${start}`,
  track,
  start,
  end,
})
const h = (hours: number) => hours * 60

describe('hourRange', () => {
  it('shows 06:00 to 24:00 in edit mode on an empty course', () => {
    expect(hourRange('edit', [])).toEqual({ min: h(6), max: h(24) })
  })

  it('shows 06:00 to 24:00 in edit mode for meetings from 10:00 to 22:00', () => {
    const blocks = [at('2026-11-14', h(10), h(13)), at('2026-11-17', h(19), h(22))]
    expect(hourRange('edit', blocks)).toEqual({ min: h(6), max: h(24) })
  })

  it('starts at the whole hour of a meeting before 06:00', () => {
    expect(hourRange('edit', [at('2026-11-14', h(5) + 30, h(7))])).toEqual({
      min: h(5),
      max: h(24),
    })
  })

  it('ends at 24:00 for a meeting that runs to 24:00', () => {
    expect(hourRange('edit', [at('2026-11-14', h(22), h(24))])).toEqual({ min: h(6), max: h(24) })
  })

  it('shows the earliest start to the latest end, in whole hours, in view mode', () => {
    const blocks = [at('2026-11-14', h(10) + 15, h(13)), at('2026-11-17', h(19), h(21) + 30)]
    expect(hourRange('view', blocks)).toEqual({ min: h(10), max: h(22) })
  })

  it('shows 09:00 to 17:00 in view mode with no meeting', () => {
    expect(hourRange('view', [])).toEqual({ min: h(9), max: h(17) })
  })
})

describe('scrollTargetOf', () => {
  const days = ['2026-11-14', '2026-11-15']
  it('is the first meeting of the days', () => {
    const blocks = [
      at('2026-11-15', h(14), h(15)),
      at('2026-11-14', h(11), h(12)),
      at('2026-12-01', h(7), h(8)),
    ]
    expect(scrollTargetOf(blocks, days)).toBe(h(11))
  })
  it('is 09:00 when the days have no meeting', () => {
    expect(scrollTargetOf([at('2026-12-01', h(7), h(8))], days)).toBe(h(9))
  })
})

const item = (id: string, blocks: CalendarItem['blocks'], extra: Partial<CalendarItem> = {}) =>
  ({
    id,
    kind: 'event',
    title: id,
    tone: 'blue',
    cancelled: false,
    version: 'v',
    blocks,
    ...extra,
  }) as CalendarItem
const allDay = (id: string, date: string) => ({ id, date, start_time: null, end_time: null })

describe('allDayBars', () => {
  const week = weekOf('2026-11-28')
  const fair = item('fair', [
    allDay('a', '2026-11-29'),
    allDay('b', '2026-11-30'),
    allDay('c', '2026-12-01'),
    allDay('e', '2026-12-03'),
  ])
  const trip = item('trip', [allDay('t', '2026-11-30'), allDay('u', '2026-12-01')])

  it('joins an item’s days in a row into one bar across the month end, and stacks overlaps in lanes', () => {
    const bars = allDayBars(blocksOf([fair, trip]), week, () => 'saved')
    expect(
      bars.map((bar) => [bar.blocks.map((b) => b.blockId), bar.from, bar.span, bar.lane]),
    ).toEqual([
      [['a', 'b', 'c'], 1, 3, 0],
      [['t', 'u'], 2, 2, 1],
      [['e'], 5, 1, 0],
    ])
  })

  it('splits a run where the state changes, such as an unsaved day in it', () => {
    const bars = allDayBars(blocksOf([fair]), week, (block) =>
      block.blockId === 'b' ? 'unsaved' : 'saved',
    )
    expect(bars.map((bar) => [bar.from, bar.span])).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
      [5, 1],
    ])
  })

  it('ends a bar at the edge of the week and leaves out days not shown', () => {
    const edge = item('edge', [allDay('x', '2026-12-04'), allDay('y', '2026-12-05')])
    expect(
      allDayBars(blocksOf([edge]), week, () => 'saved').map((bar) => [bar.from, bar.span]),
    ).toEqual([[6, 1]])
  })
})

describe('upNext', () => {
  const items = [
    item('done', [{ id: 'd', date: '2026-11-17', start_time: '09:00', end_time: '10:00' }]),
    item('off', [{ id: 'o', date: '2026-11-17', start_time: '18:00', end_time: '19:00' }], {
      cancelled: true,
    }),
    item('next', [{ id: 'n', date: '2026-11-17', start_time: '19:00', end_time: '21:00' }]),
  ]

  it('names the first held meeting that has not ended', () => {
    const next = upNext(items, { date: '2026-11-17', minutes: 12 * 60 })
    expect([next?.item.id, next?.id]).toEqual(['next', 'n'])
  })

  it('keeps a meeting going on now, and has none after the last', () => {
    expect(upNext(items, { date: '2026-11-17', minutes: 20 * 60 })?.id).toBe('n')
    expect(upNext(items, { date: '2026-11-17', minutes: 21 * 60 })).toBeNull()
  })
})
