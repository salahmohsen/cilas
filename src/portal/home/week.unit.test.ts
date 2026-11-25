import { describe, expect, it } from 'vitest'

import type { CalendarMeeting } from '@/lib/calendar'

import { weekAgenda } from './week'

type Extra = Partial<Pick<CalendarMeeting, 'start' | 'cancelled' | 'item' | 'courseId'>>

const meeting = (kind: CalendarMeeting['kind'], key: string, date: string, extra: Extra = {}) =>
  ({
    key,
    item: key,
    kind,
    title: key,
    href: null,
    type: kind,
    date,
    ...extra,
  }) satisfies CalendarMeeting

const course = (key: string, date: string, extra?: Extra) => meeting('course', key, date, extra)
const event = (key: string, date: string, extra?: Extra) => meeting('event', key, date, extra)

const WEEK = [
  '2034-10-07',
  '2034-10-08',
  '2034-10-09',
  '2034-10-10',
  '2034-10-11',
  '2034-10-12',
  '2034-10-13',
]

const keysOn = (week: ReturnType<typeof weekAgenda>, date: string) =>
  week.find((day) => day.date === date)?.meetings.map(({ key }) => key)

const allKeys = (week: ReturnType<typeof weekAgenda>) =>
  week.flatMap((day) => day.meetings.map(({ key }) => key))

describe('weekAgenda', () => {
  it.each(['2034-10-07', '2034-10-11', '2034-10-13'])(
    'the week runs from Saturday to Friday around today %s',
    (today) => {
      expect(weekAgenda([], [], today).map(({ date }) => date)).toEqual(WEEK)
    },
  )

  it('the next Saturday starts the next week', () => {
    const week = weekAgenda([], [], '2034-10-14')
    expect(week[0]?.date).toBe('2034-10-14')
    expect(week.at(-1)?.date).toBe('2034-10-20')
  })

  it('own meetings and public events share a day, by start time, and a meeting with no start comes first', () => {
    const week = weekAgenda(
      [course('evening', '2034-10-09', { start: '19:00' })],
      [event('all day', '2034-10-09'), event('noon', '2034-10-09', { start: '12:00' })],
      '2034-10-11',
    )
    expect(keysOn(week, '2034-10-09')).toEqual(['all day', 'noon', 'evening'])
  })

  it('a public course in the public list never shows', () => {
    const week = weekAgenda(
      [course('mine', '2034-10-09')],
      [course('someone else’s', '2034-10-09'), event('talk', '2034-10-10')],
      '2034-10-11',
    )
    expect(allKeys(week)).toEqual(['mine', 'talk'])
  })

  it('a cancelled meeting is not counted', () => {
    const week = weekAgenda(
      [course('off', '2034-10-09', { cancelled: true }), course('on', '2034-10-09')],
      [event('called off', '2034-10-09', { cancelled: true })],
      '2034-10-11',
    )
    expect(allKeys(week)).toEqual(['on'])
  })

  it('a meeting on the day before or after the week is left out', () => {
    const week = weekAgenda(
      [course('friday before', '2034-10-06'), course('saturday after', '2034-10-14')],
      [event('first day', '2034-10-07'), event('last day', '2034-10-13')],
      '2034-10-11',
    )
    expect(allKeys(week)).toEqual(['first day', 'last day'])
  })

  it('two meetings of one session on one day count as two', () => {
    const week = weekAgenda(
      [
        course('morning', '2034-10-09', { item: 's1', start: '10:00' }),
        course('afternoon', '2034-10-09', { item: 's1', start: '15:00' }),
      ],
      [],
      '2034-10-11',
    )
    expect(keysOn(week, '2034-10-09')).toEqual(['morning', 'afternoon'])
  })

  it('with no own meeting, only the events show', () => {
    const week = weekAgenda(
      [],
      [course('public course', '2034-10-09'), event('talk', '2034-10-09')],
      '2034-10-11',
    )
    expect(allKeys(week)).toEqual(['talk'])
  })

  it('leaves the lists it reads in their order', () => {
    const own = [course('late', '2034-10-09', { start: '19:00' }), course('early', '2034-10-08')]
    const before = [...own]
    weekAgenda(own, [], '2034-10-11')
    expect(own).toEqual(before)
  })
})
