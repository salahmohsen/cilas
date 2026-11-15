import { describe, expect, it } from 'vitest'

import type { CalendarBlock, CalendarItem } from '@/lib/calendar-items'
import { scheduleBlock, scheduleChangeText, scheduleChanges } from '@/lib/schedule-changes'
import { scheduleLineRef } from '@/lib/session-refs'

// 2026-11-18 is a Wednesday, 2026-11-20 a Friday.
const TODAY = '2026-11-18'

const block = (id: string, date: string, start = '19:00', end = '21:00'): CalendarBlock => ({
  id,
  date,
  start_time: start,
  end_time: end,
})
const allDay = (id: string, date: string): CalendarBlock => ({
  id,
  date,
  start_time: null,
  end_time: null,
})
const item = (
  id: string,
  title: string,
  blocks: CalendarBlock[],
  cancelled = false,
): CalendarItem => ({
  id,
  kind: 'session',
  title,
  tone: 'neutral',
  cancelled,
  version: '2026-11-01T00:00:00.000Z',
  blocks,
})

const s3 = (blocks: CalendarBlock[], cancelled = false) => item('3', 'Session 3', blocks, cancelled)

describe('scheduleChanges', () => {
  it('finds nothing when nothing changed', () => {
    const items = [s3([block('a', '2026-11-20')])]
    expect(scheduleChanges(items, items, TODAY)).toEqual([])
  })

  it('finds a moved meeting', () => {
    const from = block('a', '2026-11-19')
    const to = block('a', '2026-11-21', '20:00', '22:00')
    expect(scheduleChanges([s3([from])], [s3([to])], TODAY)).toEqual([
      { kind: 'moved', itemId: '3', title: 'Session 3', from, to },
    ])
  })

  it('finds a meeting moved to other times on the same day', () => {
    const changes = scheduleChanges(
      [s3([block('a', '2026-11-20')])],
      [s3([block('a', '2026-11-20', '20:00', '22:00')])],
      TODAY,
    )
    expect(changes.map((c) => c.kind)).toEqual(['moved'])
  })

  it('finds an added and a removed meeting', () => {
    const kept = block('a', '2026-11-20')
    const added = block('b', '2026-11-25')
    const removed = block('c', '2026-11-27')
    expect(scheduleChanges([s3([kept, removed])], [s3([kept, added])], TODAY)).toEqual([
      { kind: 'meeting-added', itemId: '3', title: 'Session 3', block: added },
      { kind: 'meeting-removed', itemId: '3', title: 'Session 3', block: removed },
    ])
  })

  it('finds a new session with meetings, and ignores one with none', () => {
    const blocks = [block('x', '2026-11-25'), block('y', '2026-11-26')]
    expect(scheduleChanges([], [item('9', 'Session 9', blocks)], TODAY)).toEqual([
      { kind: 'item-added', itemId: '9', title: 'Session 9', blocks },
    ])
    expect(scheduleChanges([], [item('9', 'Session 9', [])], TODAY)).toEqual([])
  })

  it('finds a removed session', () => {
    const blocks = [block('a', '2026-11-20')]
    expect(scheduleChanges([s3(blocks)], [], TODAY)).toEqual([
      { kind: 'item-removed', itemId: '3', title: 'Session 3', blocks },
    ])
  })

  it('finds a cancelled and a restored session', () => {
    const blocks = [block('a', '2026-11-20')]
    expect(scheduleChanges([s3(blocks)], [s3(blocks, true)], TODAY)).toEqual([
      { kind: 'cancelled', itemId: '3', title: 'Session 3', blocks },
    ])
    expect(scheduleChanges([s3(blocks, true)], [s3(blocks)], TODAY)).toEqual([
      { kind: 'restored', itemId: '3', title: 'Session 3', blocks },
    ])
  })

  it('counts nothing when every touched meeting is in the past', () => {
    const past = block('a', '2026-11-10')
    expect(scheduleChanges([s3([past])], [s3([block('a', '2026-11-12')])], TODAY)).toEqual([])
    expect(scheduleChanges([s3([past])], [s3([past, block('b', '2026-11-11')])], TODAY)).toEqual([])
    expect(scheduleChanges([s3([past])], [s3([])], TODAY)).toEqual([])
    expect(scheduleChanges([s3([past])], [], TODAY)).toEqual([])
    expect(scheduleChanges([], [s3([past])], TODAY)).toEqual([])
  })

  it('does not count cancelling a session whose meetings are all in the past', () => {
    const blocks = [block('a', '2026-11-10')]
    expect(scheduleChanges([s3(blocks)], [s3(blocks, true)], TODAY)).toEqual([])
  })

  it('counts a meeting moved from the past to the future, and the other way', () => {
    const past = block('a', '2026-11-10')
    const future = block('a', '2026-11-25')
    expect(scheduleChanges([s3([past])], [s3([future])], TODAY).map((c) => c.kind)).toEqual([
      'moved',
    ])
    expect(scheduleChanges([s3([future])], [s3([past])], TODAY).map((c) => c.kind)).toEqual([
      'moved',
    ])
  })

  it('counts a meeting today, and not one yesterday', () => {
    const move = (date: string, to: string) =>
      scheduleChanges([s3([block('a', date)])], [s3([block('a', to)])], TODAY)
    expect(move('2026-11-18', '2026-11-12')).toHaveLength(1)
    expect(move('2026-11-17', '2026-11-12')).toHaveLength(0)
  })

  it('counts a cancel for a session with a meeting later, and lists only that meeting', () => {
    const later = block('b', '2026-11-20')
    const blocks = [block('a', '2026-11-10'), later]
    expect(scheduleChanges([s3(blocks)], [s3(blocks, true)], TODAY)).toEqual([
      { kind: 'cancelled', itemId: '3', title: 'Session 3', blocks: [later] },
    ])
  })

  it('lists only the meetings from today on for an added or removed session', () => {
    const past = block('p', '2026-11-10')
    const today = block('t', '2026-11-18')
    const later = block('l', '2026-11-25')
    expect(scheduleChanges([], [s3([later, past, today])], TODAY)).toEqual([
      { kind: 'item-added', itemId: '3', title: 'Session 3', blocks: [today, later] },
    ])
    expect(scheduleChanges([s3([past, later])], [], TODAY)).toEqual([
      { kind: 'item-removed', itemId: '3', title: 'Session 3', blocks: [later] },
    ])
  })

  it('keeps only the cancel when a session is cancelled and changed in one save', () => {
    const kept = block('a', '2026-11-20')
    const before = s3([kept, block('b', '2026-11-25'), block('c', '2026-11-27')])
    const after = s3(
      [block('a', '2026-11-21'), block('b', '2026-11-25'), block('d', '2026-12-02')],
      true,
    )
    expect(scheduleChanges([before], [after], TODAY)).toEqual([
      { kind: 'cancelled', itemId: '3', title: 'Session 3', blocks: after.blocks },
    ])
  })

  it('keeps the other changes when a session is restored', () => {
    const before = s3([block('a', '2026-11-20')], true)
    const after = s3([block('a', '2026-11-21')])
    expect(scheduleChanges([before], [after], TODAY).map((c) => c.kind)).toEqual([
      'restored',
      'moved',
    ])
  })

  it('returns the changes of several items', () => {
    const a1 = item('1', 'Session 1', [block('a', '2026-11-20')])
    const a2 = item('1', 'Session 1', [block('a', '2026-11-21')])
    const b1 = item('2', 'Session 2', [block('b', '2026-11-27')])
    const c = item('5', 'Session 5', [block('c', '2026-12-04')])
    expect(scheduleChanges([a1, b1], [a2, b1, c], TODAY).map((x) => [x.itemId, x.kind])).toEqual([
      ['1', 'moved'],
      ['5', 'item-added'],
    ])
    expect(scheduleChanges([a1, b1], [a2], TODAY).map((x) => [x.itemId, x.kind])).toEqual([
      ['1', 'moved'],
      ['2', 'item-removed'],
    ])
  })
})

