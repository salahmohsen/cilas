import { describe, expect, it } from 'vitest'

import {
  expandSchedule,
  isOnCalendar,
  scheduleEndDate,
  type Schedule,
  type SessionDates,
} from '@/lib/schedule'

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

describe('expandSchedule with sessions', () => {
  // Tuesdays and Thursdays for 3 weeks: 6 meetings, 2 per session.
  const threeWeeks: Schedule = { ...tueThu, weeks: 3 }
  const pick = (sessions: SessionDates[]) =>
    expandSchedule(threeWeeks, sessions).map(({ date, session, cancelled }) => ({
      date,
      session,
      ...(cancelled ? { cancelled } : {}),
    }))

  it('gives each session one week of meetings by default', () => {
    expect(pick([{}, {}, {}])).toEqual([
      { date: '2026-03-03', session: 1 },
      { date: '2026-03-05', session: 1 },
      { date: '2026-03-10', session: 2 },
      { date: '2026-03-12', session: 2 },
      { date: '2026-03-17', session: 3 },
      { date: '2026-03-19', session: 3 },
    ])
  })

  it('lets a session take a different number of meetings', () => {
    expect(pick([{ meetings: 1 }, { meetings: 3 }])).toEqual([
      { date: '2026-03-03', session: 1 },
      { date: '2026-03-05', session: 2 },
      { date: '2026-03-10', session: 2 },
      { date: '2026-03-12', session: 2 },
      // Left over after the last session.
      { date: '2026-03-17', session: undefined },
      { date: '2026-03-19', session: undefined },
    ])
  })

  it('keeps a cancelled session in place, marked cancelled', () => {
    expect(pick([{}, { cancelled: true }, {}])).toEqual([
      { date: '2026-03-03', session: 1 },
      { date: '2026-03-05', session: 1 },
      { date: '2026-03-10', session: 2, cancelled: true },
      { date: '2026-03-12', session: 2, cancelled: true },
      { date: '2026-03-17', session: 3 },
      { date: '2026-03-19', session: 3 },
    ])
  })

  it("uses a session's own dates instead of the computed ones", () => {
    const moved = expandSchedule(threeWeeks, [
      {},
      {},
      { dates: [{ date: '2026-03-21', start_time: '10:00', end_time: '12:00' }] },
    ])
    expect(moved.slice(4)).toEqual([
      { date: '2026-03-21', start_time: '10:00', end_time: '12:00', session: 3 },
    ])
  })

  it('reads stored timestamps in session dates as Cairo days', () => {
    const moved = expandSchedule(threeWeeks, [
      { dates: [{ date: '2026-03-20T22:00:00.000Z', start_time: '10:00', end_time: '12:00' }] },
    ])
    expect(moved.find((m) => m.session === 1)?.date).toBe('2026-03-21')
  })

  it('numbers sessions by order, not array position', () => {
    expect(pick([{ order: 2 }, { order: 1, meetings: 1 }]).slice(0, 3)).toEqual([
      { date: '2026-03-03', session: 1 },
      { date: '2026-03-05', session: 2 },
      { date: '2026-03-10', session: 2 },
    ])
  })
})

describe('scheduleEndDate', () => {
  it('is the last meeting day', () => {
    expect(scheduleEndDate(tueThu)).toBe('2026-03-12')
  })

  it('ignores cancelled meetings', () => {
    expect(scheduleEndDate(tueThu, [{}, { cancelled: true }])).toBe('2026-03-05')
  })

  it('follows moved session dates', () => {
    expect(
      scheduleEndDate(tueThu, [
        {},
        { dates: [{ date: '2026-03-28', start_time: '10:00', end_time: '12:00' }] },
      ]),
    ).toBe('2026-03-28')
  })

  it('is null with no meetings', () => {
    expect(scheduleEndDate({ ...tueThu, slots: [] })).toBeNull()
  })
})

describe('isOnCalendar', () => {
  it('shows day-precision schedules, the default', () => {
    expect(isOnCalendar(tueThu)).toBe(true)
    expect(isOnCalendar({ ...tueThu, start_precision: 'day' })).toBe(true)
  })

  it('keeps week-precision schedules off the calendar', () => {
    expect(isOnCalendar({ ...tueThu, start_precision: 'week' })).toBe(false)
  })

  it('keeps empty schedules off the calendar', () => {
    expect(isOnCalendar({ ...tueThu, start_date: null })).toBe(false)
    expect(isOnCalendar(null)).toBe(false)
  })
})
