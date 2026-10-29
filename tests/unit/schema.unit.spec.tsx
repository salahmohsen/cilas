import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { Schema } from '@/components/schema'
import { courseSchema, eventSchema } from '@/lib/schema'
import type { Course, Event, Person } from '@/payload-types'

vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_SERVER_URL: 'https://ci-las.org' } }))

const event: Event = {
  id: 1,
  title: 'An evening at CILAS',
  slug: 'an-evening',
  tier: 'public',
  event_type: 'talk',
  createdAt: '',
  updatedAt: '',
  schedule: { start_date: '2026-10-29', start_precision: 'day' },
  external_venue: { name: 'CILAS', address: 'Cairo, Egypt' },
  cover_image: { id: 2, url: '/cover.jpg' } as Event['cover_image'],
}

const dataFor = (overrides: Partial<Event> = {}) =>
  eventSchema({ event: { ...event, ...overrides }, locale: 'ar', siteName: 'CILAS' })

describe('event structured data', () => {
  it('uses single-event times without an agenda beside Cairo DST changes', () => {
    for (const [day, utc] of [
      ['2026-10-29', '19:30'],
      ['2026-10-30', '20:30'],
    ]) {
      const data = dataFor({
        schedule: { mode: 'single', start_date: day, start_time: '22:30', end_time: '23:00' },
        agenda: [],
      })
      expect(new Date(data!.startDate).toISOString()).toBe(`${day}T${utc}:00.000Z`)
    }
  })
  it('identifies its localized detail page and cover', () => {
    expect(dataFor()).toMatchObject({
      '@type': 'Event',
      url: 'https://ci-las.org/ar/events/an-evening',
      image: ['https://ci-las.org/cover.jpg'],
      startDate: '2026-10-29',
      endDate: '2026-10-29',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    })
  })

  it('omits uncertain dates even when a weekly pattern exists', () => {
    expect(
      dataFor({
        schedule: {
          start_date: '2026-10-29',
          start_precision: 'week',
          weeks: 1,
          slots: [{ weekday: 'thu', start_time: '19:00', end_time: '21:00' }],
        },
      }),
    ).toBeNull()
  })

  it('requires a detail URL, an exact day and a physical venue address', () => {
    expect(dataFor({ slug: '' })).toBeNull()
    expect(dataFor({ schedule: {} })).toBeNull()
    expect(dataFor({ external_venue: { name: 'TBA' } })).toBeNull()
    expect(
      dataFor({ external_venue: undefined, online_url: 'https://example.com/meeting' }),
    ).toBeNull()
  })

  it('matches the visible external venue when a CILAS place is also populated', () => {
    const data = dataFor({
      place: {
        id: 3,
        name: 'Old place',
        address: 'Old address',
      } as Event['place'],
    })
    expect(data?.location[0]).toMatchObject({ name: 'CILAS' })
  })

  it('keeps the Cairo offset correct beside the autumn daylight-saving change', () => {
    const data = dataFor({
      schedule: {
        start_date: '2026-10-29',
        weeks: 1,
        slots: [{ weekday: 'thu', start_time: '22:30', end_time: '23:00' }],
      },
    })
    expect(new Date(data!.startDate).toISOString()).toBe('2026-10-29T19:30:00.000Z')
  })

  it('uses the earliest and latest agenda times regardless of editor order', () => {
    const data = dataFor({
      agenda: [
        { title: 'Last', start_time: '20:00', end_time: '21:00' },
        { title: 'First', start_time: '18:00', end_time: '19:00' },
      ],
    })
    expect(new Date(data!.startDate).toISOString()).toBe('2026-10-29T15:00:00.000Z')
    expect(new Date(data!.endDate).toISOString()).toBe('2026-10-29T18:00:00.000Z')
  })
})

describe('course structured data', () => {
  const course = {
    title: 'Reading Plato',
    slug: 'reading-plato',
    summary: 'A reading seminar.',
    location: ['ONLINE'],
    schedule: { slots: [{ weekday: 'thu', start_time: '19:00', end_time: '21:00' }] },
  } as Course

  it('types the instance and puts its instructors on that instance', () => {
    const data = courseSchema({
      course,
      locale: 'en',
      siteName: 'CILAS',
      instructors: [{ name: 'A Fellow' } as Person],
    })
    expect(data).toMatchObject({
      url: 'https://ci-las.org/en/study/reading-plato',
      hasCourseInstance: [
        { '@type': 'CourseInstance', courseMode: 'Online', instructor: [{ name: 'A Fellow' }] },
      ],
    })
    expect(data).not.toHaveProperty('instructor')
    expect(data?.hasCourseInstance?.[0]).not.toHaveProperty('courseSchedule')
  })

  it('does not invent an onsite instance when the delivery mode is unknown', () => {
    const data = courseSchema({
      course: { ...course, location: [] },
      locale: 'ar',
      siteName: 'CILAS',
      instructors: [],
    })
    expect(data).not.toHaveProperty('hasCourseInstance')
  })
})

describe('JSON-LD output', () => {
  it('renders parseable data without letting content close the script tag', () => {
    const name = '</script><script>alert(1)</script>'
    const html = renderToStaticMarkup(<Schema data={{ '@type': 'Event', name }} />)
    const root = document.createElement('div')
    root.innerHTML = html
    expect(root.querySelectorAll('script')).toHaveLength(1)
    expect(JSON.parse(root.querySelector('script')!.textContent!)).toEqual({
      '@type': 'Event',
      name,
    })
  })
})
