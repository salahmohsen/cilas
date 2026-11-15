// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { useSyncExternalStore } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadSessionView, type SessionViewResult } from '@/actions/load-session-view'
import { scheduleOffers } from '@/actions/schedule-offers'
import { loadSessionEdit, saveSessionEdit, type SessionEdit } from '@/actions/session-edit'
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
vi.mock('@/actions/session-edit', () => ({ loadSessionEdit: vi.fn(), saveSessionEdit: vi.fn() }))
vi.mock('@/actions/schedule-offers', () => ({ scheduleOffers: vi.fn() }))
vi.mock('@/actions/save-calendar-changes', () => ({ saveCalendarChanges: vi.fn() }))
const refresh = vi.fn()

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
  useRouter: () => ({ push: vi.fn(), refresh }),
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
  // The Edit form's chunk too, as a pointer over Edit loads it.
  await import('@/components/space/session-form')
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

    // The heading names the session; the view under it shows its number, not its title again.
    const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(loadSessionView).toHaveBeenCalledWith('13', 'en')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    expect(within(dialog).getByText(en.SpacePost.sessionDrawerTimes)).toBeInTheDocument()

    // The one session view: number, title, times, delivery, Markdown, materials, activities.
    const view = within(dialog).getByRole('region', { name: 'Session 3: Reading the city' })
    expect(view).toHaveTextContent('Session 3')
    expect(view).not.toHaveTextContent('Reading the city')
    expect(within(dialog).getByText('19:00–21:00')).toBeInTheDocument()
    expect(within(dialog).getAllByText(en.Course.delivery.ONLINE).length).toBeGreaterThan(0)
    expect(dialog.querySelector('strong')?.textContent).toBe('slowly')
    expect(within(dialog).getByText('Invisible Cities')).toBeInTheDocument()
    expect(within(dialog).getByText('In pairs')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('link', { name: en.SpacePost.sessionDrawerPosts }),
    ).toHaveAttribute('href', '/en/spaces/course/probe?session=13')
    // Only the people who may edit the session see Edit.
    expect(within(dialog).queryByRole('button', { name: en.SessionEdit.edit })).toBeNull()

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(window.location.search).toBe('?tab=syllabus'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(link)
  })

  it('opens from a link with the param and drops the param in place on close', async () => {
    window.history.replaceState(null, '', '/en/spaces/course/probe?open=14')
    const length = window.history.length
    page()
    const dialog = await screen.findByRole('dialog', { name: 'Called off' })
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
    const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(dialog).toHaveAttribute('data-side', 'left')
    expect(
      within(dialog).getByRole('button', { name: ar.SpacePost.sessionDrawerClose }),
    ).toBeInTheDocument()
  })

  it('is a bottom sheet on a phone', async () => {
    phone = true
    window.history.replaceState(null, '', '/en/spaces/course/probe?open=13')
    page()
    const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(dialog).not.toHaveAttribute('data-side')
    expect(screen.getByRole('button', { name: /^(Expand|Collapse) sheet$/ })).toBeInTheDocument()
    await act(async () => {})
  })
})

const editValues = (extra: Partial<SessionEdit> = {}): SessionEdit => ({
  title: 'Reading the city',
  description: 'Walk **slowly**.',
  cancelled: false,
  meetings: [{ id: 'm13', date: '2026-11-13', start_time: '19:00', end_time: '21:00' }],
  bibliography: [{ id: 'b1', type: 'reading', title: 'Invisible Cities', href: '', note: '' }],
  activities: [{ id: 'a1', kind: 'discussion', description: 'In pairs' }],
  ...extra,
})

const openForm = async (values = editValues()) => {
  vi.mocked(loadSessionView).mockImplementation(async (id) => shown(Number(id), true))
  vi.mocked(loadSessionEdit).mockResolvedValue({ ok: true, values, version: 'v1' })
  window.history.replaceState(null, '', '/en/spaces/course/probe?open=13')
  page()
  const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
  const edit = await within(dialog).findByRole('button', { name: en.SessionEdit.edit })
  // The form's chunk loads from the button's pointer, before the click.
  fireEvent.pointerEnter(edit)
  await act(async () => {})
  fireEvent.click(edit)
  await within(dialog).findByRole('textbox', { name: en.SessionEdit.title })
  return dialog
}

const save = (dialog: HTMLElement) =>
  act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: en.SessionEdit.save }))
  })

