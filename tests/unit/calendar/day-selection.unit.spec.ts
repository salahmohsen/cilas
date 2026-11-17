import { describe, expect, it } from 'vitest'

import type { EditBlock } from '@/components/calendar/ui/calendar-model'
import {
  dayBlocksOf,
  monthDefaultDay,
  nextBlockAfter,
} from '@/components/calendar/ui/day-selection'

const block = (id: string, track: string, start: number, extra: Partial<EditBlock> = {}) =>
  ({ id, itemId: id, blockId: id, track, start, end: start + 60, ...extra }) as EditBlock

const blocks = [
  block('late', '2026-11-17', 18 * 60),
  block('early', '2026-11-17', 9 * 60),
  block('bar', '2026-11-17', 0, { allDay: true, end: 0 }),
  block('gone', '2026-11-17', 10 * 60, { deleted: true }),
  block('next', '2026-11-20', 17 * 60),
  block('after', '2026-12-02', 8 * 60),
]

describe('the day the side panel shows', () => {
  it('lists a day all-day first, then by start, with no removed block', () => {
    expect(dayBlocksOf(blocks, '2026-11-17').map((b) => b.id)).toEqual(['bar', 'early', 'late'])
    expect(dayBlocksOf(blocks, '2026-11-18')).toEqual([])
  })

  it('finds the next block after a day, from any day with none', () => {
    expect(nextBlockAfter(blocks, '2026-11-18')?.id).toBe('next')
    expect(nextBlockAfter(blocks, '2026-11-17')?.id).toBe('next')
    expect(nextBlockAfter(blocks, '2026-12-02')).toBeUndefined()
  })

  const november = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)
  it('opens a month on today when it holds today', () => {
    expect(monthDefaultDay(november, '2026-11-17', blocks)).toBe('2026-11-17')
  })
  it('opens another month on its first day with an item, else its first day', () => {
    const december = Array.from(
      { length: 31 },
      (_, i) => `2026-12-${String(i + 1).padStart(2, '0')}`,
    )
    expect(monthDefaultDay(december, '2026-11-17', blocks)).toBe('2026-12-02')
    expect(monthDefaultDay(december, null, [])).toBe('2026-12-01')
  })
})
