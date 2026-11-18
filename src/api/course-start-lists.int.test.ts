import { createFormatter, createTranslator } from 'next-intl'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getStudyCourses } from '@/api/courses.api'
import { getFellows } from '@/api/people.api'
import { CAIRO } from '@/lib/cairo-day'
import { toCourseCard } from '@/lib/article-cards'
import { formatsOf } from '@/i18n/formats'
import config from '@/payload.config'
import type { Course } from '@/payload-types'

import { messagesOf } from '../../testing/intl.test-utils'
import { createTracker, uniq } from '../../testing/payload.fixture'

let payload: Payload
let cycle: number
let fellow: { id: number; slug: string }
let dated: Course
let cycleOnly: Course
let sessioned: Course
const { track, cleanup } = createTracker()

const course = async (title: string, fellows: number[] = []) =>
  track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title,
        slug: uniq(title.toLowerCase().replace(/\W+/g, '-')),
        course_type: 'THEMATIC',
        tier: 'public',
        cycle,
        fellows,
        registration: { mode: 'closed' },
        _status: 'published',
      },
      overrideAccess: true,
    }),
  )

const meets = (courseId: number, date: string, extra: Record<string, unknown> = {}) =>
  payload.create({
    collection: 'sessions',
    locale: 'en',
    data: {
      course: courseId,
      title: 'A session',
      meetings: [{ date, start_time: '19:00', end_time: '21:00' }],
      ...extra,
    },
    overrideAccess: true,
  })

const stored = (id: number) =>
  payload.findByID({ collection: 'courses', id, depth: 0, overrideAccess: true })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const person = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name: 'Start list fellow', slug: uniq('start-list-fellow') },
      overrideAccess: true,
    }),
  )
  fellow = { id: person.id, slug: person.slug! }
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Start list place', slug: uniq('start-list-place'), city: uniq('Probe') },
      overrideAccess: true,
    }),
  ).id
  cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'winter', start_year: 2019, place, start_date: '2019-01-05' },
      overrideAccess: true,
    }),
  ).id
  dated = await course('Start list dated', [fellow.id])
  const session = await meets(dated.id, '2019-03-01')
  track('sessions', session)
  cycleOnly = await course('Start list cycle only', [fellow.id])
  sessioned = await course('Start list sessioned')
  track('sessions', await meets(sessioned.id, '2020-02-01', { title: 'Mapping the river' }))
  dated = await stored(dated.id)
  sessioned = await stored(sessioned.id)
})

afterAll(async () => {
  await cleanup(payload)
})

describe('lists by start date read the stored first day', () => {
  it('sorts the study list by first day, else the cycle day, and finds a session by its words', async () => {
    const t = createTranslator({
      locale: 'en',
      messages: messagesOf.en,
      namespace: 'Study.filters',
    })
    const all = await getStudyCourses(payload, 'en', (key) => t(key as never), ['public'])
    const mine = [sessioned.id, dated.id, cycleOnly.id]
    const rows = all.filter((row) => mine.includes(row.id))
    expect(rows.map((r) => [r.id, r.startDate])).toEqual([
      [sessioned.id, '2020-02-01'],
      [dated.id, '2019-03-01'],
      [cycleOnly.id, '2019-01-05'],
    ])
    expect(rows[0]!.words).toContain('river')
  })

  it("dates a fellow's courses by their first day, newest first", async () => {
    const fellows = await getFellows(payload, 'en')
    const mine = fellows.find((f) => f.id === fellow.id)
    expect(mine!.courses.map((c) => c.start)).toEqual(['2019-03-01', '2019-01-05'])
  })

  it('gives a course card its first day and its length in weeks from the first to the last day', () => {
    const format = createFormatter({
      locale: 'en',
      timeZone: CAIRO,
      formats: formatsOf('en'),
    })
    const tCourse = createTranslator({
      locale: 'en',
      messages: messagesOf.en,
      namespace: 'Course',
    })
    const card = (c: Course) =>
      toCourseCard(c, {
        locale: 'en',
        format,
        weeksLabel: (count) => tCourse('weeks', { count }),
        and: 'and',
      })
    expect(
      card({ ...dated, first_day: '2026-03-03', last_day: '2026-04-21', cycle: null }),
    ).toMatchObject({
      date: '2026-03-03',
      dateLabel: '2026',
      readTime: 8,
      readTimeLabel: '8 weeks',
    })
    expect(card({ ...cycleOnly, first_day: null, last_day: null, cycle: null })).toMatchObject({
      date: cycleOnly.createdAt.slice(0, 10),
      readTime: 0,
      readTimeLabel: '',
    })
  })
})
