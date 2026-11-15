import { describe, expect, it, vi } from 'vitest'

import {
  CalendarSaveFailure,
  calendarSourceOf,
  meetingsAfter,
  sessionItems,
  spaceEventItems,
  type CalendarContext,
} from '@/lib/calendar-sources'
import type { Session } from '@/payload-types'

const untitled = (n: number) => `Session ${n}`

type Doc = Parameters<typeof sessionItems>[0][number]
const doc = (over: Partial<Doc> & { id: number }): Doc => ({
  title: null,
  cancelled: false,
  meetings: [],
  position: null,
  updatedAt: '2034-01-01T00:00:00.000Z',
  ...over,
})
const course = { course_type: 'THEMATIC' } as const

describe('sessionItems', () => {
  it('turns a session into an item and each meeting into a block, by the course’s order', () => {
    const items = sessionItems(
      [
        doc({
          id: 2,
          title: 'Second',
          meetings: [{ id: 'm2', date: '2034-10-12', start_time: '19:00', end_time: '21:00' }],
        }),
        doc({
          id: 1,
          title: 'First',
          cancelled: true,
          updatedAt: '2034-02-02T10:00:00.000Z',
          meetings: [
            { id: 'b', date: '2034-10-07', start_time: null, end_time: null },
            { id: 'a', date: '2034-10-05', start_time: '10:00', end_time: '12:00' },
          ],
        }),
      ],
      course,
      untitled,
    )
    expect(items.map((i) => i.id)).toEqual(['1', '2'])
    expect(items[0]).toEqual({
      id: '1',
      kind: 'session',
      title: 'First',
      tone: 'blue',
      cancelled: true,
      version: '2034-02-02T10:00:00.000Z',
      blocks: [
        { id: 'a', date: '2034-10-05', start_time: '10:00', end_time: '12:00' },
        { id: 'b', date: '2034-10-07', start_time: null, end_time: null },
      ],
    })
  })

  it('names an untitled session by its place, and keeps one with no meeting', () => {
    const items = sessionItems(
      [doc({ id: 5, position: 1 }), doc({ id: 4, meetings: [{ id: 'x', date: '2034-10-05' }] })],
      course,
      untitled,
    )
    expect(items.map((i) => [i.id, i.title, i.blocks.length])).toEqual([
      ['4', 'Session 1', 1],
      ['5', 'Session 2', 0],
    ])
  })

  it('opens a draft course that has no type yet, with the neutral tone', () => {
    const items = sessionItems([doc({ id: 1 })], { course_type: null }, untitled)
    expect(items.map((i) => i.tone)).toEqual(['neutral'])
  })
})

describe('meetingsAfter', () => {
  const current: Session['meetings'] = [
    { id: 'a', date: '2034-10-05', start_time: '10:00', end_time: '12:00' },
    { id: 'b', date: '2034-10-12', start_time: '10:00', end_time: '12:00' },
  ]
  const times = { date: '2034-10-06', start_time: '14:00', end_time: '15:00' }

  it('moves a meeting in place, keeping its row id', () => {
    const result = meetingsAfter('1', current ?? [], [
      { change: { op: 'move-block', itemId: '1', version: 'v', blockId: 'b', ...times }, index: 0 },
    ])
    expect(result[1]).toEqual({ id: 'b', ...times })
    expect(result[0]).toBe(current![0])
  })

  it('adds a block with no id, and lets a later change in the same save name it', () => {
    const result = meetingsAfter('1', current ?? [], [
      {
        change: { op: 'add-block', itemId: '1', version: 'v', blockId: 'tmp-1', ...times },
        index: 0,
      },
      {
        change: {
          op: 'move-block',
          itemId: '1',
          version: 'v',
          blockId: 'tmp-1',
          date: '2034-10-09',
          start_time: null,
          end_time: null,
        },
        index: 1,
      },
    ])
    expect(result).toHaveLength(3)
    expect(result[2]).toEqual({ date: '2034-10-09', start_time: null, end_time: null })
    expect(result[2]).not.toHaveProperty('id')
  })

  it('deletes one meeting', () => {
    const result = meetingsAfter('1', current ?? [], [
      { change: { op: 'delete-block', itemId: '1', version: 'v', blockId: 'a' }, index: 0 },
    ])
    expect(result.map((m) => m.id)).toEqual(['b'])
  })

  it('fails for a block that is not there', () => {
    expect(() =>
      meetingsAfter('1', current ?? [], [
        { change: { op: 'delete-block', itemId: '1', version: 'v', blockId: 'zz' }, index: 0 },
      ]),
    ).toThrow(CalendarSaveFailure)
  })
})

describe('space source', () => {
  const post = {
    id: 12,
    body: '# Legacy event',
    event_title: null,
    event_starts_at: '2026-07-15T21:30:00.000Z',
    event_ends_at: '2026-07-15T22:30:00.000Z',
    updatedAt: 'v',
  }
  it('converts summer instants across midnight to Cairo and marks events read only', () => {
    expect(spaceEventItems([post])).toEqual([
      {
        id: 'space-event:12',
        kind: 'space-event',
        title: 'Legacy event',
        tone: 'neutral',
        readOnly: true,
        cancelled: false,
        version: 'v',
        blocks: [{ id: '12', date: '2026-07-16', start_time: '00:30', end_time: '01:30' }],
      },
    ])
  })
  it.each([
    ['2026-04-23T21:30:00Z', '2026-04-23', '23:30'],
    ['2026-04-23T22:30:00Z', '2026-04-24', '01:30'],
  ])('uses Cairo rules beside the daylight-saving jump: %s', (instant, date, time) => {
    expect(
      spaceEventItems([{ ...post, event_starts_at: instant, event_ends_at: null }])[0]?.blocks,
    ).toEqual([{ id: '12', date, start_time: time, end_time: null }])
  })
  it('uses winter Cairo time, the event title, and preserves a missing end', () => {
    expect(
      spaceEventItems([
        {
          ...post,
          event_title: 'Winter',
          event_starts_at: '2026-01-15T18:00:00Z',
          event_ends_at: null,
        },
      ])[0],
    ).toMatchObject({
      title: 'Winter',
      blocks: [
        {
          date: '2026-01-15',
          start_time: '20:00',
          end_time: null,
        },
      ],
    })
  })
  it('refuses every operation on an event before writing any session', async () => {
    const create = vi.fn()
    const ctx = {
      req: {
        payload: {
          findByID: vi.fn().mockResolvedValue({ kind: 'course', course: 1 }),
          create,
        },
      },
      user: { id: 1 },
    } as unknown as CalendarContext
    const source = calendarSourceOf('space')!
    for (const change of [
      { op: 'delete-block', itemId: 'space-event:12', blockId: '12', version: 'v' },
      {
        op: 'move-block',
        itemId: 'space-event:12',
        blockId: '12',
        version: 'v',
        date: '2026-01-15',
        start_time: '20:00',
        end_time: null,
      },
      {
        op: 'add-block',
        itemId: 'space-event:12',
        blockId: 'new',
        version: 'v',
        date: '2026-01-15',
        start_time: '20:00',
        end_time: null,
      },
      {
        op: 'create-item',
        kind: 'space-event',
        blocks: [{ blockId: 'new', date: '2026-01-15', start_time: '20:00', end_time: null }],
      },
    ] as const) {
      await expect(source.apply(ctx, '1', [change as never])).rejects.toMatchObject({
        error: { code: 'invalid', change: 0 },
      })
    }
    expect(create).not.toHaveBeenCalled()
  })
})