describe('scheduleBlock', () => {
  it('shows the weeks from the first touched meeting to the last, with the changed sessions', () => {
    // Wed 18 Nov is in the week of Sat 14 Nov; Tue 1 Dec in the week of Sat 28 Nov.
    const changes = scheduleChanges(
      [s3([block('a', '2026-11-18')]), item('5', 'Session 5', [block('c', '2026-11-26')])],
      [s3([block('a', '2026-12-01')]), item('5', 'Session 5', [block('c', '2026-11-26')], true)],
      TODAY,
    )
    const token = scheduleBlock(changes, TODAY)
    expect(token).toBe('::schedule[2026-11-14+3:3,5]')
    expect(scheduleLineRef(token!)).toEqual({ from: '2026-11-14', weeks: 3, ids: ['3', '5'] })
  })

  it('names one week for changes inside one Saturday week', () => {
    const changes = scheduleChanges(
      [s3([block('a', '2026-11-21')])],
      [s3([block('a', '2026-11-27')])],
      TODAY,
    )
    expect(scheduleBlock(changes, TODAY)).toBe('::schedule[2026-11-21+1:3]')
  })

  it('does not mark a removed session, but its meetings still set the weeks', () => {
    const changes = scheduleChanges(
      [s3([block('a', '2026-11-20')]), item('9', 'Session 9', [block('z', '2026-12-10')])],
      [s3([block('a', '2026-11-21')])],
      TODAY,
    )
    expect(scheduleBlock(changes, TODAY)).toBe('::schedule[2026-11-14+4:3]')
  })

  it('starts at the first week from today, not at the past start of a move', () => {
    const changes = scheduleChanges(
      [s3([block('a', '2026-10-01')])],
      [s3([block('a', '2026-11-24')])],
      TODAY,
    )
    expect(scheduleBlock(changes, TODAY)).toBe('::schedule[2026-11-21+1:3]')
  })

  it('gives no block when nothing is left to mark', () => {
    expect(scheduleBlock([], TODAY)).toBeNull()
    const removed = scheduleChanges([s3([block('a', '2026-11-20')])], [], TODAY)
    expect(scheduleBlock(removed, TODAY)).toBeNull()
  })
})

