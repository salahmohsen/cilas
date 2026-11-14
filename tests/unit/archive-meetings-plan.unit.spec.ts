import { describe, expect, it } from 'vitest'

import { planArchiveMeetings, type ArchiveCourse } from '../../scripts/archive-meetings-plan'

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
    it('runs from the announced start day at the real times, a session a week', () => {
      // 2026-03-04 is a Wednesday.
      const plan = planArchiveMeetings(
        course({ slots: [wednesdays], startDay: '2026-03-04', weeks: 2, sessions: [1, 2] }),
      )
      expect(plan.group).toBe('weekly-times')
      expect(plan.startedFrom).toEqual({ day: '2026-03-04', source: 'announced' })
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
