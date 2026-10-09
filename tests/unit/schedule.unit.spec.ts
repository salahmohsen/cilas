import { describe, expect, it } from 'vitest'

import { expandSchedule, type Schedule } from '@/lib/schedule'

// 3 March 2026 is a Tuesday.
const tueThu: Schedule = {
  start_date: '2026-03-03',
  weeks: 2,
  slots: [
    { weekday: 'thu', start_time: '19:00', end_time: '21:00' },
    { weekday: 'tue', start_time: '19:00', end_time: '21:00', label: 'Seminar' },
  ],
}

const days = (s: Schedule) => expandSchedule(s).map((m) => m.date)

describe('expandSchedule (pattern only)', () => {
  it('produces every meeting in date order', () => {
    expect(days(tueThu)).toEqual(['2026-03-03', '2026-03-05', '2026-03-10', '2026-03-12'])
  })

  it('carries times and labels from the slot', () => {
    expect(expandSchedule(tueThu)[0]).toEqual({
      date: '2026-03-03',
      start_time: '19:00',
      end_time: '21:00',
      label: 'Seminar',
    })
  })

  it('starts each slot on its first weekday on or after the start date', () => {
    // A Wednesday start: Thursday first, then the next Tuesday.
    expect(days({ ...tueThu, start_date: '2026-03-04', weeks: 1 })).toEqual([
      '2026-03-05',
      '2026-03-10',
    ])
  })

  it('orders two meetings on one day by start time', () => {
    const twice: Schedule = {
      start_date: '2026-03-03',
      weeks: 1,
      slots: [
        { weekday: 'tue', start_time: '18:00', end_time: '19:00' },
        { weekday: 'tue', start_time: '10:00', end_time: '12:00' },
      ],
    }
    expect(expandSchedule(twice).map((m) => m.start_time)).toEqual(['10:00', '18:00'])
  })

  it('reads a stored timestamp as its Cairo day', () => {
    expect(days({ ...tueThu, start_date: '2026-03-02T22:00:00.000Z' })[0]).toBe('2026-03-03')
  })

  it('is empty until start date, weeks and slots are all set', () => {
    expect(expandSchedule({ ...tueThu, start_date: null })).toEqual([])
    expect(expandSchedule({ ...tueThu, weeks: 0 })).toEqual([])
    expect(expandSchedule({ ...tueThu, slots: [] })).toEqual([])
    expect(expandSchedule(null)).toEqual([])
  })
})
