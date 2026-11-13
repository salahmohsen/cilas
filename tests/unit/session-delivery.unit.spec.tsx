import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { CourseSyllabus, syllabusOf } from '@/components/course/course-syllabus'
import type { Course, Session } from '@/payload-types'
import en from '../../messages/en.json'
import ar from '../../messages/ar.json'

const course = { title: 'Course' } as Course
const session = (
  id: number,
  title: string,
  delivery?: 'ONLINE' | 'OFFLINE' | 'HYBRID' | null,
): Session =>
  ({
    id,
    course: 1,
    title,
    position: id,
    createdAt: '',
    updatedAt: '',
    ...(delivery !== undefined ? { delivery } : {}),
  }) as Session
const view = (sessions: Session[], locale = 'en', editable = false) =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ar' ? ar : en}
      timeZone="Africa/Cairo"
    >
      <CourseSyllabus
        course={course}
        sessions={syllabusOf(sessions, 'session')}
        editable={editable}
      />
    </NextIntlClientProvider>,
  )
describe('optional session delivery', () => {
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
  it.each([
    ['en', 'Online', 'In person'],
    ['ar', 'عبر الإنترنت', 'حضوري'],
  ])('shows a session split in %s', (locale, online, offline) => {
    const { getByText } = view(
      [session(1, 'First', 'ONLINE'), session(2, 'Second', 'OFFLINE')],
      locale,
    )
    expect(getByText(online!)).toBeInTheDocument()
    expect(getByText(offline!)).toBeInTheDocument()
  })
  it('renders the same markup when delivery is absent or empty', () => {
    const first = view([session(1, 'First')])
    const absent = first.container.innerHTML
    first.unmount()
    const empty = view([session(1, 'First', null)])
    // React-generated accordion ids differ between mounts.
    expect(empty.container.innerHTML.replace(/«[^»]+»/g, 'ID').replace(/_r_[^" ]+/g, 'ID')).toBe(
      absent.replace(/«[^»]+»/g, 'ID').replace(/_r_[^" ]+/g, 'ID'),
    )
    expect(empty.queryByText('Online')).not.toBeInTheDocument()
  })
  it('shows the delivery saved in the session, with no editor mark: sessions are edited in their own documents', () => {
    const { container, getByText, rerender } = view([session(1, 'First', 'ONLINE')], 'en', true)
    expect(getByText('Online').outerHTML).not.toContain('sessions.0')
    expect(container.innerHTML).not.toContain('sessions.0')
    rerender(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
        <CourseSyllabus
          course={course}
          sessions={syllabusOf([session(1, 'First', 'OFFLINE')], 'session')}
          editable
        />
      </NextIntlClientProvider>,
    )
    expect(getByText('In person')).toBeInTheDocument()
  })
})
