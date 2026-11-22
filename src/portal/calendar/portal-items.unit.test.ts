import { describe, expect, it } from 'vitest'

import { publicItems } from '@/components/calendar/public-items'

import { meeting, words } from '../../../testing/public-calendar.fixture'
import {
  KIND_LOOK,
  MINE,
  OTHER,
  mergeMeetings,
  ownCourseIdsOf,
  portalItems,
  presetHidden,
} from './portal-items'

const own = meeting({ courseId: 22, sessionId: '501', title: 'Fresh title' })
const stale = meeting({ courseId: 22, sessionId: '501', title: 'Stale title' })
const elsewhere = meeting({
  key: 's2-2026-11-18-1900',
  item: 's2',
  courseId: 23,
  sessionId: '502',
  date: '2026-11-18',
})
const event = meeting({
  key: 'e4-0',
  item: 'e4',
  kind: 'event',
  courseId: undefined,
  sessionId: undefined,
  type: 'screening',
  title: 'Film night',
  date: '2026-11-18',
  session: undefined,
})

const items = (meetings: Parameters<typeof publicItems>[0]) => publicItems(meetings, words('en'))

describe('mergeMeetings', () => {
  it('shows a session in both lists once, the gated copy', () => {
    const merged = mergeMeetings([stale, elsewhere], [own])
    expect(merged.filter((m) => m.sessionId === '501')).toEqual([own])
    expect(merged).toHaveLength(2)
  })

  it('keeps a public meeting with no session id', () => {
    expect(mergeMeetings([event], [own])).toEqual([own, event])
  })

  it('keeps a cancelled meeting of a merged session as one item with publicItems', () => {
    const cancelled = meeting({
      key: 's1-2026-11-19-1900',
      date: '2026-11-19',
      cancelled: true,
      sessionId: '501',
    })
    const merged = mergeMeetings([stale, { ...stale, ...cancelled }], [own, cancelled])
    expect(
      items(merged)
        .map((item) => item.id)
        .toSorted(),
    ).toEqual(['s1', 's1-cancelled'])
  })

  it('sorts by day, then start', () => {
    const early = meeting({ key: 'a', sessionId: '9', date: '2026-11-17', start: '09:00' })
    expect(mergeMeetings([elsewhere], [own, early]).map((m) => m.key)).toEqual([
      'a',
      own.key,
      elsewhere.key,
    ])
  })
})

describe('portalItems', () => {
  const merged = items([elsewhere, event, own])
  const ownIds = ownCourseIdsOf([own])
  const result = portalItems(merged, ownIds)

  it('makes own courses Your courses, others Other courses, and keeps event kinds', () => {
    expect(result.map((item) => item.kind)).toEqual([MINE, OTHER, 'event:screening'])
  })

  it('gives each portal kind one tone and one edge, and no event an edge', () => {
    for (const item of result) {
      if (item.kind === MINE || item.kind === OTHER) {
        expect(item).toMatchObject(KIND_LOOK[item.kind])
      } else {
        expect(item.edge).toBeUndefined()
      }
    }
    expect(new Set(Object.values(KIND_LOOK).map((look) => look.edge)).size).toBe(2)
  })

  it('lists Your courses, Other courses, then events, each in input order', () => {
    const second = meeting({ key: 'm2', item: 's9', courseId: 22, sessionId: '509' })
    const order = portalItems(items([event, elsewhere, own, second]), ownIds)
    expect(order.map((item) => item.kind)).toEqual([MINE, MINE, OTHER, 'event:screening'])
    expect(order.slice(0, 2).map((item) => item.id)).toEqual(['s1', 's9'])
  })
})

describe('presetHidden', () => {
  it('hides Other courses for a reader with a course of their own', () => {
    expect(presetHidden(new Set(['22']))).toEqual([OTHER])
  })

  it('hides nothing for a reader with no course', () => {
    expect(presetHidden(new Set())).toEqual([])
  })

  it('reads the ids of the gated meetings, so a course with no returned meeting hides nothing', () => {
    expect(ownCourseIdsOf([own, stale])).toEqual(new Set(['22']))
    expect(presetHidden(ownCourseIdsOf([]))).toEqual([])
  })
})
