import { describe, expect, it } from 'vitest'

import { hourRange, scrollTargetOf } from '@/components/calendar/ui/calendar-model'

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
