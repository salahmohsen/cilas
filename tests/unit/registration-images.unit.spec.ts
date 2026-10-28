import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { getOpenNow } from '@/api/home.api'
import { getStudyCourses } from '@/api/courses.api'
import { getStudyIndex } from '@/api/study-index'

vi.mock('@/api/study-index', () => ({ getStudyIndex: vi.fn() }))
vi.mock('@/api/programmes.api', () => ({
  listBridgeYears: async () => [],
  bridgeYearPath: (slug: string) => `/study/bridge/${slug}`,
}))

describe('registration image metadata', () => {
  it('keeps the main cover and focal coordinates through the course index', async () => {
    const course = {
      id: 1,
      title: 'A course',
      slug: 'a-course',
      course_type: 'THEMATIC',
      cover_image: { url: '/course.webp', alt: 'Course cover', focalX: 0, focalY: 85 },
      registration: { method: 'external', url: '/apply' },
    }
    const find = vi.fn().mockImplementation(async ({ collection }) => ({
      docs: collection === 'courses' ? [course] : [],
    }))
    const rows = await getStudyCourses({ find } as unknown as Payload, 'en', (key) => key, [
      'public',
    ])
    expect(rows[0]).toMatchObject({
      image: '/course.webp',
      imageFocalPoint: { focalX: 0, focalY: 85 },
    })
    expect(find.mock.calls[0]?.[0].populate.media).toMatchObject({ focalX: true, focalY: true })
  })

  it('preserves the focal point for both programme and course posters', async () => {
    vi.mocked(getStudyIndex).mockResolvedValue([
      {
        id: 1,
        title: 'A course',
        href: '/en/study/a-course',
        startDate: '',
        words: '',
        image: '/course.webp',
        imageAlt: 'Course cover',
        imageFocalPoint: { focalX: 0, focalY: 85 },
        facets: { registration: [{ value: 'open', label: 'Open' }] },
      },
    ])
    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [
          {
            title: 'Bridge',
            kind: 'bridge',
            slug: '2026',
            registration: { method: 'external' },
            cover: { url: '/bridge.webp', alt: 'Bridge cover', focalX: 90, focalY: 0 },
          },
        ],
      }),
    } as unknown as Payload
    const items = await getOpenNow(payload, 'en')
    expect(items.map((item) => item.image)).toEqual([
      { src: '/bridge.webp', alt: 'Bridge cover', focalX: 90, focalY: 0 },
      { src: '/course.webp', alt: 'Course cover', focalX: 0, focalY: 85 },
    ])
  })
})
