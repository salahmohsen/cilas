import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { CourseSyllabus } from '@/components/course/course-syllabus'
import type { Course } from '@/payload-types'
import en from '../../messages/en.json'
import ar from '../../messages/ar.json'

const course = (delivery?: 'ONLINE' | 'OFFLINE' | 'HYBRID' | null): Course =>
  ({
    id: 1,
    title: 'Course',
    course_type: 'THEMATIC',
    cycle: 1,
    session_unit: 'session',
    createdAt: '',
    updatedAt: '',
    sessions: [
      {
        id: 'session-one',
        order: 1,
        session_title: 'First',
        ...(delivery !== undefined ? { delivery } : {}),
      },
    ],
  }) as Course
const view = (data: Course, locale = 'en', editable = false) =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ar' ? ar : en}
      timeZone="Africa/Cairo"
    >
      <CourseSyllabus course={data} editable={editable} />
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
    const data = course('ONLINE')
    data.sessions!.push({ id: 'second', order: 2, session_title: 'Second', delivery: 'OFFLINE' })
    const { getByText } = view(data, locale)
    expect(getByText(online!)).toBeInTheDocument()
    expect(getByText(offline!)).toBeInTheDocument()
  })
  it('renders the same markup when delivery is absent or empty', () => {
    const first = view(course())
    const absent = first.container.innerHTML
    first.unmount()
    const empty = view(course(null))
    // React-generated accordion ids differ between mounts.
    expect(empty.container.innerHTML.replace(/«[^»]+»/g, 'ID').replace(/_r_[^" ]+/g, 'ID')).toBe(
      absent.replace(/«[^»]+»/g, 'ID').replace(/_r_[^" ]+/g, 'ID'),
    )
    expect(empty.queryByText('Online')).not.toBeInTheDocument()
  })
  it('keeps delivery editable inside its session row and updates on rerender', () => {
    const { container, getByText, rerender } = view(course('ONLINE'), 'en', true)
    expect(getByText('Online').outerHTML).toContain('sessions.0.delivery')
    expect(container.innerHTML).toContain('session-one')
    rerender(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
        <CourseSyllabus course={course('OFFLINE')} editable />
      </NextIntlClientProvider>,
    )
    expect(getByText('In person')).toBeInTheDocument()
  })
})
