import { act, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadedRange } from '@/components/calendar/calendar-url'
import { PublicCalendar } from '@/components/calendar/public-calendar'
import { publicItems } from '@/components/calendar/public-items'
import { usePublicCalendarAccess } from '@/components/calendar/use-public-calendar-access'
import { ScheduleActionsProvider, type ScheduleActions } from '@/components/space/schedule-actions'
import type { CalendarMeeting } from '@/lib/calendar'

import { meeting, meetings, words } from '../../../testing/public-calendar.fixture'
import { IntlProvider, messagesOf } from '../../../testing/intl.test-utils'
import { mockNetwork, nextImages } from '../../../testing/msw-browser.test-utils'
import {
  NavigationProvider,
  createMemoryRouter,
  renderWithNavigation,
} from '../../../testing/navigation.test-utils'
import { scheduleActionsHost } from '../../../testing/schedule-actions.test-utils'

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

const en = messagesOf.en
const ar = messagesOf.ar

type Access = Awaited<ReturnType<ScheduleActions['publicCalendarLinks']>>

const network = mockNetwork(
  nextImages(),
  http.get('/api/users/me', () => HttpResponse.json({ user: null })),
)
const signIn = (email: string) =>
  network.use(http.get('/api/users/me', () => HttpResponse.json({ user: { id: 8, email } })))

const host = scheduleActionsHost()
const grant = (access: Partial<Access>) => {
  host.answers.publicCalendarLinks = async () => ({
    canEdit: false,
    editable: [],
    spaces: {},
    ...access,
  })
}
const asReader = (access: Partial<Access> = {}) => {
  signIn('reader@cilas.test')
  grant(access)
}
const accessRead = async () => {
  await waitFor(() => expect(host.calls.publicCalendarLinks).toHaveLength(1))
  await act(async () => {})
}

const kinds = (locale: 'en' | 'ar') => {
  const calendar = messagesOf[locale].Calendar
  return {
    'course:core': { name: 'Core course', open: calendar.viewCourse },
    'course:thematic': { name: 'Thematic course', open: calendar.viewCourse },
    'event:screening': { name: 'Screening', open: calendar.viewEvent },
  }
}

const calendar = (
  locale: 'en' | 'ar',
  query: string,
  source: readonly CalendarMeeting[] = meetings,
) => (
  <IntlProvider locale={locale}>
    <ScheduleActionsProvider actions={host.actions}>
      <PublicCalendar
        items={publicItems(source, words(locale))}
        range={loadedRange(new URLSearchParams(query).get('date')!)}
        today="2026-11-17"
        kinds={kinds(locale)}
        months={['2025-03', '2026-11']}
      />
    </ScheduleActionsProvider>
  </IntlProvider>
)

const DOCKED = '72rem'
const UNDOCKED = '48rem'

const framed = (width: string, children: ReactNode) => (
  <div style={{ inlineSize: width }}>{children}</div>
)

const page = (
  locale: 'en' | 'ar' = 'en',
  query = '?view=week&date=2026-11-17',
  { source = meetings, docked = false }: { source?: CalendarMeeting[]; docked?: boolean } = {},
) => {
  const url = `/${locale}/calendar${query}`
  window.history.replaceState(null, '', query)
  return renderWithNavigation(framed(docked ? DOCKED : UNDOCKED, calendar(locale, query, source)), {
    url,
  })
}

const pageTookOver = (target: Element, init: MouseEventInit = {}) => {
  let taken = false
  const look = (event: Event) => {
    taken = event.defaultPrevented
    event.preventDefault()
  }
  window.addEventListener('click', look, { once: true })
  target.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }),
  )
  return taken
}

beforeAll(() => {
  globalThis.__UI_SDK_STRICT__ = true
})

