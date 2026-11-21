import { describe, expect, it } from 'vitest'

import { heldCount } from './course-meta'

const now = new Date('2026-03-10T12:00:00Z')

const timed = (date: string, start_time: string, end_time: string | null = null) => ({
  date,
  start_time,
  end_time,
})

describe('heldCount', () => {
  it('counts sessions whose last meeting has ended', () => {
    const sessions = [
      { meetings: [timed('2026-03-01', '10:00', '12:00')] },
      { meetings: [timed('2026-03-05', '10:00', '12:00')] },
      { meetings: [timed('2026-03-20', '10:00', '12:00')] },
    ]
    expect(heldCount(sessions, now)).toEqual({ held: 2, total: 3 })
  })

  it('a session with two meetings is held when the later one has ended', () => {
    const sessions = [
      { meetings: [timed('2026-03-01', '10:00', '12:00'), timed('2026-03-15', '10:00', '12:00')] },
      { meetings: [timed('2026-03-02', '10:00', '12:00'), timed('2026-03-03', '10:00', '12:00')] },
    ]
    expect(heldCount(sessions, now)).toEqual({ held: 1, total: 2 })
  })

  it('a cancelled session counts in neither', () => {
    const sessions = [
      { meetings: [timed('2026-03-01', '10:00', '12:00')], cancelled: true },
      { meetings: [timed('2026-03-02', '10:00', '12:00')] },
    ]
    expect(heldCount(sessions, now)).toEqual({ held: 1, total: 1 })
  })

  it('a session that ends today in Cairo after now is not held', () => {
    expect(heldCount([{ meetings: [timed('2026-03-10', '15:00', '18:00')] }], now)).toEqual({
      held: 0,
      total: 1,
    })
  })

  it('a session that ended today in Cairo before now is held', () => {
    expect(heldCount([{ meetings: [timed('2026-03-10', '11:00', '13:00')] }], now)).toEqual({
      held: 1,
      total: 1,
    })
  })

  it('a meeting with a start time only ends at its start time', () => {
    expect(heldCount([{ meetings: [timed('2026-03-10', '13:00')] }], now)).toEqual({
      held: 1,
      total: 1,
    })
    expect(heldCount([{ meetings: [timed('2026-03-10', '15:00')] }], now)).toEqual({
      held: 0,
      total: 1,
    })
  })

  it('an all-day meeting is held from the next Cairo day', () => {
    const today = { meetings: [{ date: '2026-03-10' }] }
    const yesterday = { meetings: [{ date: '2026-03-09' }] }
    expect(heldCount([today, yesterday], now)).toEqual({ held: 1, total: 2 })
  })

  it('the Cairo day, not the UTC day, decides an all-day meeting', () => {
    const afterCairoMidnight = new Date('2026-03-09T22:30:00Z')
    expect(heldCount([{ meetings: [{ date: '2026-03-09' }] }], afterCairoMidnight)).toEqual({
      held: 1,
      total: 1,
    })
    const beforeCairoMidnight = new Date('2026-03-09T21:30:00Z')
    expect(heldCount([{ meetings: [{ date: '2026-03-09' }] }], beforeCairoMidnight)).toEqual({
      held: 0,
      total: 1,
    })
  })

  it('a session with no meeting counts in total, not in held', () => {
    expect(heldCount([{ meetings: [] }, { meetings: null }, {}], now)).toEqual({
      held: 0,
      total: 3,
    })
  })

  it('a meeting with a bad time is not held', () => {
    expect(heldCount([{ meetings: [timed('2026-03-01', '10:00', '25:99')] }], now)).toEqual({
      held: 0,
      total: 1,
    })
  })

  it('a meeting with a bad date is not held', () => {
    expect(heldCount([{ meetings: [{ date: '2026-02-30' }] }], now)).toEqual({
      held: 0,
      total: 1,
    })
  })

  it('no sessions give zero of zero', () => {
    expect(heldCount([], now)).toEqual({ held: 0, total: 0 })
  })
})
