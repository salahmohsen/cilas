import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CourseView } from '@/app/(frontend)/[locale]/study/[slug]/CourseView'
import type { Course, Session } from '@/payload-types'
import ar from '../../messages/ar.json'
import en from '../../messages/en.json'

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/en/study/a-course',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const course = (over: Partial<Course> = {}): Course =>
  ({
    id: 1,
    slug: 'a-course',
    title: 'A course',
    course_type: 'THEMATIC',
    session_unit: 'session',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Course
const session = (id: number, over: Partial<Session> = {}): Session =>
  ({ id, course: 1, createdAt: '', updatedAt: '', ...over }) as Session
const weekly = [1, 2, 3].map((n) =>
  session(n, {
    meetings: [
      {
        date: `2026-03-${String(n * 7 - 4).padStart(2, '0')}`,
        start_time: '19:00',
        end_time: '21:00',
      },
    ],
  }),
)

const facts = (c: Course, sessions: Session[], locale: 'en' | 'ar' = 'en') => {
  const { container } = render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ar' ? ar : en}
      timeZone="Africa/Cairo"
    >
      <CourseView course={c} sessions={sessions} />
    </NextIntlClientProvider>,
  )
  const dl = container.querySelector('dl.side-card-facts')
  return {
    container,
    rows: [...(dl?.children ?? [])].map(
      (row) => `${row.querySelector('dt')?.textContent}: ${row.querySelector('dd')?.textContent}`,
    ),
  }
}

describe('what the course page says about time', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    )
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reads the start, the weekly times and the length from the sessions', () => {
    expect(facts(course(), weekly).rows).toEqual([
      'Starts: Tuesday, Mar 3',
      'Meets: Tuesday, 19:00–21:00',
      'Length: 3 sessions',
    ])
  })

  it('writes them in Arabic with Arabic digits and weekday', () => {
    const rows = facts(course(), weekly, 'ar').rows
    expect(rows[1]).toContain('الثلاثاء')
    expect(rows[1]).toContain('١٩:٠٠–٢١:٠٠')
  })

  it('says no weekly times for a course that does not meet every week alike', () => {
    const rows = facts(course({ session_unit: 'week' }), [
      session(1, { meetings: [{ date: '2026-03-03', start_time: '10:00', end_time: '13:00' }] }),
      session(2, { meetings: [{ date: '2026-03-05', start_time: '15:00', end_time: '17:00' }] }),
    ]).rows
    expect(rows).toEqual(['Starts: Tuesday, Mar 3', 'Length: 2 weeks'])
  })

  it('shows the timing note, and no time and no syllabus for a course with no session', () => {
    const { rows, container } = facts(course({ timing_note: 'Tuesday, 19:00–21:00' }), [])
    expect(rows).toEqual([])
    expect(container.querySelector('p.side-card-muted')?.textContent).toBe('Tuesday, 19:00–21:00')
    expect(container.querySelector('.course-flow')).toBeNull()
  })
})
