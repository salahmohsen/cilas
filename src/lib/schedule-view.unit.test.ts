import { createTranslator } from 'next-intl'
import { describe, expect, it } from 'vitest'

import { formatsOf } from '@/i18n/formats'
import type { CalendarItem } from '@/lib/calendar-items'
import { sessionName } from '@/lib/session-items'
import { scheduleLineRef, scheduleToken, scheduleView, withSchedule } from '@/lib/session-refs'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'

const item = (id: string, dates: string[]) =>
  ({
    id,
    kind: 'session',
    title: `Session ${id}`,
    tone: 'green',
    cancelled: false,
    version: 'v',
    blocks: dates.map((date, i) => ({
      id: `${id}-${i}`,
      date,
      start_time: '19:00',
      end_time: '21:00',
    })),
  }) satisfies CalendarItem

const ref = { from: '2026-11-14', weeks: 2, ids: ['3'] }

describe('scheduleView', () => {
  it('keeps the meetings in its weeks and opens on the first day a marked session meets', () => {
    const view = scheduleView(
      [
        item('2', ['2026-11-15', '2026-12-20']),
        item('3', ['2026-11-26', '2026-11-19', '2026-11-10']),
        item('4', ['2026-12-01']),
      ],
      ref,
    )
    expect(view?.day).toBe('2026-11-19')
    expect(view?.items.map((i) => [i.id, i.blocks.map((b) => b.date)])).toEqual([
      ['2', ['2026-11-15']],
      ['3', ['2026-11-26', '2026-11-19']],
    ])
  })

  it('gives nothing when every marked session has left its weeks', () => {
    expect(scheduleView([item('2', ['2026-11-15']), item('3', ['2026-12-03'])], ref)).toBeNull()
    expect(scheduleView([item('2', ['2026-11-15'])], ref)).toBeNull()
  })
})

describe('withSchedule', () => {
  it('puts the block after the text, as a line of its own that reads as the block', () => {
    const token = scheduleToken(ref)
    const body = withSchedule('- Session 3 is cancelled\n', token)
    expect(body).toBe(`- Session 3 is cancelled\n\n${token}`)
    expect(scheduleLineRef(body.split('\n').at(-1)!)).toEqual(ref)
  })

  it('leaves the text as it is without a block', () => {
    expect(withSchedule('- Session 3 is cancelled', null)).toBe('- Session 3 is cancelled')
  })
})

describe('sessionName', () => {
  const unit = (locale: 'en' | 'ar') => {
    const t = createTranslator({
      locale,
      messages: locale === 'ar' ? ar : en,
      namespace: 'Course',
      formats: formatsOf(locale),
    })
    return (number: number) => t('session', { number })
  }

  it('names a session by its number, then its title', () => {
    expect(sessionName(3, 'Reading Fanon', unit('en'))).toBe('Session 3: Reading Fanon')
    expect(sessionName(3, null, unit('en'))).toBe('Session 3')
    expect(sessionName(3, '', unit('en'))).toBe('Session 3')
  })

  it('writes الجلسة with Arabic digits', () => {
    expect(sessionName(3, 'قراءة فانون', unit('ar'))).toBe('الجلسة ٣: قراءة فانون')
    expect(sessionName(12, null, unit('ar'))).toBe('الجلسة ١٢')
  })
})