beforeEach(() => {
  host.reset()
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the public calendar', () => {
  it('server renders the week with each meeting as a link to its page', () => {
    const html = renderToString(
      <NavigationProvider memory={createMemoryRouter('/en/calendar?view=week&date=2026-11-17')}>
        {calendar('en', '?view=week&date=2026-11-17')}
      </NavigationProvider>,
    )
    expect(html).toContain('Reading the city')
    expect(html).toContain('href="/en/study/reading-the-city#session-501"')
    expect(html).toContain('href="/en/events/film-night"')
  })

  it('opens the details on a plain press of a block, with a link to the course', async () => {
    page()
    const block = screen.getByRole('link', { name: /^Reading the city, Tuesday/ })
    expect(block).toHaveAttribute('href', '/en/study/reading-the-city#session-501')
    expect(pageTookOver(block)).toBe(true)
    const details = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(within(details).getByText('Session 3')).toBeInTheDocument()
    expect(within(details).getByText('Online')).toBeInTheDocument()
    expect(within(details).getByRole('img', { name: 'A street' })).toBeInTheDocument()
    expect(within(details).getByRole('link', { name: 'View course' })).toHaveAttribute(
      'href',
      '/en/study/reading-the-city#session-501',
    )
    expect(within(details).queryByRole('button', { name: /Edit/ })).toBeNull()
  })

  it('shows the session title in the caption and the counts as a link to the session in the course page', async () => {
    const titled = [meeting({ sessionTitle: 'What is intelligence?', materials: 3, activities: 1 })]
    page('en', '?view=week&date=2026-11-17', { source: titled })
    fireEvent.click(screen.getByRole('link', { name: /^Reading the city, Tuesday/ }))
    const details = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(details).toHaveTextContent('Session 3 · ⁨What is intelligence?⁩')
    const counts = within(details).getByRole('link', { name: '3 materials · 1 activity' })
    expect(counts).toHaveAttribute('href', '/en/study/reading-the-city#session-501')
    expect(within(details).getByRole('link', { name: 'View course' })).toHaveAttribute(
      'href',
      counts.getAttribute('href')!,
    )
  })

  it('shows no counts row for a session without materials and activities', async () => {
    page()
    fireEvent.click(screen.getByRole('link', { name: /^Reading the city, Tuesday/ }))
    const details = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(within(details).queryByRole('link', { name: /material|activit/ })).toBeNull()
    expect(within(details).getAllByRole('link')).toHaveLength(1)
  })

  it('opens the details from the keyboard on a linked block, with Enter or Space', async () => {
    page()
    const block = screen.getByRole('link', { name: /^Reading the city, Tuesday/ })
    block.focus()
    fireEvent.keyDown(block, { key: ' ' })
    expect(await screen.findByRole('dialog', { name: 'Reading the city' })).toBeInTheDocument()
  })

  it('leaves a press with a modifier key to the browser', () => {
    page()
    const block = screen.getByRole('link', { name: /^Reading the city, Tuesday/ })
    expect(pageTookOver(block, { metaKey: true })).toBe(false)
  })

  it('offers View event for an event', async () => {
    page()
    fireEvent.click(screen.getByRole('link', { name: /^Film night, Wednesday/ }))
    const details = await screen.findByRole('dialog', { name: 'Film night' })
    expect(within(details).getByRole('link', { name: 'View event' })).toHaveAttribute(
      'href',
      '/en/events/film-night',
    )
  })

  it("turns a kind's meetings off and on from the legend", () => {
    page()
    fireEvent.click(screen.getByRole('button', { name: en.CalendarUi.panel }))
    const legend = screen.getByRole('group', { name: en.CalendarUi.legend })
    const thematic = within(legend).getByRole('button', { name: 'Thematic course' })
    expect(
      within(legend)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Core course', 'Thematic course', 'Screening'])
    expect(thematic).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(thematic)
    expect(thematic).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('link', { name: /^Reading the city/ })).toBeNull()
    expect(screen.getByRole('link', { name: /^Core seminar/ })).toBeInTheDocument()
    fireEvent.click(thematic)
    expect(screen.getAllByRole('link', { name: /^Reading the city/ }).length).toBeGreaterThan(0)
  })

  it('writes a move inside the loaded days to the URL, and loads the days past them', () => {
    const { memory } = page()
    const push = vi.spyOn(window.history, 'pushState')
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    expect(push).toHaveBeenLastCalledWith(null, '', '?view=day&date=2026-11-17')
    expect(memory.visits).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(memory.visits[0]).toEqual({
      method: 'push',
      href: '/en/calendar?view=month&date=2026-12-01',
      options: { scroll: false },
    })
    push.mockRestore()
  })

  it('follows the URL when Back changes it', async () => {
    window.history.replaceState(null, '', '?view=day&date=2026-11-18')
    window.history.pushState(null, '', '?view=week&date=2026-11-17')
    renderWithNavigation(framed(UNDOCKED, calendar('en', '?view=week&date=2026-11-17')), {
      url: '/en/calendar?view=week&date=2026-11-17',
    })
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    window.history.back()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true'),
    )
    expect(screen.getByRole('link', { name: /^Film night, Wednesday/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Reading the city, Tuesday/ })).toBeNull()
  })

  it('moves back on a quick Back after a switch, before the router has the new URL', async () => {
    const { memory } = page()
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')
    expect(memory.url.search).toBe('?view=week&date=2026-11-17')
    window.history.back()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true'),
    )
  })

  it('settles on the month the router loaded, before the router writes its URL', () => {
    const { memory, rerender } = page('en', '?view=month&date=2026-11-07')
    act(() => {
      memory.router.push('/en/calendar?view=month&date=2026-10-07', { scroll: false })
      rerender(framed(UNDOCKED, calendar('en', '?view=month&date=2026-10-07')))
    })
    expect(memory.visits.filter((visit) => visit.method === 'replace')).toEqual([])
    expect(screen.queryByText('November 2026')).toBeNull()
  })

  it('points an empty month to the nearest month with something', () => {
    page('en', '?view=month&date=2026-12-10')
    expect(screen.getByRole('link', { name: 'Most recent: November 2026' })).toBeInTheDocument()
  })

  it('reads right to left in Arabic, with the Arabic link names', async () => {
    page('ar')
    fireEvent.click(screen.getByRole('link', { name: /^Film night/ }))
    const details = await screen.findByRole('dialog', { name: 'Film night' })
    expect(within(details).getByRole('link', { name: ar.Calendar.viewEvent })).toBeInTheDocument()
  })
})

