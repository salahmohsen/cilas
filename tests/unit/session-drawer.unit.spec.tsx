// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { useSyncExternalStore } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadSessionView, type SessionViewResult } from '@/actions/load-session-view'
import {
  SessionDrawerHost,
  SessionLink,
  sessionTriggerProps,
} from '@/components/space/session-drawer-host'
import { numberedSessions } from '@/lib/meetings'
import type { Session } from '@/payload-types'
import en from '../../messages/en.json'
import ar from '../../messages/ar.json'

vi.mock('@/actions/load-session-view', () => ({ loadSessionView: vi.fn() }))

// Next folds pushState and replaceState into its router; this stands in for that.
const URL_EVENT = 'test:url'
const subscribe = (change: () => void) => {
  window.addEventListener('popstate', change)
  window.addEventListener(URL_EVENT, change)
  return () => {
    window.removeEventListener('popstate', change)
    window.removeEventListener(URL_EVENT, change)
  }
}
vi.mock('next/navigation', () => ({
  useSearchParams: () =>
    new URLSearchParams(
      useSyncExternalStore(
        subscribe,
        () => window.location.search,
        () => '',
      ),
    ),
}))

let phone = false
const session = (id: number, position: number, extra: Partial<Session> = {}): Session =>
  ({
    id,
    course: 1,
    position,
    title: null,
    cancelled: false,
    createdAt: '',
    updatedAt: '',
    meetings: [
      { id: `${id}`, date: `2026-11-${10 + position}`, start_time: '19:00', end_time: '21:00' },
    ],
    ...extra,
  }) as Session

const sessions = [
  session(11, 1),
  session(12, 2),
  session(13, 3, {
    title: 'Reading the city',
    delivery: 'ONLINE',
    description: 'Walk **slowly**.',
    bibliography: [{ id: 'm1', type: 'reading', title: 'Invisible Cities' }],
    activities: [{ id: 'a1', kind: 'discussion', description: 'In pairs' }],
  }),
  session(14, 4, { title: 'Called off', cancelled: true }),
]
const course = {
  id: 1,
  slug: 'probe',
  title: 'Probe course',
  subtitle: null,
  description: null,
  syllabus_tentative: null,
  course_type: 'LAB',
} as const
const shown = (id: number, canEdit = false): SessionViewResult => ({
  ok: true,
  course: course as never,
  session: numberedSessions(sessions).find((n) => n.session.id === id)!,
  spaceHref: '/en/spaces/course/probe',
  canEdit,
})

const page = (locale: 'en' | 'ar' = 'en') =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ar' ? ar : en}
      timeZone="Africa/Cairo"
    >
      <SessionLink id="13" href="/en/spaces/course/probe?tab=syllabus&open=13">
        {en.SpacePost.sessionOpen}
      </SessionLink>
      <SessionDrawerHost />
    </NextIntlClientProvider>,
  )

beforeAll(async () => {
  // Load the drawer's chunk first, as a pointer over a trigger does: React does
  // not retry a suspended render outside act() in this environment.
  sessionTriggerProps.onPointerEnter()
  await import('@/components/space/session-drawer')
  await new Promise((resolve) => setTimeout(resolve, 0))
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history)
    window.history[method] = (...args: Parameters<History['pushState']>) => {
      original(...args)
      window.dispatchEvent(new Event(URL_EVENT))
    }
  }
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  } as unknown as typeof IntersectionObserver
  Element.prototype.scrollIntoView = vi.fn()
})
beforeEach(() => {
  phone = false
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: phone,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  window.history.replaceState(null, '', '/en/spaces/course/probe?tab=syllabus')
  vi.mocked(loadSessionView).mockImplementation(async (id) => shown(Number(id)))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.mocked(loadSessionView).mockReset()
})

describe('the session drawer', () => {
  it('is not in the page until a session is opened', () => {
    page()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(loadSessionView).not.toHaveBeenCalled()
  })

  it('opens on a click with the param, takes focus, closes on Escape, and gives focus back', async () => {
    page()
    const link = screen.getByRole('link', { name: en.SpacePost.sessionOpen })
    link.focus()
    fireEvent.click(link)
    expect(window.location.search).toBe('?tab=syllabus&open=13')

    const dialog = await screen.findByRole('dialog', { name: 'Session 3' })
    expect(loadSessionView).toHaveBeenCalledWith('13', 'en')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    expect(within(dialog).getByText(en.SpacePost.sessionDrawerTimes)).toBeInTheDocument()

    // The one session view: number, title, times, delivery, Markdown, materials, activities.
    expect(
      within(dialog).getByRole('region', { name: 'Session 3: Reading the city' }),
    ).toHaveTextContent('Reading the city')
    expect(within(dialog).getByText('19:00–21:00')).toBeInTheDocument()
    expect(within(dialog).getAllByText(en.Course.delivery.ONLINE).length).toBeGreaterThan(0)
    expect(dialog.querySelector('strong')?.textContent).toBe('slowly')
    expect(within(dialog).getByText('Invisible Cities')).toBeInTheDocument()
    expect(within(dialog).getByText('In pairs')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('link', { name: en.SpacePost.sessionDrawerPosts }),
    ).toHaveAttribute('href', '/en/spaces/course/probe?session=13')
    // Unit 5 adds Edit; nothing offers it yet.
    expect(within(dialog).queryByRole('button', { name: /edit/i })).toBeNull()

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(window.location.search).toBe('?tab=syllabus'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(link)
  })

  it('opens from a link with the param and drops the param in place on close', async () => {
    window.history.replaceState(null, '', '/en/spaces/course/probe?open=14')
    const length = window.history.length
    page()
    const dialog = await screen.findByRole('dialog', { name: 'Session 4' })
    expect(within(dialog).getAllByText(en.Course.cancelled).length).toBeGreaterThan(0)
    fireEvent.click(within(dialog).getByRole('button', { name: en.SpacePost.sessionDrawerClose }))
    await waitFor(() => expect(window.location.search).toBe(''))
    expect(window.history.length).toBe(length)
  })

  it('says so when the session is gone or not the reader’s to read', async () => {
    vi.mocked(loadSessionView).mockResolvedValue({ ok: false, error: 'not-found' })
    window.history.replaceState(null, '', '/en/spaces/course/probe?open=99')
    page()
    expect(await screen.findByText(en.SpacePost.sessionGone)).toBeInTheDocument()
  })

  it('slides from the left in Arabic, with Arabic labels', async () => {
    window.history.replaceState(null, '', '/ar/spaces/course/probe?open=13')
    vi.mocked(loadSessionView).mockImplementation(async (id) => shown(Number(id)))
    page('ar')
    const dialog = await screen.findByRole('dialog', { name: /^الجلسة/ })
    expect(dialog).toHaveAttribute('data-side', 'left')
    expect(
      within(dialog).getByRole('button', { name: ar.SpacePost.sessionDrawerClose }),
    ).toBeInTheDocument()
  })

  it('is a bottom sheet on a phone', async () => {
    phone = true
    window.history.replaceState(null, '', '/en/spaces/course/probe?open=13')
    page()
    const dialog = await screen.findByRole('dialog', { name: 'Session 3' })
    expect(dialog).not.toHaveAttribute('data-side')
    expect(screen.getByRole('button', { name: /^(Expand|Collapse) sheet$/ })).toBeInTheDocument()
    await act(async () => {})
  })
})
