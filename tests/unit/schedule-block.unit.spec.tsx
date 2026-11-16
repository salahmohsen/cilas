// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PostBody } from '@/components/space/post-body'
import { scheduleToken } from '@/lib/session-refs'
import type { SessionCourse, SessionRead } from '@/lib/spaces-data'
import type { Session } from '@/payload-types'

import en from '../../messages/en.json'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const session = (
  id: number,
  position: number,
  meetings: { date: string; start_time?: string }[],
  extra: Partial<Session> = {},
) =>
  ({
    id,
    course: 1,
    position,
    title: null,
    cancelled: false,
    updatedAt: '2026-11-01T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    meetings: meetings.map((m, i) => ({
      id: `${id}-${i}`,
      date: m.date,
      start_time: m.start_time ?? '19:00',
      end_time: m.start_time ? null : '21:00',
    })),
    ...extra,
  }) as Session

// Sessions 1 to 4 meet on Tuesdays; session 4 is three weeks after the block's two.
const course: SessionCourse = {
  id: 1,
  slug: 'probe',
  title: 'Probe',
  subtitle: null,
  description: null,
  syllabus_tentative: null,
  course_type: 'LAB',
  sessions: [
    session(11, 1, [{ date: '2026-11-10' }]),
    session(12, 2, [{ date: '2026-11-17' }]),
    session(13, 3, [{ date: '2026-11-24' }]),
    session(14, 4, [{ date: '2026-12-15' }]),
  ],
} as SessionCourse

const shown: SessionRead = { state: 'shown', course }
const links = { spaceHref: '/en/spaces/probe', facts: {}, known: true }
const schedule = (ids: string[]) =>
  `Changes:\n\n${scheduleToken({ from: '2026-11-17', weeks: 2, ids })}`

const view = (body: string, read: SessionRead | null = shown) =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <PostBody body={body} sessions={{ links: read ? links : null, read }} />
    </NextIntlClientProvider>,
  )

beforeEach(() => {
  // Each test sets it: another file's vi.unstubAllGlobals() can remove it when files share a worker.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  localStorage.clear()
  push.mockReset()
  vi.useFakeTimers({ now: new Date('2026-11-12T10:00:00Z'), toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('a schedule block in a post', () => {
  it('opens on the first week it names, view only, with its sessions marked', () => {
    view(schedule(['12']))
    expect(screen.getByText('Nov 14 to Nov 20, 2026')).toBeInTheDocument()
    expect(screen.getByText('Week 2 of 6')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Session 2, Tuesday, November 17, 7 PM to 9 PM, Changed',
      }),
    ).toHaveAttribute('data-marked')
    // The course's type gives the tone, as on its page.
    expect(screen.getByRole('button', { name: /^Session 2,/ })).toHaveAttribute(
      'data-tone',
      'green',
    )
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(document.querySelector('[data-mode="view"]')).not.toBeNull()
    expect(screen.getByText('Changes:')).toBeInTheDocument()
  })

  it('shows the other sessions of its weeks unmarked, and none outside them', () => {
    view(schedule(['12']))
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    const next = screen.getByRole('button', { name: /^Session 3, Tuesday, November 24/ })
    expect(next).not.toHaveAttribute('data-marked')
    expect(screen.queryByRole('group', { name: 'Unscheduled' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(screen.getByText('Dec 12 to Dec 18, 2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Session 4,/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(screen.queryByRole('button', { name: /^Session 1,/ })).toBeNull()
  })

  it('reads the current schedule: a session moved since shows where it is now', () => {
    const moved = {
      ...course,
      sessions: [session(12, 2, [{ date: '2026-11-19', start_time: '17:00' }])],
    }
    view(schedule(['12']), { state: 'shown', course: moved })
    expect(
      screen.getByRole('button', { name: /^Session 1, Thursday, November 19, 5 PM.*Changed$/ }),
    ).toBeInTheDocument()
  })

  it('opens the session drawer on the session, in place, not the feed', () => {
    window.history.replaceState(null, '', '/en/spaces/probe/posts/5')
    view(schedule(['12']))
    fireEvent.click(screen.getByRole('button', { name: /^Session 2, Tuesday/ }))
    expect(push).not.toHaveBeenCalled()
    expect(`${window.location.pathname}${window.location.search}`).toBe(
      '/en/spaces/probe/posts/5?open=12',
    )
  })

  it('says so in a short line when its sessions are gone or the course is not readable', () => {
    view(schedule(['99']))
    expect(screen.getByText(en.SpacePost.scheduleGone)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Calendar' })).toBeNull()
    cleanup()
    view(schedule(['12']), { state: 'hidden' })
    expect(screen.getByText(en.SpacePost.sessionHidden)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Calendar' })).toBeNull()
    cleanup()
    view(schedule(['12']), null)
    expect(screen.queryByRole('group', { name: 'Calendar' })).toBeNull()
  })

  it('says so in a short line when its sessions all moved out of its weeks', () => {
    const away = {
      ...course,
      sessions: [
        session(12, 2, [{ date: '2027-01-12' }]),
        session(13, 3, [{ date: '2026-11-24' }]),
      ],
    }
    view(schedule(['12']), { state: 'shown', course: away })
    expect(screen.getByText(en.SpacePost.scheduleGone)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Calendar' })).toBeNull()
  })

  it('opens on the week of the first day a named session meets', () => {
    view(schedule(['13']))
    expect(screen.getByText('Nov 21 to Nov 27, 2026')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Session 3, Tuesday, November 24.*Changed$/ }),
    ).toBeInTheDocument()
  })
})
