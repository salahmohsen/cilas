import { describe, expect, it } from 'vitest'

import {
  byWhen,
  firstDay,
  isAllDay,
  lastDay,
  meetingsOf,
  nextMeeting,
  sessionsInOrder,
  summary,
  weeks,
  type Meeting,
  type SessionTimes,
} from '@/lib/meetings'

const at = (date: string, start_time = '19:00', end_time = '21:00'): Meeting => ({
  date,
  start_time,
  end_time,
})
const allDay = (date: string): Meeting => ({ date, start_time: null, end_time: null })

// 2026-03-03 is a Tuesday; 2026-03-05 a Thursday; 2026-02-28 a Saturday.
const tuesdays = (n: number, from = '2026-03-03'): Meeting[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 7 * i)
    return at(d.toISOString().slice(0, 10))
  })

describe('byWhen', () => {
  it('orders by day, then start time, all day first', () => {
    const list = [at('2026-03-04', '10:00'), at('2026-03-03', '19:00'), allDay('2026-03-03')]
    expect([...list].sort(byWhen)).toEqual([
      allDay('2026-03-03'),
      at('2026-03-03', '19:00'),
      at('2026-03-04', '10:00'),
    ])
  })

  it('compares wall-clock strings, so a daylight-saving change cannot reorder them', () => {
    // Egypt moves its clocks on the last Friday of April; the strings do not move.
    const list = [at('2026-05-01', '09:00'), at('2026-04-24', '23:30')]
    expect([...list].sort(byWhen).map((m) => m.date)).toEqual(['2026-04-24', '2026-05-01'])
  })
})

describe('isAllDay', () => {
  it('is true only with both times empty', () => {
    expect(isAllDay(allDay('2026-03-03'))).toBe(true)
    expect(isAllDay({ date: '2026-03-03', start_time: '', end_time: '' })).toBe(true)
    expect(isAllDay(at('2026-03-03'))).toBe(false)
  })
})

