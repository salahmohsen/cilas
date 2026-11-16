import { describe, expect, it } from 'vitest'

import { courseItems, toneOf, weekStart } from '@/lib/calendar'

describe('calendar dates', () => {
  it('starts weeks on Saturday', () => {
    expect(weekStart('2026-03-11')).toBe('2026-03-07') // a Wednesday
    expect(weekStart('2026-03-07')).toBe('2026-03-07')
  })
})

describe('toneOf', () => {
  it('gives a course and an event type a named tone, and an unknown type the neutral one', () => {
    expect(toneOf({ type: 'core' })).toBe('yellow')
    expect(toneOf({ type: 'talk' })).toBe('blue')
    expect(toneOf({ type: 'something-new' })).toBe('neutral')
  })
})

describe('courseItems', () => {
  const base = { kind: 'course' as const, title: 'A course', href: '/study/a', type: 'lab' }

  it('places every meeting with its session, number, place and state, all-day ones untimed', () => {
    const items = courseItems(base, [
      {
        id: 8,
        place: 'Online',
        meetings: [{ date: '2026-03-10', start_time: '19:00', end_time: '21:00' }],
      },
      { id: 5, meetings: [{ date: '2026-03-03', start_time: '19:00', end_time: '21:00' }] },
      { id: 9, cancelled: true, meetings: [{ date: '2026-03-17' }] },
    ])
    expect(items).toEqual([
      {
        ...base,
        key: 's5-2026-03-03-1900',
        item: 's5',
        date: '2026-03-03',
        start: '19:00',
        end: '21:00',
        session: 1,
      },
      {
        ...base,
        key: 's8-2026-03-10-1900',
        item: 's8',
        date: '2026-03-10',
        start: '19:00',
        end: '21:00',
        session: 2,
        place: 'Online',
      },
      {
        ...base,
        key: 's9-2026-03-17-day',
        item: 's9',
        date: '2026-03-17',
        session: 3,
        cancelled: true,
      },
    ])
  })

  it("keeps a meeting's key when another session is added before it", () => {
    const later = { id: 8, meetings: [{ date: '2026-03-10', start_time: '19:00' }] }
    const before = courseItems(base, [later])
    const after = courseItems(base, [{ id: 12, meetings: [{ date: '2026-03-03' }] }, later])
    expect(after[1]!.key).toBe(before[0]!.key)
    expect(after[1]!.session).toBe(2)
  })

  it('places nothing for a course with no meeting', () => {
    expect(courseItems(base, [])).toEqual([])
    expect(courseItems(base, [{ id: 1, meetings: [] }])).toEqual([])
  })
})
