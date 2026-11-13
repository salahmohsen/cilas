import { describe, expect, it } from 'vitest'

import {
  fillSource,
  planCourseSessions,
  type OldCourse,
  type OldRow,
} from '../../scripts/course-sessions-plan'

// A stand-in for convertLexicalToMarkdown: the fixture's "Lexical" is { md }.
const toMarkdown = (lexical: unknown) => (lexical as { md: string }).md

// 2026-03-03 is a Tuesday.
const tuesdays = { weekday: 'tue' as const, start_time: '19:00', end_time: '21:00' }
const thursdays = { weekday: 'thu' as const, start_time: '18:00', end_time: '20:00' }

const row = (id: string, extra: Partial<OldRow> = {}): OldRow => ({
  id,
  session_title: { en: `Title ${id}`, ar: `عنوان ${id}` },
  ...extra,
})

const plan = (course: Omit<OldCourse, 'id'>) => planCourseSessions({ id: 1, ...course }, toMarkdown)

const at = (date: string, start_time = '19:00', end_time = '21:00') => ({
  date,
  start_time,
  end_time,
})

describe('planCourseSessions', () => {
  it('gives each row its weekly meeting, in the old order', () => {
    const { sessions } = plan({
      schedule: { start_date: '2026-03-03', weeks: 3, slots: [tuesdays] },
      sessions: [row('b', { order: 2 }), row('a', { order: 1 }), row('c', { order: 3 })],
    })
    expect(sessions.map((s) => [s.from, s.position, s.meetings])).toEqual([
      ['a', 0, [at('2026-03-03')]],
      ['b', 1, [at('2026-03-10')]],
      ['c', 2, [at('2026-03-17')]],
    ])
  })

  it('gives a twice-a-week row both meetings of its week', () => {
    const { sessions } = plan({
      schedule: { start_date: '2026-03-03', weeks: 2, slots: [tuesdays, thursdays] },
      sessions: [row('a'), row('b')],
    })
    expect(sessions.map((s) => s.meetings)).toEqual([
      [at('2026-03-03'), at('2026-03-05', '18:00', '20:00')],
      [at('2026-03-10'), at('2026-03-12', '18:00', '20:00')],
    ])
  })

  it('makes one untitled session per week of slots when no row holds the meetings', () => {
    const { sessions } = plan({
      schedule: { start_date: '2026-03-03', weeks: 2, slots: [tuesdays, thursdays] },
      sessions: [],
    })
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({ from: null, title: null, description: null })
    expect(sessions.map((s) => s.meetings.length)).toEqual([2, 2])
  })

  it('makes untitled sessions for pattern meetings after the last row', () => {
    const { sessions } = plan({
      schedule: { start_date: '2026-03-03', weeks: 4, slots: [tuesdays] },
      sessions: [row('a'), row('b')],
    })
    expect(sessions.map((s) => [s.from, s.position, s.meetings[0]?.date])).toEqual([
      ['a', 0, '2026-03-03'],
      ['b', 1, '2026-03-10'],
      [null, 2, '2026-03-17'],
      [null, 3, '2026-03-24'],
    ])
  })

  it('keeps rows past the end of the pattern unscheduled, in their old order', () => {
    const { sessions } = plan({
      schedule: { start_date: '2026-03-03', weeks: 1, slots: [tuesdays] },
      sessions: [row('a'), row('b'), row('c')],
    })
    expect(sessions.map((s) => [s.from, s.position, s.meetings.length])).toEqual([
      ['a', 0, 1],
      ['b', 1, 0],
      ['c', 2, 0],
    ])
  })

  it('follows a row’s meetings count', () => {
    const { sessions } = plan({
      schedule: { start_date: '2026-03-03', weeks: 3, slots: [tuesdays] },
      sessions: [row('a', { meetings: 2 }), row('b')],
    })
    expect(sessions.map((s) => s.meetings.map((m) => m.date))).toEqual([
      ['2026-03-03', '2026-03-10'],
      ['2026-03-17'],
    ])
  })

  it('keeps a row with a meetings count of zero, unscheduled', () => {
    const { sessions } = plan({
      schedule: { start_date: '2026-03-03', weeks: 1, slots: [tuesdays] },
      sessions: [row('a', { meetings: 0 }), row('b')],
    })
    expect(sessions.map((s) => [s.from, s.meetings.length])).toEqual([
      ['a', 0],
      ['b', 1],
    ])
  })

  it('uses a row’s own dates in place of its share', () => {
    const { sessions } = plan({
      schedule: { start_date: '2026-03-03', weeks: 2, slots: [tuesdays] },
      sessions: [
        row('a', {
          dates: [{ date: '2026-03-07T22:00:00.000Z', start_time: '10:00', end_time: '16:00' }],
        }),
        row('b'),
      ],
    })
    // 22:00 UTC on 7 March is 8 March in Cairo. Its share (3 March) is not used.
    expect(sessions.map((s) => s.meetings)).toEqual([
      [at('2026-03-08', '10:00', '16:00')],
      [at('2026-03-10')],
    ])
  })

  it('keeps a cancelled row cancelled, with its meetings', () => {
    const { sessions } = plan({
      schedule: { start_date: '2026-03-03', weeks: 1, slots: [tuesdays] },
      sessions: [row('a', { cancelled: true })],
    })
    expect(sessions[0]).toMatchObject({ cancelled: true, meetings: [at('2026-03-03')] })
  })

  it('puts an all-day meeting on the first session for a start date with no slots', () => {
    const result = plan({
      schedule: { start_date: '2026-03-02T22:00:00.000Z', weeks: 4 },
      sessions: [row('a', { order: 2 }), row('b', { order: 1 })],
    })
    expect(result.startDay).toBe('2026-03-03')
    expect(result.sessions.map((s) => [s.from, s.meetings])).toEqual([
      ['b', [{ date: '2026-03-03', start_time: null, end_time: null }]],
      ['a', []],
    ])
  })

  it('makes a session for the start date when there is none', () => {
    const result = plan({ schedule: { start_date: '2026-03-03' }, sessions: [] })
    expect(result.sessions).toEqual([
      expect.objectContaining({
        from: null,
        position: 0,
        meetings: [{ date: '2026-03-03', start_time: null, end_time: null }],
      }),
    ])
  })

  it('adds no start-day meeting when a row already has dates', () => {
    const result = plan({
      schedule: { start_date: '2026-03-03' },
      sessions: [
        row('a', { dates: [{ date: '2026-03-05', start_time: '10:00', end_time: '12:00' }] }),
      ],
    })
    expect(result.startDay).toBeNull()
    expect(result.sessions[0]?.meetings).toEqual([at('2026-03-05', '10:00', '12:00')])
  })

  it('makes no meeting from slots with no start date', () => {
    expect(plan({ schedule: { weeks: 4, slots: [tuesdays] }, sessions: [] })).toMatchObject({
      sessions: [],
      startDay: null,
    })
  })

  it('makes nothing for a course with no schedule and no sessions', () => {
    expect(plan({ schedule: null, sessions: null })).toEqual({
      sessions: [],
      startDay: null,
      timingNote: null,
    })
  })

  it('copies the content, with the description as Markdown in each language', () => {
    const bibliography = [{ id: 'x', type: 'reading', title: { en: 'Republic' } }]
    const activities = [{ id: 'y', kind: 'discussion', description: { en: 'Talk', ar: 'نقاش' } }]
    const { sessions } = plan({
      schedule: { start_date: '2026-03-03', weeks: 1, slots: [tuesdays] },
      sessions: [
        row('a', {
          delivery: 'ONLINE',
          description: { en: { md: '**Read** book I. ' }, ar: null },
          bibliography,
          activities,
        }),
      ],
    })
    expect(sessions[0]).toMatchObject({
      title: { en: 'Title a', ar: 'عنوان a' },
      description: { en: '**Read** book I.' },
      delivery: 'ONLINE',
      bibliography,
      activities,
      cancelled: false,
    })
  })

  it('stores an empty description as null', () => {
    const { sessions } = plan({ sessions: [row('a', { description: { en: { md: '  ' } } })] })
    expect(sessions[0]?.description).toEqual({ en: null })
  })

  it('refuses a week-only start date', () => {
    expect(() =>
      plan({ schedule: { start_date: '2026-03-03', start_precision: 'week' }, sessions: [] }),
    ).toThrow(/week-only/)
  })

  it('keeps the schedule note as the timing note', () => {
    const note = { en: 'Hybrid', ar: 'هجين' }
    expect(
      plan({ schedule: { start_date: '2026-03-03', weeks: 1, slots: [tuesdays], note } })
        .timingNote,
    ).toEqual(note)
  })

  it('writes slots with no start date into the timing note when it is empty', () => {
    const { timingNote } = plan({ schedule: { slots: [tuesdays, thursdays] } })
    expect(timingNote).toEqual({
      en: 'Tuesday, 19:00–21:00; Thursday, 18:00–20:00',
      ar: 'الثلاثاء، ١٩:٠٠–٢١:٠٠؛ الخميس، ١٨:٠٠–٢٠:٠٠',
    })
  })

  it('keeps a note unchanged and writes the slots only where a language has none', () => {
    const { timingNote } = plan({
      schedule: { slots: [tuesdays], note: { en: 'Online only', ar: '' } },
    })
    expect(timingNote).toEqual({ en: 'Online only', ar: 'الثلاثاء، ١٩:٠٠–٢١:٠٠' })
  })

  it('gives a course that gets a start date its own note back, with no slot words', () => {
    const note = { en: 'Hybrid' }
    const undated = plan({ schedule: { slots: [tuesdays], note } }).timingNote
    const dated = plan({
      schedule: { start_date: '2026-03-03', weeks: 2, slots: [tuesdays], note },
    })
    expect(undated).toEqual({ en: 'Hybrid', ar: 'الثلاثاء، ١٩:٠٠–٢١:٠٠' })
    expect(dated.timingNote).toEqual(note)
    expect(dated.sessions.map((s) => s.meetings)).toEqual([[at('2026-03-03')], [at('2026-03-10')]])
  })

  it('writes slots the pattern cannot place into the note: a start date with no weeks', () => {
    const { timingNote, sessions } = plan({
      schedule: { start_date: '2026-03-03', slots: [tuesdays] },
    })
    expect(timingNote).toEqual({ en: 'Tuesday, 19:00–21:00', ar: 'الثلاثاء، ١٩:٠٠–٢١:٠٠' })
    expect(sessions.map((s) => s.meetings)).toEqual([
      [{ date: '2026-03-03', start_time: null, end_time: null }],
    ])
  })

  it('leaves slots out of the timing note when the pattern places them', () => {
    expect(
      plan({ schedule: { start_date: '2026-03-03', weeks: 1, slots: [tuesdays] } }).timingNote,
    ).toBeNull()
  })
})

describe('fillSource', () => {
  type Doc = { id: string; _status: 'draft' | 'published' }
  const published: Doc = { id: 'published', _status: 'published' }
  const draft: Doc = { id: 'draft', _status: 'draft' }

  it('reads the latest version when it is a draft over the published course', () => {
    expect(fillSource(published, draft)).toBe(draft)
  })

  it('reads the published course when the latest version is the published one', () => {
    expect(fillSource(published, { id: 'version', _status: 'published' })).toBe(published)
    expect(fillSource(published, null)).toBe(published)
  })

  it('reads a course never published as it is', () => {
    const course: Doc = { id: 'course', _status: 'draft' }
    expect(fillSource(course, draft)).toBe(course)
  })
})
