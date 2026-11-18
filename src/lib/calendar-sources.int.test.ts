import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  CalendarSaveFailure,
  calendarSourceOf,
  meetingsAfter,
  spaceEventItems,
  type CalendarContext,
} from '@/lib/calendar-sources'
import { deliveryOf, sessionItems } from '@/lib/session-items'
import config from '@/payload.config'
import type { Session, User } from '@/payload-types'

import { createTracker, uniq } from '../../testing/payload.fixture'

const words = {
  untitled: (n: number) => `Session ${n}`,
  delivery: (value: string) =>
    ({ OFFLINE: 'In person', ONLINE: 'Online', HYBRID: 'Hybrid' })[value]!,
}

type Doc = Parameters<typeof sessionItems>[0][number]
const doc = (over: Partial<Doc> & { id: number }) =>
  ({
    title: null,
    cancelled: false,
    meetings: [],
    position: null,
    updatedAt: '2034-01-01T00:00:00.000Z',
    ...over,
  }) satisfies Doc
const course = { course_type: 'THEMATIC' } as const

let payload: Payload
const { track, cleanup } = createTracker()

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

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
      words,
    )
    expect(items.map((i) => i.id)).toEqual(['1', '2'])
    expect(items[0]).toEqual({
      id: '1',
      sessionId: '1',
      kind: 'session',
      title: 'First',
      caption: 'Session 1',
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
      words,
    )
    expect(items.map((i) => [i.id, i.title, i.blocks.length])).toEqual([
      ['4', 'Session 1', 1],
      ['5', 'Session 2', 0],
    ])
  })

  it('opens a draft course that has no type yet, with the neutral tone', () => {
    const items = sessionItems([doc({ id: 1 })], { course_type: null }, words)
    expect(items.map((i) => i.tone)).toEqual(['neutral'])
  })

  it('says how a session meets: its own delivery, else the course location', () => {
    const items = sessionItems(
      [doc({ id: 1, delivery: 'ONLINE' }), doc({ id: 2 })],
      { course_type: null, location: ['OFFLINE'] },
      words,
    )
    expect(items.map((i) => [i.id, i.place])).toEqual([
      ['1', 'Online'],
      ['2', 'In person'],
    ])
    const both = sessionItems([doc({ id: 1 })], { location: ['OFFLINE', 'ONLINE'] }, words)
    expect(both[0]!.place).toBe('Hybrid')
    const none = sessionItems([doc({ id: 1 })], { location: [] }, words)
    expect(none[0]).not.toHaveProperty('place')
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
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Calendar place', slug: uniq('calendar-place'), city: uniq('Probe') },
        overrideAccess: true,
      }),
    ).id
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2036, place, start_date: '2036-10-04' },
        overrideAccess: true,
      }),
    ).id
    const courseId = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Calendar probe',
          slug: uniq('calendar-probe'),
          course_type: 'THEMATIC',
          tier: 'public',
          cycle,
          registration: { mode: 'closed' },
          _status: 'published',
        },
        overrideAccess: true,
      }),
    ).id
    const { docs: spaces } = await payload.find({
      collection: 'spaces',
      where: { course: { equals: courseId } },
      overrideAccess: true,
      depth: 0,
    })
    const admin = { id: -1, roles: ['admin'], collection: 'users' } as unknown as User
    const ctx = {
      req: await createLocalReq({ user: admin }, payload),
      user: admin,
      untitled: words.untitled,
      delivery: words.delivery,
    } satisfies CalendarContext
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
      await expect(
        source.apply(ctx, String(spaces[0]!.id), [change as never]),
      ).rejects.toMatchObject({
        error: { code: 'invalid', change: 0 },
      })
    }
    const written = await payload.count({
      collection: 'sessions',
      where: { course: { equals: courseId } },
      overrideAccess: true,
    })
    expect(written.totalDocs).toBe(0)
  })

  it('gives a titled session its number as a caption, and the start of its description', () => {
    const [titled, untitled] = sessionItems(
      [doc({ id: 1, title: 'Maps', description: '  Read the atlas.  ' }), doc({ id: 2 })],
      course,
      words,
    )
    expect(titled).toMatchObject({
      title: 'Maps',
      caption: 'Session 1',
      summary: 'Read the atlas.',
    })
    expect(untitled).not.toHaveProperty('caption')
    expect(untitled).not.toHaveProperty('summary')
  })
})

describe('deliveryOf', () => {
  it('names the course’s place after In person, and never after Online', () => {
    const at = { location: ['OFFLINE' as const], place: 'Darb 1718' }
    expect(deliveryOf({}, at, words.delivery)).toBe('In person · Darb 1718')
    expect(deliveryOf({ delivery: 'ONLINE' }, at, words.delivery)).toBe('Online')
    expect(deliveryOf({ delivery: 'HYBRID' }, at, words.delivery)).toBe('Hybrid · Darb 1718')
  })

  it('says only how it meets when the course has no place', () => {
    expect(deliveryOf({}, { location: ['OFFLINE'] }, words.delivery)).toBe('In person')
    expect(deliveryOf({}, { location: ['OFFLINE'], place: null }, words.delivery)).toBe('In person')
    expect(deliveryOf({}, { location: [] }, words.delivery)).toBeNull()
  })
})
