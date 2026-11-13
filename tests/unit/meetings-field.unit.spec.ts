import { describe, expect, it } from 'vitest'

import { meetingProblem } from '@/fields/meetings'

describe('meetingProblem', () => {
  it('accepts a real day, and refuses anything else', () => {
    expect(meetingProblem('date', { date: '2026-03-03' })).toBe(true)
    expect(meetingProblem('date', { date: '2026-02-30' })).toMatch(/real day/)
    expect(meetingProblem('date', { date: '2026-03-03T00:00:00Z' })).toMatch(/real day/)
    expect(meetingProblem('date', { date: undefined })).toMatch(/real day/)
  })

  it('accepts no times at all, for an all-day meeting', () => {
    expect(meetingProblem('start_time', { date: '2026-03-03' })).toBe(true)
    expect(meetingProblem('end_time', { date: '2026-03-03', start_time: '', end_time: '' })).toBe(
      true,
    )
  })

  it('wants both times or neither', () => {
    expect(meetingProblem('end_time', { start_time: '19:00', end_time: '' })).toMatch(/both/)
    expect(meetingProblem('start_time', { start_time: null, end_time: '21:00' })).toMatch(/both/)
  })

  it('wants HH:MM in 24-hour time', () => {
    expect(meetingProblem('start_time', { start_time: '7pm', end_time: '21:00' })).toMatch(/HH:MM/)
    expect(meetingProblem('end_time', { start_time: '19:00', end_time: '24:00' })).toMatch(/HH:MM/)
  })

  it('wants the end after the start', () => {
    expect(meetingProblem('end_time', { start_time: '19:00', end_time: '21:00' })).toBe(true)
    expect(meetingProblem('end_time', { start_time: '19:00', end_time: '19:00' })).toMatch(/after/)
    expect(meetingProblem('start_time', { start_time: '19:00', end_time: '18:00' })).toBe(true)
  })
})
