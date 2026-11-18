import { act, render, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CourseSyllabus, syllabusOf } from '@/components/course/course-syllabus'
import type { Course, Session } from '@/payload-types'
import en from '../../../messages/en.json'
import ar from '../../../messages/ar.json'

const course = { title: 'Course' } as Course
const session = (id: number, over: Partial<Session> = {}): Session =>
  ({ id, course: 1, createdAt: '', updatedAt: '', ...over }) as Session
const view = (sessions: Session[], locale: 'en' | 'ar' = 'en') =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ar' ? ar : en}
      timeZone="Africa/Cairo"
    >
      <CourseSyllabus course={course} sessions={syllabusOf(sessions)} />
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

  it('orders sessions by their first meeting and names an untitled one by its number', () => {
    const { container } = view([
      session(1, { title: 'Later', meetings: [{ date: '2026-03-10' }] }),
      session(2, { meetings: [{ date: '2026-03-03' }] }),
    ])
    const titles = [...container.querySelectorAll('[class*="title"]')].map((t) => t.textContent)
    expect(titles.filter((t) => t === 'Session 1' || t === 'Later')).toEqual(['Session 1', 'Later'])
  })

  it('shows a timed meeting with its hours and an all-day one with its day alone', () => {
    const { container } = view([
      session(1, { meetings: [{ date: '2026-03-03', start_time: '19:00', end_time: '21:00' }] }),
      session(2, { meetings: [{ date: '2026-03-10' }] }),
    ])
    const clocks = [...container.querySelectorAll('[class*="clock"]')].map((c) => c.textContent)
    expect(clocks).toEqual(['7 – 9 PM'])
    expect(container.textContent).not.toContain('–null')
  })

  it.each([
    ['en', '3:15 – 6 PM', '11 AM', '11 AM – 1 PM'],
    ['ar', '٣:١٥ – ٦ م', '١١ ص', '١١ ص – ١ م'],
  ] as const)(
    'uses the calendar clock for ranges and start-only meetings in %s',
    (locale, range, start, noon) => {
      const { container } = view(
        [
          session(1, {
            meetings: [{ date: '2026-03-03', start_time: '15:15', end_time: '18:00' }],
          }),
          session(2, { meetings: [{ date: '2026-03-10', start_time: '11:00' }] }),
          session(3, {
            meetings: [{ date: '2026-03-17', start_time: '11:00', end_time: '13:00' }],
          }),
        ],
        locale,
      )
      expect([...container.querySelectorAll('[class*="clock"]')].map((c) => c.textContent)).toEqual(
        [range, start, noon],
      )
    },
  )

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

  describe('a link to one session', () => {
    const sessions = () => [
      session(7, { title: 'First', meetings: [{ date: '2026-03-03' }] }),
      session(9, {
        title: 'Second',
        description: 'Text',
        meetings: [{ date: '2026-03-10' }],
      }),
    ]
    const rowOf = (container: HTMLElement, id: string) =>
      container.querySelector<HTMLElement>(`li[id="session-${id}"] button[aria-expanded]`)!
    afterEach(() => window.history.replaceState(null, '', '/'))

    it.each(['en', 'ar'] as const)('gives each row a stable anchor in %s', (locale) => {
      const { container } = view(sessions(), locale)
      expect([...container.querySelectorAll('li[id^="session-"]')].map((li) => li.id)).toEqual([
        'session-7',
        'session-9',
      ])
    })

    it('opens the row, focuses it and scrolls to it when the page arrives with its hash', async () => {
      window.history.replaceState(null, '', '/en/study/a#session-9')
      const { container } = view(sessions())
      await waitFor(() => expect(rowOf(container, '9')).toHaveFocus())
      expect(rowOf(container, '9')).toHaveAttribute('aria-expanded', 'true')
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: 'start' }),
      )
    })

    it('follows a later change of the hash', async () => {
      const { container } = view(sessions())
      expect(rowOf(container, '7')).not.toHaveFocus()
      act(() => {
        window.history.replaceState(null, '', '/en/study/a#session-7')
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      })
      await waitFor(() => expect(rowOf(container, '7')).toHaveFocus())
      expect(rowOf(container, '7')).toHaveAttribute('aria-expanded', 'true')
    })

    it('ignores a hash that is not a session of the course', () => {
      window.history.replaceState(null, '', '/en/study/a#session-404')
      const { container } = view(sessions())
      expect(container.contains(document.activeElement)).toBe(false)
    })
  })
})