describe('public calendar access after hydration', () => {
  it('sends no access request for an anonymous viewer', async () => {
    let asked = false
    network.use(
      http.get('/api/users/me', () => {
        asked = true
        return HttpResponse.json({ user: null })
      }),
    )
    page()
    await waitFor(() => expect(asked).toBe(true))
    await act(async () => {})
    expect(host.calls.publicCalendarLinks).toEqual([])
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })

  it('shows Edit after one admin access request and keeps the current date and view', async () => {
    signIn('admin@cilas.test')
    grant({ canEdit: true, spaces: { '22': '/en/spaces/course/city' } })
    const { memory } = page()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(host.calls.publicCalendarLinks).toHaveLength(1)
    expect(memory.visits).toEqual([
      {
        method: 'push',
        href: '/en/calendar?view=week&date=2026-11-17&edit=1',
        options: { scroll: false },
      },
    ])
  })

  it.each([true, false])('shows the course links with space access %s', async (allowed) => {
    asReader({ spaces: allowed ? { '22': '/en/spaces/course/city' } : {} })
    const { container } = page()
    await accessRead()
    fireEvent.click(container.querySelector('a[href="/en/study/reading-the-city#session-501"]')!)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('link', { name: 'View course' })).toBeInTheDocument()
    if (allowed) {
      expect(within(dialog).getByRole('link', { name: 'Go to space' })).toHaveAttribute(
        'href',
        '/en/spaces/course/city',
      )
      expect(within(dialog).getByRole('group', { name: 'Reading the city' })).toBeInTheDocument()
    } else expect(within(dialog).queryByRole('link', { name: 'Go to space' })).toBeNull()
  })
})

it('keeps one event action when the viewer can read a course space', async () => {
  asReader({ spaces: { '22': '/en/spaces/course/city' } })
  page()
  await accessRead()
  fireEvent.click(screen.getByRole('link', { name: /^Film night, Wednesday/ }))
  const details = await screen.findByRole('dialog', { name: 'Film night' })
  expect(within(details).getByRole('link', { name: 'View event' })).toBeInTheDocument()
  expect(within(details).queryByRole('link', { name: 'Go to space' })).toBeNull()
  expect(within(details).getAllByRole('link')).toHaveLength(1)
})