describe('sessionsInOrder', () => {
  it('sorts sessions by their first meeting, whatever order the meetings are stored in', () => {
    const b = { id: 'b', meetings: [at('2026-03-17'), at('2026-03-10')] }
    const a = { id: 'a', meetings: [at('2026-03-03')] }
    expect(sessionsInOrder([b, a]).map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('puts sessions with no meeting last, by position, then as given', () => {
    const list = [
      { id: 'none-2', position: 2 },
      { id: 'none-unset' },
      { id: 'placed', meetings: [at('2026-03-03')] },
      { id: 'none-1', position: 1, meetings: [] },
    ]
    expect(sessionsInOrder(list).map((s) => s.id)).toEqual([
      'placed',
      'none-1',
      'none-2',
      'none-unset',
    ])
  })

  it('keeps the given order for sessions that start at the same time', () => {
    const list = [
      { id: 'x', meetings: [at('2026-03-03')] },
      { id: 'y', meetings: [at('2026-03-03')] },
    ]
    expect(sessionsInOrder(list).map((s) => s.id)).toEqual(['x', 'y'])
  })

  it('places an all-day session before a timed one on the same day', () => {
    const list = [
      { id: 'evening', meetings: [at('2026-03-03')] },
      { id: 'day', meetings: [allDay('2026-03-03')] },
    ]
    expect(sessionsInOrder(list).map((s) => s.id)).toEqual(['day', 'evening'])
  })

  it('is empty for no sessions', () => {
    expect(sessionsInOrder([])).toEqual([])
  })
})

describe('meetingsOf', () => {
  it('numbers meetings by session order and sorts them by time', () => {
    const sessions: SessionTimes[] = [
      { meetings: [at('2026-03-10')] },
      { meetings: [at('2026-03-03')] },
    ]
    expect(meetingsOf(sessions)).toEqual([
      { ...at('2026-03-03'), session: 1 },
      { ...at('2026-03-10'), session: 2 },
    ])
  })

  it('gives every meeting of a twice-a-week session the same number', () => {
    const sessions: SessionTimes[] = [
      { meetings: [at('2026-03-03'), at('2026-03-05')] },
      { meetings: [at('2026-03-10'), at('2026-03-12')] },
    ]
    expect(meetingsOf(sessions).map((m) => m.session)).toEqual([1, 1, 2, 2])
  })

  it('marks the meetings of a cancelled session', () => {
    const sessions: SessionTimes[] = [{ meetings: [at('2026-03-03')], cancelled: true }]
    expect(meetingsOf(sessions)).toEqual([{ ...at('2026-03-03'), session: 1, cancelled: true }])
  })

  it('stores empty times as null, for all-day meetings', () => {
    const sessions: SessionTimes[] = [
      { meetings: [{ date: '2026-03-03', start_time: '', end_time: '' }] },
    ]
    expect(meetingsOf(sessions)).toEqual([{ ...allDay('2026-03-03'), session: 1 }])
  })

  it('numbers sessions with no meeting after the placed ones', () => {
    const sessions: SessionTimes[] = [{ position: 0 }, { meetings: [at('2026-03-03')] }]
    expect(meetingsOf(sessions)).toEqual([{ ...at('2026-03-03'), session: 1 }])
  })

  it('is empty when no session has a meeting', () => {
    expect(meetingsOf([])).toEqual([])
    expect(meetingsOf([{ position: 0 }, { meetings: null }])).toEqual([])
  })
})

describe('firstDay and lastDay', () => {
  it('skip cancelled meetings', () => {
    const list = [
      { ...at('2026-03-03'), cancelled: true },
      at('2026-03-10'),
      at('2026-03-17'),
      { ...at('2026-03-24'), cancelled: true },
    ]
    expect(firstDay(list)).toBe('2026-03-10')
    expect(lastDay(list)).toBe('2026-03-17')
  })

  it('do not need sorted input', () => {
    const list = [at('2026-04-01'), at('2026-03-01'), at('2026-03-15')]
    expect(firstDay(list)).toBe('2026-03-01')
    expect(lastDay(list)).toBe('2026-04-01')
  })

  it('are null with no meeting held', () => {
    expect(firstDay([])).toBeNull()
    expect(lastDay([{ ...at('2026-03-03'), cancelled: true }])).toBeNull()
  })
})

describe('weeks', () => {
  it('counts eight Tuesdays as eight weeks', () => {
    expect(weeks(tuesdays(8))).toBe(8)
  })

  it('counts calendar weeks that start on Saturday', () => {
    // Friday 6 March and Saturday 7 March are in two different weeks.
    expect(weeks([at('2026-03-06'), at('2026-03-07')])).toBe(2)
    // Saturday 28 February to Friday 6 March is one week.
    expect(weeks([at('2026-02-28'), at('2026-03-06')])).toBe(1)
  })

  it('counts weeks with no meeting inside the span', () => {
    expect(weeks([at('2026-03-03'), at('2026-03-31')])).toBe(5)
  })

  it('is one for a single meeting and zero for none', () => {
    expect(weeks([allDay('2026-03-03')])).toBe(1)
    expect(weeks([])).toBe(0)
  })

  it('crosses a year end', () => {
    expect(weeks([at('2026-12-29'), at('2027-01-05')])).toBe(2)
  })
})

describe('nextMeeting', () => {
  const list = [
    { ...at('2026-03-03'), session: 1 },
    { ...at('2026-03-10'), session: 2, cancelled: true as const },
    { ...at('2026-03-17'), session: 3 },
  ]

  it('is the first meeting on or after today that is held', () => {
    expect(nextMeeting(list, '2026-03-03')?.session).toBe(1)
    expect(nextMeeting(list, '2026-03-04')?.session).toBe(3)
  })

  it('is null after the last meeting, and with none', () => {
    expect(nextMeeting(list, '2026-03-18')).toBeNull()
    expect(nextMeeting([], '2026-03-01')).toBeNull()
  })
})

describe('summary', () => {
  it('is null with no meeting held', () => {
    expect(summary([])).toBeNull()
    expect(summary([{ ...at('2026-03-03'), cancelled: true }])).toBeNull()
  })

  it('reads one meeting a week as weekly', () => {
    expect(summary(tuesdays(8))).toEqual({
      kind: 'weekly',
      times: [{ weekday: 'tue', start_time: '19:00', end_time: '21:00' }],
      weeks: 8,
    })
  })

  it('reads twice a week as weekly, weekdays in week order', () => {
    const list = [
      at('2026-03-03'),
      at('2026-03-05', '18:00', '20:00'),
      at('2026-03-10'),
      at('2026-03-12', '18:00', '20:00'),
    ]
    expect(summary(list)).toEqual({
      kind: 'weekly',
      times: [
        { weekday: 'tue', start_time: '19:00', end_time: '21:00' },
        { weekday: 'thu', start_time: '18:00', end_time: '20:00' },
      ],
      weeks: 2,
    })
  })

  it('starts the week on Saturday, so Saturday and Monday meetings are one week', () => {
    // Sat 28 Feb + Mon 2 Mar, then Sat 7 Mar + Mon 9 Mar.
    const list = [at('2026-02-28'), at('2026-03-02'), at('2026-03-07'), at('2026-03-09')]
    expect(summary(list)).toMatchObject({ kind: 'weekly', weeks: 2 })
  })

  it('reads all-day weekly meetings as weekly with no times', () => {
    expect(summary([allDay('2026-03-03'), allDay('2026-03-10')])).toEqual({
      kind: 'weekly',
      times: [{ weekday: 'tue', start_time: null, end_time: null }],
      weeks: 2,
    })
  })

  it('reads a moved time as dates', () => {
    const list = [at('2026-03-03'), at('2026-03-10', '18:00', '20:00'), at('2026-03-17')]
    expect(summary(list.map((m, i) => ({ ...m, session: i + 1 })))).toEqual({
      kind: 'dates',
      sessions: 3,
      first: '2026-03-03',
      last: '2026-03-17',
    })
  })

  it('reads a week with no meeting as dates', () => {
    expect(summary([at('2026-03-03'), at('2026-03-17')])).toMatchObject({ kind: 'dates' })
  })

  it('reads a moved weekday as dates', () => {
    expect(summary([at('2026-03-03'), at('2026-03-11')])).toMatchObject({ kind: 'dates' })
  })

  it('reads a single meeting as dates, first and last the same day', () => {
    expect(summary([{ ...allDay('2026-03-03'), session: 1 }])).toEqual({
      kind: 'dates',
      sessions: 1,
      first: '2026-03-03',
      last: '2026-03-03',
    })
  })

  it('counts sessions, not meetings', () => {
    const list = [
      { ...at('2026-03-03'), session: 1 },
      { ...at('2026-03-04'), session: 1 },
      { ...at('2026-03-12'), session: 2 },
    ]
    expect(summary(list)).toMatchObject({ kind: 'dates', sessions: 2 })
  })

  it('counts each meeting with no session as one', () => {
    expect(summary([at('2026-03-03'), at('2026-03-04'), at('2026-03-12')])).toMatchObject({
      sessions: 3,
    })
  })

  it('leaves cancelled meetings out of the summary', () => {
    const list = [...tuesdays(4), { ...at('2026-03-24', '10:00', '12:00'), cancelled: true }]
    expect(summary(list)).toMatchObject({ kind: 'weekly', weeks: 4 })
  })
})
