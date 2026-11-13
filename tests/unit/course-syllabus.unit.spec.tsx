import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CourseSyllabus, syllabusOf } from '@/components/course/course-syllabus'
import type { Course, Session } from '@/payload-types'
import en from '../../messages/en.json'

const course = { title: 'Course' } as Course
const session = (id: number, over: Partial<Session> = {}): Session =>
  ({ id, course: 1, createdAt: '', updatedAt: '', ...over }) as Session
const view = (sessions: Session[], unit: Course['session_unit'] = 'session') =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <CourseSyllabus course={course} sessions={syllabusOf(sessions, unit)} />
    </NextIntlClientProvider>,
  )

describe('the course syllabus from the sessions collection', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('orders sessions by their first meeting and names an untitled one by its unit', () => {
    const { container } = view(
      [
        session(1, { title: 'Later', meetings: [{ date: '2026-03-10' }] }),
        session(2, { meetings: [{ date: '2026-03-03' }] }),
      ],
      'week',
    )
    const titles = [...container.querySelectorAll('[class*="title"]')].map((t) => t.textContent)
    expect(titles.filter((t) => t === 'Week 1' || t === 'Later')).toEqual(['Week 1', 'Later'])
  })

  it('shows a timed meeting with its hours and an all-day one with its day alone', () => {
    const { container } = view([
      session(1, { meetings: [{ date: '2026-03-03', start_time: '19:00', end_time: '21:00' }] }),
      session(2, { meetings: [{ date: '2026-03-10' }] }),
    ])
    const clocks = [...container.querySelectorAll('[class*="clock"]')].map((c) => c.textContent)
    expect(clocks).toEqual(['19:00–21:00'])
    expect(container.textContent).not.toContain('–null')
  })

  it('renders a description as Markdown, never as raw HTML', () => {
    const { container } = view([
      session(1, { description: 'Read **closely**.\n\n<script>alert(1)</script>' }),
    ])
    expect(container.querySelector('strong')?.textContent).toBe('closely')
    expect(container.querySelector('script')).toBeNull()
  })

  it('renders nothing for a course with no session', () => {
    expect(view([]).container.innerHTML).toBe('')
  })
})
