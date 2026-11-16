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
        updatedAt: '2026-11-17T10:00:00Z',
        place: 'Online',
        meetings: [{ id: 'row8', date: '2026-03-10', start_time: '19:00', end_time: '21:00' }],
      },
      {
        id: 5,
        updatedAt: '2026-11-17T10:00:00Z',
        meetings: [{ id: 'row5', date: '2026-03-03', start_time: '19:00', end_time: '21:00' }],
      },
      {
        id: 9,
        updatedAt: '2026-11-17T10:00:00Z',
        cancelled: true,
        meetings: [{ id: 'row9', date: '2026-03-17' }],
      },
    ])
    expect(items).toEqual([
      {
        ...base,
        feed: { uid: 'session-meeting-row5@cilas.org', updatedAt: '2026-11-17T10:00:00Z' },
        key: 's5-2026-03-03-1900',
        item: 's5',
        date: '2026-03-03',
        start: '19:00',
        end: '21:00',
        session: 1,
      },
      {
        ...base,
        feed: { uid: 'session-meeting-row8@cilas.org', updatedAt: '2026-11-17T10:00:00Z' },
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
        feed: { uid: 'session-meeting-row9@cilas.org', updatedAt: '2026-11-17T10:00:00Z' },
        key: 's9-2026-03-17-day',
        item: 's9',
        date: '2026-03-17',
        session: 3,
        cancelled: true,
      },
    ])
  })

  it("keeps a meeting's key when another session is added before it", () => {
    const later = {
      id: 8,
      updatedAt: '2026-11-17T10:00:00Z',
      meetings: [{ id: 'row8', date: '2026-03-10', start_time: '19:00' }],
    }
    const before = courseItems(base, [later])
    const after = courseItems(base, [
      {
        id: 12,
        updatedAt: '2026-11-17T10:00:00Z',
        meetings: [{ id: 'row12', date: '2026-03-03' }],
      },
      later,
    ])
    expect(after[1]!.key).toBe(before[0]!.key)
    expect(after[1]!.session).toBe(2)
  })

  it('keeps the feed UID on a move and cancellation and gives each meeting its own UID', () => {
    const session = {
      id: 8,
      updatedAt: '2026-11-17T10:00:00Z',
      meetings: [
        { id: 'a', date: '2026-03-10', start_time: '19:00' },
        { id: 'b', date: '2026-03-11' },
      ],
    }
    const before = courseItems(base, [session])
    const after = courseItems(base, [
      {
        ...session,
        cancelled: true,
        meetings: [
          { ...session.meetings[0], date: '2026-03-12', start_time: '20:00' },
          session.meetings[1],
        ],
      },
    ])
    expect(after[1].feed?.uid).toBe(before[0].feed?.uid)
    expect(before[0].feed?.uid).not.toBe(before[1].feed?.uid)
    expect(after[1].key).not.toBe(before[0].key)
    expect(after[1].cancelled).toBe(true)
  })

  it('rejects a meeting without its stored row ID', () => {
    expect(() =>
      courseItems(base, [
        { id: 8, updatedAt: '2026-11-17T10:00:00Z', meetings: [{ date: '2026-03-10' }] },
      ]),
    ).toThrow('without a row ID')
  })

  it('places nothing for a course with no meeting', () => {
    expect(courseItems(base, [])).toEqual([])
    expect(courseItems(base, [{ id: 1, updatedAt: '2026-11-17T10:00:00Z', meetings: [] }])).toEqual(
      [],
    )
  })
})