describe('scheduleChangeText', () => {
  const from = block('a', '2026-11-19')
  const to = block('a', '2026-11-21', '20:00', '22:00')

  it('writes one bullet per change in English', () => {
    const changes = scheduleChanges(
      [s3([from, block('b', '2026-11-26')]), item('5', 'Session 5', [block('c', '2026-12-03')])],
      [s3([to]), item('5', 'Session 5', [block('c', '2026-12-03')], true)],
      TODAY,
    )
    expect(scheduleChangeText(changes, 'en')).toBe(
      [
        '- Session 3 moves from Thu 19 Nov 19:00 to Sat 21 Nov 20:00',
        '- The meeting of Session 3 on Thu 26 Nov 19:00 is removed',
        '- Session 5 is cancelled',
      ].join('\n'),
    )
  })

  it('words the other changes in English', () => {
    const text = scheduleChangeText(
      [
        { kind: 'meeting-added', itemId: '3', title: 'Session 3', block: to },
        { kind: 'item-added', itemId: '9', title: 'Session 9', blocks: [from, to] },
        { kind: 'item-removed', itemId: '8', title: 'Session 8', blocks: [from] },
        { kind: 'restored', itemId: '5', title: 'Session 5', blocks: [] },
      ],
      'en',
    ).split('\n')
    expect(text).toEqual([
      '- Session 3 has a new meeting on Sat 21 Nov 20:00',
      '- A new session, Session 9, meets on Thu 19 Nov 19:00 and Sat 21 Nov 20:00',
      '- Session 8 is removed. It was to meet on Thu 19 Nov 19:00',
      '- Session 5 is no longer cancelled',
    ])
  })

  it('shows the day only for an all-day meeting', () => {
    const text = scheduleChangeText(
      [
        {
          kind: 'moved',
          itemId: '3',
          title: 'Session 3',
          from: allDay('a', '2026-11-19'),
          to: allDay('a', '2026-11-21'),
        },
      ],
      'en',
    )
    expect(text).toBe('- Session 3 moves from Thu 19 Nov to Sat 21 Nov')
  })

  it('writes Arabic with Arabic digits', () => {
    const text = scheduleChangeText(
      [
        { kind: 'moved', itemId: '3', title: 'الجلسة ٣', from, to },
        { kind: 'cancelled', itemId: '5', title: 'الجلسة ٥', blocks: [] },
        { kind: 'restored', itemId: '6', title: 'الجلسة ٦', blocks: [] },
        {
          kind: 'meeting-removed',
          itemId: '3',
          title: 'الجلسة ٣',
          block: allDay('c', '2026-11-26'),
        },
      ],
      'ar',
    ).split('\n')
    expect(text[0]).toBe(
      '- يُنقل موعد الجلسة ٣ من الخميس، ١٩ نوفمبر، الساعة ١٩:٠٠ إلى السبت، ٢١ نوفمبر، الساعة ٢٠:٠٠',
    )
    expect(text[1]).toBe('- أُلغيت الجلسة ٥')
    expect(text[2]).toBe('- عادت الجلسة ٦ إلى الجدول')
    expect(text[3]).toBe('- أُلغي لقاء الجلسة ٣ المقرر في الخميس، ٢٦ نوفمبر')
    for (const line of text) expect(line).not.toMatch(/[0-9]/)
  })

  it('writes nothing for no change', () => {
    expect(scheduleChangeText([], 'en')).toBe('')
  })
})
