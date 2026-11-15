import { describe, expect, it } from 'vitest'

import {
  matchArchiveMeetings,
  patternDated,
  planArchiveMeetings,
  type ArchiveCourse,
} from '../../scripts/archive-meetings-plan'

// 2026-03-03 is a Tuesday.
const course = (extra: Partial<ArchiveCourse> = {}): ArchiveCourse => ({
  hasMeetings: false,
  startDay: null,
  weeks: null,
  slots: [],
  term: { research: null, cycle: null },
  sessions: [],
  ...extra,
})

const day = (date: string) => ({ date, start_time: null, end_time: null })
const at = (date: string, start_time = '18:00', end_time = '20:00') => ({
  date,
  start_time,
  end_time,
})
const wednesdays = { weekday: 'wed' as const, start_time: '18:00', end_time: '20:00' }
const mondays = { weekday: 'mon' as const, start_time: '10:00', end_time: '12:00' }

describe('planArchiveMeetings', () => {
  it('leaves a course that has a meeting alone', () => {
    const plan = planArchiveMeetings(
      course({ hasMeetings: true, startDay: '2026-03-03', weeks: 3, sessions: [1] }),
    )
    expect(plan).toMatchObject({ group: 'has-meetings', onSessions: [], newSessions: [] })
  })

  describe('a start day and a length, no weekly times', () => {
    it('makes one all-day meeting a week from the start day, on the existing sessions in order', () => {
      const plan = planArchiveMeetings(
        course({ startDay: '2026-03-03', weeks: 3, sessions: [11, 12, 13] }),
      )
      expect(plan.group).toBe('start-and-weeks')
      expect(plan.onSessions).toEqual([
        { session: 11, meetings: [day('2026-03-03')] },
        { session: 12, meetings: [day('2026-03-10')] },
        { session: 13, meetings: [day('2026-03-17')] },
      ])
      expect(plan.newSessions).toEqual([])
    })

    it('makes new sessions for the weeks the course has no session for', () => {
      const plan = planArchiveMeetings(
        course({ startDay: '2026-03-03', weeks: 4, sessions: [11, 12] }),
      )
      expect(plan.onSessions.map((s) => s.session)).toEqual([11, 12])
      expect(plan.newSessions).toEqual([[day('2026-03-17')], [day('2026-03-24')]])
    })

    it('leaves sessions that have no week unscheduled', () => {
      const plan = planArchiveMeetings(
        course({ startDay: '2026-03-03', weeks: 2, sessions: [11, 12, 13, 14] }),
      )
      expect(plan.onSessions.map((s) => s.session)).toEqual([11, 12])
      expect(plan.newSessions).toEqual([])
    })

    it('makes all the sessions new when the course has none', () => {
      const plan = planArchiveMeetings(course({ startDay: '2026-03-03', weeks: 2 }))
      expect(plan.onSessions).toEqual([])
      expect(plan.newSessions).toEqual([[day('2026-03-03')], [day('2026-03-10')]])
    })
  })

  describe('a start day only', () => {
    it('makes one all-day meeting on the first session, or a new one', () => {
      expect(
        planArchiveMeetings(course({ startDay: '2026-03-03', sessions: [5, 6] })),
      ).toMatchObject({
        group: 'start-only',
        onSessions: [{ session: 5, meetings: [day('2026-03-03')] }],
        newSessions: [],
      })
      expect(planArchiveMeetings(course({ startDay: '2026-03-03' }))).toMatchObject({
        group: 'start-only',
        onSessions: [],
        newSessions: [[day('2026-03-03')]],
      })
    })

    it('refuses a day that is not real', () => {
      expect(() => planArchiveMeetings(course({ startDay: '2026-02-30' }))).toThrow(
        'Not a real day',
      )
    })
  })

  describe('weekly times', () => {
    it('runs from the schedule start day at the real times, a session a week', () => {
      // 2026-03-04 is a Wednesday.
      const plan = planArchiveMeetings(
        course({ slots: [wednesdays], startDay: '2026-03-04', weeks: 2, sessions: [1, 2] }),
      )
      expect(plan.group).toBe('weekly-times')
      expect(plan.startedFrom).toEqual({ day: '2026-03-04', source: 'schedule' })
      expect(plan.onSessions).toEqual([
        { session: 1, meetings: [at('2026-03-04')] },
        { session: 2, meetings: [at('2026-03-11')] },
      ])
    })

    it('starts on the first slot weekday on or after the start day', () => {
      // The day is a Sunday; the slot is Saturday.
      const plan = planArchiveMeetings(
        course({
          slots: [{ weekday: 'sat', start_time: '18:00', end_time: '20:00' }],
          startDay: '2022-06-05',
          weeks: 1,
        }),
      )
      expect(plan.newSessions).toEqual([[at('2022-06-11')]])
    })

    it('puts the slots of one week on one session, in date order', () => {
      // From Wednesday 2026-03-04: Wednesday that day, Monday five days later.
      const plan = planArchiveMeetings(
        course({ slots: [mondays, wednesdays], startDay: '2026-03-04', weeks: 2, sessions: [7] }),
      )
      expect(plan.onSessions).toEqual([
        { session: 7, meetings: [at('2026-03-04'), at('2026-03-09', '10:00', '12:00')] },
      ])
      expect(plan.newSessions).toEqual([[at('2026-03-11'), at('2026-03-16', '10:00', '12:00')]])
    })

    it('makes only the first meeting when no length is known', () => {
      const plan = planArchiveMeetings(
        course({ slots: [mondays, wednesdays], startDay: '2026-03-04', sessions: [7, 8] }),
      )
      expect(plan.onSessions).toEqual([{ session: 7, meetings: [at('2026-03-04')] }])
      expect(plan.newSessions).toEqual([])
    })

    it('takes the research term start before the cycle start', () => {
      const plan = planArchiveMeetings(
        course({
          slots: [wednesdays],
          weeks: 1,
          term: { research: '2022-05-18', cycle: '2022-02-02' },
        }),
      )
      expect(plan.startedFrom).toEqual({ day: '2022-05-18', source: 'research' })
      expect(plan.newSessions).toEqual([[at('2022-05-18')]])
    })

    it('uses the cycle start when nothing else gives a day', () => {
      // 2022-09-24 is a Saturday; the first Wednesday on or after it is 09-28.
      const plan = planArchiveMeetings(
        course({ slots: [wednesdays], weeks: 2, term: { research: null, cycle: '2022-09-24' } }),
      )
      expect(plan.startedFrom).toEqual({ day: '2022-09-24', source: 'cycle' })
      expect(plan.newSessions).toEqual([[at('2022-09-28')], [at('2022-10-05')]])
    })

    it('makes no meeting when no day is known: the times are lost', () => {
      expect(planArchiveMeetings(course({ slots: [wednesdays], weeks: 5, sessions: [1] }))).toEqual(
        {
          group: 'times-lost',
          startedFrom: null,
          onSessions: [],
          newSessions: [],
        },
      )
    })

    it('keeps an all-day slot all day', () => {
      const plan = planArchiveMeetings(
        course({
          slots: [{ weekday: 'wed', start_time: null, end_time: null }],
          startDay: '2026-03-04',
        }),
      )
      expect(plan.newSessions).toEqual([[day('2026-03-04')]])
    })
  })

  it('makes no meeting from a length alone, or from nothing', () => {
    expect(planArchiveMeetings(course({ weeks: 8, sessions: [1, 2] })).group).toBe('weeks-lost')
    expect(planArchiveMeetings(course({ sessions: [1] })).group).toBe('nothing')
    expect(planArchiveMeetings(course({ weeks: 8 }))).toMatchObject({
      onSessions: [],
      newSessions: [],
    })
  })
})