it('waits for the new language before it shows a space path', async () => {
  signIn('reader@cilas.test')
  let finish!: (value: Access) => void
  host.answers.publicCalendarLinks = async () => {
    host.answers.publicCalendarLinks = () =>
      new Promise((resolve) => {
        finish = resolve
      })
    return { canEdit: false, editable: [], spaces: { '22': '/en/spaces/course/city' } }
  }
  const { result, rerender } = renderHook(({ locale }) => usePublicCalendarAccess(['22'], locale), {
    initialProps: { locale: 'en' },
    wrapper: ({ children }: { children: ReactNode }) => (
      <ScheduleActionsProvider actions={host.actions}>{children}</ScheduleActionsProvider>
    ),
  })
  await waitFor(() => expect(result.current.spaces['22']).toBe('/en/spaces/course/city'))
  rerender({ locale: 'ar' })
  expect(result.current.spaces).toEqual({})
  await act(async () =>
    finish({ canEdit: false, editable: [], spaces: { '22': '/ar/spaces/course/city' } }),
  )
  expect(result.current.spaces['22']).toBe('/ar/spaces/course/city')
  expect(host.calls.publicCalendarLinks).toHaveLength(2)
})

describe('the month panel on the public calendar, by role', () => {
  const monthPage = async (query = '?view=month&date=2026-11-17') => {
    const shown = page('en', query, { docked: true })
    await act(async () => {})
    return shown
  }
  const openDay = async (day = '2026-11-17') => {
    fireEvent.click(document.querySelector<HTMLElement>(`[data-day="${day}"] [data-block-id]`)!)
    return screen.findByRole('region', { name: 'Reading the city' })
  }
  const menu = async () => {
    fireEvent.keyDown(await screen.findByRole('button', { name: 'More actions' }), {
      key: 'Enter',
    })
    return screen.findByRole('menu')
  }
  const editValues = (cancelled: boolean) => ({
    title: 'Reading the city',
    description: 'Text',
    cancelled,
    meetings: [],
    bibliography: [{ id: 'b1', type: 'reading' as const, title: 'A book', href: '', note: '' }],
    activities: [],
  })

  it('opens on today with the panel open, and no Edit session for anyone', async () => {
    asReader({ canEdit: true, editable: ['22'] })
    await monthPage()
    await accessRead()
    expect(screen.getByRole('region', { name: 'Tuesday, November 17' })).toBeInTheDocument()
    const details = await openDay()
    expect(within(details).queryByRole('button', { name: /Edit/ })).toBeNull()
    expect(within(details).queryByRole('link', { name: /Edit/ })).toBeNull()
  })

  it('gives a visitor View course only, and no menu', async () => {
    await monthPage()
    const details = await openDay()
    expect(within(details).getByRole('link', { name: 'View course' })).toBeInTheDocument()
    expect(within(details).getAllByRole('link')).toHaveLength(1)
    expect(within(details).queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  it('gives a student who may not read the space View course only', async () => {
    asReader()
    await monthPage()
    await accessRead()
    const details = await openDay()
    expect(within(details).queryByRole('link', { name: 'Go to space' })).toBeNull()
    expect(within(details).queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  it('adds Go to space for an enrolled student, after View course', async () => {
    asReader({ spaces: { '22': '/en/spaces/course/city' } })
    await monthPage()
    await accessRead()
    const details = await openDay()
    expect(
      within(details)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/en/study/reading-the-city#session-501', '/en/spaces/course/city'])
    expect(within(details).queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  it.each([
    ['a host', { editable: ['22'] }],
    ['an admin', { canEdit: true, editable: ['22'] }],
  ])('gives %s a More actions menu that holds Cancel session only', async (_who, access) => {
    asReader(access)
    await monthPage()
    await openDay()
    const entries = within(await menu()).getAllByRole('menuitem')
    expect(entries.map((entry) => entry.textContent)).toEqual(['Cancel session'])
  })

  it('gives a fellow of another course no menu', async () => {
    asReader({ editable: ['99'] })
    await monthPage()
    await accessRead()
    const details = await openDay()
    expect(within(details).queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  it('cancels after the confirm: one detail change, the other fields kept, then the offer', async () => {
    asReader({ editable: ['22'] })
    const values = editValues(false)
    host.answers.loadSessionEdit = async () => ({ ok: true, values, version: 'v1' })
    host.answers.saveScheduleEdits = async () => ({ ok: true, items: [], before: [], after: [] })
    await monthPage()
    await openDay()
    fireEvent.click(within(await menu()).getByRole('menuitem', { name: 'Cancel session' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this session?' })
    expect(host.calls.saveScheduleEdits).toEqual([])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel session' }))
    await waitFor(() => expect(host.calls.saveScheduleEdits).toHaveLength(1))
    const { meetings: _meetings, ...rest } = values
    expect(host.calls.saveScheduleEdits).toEqual([
      [
        {
          details: [{ op: 'edit', id: '501', version: 'v1', values: { ...rest, cancelled: true } }],
        },
        'en',
      ],
    ])
    await waitFor(() =>
      expect(host.calls.scheduleOffers).toEqual([
        [expect.objectContaining({ courseId: '22' }), 'en'],
      ]),
    )
  })

  it('shows a refused save in words and keeps the session as it was', async () => {
    asReader({ editable: ['22'] })
    host.answers.loadSessionEdit = async () => ({
      ok: true,
      values: editValues(false),
      version: 'v1',
    })
    host.answers.saveScheduleEdits = async () => ({
      ok: false,
      error: { code: 'stale', itemId: '501' },
    })
    await monthPage()
    await openDay()
    fireEvent.click(within(await menu()).getByRole('menuitem', { name: 'Cancel session' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this session?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel session' }))
    expect(await screen.findByText(/Someone else changed/)).toBeInTheDocument()
    expect(host.calls.scheduleOffers).toEqual([])
  })

  it('offers Restore session for a cancelled meeting, with no confirm', async () => {
    asReader({ editable: ['22'] })
    host.answers.loadSessionEdit = async () => ({
      ok: true,
      values: editValues(true),
      version: 'v2',
    })
    host.answers.saveScheduleEdits = async () => ({ ok: true, items: [], before: [], after: [] })
    await monthPage('?view=month&date=2026-11-21')
    await openDay('2026-11-21')
    fireEvent.click(within(await menu()).getByRole('menuitem', { name: 'Restore session' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(host.calls.saveScheduleEdits).toEqual([
        [
          expect.objectContaining({
            details: [
              expect.objectContaining({ values: expect.objectContaining({ cancelled: false }) }),
            ],
          }),
          'en',
        ],
      ]),
    )
  })
})

describe('the selected day in the URL', () => {
  it('writes a day chosen in the month with replaceState, so Back does not step through days', () => {
    page('en', '?view=month&date=2026-11-17', { docked: true })
    const push = vi.spyOn(window.history, 'pushState')
    const replace = vi.spyOn(window.history, 'replaceState')
    fireEvent.click(document.querySelector<HTMLElement>('[data-day="2026-11-19"]')!)
    expect(replace).toHaveBeenLastCalledWith(null, '', '?view=month&date=2026-11-19')
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Thursday, November 19' })).toBeInTheDocument()
    push.mockRestore()
    replace.mockRestore()
  })

  it('still pushes a new place: another month, or another view', () => {
    page('en', '?view=month&date=2026-11-17', { docked: true })
    const push = vi.spyOn(window.history, 'pushState')
    fireEvent.click(screen.getByRole('button', { name: 'Week' }))
    expect(push).toHaveBeenLastCalledWith(null, '', '?view=week&date=2026-11-17')
    push.mockRestore()
  })

  it('opens on the day in the URL, with that day selected', () => {
    page('en', '?view=month&date=2026-11-19', { docked: true })
    expect(document.querySelector('[data-day="2026-11-19"]')).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
