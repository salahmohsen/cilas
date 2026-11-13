import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { getStudyCourses } from '@/api/courses.api'
import { getFellows } from '@/api/people.api'
import { toCourseCard } from '@/lib/article-cards'
import type { Course } from '@/payload-types'

vi.mock('@/api/programmes.api', () => ({
  listBridgeYears: async () => [],
  bridgeYearPath: (slug: string) => `/study/bridge/${slug}`,
}))

const course = (id: number, over: Partial<Course> = {}): Course =>
  ({
    id,
    title: `Course ${id}`,
    slug: `course-${id}`,
    course_type: 'THEMATIC',
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '',
    ...over,
  }) as Course

const cycle = {
  id: 9,
  title: 'Winter',
  season: 'winter',
  start_year: 2019,
  start_date: '2019-01-05T00:00:00.000Z',
}

describe('lists by start date read the stored first day', () => {
  it('sorts the study list by first day, else the cycle day, and finds a session by its words', async () => {
    const docs = [
      course(1, { first_day: '2019-03-01' }),
      course(2, { cycle: cycle as Course['cycle'] }),
      course(3, {
        first_day: '2020-02-01',
        syllabus: { docs: [{ id: 7, title: 'Mapping the river', description: 'Walks' } as never] },
      }),
    ]
    const find = vi.fn().mockImplementation(async ({ collection }) => ({
      docs: collection === 'courses' ? docs : [],
    }))
    const rows = await getStudyCourses({ find } as unknown as Payload, 'en', (k) => k, ['public'])
    expect(rows.map((r) => [r.id, r.startDate])).toEqual([
      [3, '2020-02-01'],
      [1, '2019-03-01'],
      [2, '2019-01-05'],
    ])
    expect(rows[0]!.words).toContain('river')
    expect(find.mock.calls[0]?.[0].joins).toEqual({ enrollments: false, syllabus: { limit: 0 } })
  })

  it("dates a fellow's courses by their first day, newest first", async () => {
    const fellow = { id: 4, name: 'A fellow', slug: 'a-fellow' }
    const find = vi.fn().mockResolvedValue({
      docs: [
        course(1, { first_day: '2018-01-07', fellows: [fellow] as never }),
        course(2, { fellows: [fellow] as never, cycle: cycle as Course['cycle'] }),
      ],
    })
    const [f] = await getFellows({ find } as unknown as Payload, 'en')
    expect(f!.courses.map((c) => c.start)).toEqual(['2019-01-05', '2018-01-07'])
    expect(find.mock.calls[0]?.[0].select).toMatchObject({ first_day: true })
  })

  it('gives a course card its first day and its length in weeks from the first to the last day', () => {
    const format = { dateTime: (d: Date) => String(d.getUTCFullYear()) } as never
    const card = (c: Course) =>
      toCourseCard(c, { locale: 'en', format, weeksLabel: (w) => `${w} weeks`, and: 'and' })
    // Tuesday 3 March to Tuesday 21 April 2026: eight Saturday-to-Friday weeks.
    expect(card(course(1, { first_day: '2026-03-03', last_day: '2026-04-21' }))).toMatchObject({
      date: '2026-03-03',
      dateLabel: '2026',
      readTime: 8,
      readTimeLabel: '8 weeks',
    })
    expect(card(course(2))).toMatchObject({ date: '2020-01-01', readTime: 0, readTimeLabel: '' })
  })
})