describe('matchArchiveMeetings', () => {
  // The plan as the first run made it: two sessions, one all-day meeting a week.
  const plan = planArchiveMeetings(course({ startDay: '2026-03-03', weeks: 2, sessions: [1, 2] }))
  const row = (id: string, date: string, extra: object = {}) => ({ id, ...day(date), ...extra })

  it('marks the stored meetings the plan made, on the same session, day and times', () => {
    const match = matchArchiveMeetings(plan, [
      { id: 1, meetings: [row('a', '2026-03-03')] },
      { id: 2, meetings: [row('b', '2026-03-10')] },
    ])
    expect(match).toEqual({ mark: ['a', 'b'], marked: 0, missing: [], other: [] })
  })

  it('leaves a meeting a person moved since unmarked, and reports it', () => {
    const match = matchArchiveMeetings(plan, [
      { id: 1, meetings: [row('a', '2026-03-03')] },
      { id: 2, meetings: [row('b', '2026-03-12')] },
    ])
    expect(match.mark).toEqual(['a'])
    expect(match.missing).toEqual([{ session: 2, meeting: day('2026-03-10') }])
    expect(match.other).toEqual([{ session: 2, meeting: row('b', '2026-03-12') }])
  })

  it('does not match a meeting on another session', () => {
    const match = matchArchiveMeetings(plan, [
      { id: 1, meetings: [row('a', '2026-03-03'), row('b', '2026-03-10')] },
      { id: 2, meetings: [] },
    ])
    expect(match.mark).toEqual(['a'])
    expect(match.missing).toHaveLength(1)
  })

  it('changes nothing on a second run: marked rows are counted, not marked again', () => {
    const match = matchArchiveMeetings(plan, [
      { id: 1, meetings: [row('a', '2026-03-03', { approximate: true })] },
      { id: 2, meetings: [row('b', '2026-03-10', { approximate: true })] },
    ])
    expect(match).toEqual({ mark: [], marked: 2, missing: [], other: [] })
  })

  it('compares times with an empty time as no time', () => {
    const timed = planArchiveMeetings(
      course({ startDay: '2026-03-03', slots: [wednesdays], weeks: 1, sessions: [1] }),
    )
    const match = matchArchiveMeetings(timed, [
      { id: 1, meetings: [{ id: 'a', ...at('2026-03-04') }] },
    ])
    expect(match.mark).toEqual(['a'])
    const allDay = matchArchiveMeetings(plan, [
      { id: 1, meetings: [{ id: 'a', date: '2026-03-03', start_time: '', end_time: undefined }] },
      { id: 2, meetings: [] },
    ])
    expect(allDay.mark).toEqual(['a'])
  })

  it('reports planned meetings for new sessions that are not stored', () => {
    const match = matchArchiveMeetings(
      planArchiveMeetings(course({ startDay: '2026-03-03', weeks: 2, sessions: [1] })),
      [{ id: 1, meetings: [row('a', '2026-03-03')] }],
    )
    expect(match.missing).toEqual([{ session: null, meeting: day('2026-03-10') }])
  })
})

describe('patternDated', () => {
  // A course the fill dated from its weekly pattern is never one the archive
  // script wrote, even when its plan would give the same meetings.
  it('is true when the old pattern gives meetings, false when it gives none', () => {
    const pattern = {
      start_date: '2026-03-03T00:00:00.000Z',
      weeks: 2,
      slots: [{ weekday: 'tue' as const, start_time: '18:00', end_time: '20:00' }],
    }
    expect(patternDated(pattern as never, [])).toBe(true)
    expect(patternDated({ start_date: '2026-03-03T00:00:00.000Z', weeks: 2 } as never, [])).toBe(
      false,
    )
    expect(patternDated(null, null)).toBe(false)
  })
})