describe('the session drawer’s Edit form', () => {
  beforeEach(() => {
    vi.mocked(saveSessionEdit).mockReset()
    vi.mocked(scheduleOffers).mockReset().mockResolvedValue([])
    refresh.mockReset()
  })

  it('offers Edit only to the people the session’s access lets edit', async () => {
    vi.mocked(loadSessionView).mockImplementation(async (id) => shown(Number(id), true))
    window.history.replaceState(null, '', '/en/spaces/course/probe?open=13')
    page()
    const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(within(dialog).getByRole('button', { name: en.SessionEdit.edit })).toBeInTheDocument()
  })

  it('shows the meeting rule’s error by the end time, focuses it, and saves nothing', async () => {
    const dialog = await openForm(
      editValues({
        meetings: [{ id: 'm13', date: '2026-11-13', start_time: '21:00', end_time: '19:00' }],
      }),
    )
    await save(dialog)
    const error = await within(dialog).findByText(en.SessionEdit.errors.order)
    const ends = within(dialog).getByRole('button', { name: new RegExp(`^${en.SessionEdit.ends}`) })
    expect(ends).toHaveAttribute('data-invalid')
    expect(ends.getAttribute('aria-describedby')).toContain(error.id)
    await waitFor(() => expect(document.activeElement).toBe(ends))
    expect(saveSessionEdit).not.toHaveBeenCalled()
  })

  it('adds a meeting, asks for its day, and removes it again', async () => {
    const dialog = await openForm()
    fireEvent.click(within(dialog).getByRole('button', { name: en.SessionEdit.addMeeting }))
    expect(within(dialog).getAllByText(en.SessionEdit.day)).toHaveLength(2)
    await save(dialog)
    expect(await within(dialog).findByText(en.SessionEdit.errors.day)).toBeInTheDocument()
    expect(saveSessionEdit).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove meeting 2' }))
    vi.mocked(saveSessionEdit).mockResolvedValue({ ok: true, courseId: '1', before: [], after: [] })
    await save(dialog)
    expect(saveSessionEdit).toHaveBeenCalledWith(
      { id: '13', version: 'v1', values: editValues() },
      'en',
    )
  })

  it('asks before a close loses changes, and closes at once with none', async () => {
    const dialog = await openForm()
    fireEvent.change(within(dialog).getByRole('textbox', { name: en.SessionEdit.title }), {
      target: { value: 'Walking the city' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: en.SpacePost.sessionDrawerClose }))
    const ask = await screen.findByRole('dialog', { name: en.Spaces.calendarLeaveTitle })
    expect(window.location.search).toBe('?open=13')
    fireEvent.click(within(ask).getByRole('button', { name: en.Spaces.calendarLeaveStay }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: en.Spaces.calendarLeaveTitle })).toBeNull(),
    )

    fireEvent.change(within(dialog).getByRole('textbox', { name: en.SessionEdit.title }), {
      target: { value: 'Reading the city' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: en.SpacePost.sessionDrawerClose }))
    await waitFor(() => expect(window.location.search).toBe(''))
    expect(screen.queryByRole('dialog', { name: en.Spaces.calendarLeaveTitle })).toBeNull()

    // Opened again, it shows the session, not the form it was closed on.
    act(() => window.history.pushState(null, '', '/en/spaces/course/probe?open=13'))
    const again = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(await within(again).findByRole('button', { name: en.SessionEdit.edit })).toBeVisible()
    expect(within(again).queryByRole('textbox', { name: en.SessionEdit.title })).toBeNull()
  })

  it('after a save, offers on the course’s items before and after it, and reads the page again', async () => {
    const before = [
      {
        id: '13',
        kind: 'session',
        title: 'Reading the city',
        tone: 'yellow' as const,
        cancelled: false,
        version: 'v1',
        blocks: [{ id: 'm13', date: '2026-11-13', start_time: '19:00', end_time: '21:00' }],
      },
    ]
    const after = [{ ...before[0]!, cancelled: true, version: 'v2' }]
    vi.mocked(saveSessionEdit).mockResolvedValue({ ok: true, courseId: '1', before, after })
    const dialog = await openForm()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: en.SessionEdit.cancelled }))
    await save(dialog)
    await waitFor(() =>
      expect(scheduleOffers).toHaveBeenCalledWith({ courseId: '1', before, after }, 'en'),
    )
    expect(refresh).toHaveBeenCalled()
    // Back in view mode, read again.
    expect(await within(dialog).findByRole('button', { name: en.SessionEdit.edit })).toBeVisible()
    expect(loadSessionView).toHaveBeenCalledTimes(2)
  })

  it('keeps the changes on a stale save and offers to reload', async () => {
    vi.mocked(saveSessionEdit).mockResolvedValue({
      ok: false,
      error: { code: 'stale', itemId: '13', name: 'Session 3: Reading the city' },
    })
    const dialog = await openForm()
    const title = within(dialog).getByRole('textbox', { name: en.SessionEdit.title })
    fireEvent.change(title, { target: { value: 'Mine' } })
    await save(dialog)
    expect(
      await within(dialog).findByRole('button', { name: en.CalendarAdmin.reloadAndLose }),
    ).toBeInTheDocument()
    expect(title).toHaveValue('Mine')
    expect(scheduleOffers).not.toHaveBeenCalled()
  })

  it('offers a retry when the session does not load', async () => {
    vi.mocked(loadSessionView).mockResolvedValueOnce({ ok: false, error: 'failed' })
    window.history.replaceState(null, '', '/en/spaces/course/probe?open=13')
    page()
    fireEvent.click(await screen.findByRole('button', { name: en.SpacePost.sessionDrawerRetry }))
    expect(await screen.findByRole('dialog', { name: 'Reading the city' })).toBeInTheDocument()
  })
})
