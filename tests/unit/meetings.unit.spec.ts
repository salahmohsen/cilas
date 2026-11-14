import { describe, expect, it } from 'vitest'

import {
  byWhen,
  firstDay,
  isAllDay,
  lastDay,
  meetingKey,
  meetingsOf,
  nextMeeting,
  numberedSessions,
  sessionsInOrder,
  storedWeeks,
  summary,
  upcomingSession,
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

  it('counts 7-day weeks from the first meeting, not Saturday weeks', () => {
    // Friday 6 March and Saturday 7 March fall in one week from the Friday.
    expect(weeks([at('2026-03-06'), at('2026-03-07')])).toBe(1)
    // Thursday 5 March to Wednesday 11 March is one week; Thursday 12 March starts the second.
    expect(weeks([at('2026-03-05'), at('2026-03-11')])).toBe(1)
    expect(weeks([at('2026-03-05'), at('2026-03-12')])).toBe(2)
  })

  it('counts a Thursday and Saturday course from a Thursday as one week a pair (course 296)', () => {
    const list = [at('2026-03-05'), at('2026-03-07'), at('2026-03-12'), at('2026-03-14')]
    expect(weeks(list)).toBe(2)
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

  it('counts weeks from the first meeting, so Saturday and Monday meetings are one week', () => {
    // Sat 28 Feb + Mon 2 Mar, then Sat 7 Mar + Mon 9 Mar.
    const list = [at('2026-02-28'), at('2026-03-02'), at('2026-03-07'), at('2026-03-09')]
    expect(summary(list)).toMatchObject({ kind: 'weekly', weeks: 2 })
  })

  it('reads Thursday and Saturday from a Thursday as weekly, not split by Saturday (course 296)', () => {
    const list = [
      at('2026-03-05', '17:00', '21:00'),
      at('2026-03-07', '17:00', '21:00'),
      at('2026-03-12', '17:00', '21:00'),
      at('2026-03-14', '17:00', '21:00'),
    ]
    expect(summary(list)).toEqual({
      kind: 'weekly',
      times: [
        { weekday: 'thu', start_time: '17:00', end_time: '21:00' },
        { weekday: 'sat', start_time: '17:00', end_time: '21:00' },
      ],
      weeks: 2,
    })
  })

  it('reads a last week that ends early as weekly', () => {
    // Tuesdays and Thursdays for two weeks, then one last Tuesday.
    const list = [at('2026-03-03'), at('2026-03-05'), at('2026-03-10'), at('2026-03-12')]
    expect(summary([...list, at('2026-03-17')])).toMatchObject({ kind: 'weekly', weeks: 3 })
  })

  it('reads one full week and a short one as dates, not weekly (course 295)', () => {
    // Sat 22, Mon 24, Thu 27, Fri 28 August, then Sat 29: a five-day workshop.
    const list = [
      at('2026-08-22', '18:00', '22:00'),
      at('2026-08-24', '18:00', '22:00'),
      at('2026-08-27', '15:00', '19:00'),
      at('2026-08-28', '17:00', '21:00'),
      at('2026-08-29', '18:00', '22:00'),
    ]
    expect(summary(list)).toMatchObject({ kind: 'dates', first: '2026-08-22', last: '2026-08-29' })
  })

  it('reads a last week that skips its first day as dates', () => {
    // Tuesdays and Thursdays for two weeks, then a Thursday only.
    const list = [at('2026-03-03'), at('2026-03-05'), at('2026-03-10'), at('2026-03-12')]
    expect(summary([...list, at('2026-03-19')])).toMatchObject({ kind: 'dates' })
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

describe('storedWeeks', () => {
  it('reads the weeks from the stored first and last day', () => {
    expect(storedWeeks({ first_day: '2026-03-05', last_day: '2026-03-14' })).toBe(2)
    expect(storedWeeks({ first_day: '2026-03-03', last_day: '2026-04-21' })).toBe(8)
  })

  it('agrees with weeks over the meetings', () => {
    const meetings = tuesdays(8)
    expect(storedWeeks({ first_day: firstDay(meetings), last_day: lastDay(meetings) })).toBe(
      weeks(meetings),
    )
  })

  it('is zero without a first and a last day', () => {
    expect(storedWeeks({})).toBe(0)
    expect(storedWeeks({ first_day: '2026-03-03', last_day: null })).toBe(0)
  })
})

describe('numberedSessions', () => {
  const list = [
    { id: 'unplaced', position: 1 },
    { id: 'third', meetings: [at('2026-03-17')] },
    { id: 'first', meetings: [at('2026-03-05'), at('2026-03-03')] },
    { id: 'second', cancelled: true, meetings: [at('2026-03-10')] },
  ]

  it('numbers sessions in time order from 1, a cancelled one keeping its number', () => {
    expect(numberedSessions(list).map((s) => [s.session.id, s.number])).toEqual([
      ['first', 1],
      ['second', 2],
      ['third', 3],
      ['unplaced', 4],
    ])
  })

  it('gives each session its own meetings in time order', () => {
    const [first, second, , unplaced] = numberedSessions(list)
    expect(first!.meetings.map((m) => m.date)).toEqual(['2026-03-03', '2026-03-05'])
    expect(first!.meetings.every((m) => m.session === 1)).toBe(true)
    expect(second!.meetings).toEqual([{ ...at('2026-03-10'), session: 2, cancelled: true }])
    expect(unplaced!.meetings).toEqual([])
  })

  it('dates a session by its first meeting not cancelled, else its first, else none', () => {
    const days = numberedSessions([
      { id: 'a', meetings: [at('2026-03-03')] },
      { id: 'b', cancelled: true, meetings: [at('2026-03-10')] },
      { id: 'c' },
    ]).map((s) => s.day)
    expect(days).toEqual(['2026-03-03', '2026-03-10', null])
  })
})

describe('upcomingSession', () => {
  const sessions = numberedSessions([
    { id: 'one', meetings: [at('2026-03-03')] },
    { id: 'two', cancelled: true, meetings: [at('2026-03-10')] },
    { id: 'three', meetings: [at('2026-03-17'), at('2026-03-19')] },
  ])

  it('is the session of the first meeting on or after the day, skipping cancelled ones', () => {
    expect(upcomingSession(sessions, '2026-03-03')?.session.id).toBe('one')
    expect(upcomingSession(sessions, '2026-03-04')?.session.id).toBe('three')
    expect(upcomingSession(sessions, '2026-03-19')?.number).toBe(3)
  })

  it('is null after the last meeting, or with no sessions', () => {
    expect(upcomingSession(sessions, '2026-03-20')).toBeNull()
    expect(upcomingSession([], '2026-03-01')).toBeNull()
  })
})

describe('meetingKey', () => {
  it('names a meeting by its owner, day and start time, all day by its day', () => {
    expect(meetingKey(42, at('2026-03-03', '19:00'))).toBe('42-2026-03-03-1900')
    expect(meetingKey('s1', allDay('2026-03-03'))).toBe('s1-2026-03-03-day')
  })

  it('stays the same when other meetings of the session move', () => {
    const before = numberedSessions([{ meetings: [at('2026-03-03'), at('2026-03-10')] }])
    const after = numberedSessions([{ meetings: [at('2026-03-01'), at('2026-03-10')] }])
    const key = (s: typeof before) => meetingKey(7, s[0]!.meetings.at(-1)!)
    expect(key(after)).toBe(key(before))
  })
})
