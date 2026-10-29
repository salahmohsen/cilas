import { describe, expect, it } from 'vitest'

import {
  expandSchedule,
  isOnCalendar,
  nextSession,
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

describe('single event schedules', () => {
  const screening = {
    mode: 'single' as const,
    start_date: '2026-10-29',
    start_time: '19:00',
    end_time: '21:00',
  }

  it('produces one timed occurrence without weeks, slots or an agenda', () => {
    expect(expandSchedule(screening)).toEqual([
      { date: '2026-10-29', start_time: '19:00', end_time: '21:00' },
    ])
    expect(scheduleEndDate(screening)).toBe('2026-10-29')
    expect(isOnCalendar(screening)).toBe(true)
  })

  it('ignores stored recurring slots when single timing is selected', () => {
    expect(expandSchedule({ ...tueThu, ...screening })).toHaveLength(1)
  })

  it('does not fabricate meetings for incomplete or invalid timing', () => {
    expect(expandSchedule({ ...screening, end_time: null })).toEqual([])
    expect(expandSchedule({ ...screening, start_time: '25:00' })).toEqual([])
    expect(expandSchedule({ ...screening, end_time: '18:00' })).toEqual([])
    expect(expandSchedule({ ...screening, start_date: 'invalid' })).toEqual([])
    expect(isOnCalendar({ ...screening, start_precision: 'week' })).toBe(false)
  })

  it('reads the date in Cairo and keeps legacy recurrence when mode is absent', () => {
    expect(expandSchedule({ ...screening, start_date: '2026-03-02T22:00:00Z' })[0].date).toBe(
      '2026-03-03',
    )
    expect(expandSchedule({ ...tueThu, start_time: '10:00', end_time: '11:00' })).toHaveLength(4)
  })
})

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

  it('is empty for an invalid start date', () => {
    expect(expandSchedule({ ...tueThu, start_date: '2026-13-01' })).toEqual([])
  })

  it('uses whole weeks only', () => {
    expect(days({ ...tueThu, weeks: 1.5 })).toEqual(['2026-03-03', '2026-03-05'])
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

describe('expandSchedule edge cases', () => {
  const threeWeeks: Schedule = { ...tueThu, weeks: 3 }
  const dated = (sessions: SessionDates[]) =>
    expandSchedule(threeWeeks, sessions).map((m) => m.date)

  it('takes no meetings for a negative or NaN count, without duplicating dates', () => {
    expect(dated([{ meetings: -1 }, {}])).toEqual([
      '2026-03-03',
      '2026-03-05',
      '2026-03-10',
      '2026-03-12',
      '2026-03-17',
      '2026-03-19',
    ])
    expect(dated([{ meetings: NaN }, {}])).toEqual(dated([{ meetings: 0 }, {}]))
    expect(new Set(dated([{ meetings: -1 }, {}])).size).toBe(6)
  })

  it('gives a zero-meeting session nothing and starts the next where the cursor was', () => {
    const out = expandSchedule(threeWeeks, [{ meetings: 0 }, {}]).filter((m) => m.session)
    expect(out.map(({ date, session }) => ({ date, session }))).toEqual([
      { date: '2026-03-03', session: 2 },
      { date: '2026-03-05', session: 2 },
    ])
  })

  it('skips session dates that are not real days', () => {
    const out = expandSchedule(threeWeeks, [
      { dates: [{ date: 'nope', start_time: '10:00', end_time: '12:00' }] },
    ])
    expect(out.some((m) => m.session === 1)).toBe(false)
  })

  it('numbers explicit orders first, then unset ones in array order', () => {
    const out = expandSchedule(threeWeeks, [
      { order: 1, meetings: 1 },
      { meetings: 1 },
      { order: 0, meetings: 1 },
    ])
    expect(out.slice(0, 3).map((m) => m.date)).toEqual(['2026-03-03', '2026-03-05', '2026-03-10'])
    // order 0 takes the first meeting and is session 1, order 1 is 2, unset is 3.
    expect(out.slice(0, 3).map((m) => m.session)).toEqual([1, 2, 3])
  })

  it('marks a cancelled session with its own dates as cancelled', () => {
    const out = expandSchedule(threeWeeks, [
      {
        cancelled: true,
        dates: [{ date: '2026-03-21', start_time: '10:00', end_time: '12:00' }],
      },
    ])
    expect(out.find((m) => m.date === '2026-03-21')).toMatchObject({ session: 1, cancelled: true })
  })

  it('gives just the override meetings when there is no pattern', () => {
    expect(
      expandSchedule(null, [
        { dates: [{ date: '2026-03-21', start_time: '10:00', end_time: '12:00' }] },
      ]),
    ).toEqual([{ date: '2026-03-21', start_time: '10:00', end_time: '12:00', session: 1 }])
  })

  it('has no end date when every meeting is cancelled', () => {
    expect(scheduleEndDate(tueThu, [{ cancelled: true }, { cancelled: true }])).toBeNull()
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

describe('nextSession', () => {
  const schedule: Schedule = {
    start_date: '2026-03-02',
    start_precision: 'day',
    weeks: 3,
    slots: [{ weekday: 'mon', start_time: '18:00', end_time: '20:00' }],
  }
  const sessions = [{ order: 1 }, { order: 2, cancelled: true }, { order: 3 }]

  it('is the first session on or after today', () => {
    expect(nextSession(schedule, sessions, '2026-03-01')?.index).toBe(0)
    expect(nextSession(schedule, sessions, '2026-03-02')?.index).toBe(0)
  })

  it('skips a cancelled session', () => {
    expect(nextSession(schedule, sessions, '2026-03-03')?.index).toBe(2)
  })

  it('is null after the last meeting, or without sessions', () => {
    expect(nextSession(schedule, sessions, '2026-03-17')).toBeNull()
    expect(nextSession(schedule, [], '2026-03-01')).toBeNull()
  })
})
