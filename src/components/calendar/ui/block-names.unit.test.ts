import { createTranslator, type AbstractIntlMessages } from 'next-intl'
import { describe, expect, it } from 'vitest'

import { blockNamer } from '@/components/calendar/ui/block-names'
import { blocksOf } from '@/components/calendar/ui/calendar-model'
import { calendarLabelsFrom } from '@/components/calendar/ui/calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import en from '../../../../messages/en.json'

const messages: AbstractIntlMessages = { CalendarUi: en.CalendarUi }

const labels = calendarLabelsFrom(
  createTranslator({ locale: 'en', messages, namespace: 'CalendarUi' }),
  {
    kind: (kind) => (kind === 'course:mine' ? 'Your courses' : 'Other courses'),
    newItem: 'New',
  },
)

const item = (extra: Partial<CalendarItem>) =>
  ({
    id: 'c1',
    kind: 'course:mine',
    title: 'Week 3',
    tone: 'pink',
    cancelled: false,
    version: 'v1',
    blocks: [{ id: 'b1', date: '2026-11-17', start_time: '19:00', end_time: '21:00' }],
    ...extra,
  }) satisfies CalendarItem

const nameOf = (it: CalendarItem, marked: ReadonlySet<string> = new Set()) => {
  const namer = blockNamer({ items: [it], labels, locale: 'en', unsaved: new Set(), marked })
  return namer(blocksOf([it])[0]!)
}

describe('a block name', () => {
  it('holds the kind after the time when the item has an edge', () => {
    expect(nameOf(item({ edge: 'solid' }))).toBe(
      'Week 3, Tuesday, November 17, 7 PM to 9 PM, Your courses',
    )
  })

  it('does not join the kind to the state list with "and"', () => {
    const name = nameOf(item({ edge: 'solid', cancelled: true }), new Set(['c1']))
    expect(name).toBe(
      'Week 3, Tuesday, November 17, 7 PM to 9 PM, Your courses, Cancelled and Changed',
    )
  })

  it('has no kind when the item has no edge', () => {
    expect(nameOf(item({ kind: 'event:talk' }))).toBe('Week 3, Tuesday, November 17, 7 PM to 9 PM')
  })

  it('starts with the title', () => {
    expect(nameOf(item({ edge: 'double', kind: 'course:other' }))).toMatch(/^Week 3, /)
  })
})
