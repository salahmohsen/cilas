import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { createTranslator, NextIntlClientProvider } from 'next-intl'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  calendarQuery,
  holds,
  loadedRange,
  readCalendarUrl,
} from '@/components/calendar/calendar-url'
import { usePublicCalendarAccess } from '@/components/calendar/use-public-calendar-access'
import { useSession } from '@/components/use-session'
import { publicCalendarLinks } from '@/actions/public-calendar-access'
import { loadSessionEdit } from '@/actions/session-edit'
import { saveScheduleEdits } from '@/actions/save-schedule-edits'
import { scheduleOffers } from '@/actions/schedule-offers'
import { formatsOf } from '@/i18n/formats'
import { PublicCalendar } from '@/components/calendar/public-calendar'
import { publicItems } from '@/components/calendar/public-items'
import type { CalendarMeeting } from '@/lib/calendar'

import { meeting, meetings, words } from '../../../testing/fan0-public-calendar.fixture'
import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'
import { stubPopupDom } from '../../../testing/popup-dom.test-utils'

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

vi.mock('@/components/use-session', () => ({ useSession: vi.fn(() => null) }))
vi.mock('@/actions/public-calendar-access', () => ({ publicCalendarLinks: vi.fn() }))
vi.mock('@/actions/save-schedule-edits', () => ({ saveScheduleEdits: vi.fn() }))
vi.mock('@/actions/schedule-offers', () => ({ scheduleOffers: vi.fn() }))
vi.mock('@/actions/load-calendar-items', () => ({ loadCalendarItems: vi.fn() }))
vi.mock('@/actions/session-edit', () => ({ loadSessionEdit: vi.fn() }))

// Whether the side panel sits beside the grid.
let docked: boolean | null = false
vi.mock('@/components/calendar/ui/use-narrow', () => ({
  useNarrow: () => false,
  useDocked: () => docked,
}))
vi.mock('@/lib/use-narrow', () => ({ useNarrow: () => false }))

const navigation = vi.hoisted(() => {
  const push = vi.fn()
  const replace = vi.fn()
  const refresh = vi.fn()
  return {
    params: new URLSearchParams(),
    push,
    replace,
    refresh,
    router: { push, replace, refresh },
  }
})
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useSearchParams: () => navigation.params,
  useRouter: () => navigation.router,
  usePathname: () => '/en/calendar',
}))

const kinds = (locale: 'en' | 'ar') => {
  const words = (locale === 'ar' ? ar : en).Calendar
  return {
    'course:core': { name: 'Core course', open: words.viewCourse },
    'course:thematic': { name: 'Thematic course', open: words.viewCourse },
    'event:screening': { name: 'Screening', open: words.viewEvent },
  }
}

const page = (
  locale: 'en' | 'ar' = 'en',
  query = '?view=week&date=2026-11-17',
  source: readonly CalendarMeeting[] = meetings,
) => {
  navigation.params = new URLSearchParams(query)
  window.history.replaceState(null, '', `/${locale}/calendar${query}`)
  const tree = () => (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ar' ? ar : en}
      timeZone="Africa/Cairo"
    >
      <PublicCalendar
        items={publicItems(source, words(locale))}
        range={loadedRange(new URLSearchParams(query).get('date')!)}
        today="2026-11-17"
        kinds={kinds(locale)}
        months={['2025-03', '2026-11']}
      />
    </NextIntlClientProvider>
  )
  return { tree, ...render(tree()) }
}

beforeAll(() => {
  globalThis.__UI_SDK_STRICT__ = true
  stubPopupDom()
})

beforeEach(() => {
  docked = false
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
  vi.mocked(useSession).mockReturnValue(null)
  vi.mocked(publicCalendarLinks).mockReset()
  vi.mocked(loadSessionEdit).mockReset()
  vi.mocked(saveScheduleEdits).mockReset()
  vi.mocked(scheduleOffers).mockReset()
  navigation.refresh.mockClear()
  navigation.push.mockClear()
  navigation.replace.mockClear()
  window.history.replaceState(null, '', '/en/calendar?view=week&date=2026-11-17')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('the public calendar', () => {
  it('server renders the week with each meeting as a link to its page', () => {
    navigation.params = new URLSearchParams('?view=week&date=2026-11-17')
    const html = renderToString(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
        <PublicCalendar
          items={publicItems(meetings, words('en'))}
          range={loadedRange('2026-11-17')}
          today="2026-11-17"
          kinds={kinds('en')}
          months={['2026-11']}
        />
      </NextIntlClientProvider>,
    )
    expect(html).toContain('Reading the city')
    expect(html).toContain('href="/en/study/reading-the-city#session-501"')
    expect(html).toContain('href="/en/events/film-night"')
  })

  it('opens the details on a plain press of a block, with a link to the course', async () => {
    page()
    const block = screen.getByRole('link', { name: /^Reading the city, Tuesday/ })
    expect(block).toHaveAttribute('href', '/en/study/reading-the-city#session-501')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    block.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
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
    page('en', '?view=week&date=2026-11-17', titled)
    fireEvent.click(screen.getByRole('link', { name: /^Reading the city, Tuesday/ }))
    const details = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(details).toHaveTextContent('Session 3 · \u2068What is intelligence?\u2069')
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
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
    block.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
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
    page()
    const push = vi.spyOn(window.history, 'pushState')
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    expect(push).toHaveBeenLastCalledWith(null, '', '?view=day&date=2026-11-17')
    expect(navigation.push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(navigation.push).toHaveBeenCalledWith('/en/calendar?view=month&date=2026-12-01', {
      scroll: false,
    })
    push.mockRestore()
  })

  it('follows the URL when Back changes it', () => {
    page()
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    window.history.pushState(null, '', '/en/calendar?view=day&date=2026-11-18')
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: /^Film night, Wednesday/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Reading the city, Tuesday/ })).toBeNull()
  })

  it('moves back on a quick Back after a switch, before the router has the new URL', () => {
    page()
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')
    window.history.replaceState(null, '', '/en/calendar?view=week&date=2026-11-17')
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('settles on the month the router loaded, before the router writes its URL', () => {
    const at = (query: string) => (
      <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
        <PublicCalendar
          items={publicItems(meetings, words('en'))}
          range={loadedRange(new URLSearchParams(query).get('date')!)}
          today="2026-11-17"
          kinds={kinds('en')}
          months={['2025-03', '2026-11']}
        />
      </NextIntlClientProvider>
    )
    navigation.params = new URLSearchParams('?view=month&date=2026-11-07')
    window.history.replaceState(null, '', '/en/calendar?view=month&date=2026-11-07')
    const { rerender } = render(at('?view=month&date=2026-11-07'))
    navigation.params = new URLSearchParams('?view=month&date=2026-10-07')
    rerender(at('?view=month&date=2026-10-07'))
    expect(navigation.replace).not.toHaveBeenCalled()
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
    page()
    await act(async () => {})
    expect(publicCalendarLinks).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })

  it('shows Edit after one admin access request and keeps the current date and view', async () => {
    vi.mocked(useSession).mockReturnValue({ id: 8, email: 'admin@cilas.test' })
    vi.mocked(publicCalendarLinks).mockResolvedValue({
      canEdit: true,
      editable: [],
      spaces: { '22': '/en/spaces/course/city' },
    })
    page()
    await act(async () => {})
    expect(publicCalendarLinks).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(navigation.push).toHaveBeenCalledWith('/en/calendar?view=week&date=2026-11-17&edit=1', {
      scroll: false,
    })
  })

  it.each([true, false])('shows the course links with space access %s', async (allowed) => {
    vi.mocked(useSession).mockReturnValue({ id: 8, email: 'reader@cilas.test' })
    vi.mocked(publicCalendarLinks).mockResolvedValue({
      canEdit: false,
      editable: [],
      spaces: allowed ? { '22': '/en/spaces/course/city' } : {},
    })
    const { container } = page()
    await act(async () => {})
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
  vi.mocked(useSession).mockReturnValue({ id: 8, email: 'reader@cilas.test' })
  vi.mocked(publicCalendarLinks).mockResolvedValue({
    canEdit: false,
    editable: [],
    spaces: { '22': '/en/spaces/course/city' },
  })
  page()
  await act(async () => {})
  fireEvent.click(screen.getByRole('link', { name: /^Film night, Wednesday/ }))
  const details = await screen.findByRole('dialog', { name: 'Film night' })
  expect(within(details).getByRole('link', { name: 'View event' })).toBeInTheDocument()
  expect(within(details).queryByRole('link', { name: 'Go to space' })).toBeNull()
  expect(within(details).getAllByRole('link')).toHaveLength(1)
})

it('waits for the new language before it shows a space path', async () => {
  vi.mocked(useSession).mockReturnValue({ id: 8, email: 'reader@cilas.test' })
  vi.mocked(publicCalendarLinks).mockResolvedValueOnce({
    canEdit: false,
    editable: [],
    spaces: { '22': '/en/spaces/course/city' },
  })
  let finish!: (value: Awaited<ReturnType<typeof publicCalendarLinks>>) => void
  vi.mocked(publicCalendarLinks).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { result, rerender } = renderHook(({ locale }) => usePublicCalendarAccess(['22'], locale), {
    initialProps: { locale: 'en' },
  })
  await act(async () => {})
  expect(result.current.spaces['22']).toBe('/en/spaces/course/city')
  rerender({ locale: 'ar' })
  expect(result.current.spaces).toEqual({})
  await act(async () =>
    finish({ canEdit: false, editable: [], spaces: { '22': '/ar/spaces/course/city' } }),
  )
  expect(result.current.spaces['22']).toBe('/ar/spaces/course/city')
  expect(publicCalendarLinks).toHaveBeenCalledTimes(2)
})

describe('the month panel on the public calendar, by role', () => {
  const asReader = (access: Partial<Awaited<ReturnType<typeof publicCalendarLinks>>> = {}) => {
    vi.mocked(useSession).mockReturnValue({ id: 8, email: 'reader@cilas.test' })
    vi.mocked(publicCalendarLinks).mockResolvedValue({
      canEdit: false,
      editable: [],
      spaces: {},
      ...access,
    })
  }
  const monthPage = async () => {
    docked = true
    const shown = page('en', '?view=month&date=2026-11-17')
    await act(async () => {})
    return shown
  }
  const openTuesday = async () => {
    const link = document.querySelector<HTMLElement>('[data-day="2026-11-17"] [data-block-id]')!
    fireEvent.click(link)
    return screen.findByRole('region', { name: 'Reading the city' })
  }
  const menu = async () => {
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions' }), { key: 'Enter' })
    return screen.findByRole('menu')
  }

  it('opens on today with the panel open, and no Edit session for anyone', async () => {
    asReader({ canEdit: true, editable: ['22'] })
    await monthPage()
    expect(screen.getByRole('region', { name: 'Tuesday, November 17' })).toBeInTheDocument()
    const details = await openTuesday()
    expect(within(details).queryByRole('button', { name: /Edit/ })).toBeNull()
    expect(within(details).queryByRole('link', { name: /Edit/ })).toBeNull()
  })

  it('gives a visitor View course only, and no menu', async () => {
    vi.mocked(useSession).mockReturnValue(null)
    await monthPage()
    const details = await openTuesday()
    expect(within(details).getByRole('link', { name: 'View course' })).toBeInTheDocument()
    expect(within(details).getAllByRole('link')).toHaveLength(1)
    expect(within(details).queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  it('gives a student who may not read the space View course only', async () => {
    asReader()
    await monthPage()
    const details = await openTuesday()
    expect(within(details).queryByRole('link', { name: 'Go to space' })).toBeNull()
    expect(within(details).queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  it('adds Go to space for an enrolled student, after View course', async () => {
    asReader({ spaces: { '22': '/en/spaces/course/city' } })
    await monthPage()
    const details = await openTuesday()
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
    await openTuesday()
    const entries = within(await menu()).getAllByRole('menuitem')
    expect(entries.map((entry) => entry.textContent)).toEqual(['Cancel session'])
  })

  it('gives a fellow of another course no menu', async () => {
    asReader({ editable: ['99'] })
    await monthPage()
    const details = await openTuesday()
    expect(within(details).queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  it('cancels after the confirm: one detail change, the other fields kept, then the offer', async () => {
    asReader({ editable: ['22'] })
    const values = {
      title: 'Reading the city',
      description: 'Text',
      cancelled: false,
      meetings: [],
      bibliography: [{ id: 'b1', type: 'reading' as const, title: 'A book', href: '', note: '' }],
      activities: [],
    }
    vi.mocked(loadSessionEdit).mockResolvedValue({ ok: true, values, version: 'v1' })
    vi.mocked(saveScheduleEdits).mockResolvedValue({ ok: true, items: [], before: [], after: [] })
    vi.mocked(scheduleOffers).mockResolvedValue([])
    await monthPage()
    await openTuesday()
    fireEvent.click(within(await menu()).getByRole('menuitem', { name: 'Cancel session' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this session?' })
    expect(saveScheduleEdits).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel session' }))
    await waitFor(() => expect(saveScheduleEdits).toHaveBeenCalledTimes(1))
    const { meetings: _meetings, ...rest } = values
    expect(saveScheduleEdits).toHaveBeenCalledWith(
      { details: [{ op: 'edit', id: '501', version: 'v1', values: { ...rest, cancelled: true } }] },
      'en',
    )
    await waitFor(() =>
      expect(scheduleOffers).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: '22' }),
        'en',
      ),
    )
  })

  it('shows a refused save in words and keeps the session as it was', async () => {
    asReader({ editable: ['22'] })
    vi.mocked(loadSessionEdit).mockResolvedValue({
      ok: true,
      values: {
        title: 'x',
        description: '',
        cancelled: false,
        meetings: [],
        bibliography: [],
        activities: [],
      },
      version: 'v1',
    })
    vi.mocked(saveScheduleEdits).mockResolvedValue({
      ok: false,
      error: { code: 'stale', itemId: '501' },
    })
    await monthPage()
    await openTuesday()
    fireEvent.click(within(await menu()).getByRole('menuitem', { name: 'Cancel session' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this session?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel session' }))
    expect(await screen.findByText(/Someone else changed/)).toBeInTheDocument()
    expect(scheduleOffers).not.toHaveBeenCalled()
  })

  it('offers Restore session for a cancelled meeting, with no confirm', async () => {
    asReader({ editable: ['22'] })
    vi.mocked(loadSessionEdit).mockResolvedValue({
      ok: true,
      values: {
        title: 'x',
        description: '',
        cancelled: true,
        meetings: [],
        bibliography: [],
        activities: [],
      },
      version: 'v2',
    })
    vi.mocked(saveScheduleEdits).mockResolvedValue({ ok: true, items: [], before: [], after: [] })
    vi.mocked(scheduleOffers).mockResolvedValue([])
    page('en', '?view=month&date=2026-11-21')
    docked = true
    await act(async () => {})
    fireEvent.click(document.querySelector<HTMLElement>('[data-day="2026-11-21"] [data-block-id]')!)
    fireEvent.click(within(await menu()).getByRole('menuitem', { name: 'Restore session' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(saveScheduleEdits).toHaveBeenCalledWith(
        expect.objectContaining({
          details: [
            expect.objectContaining({ values: expect.objectContaining({ cancelled: false }) }),
          ],
        }),
        'en',
      ),
    )
  })
})

describe('the selected day in the URL', () => {
  it('writes a day chosen in the month with replaceState, so Back does not step through days', async () => {
    docked = true
    page('en', '?view=month&date=2026-11-17')
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
    docked = true
    page('en', '?view=month&date=2026-11-17')
    const push = vi.spyOn(window.history, 'pushState')
    fireEvent.click(screen.getByRole('button', { name: 'Week' }))
    expect(push).toHaveBeenLastCalledWith(null, '', '?view=week&date=2026-11-17')
    push.mockRestore()
  })

  it('opens on the day in the URL, with that day selected', () => {
    docked = true
    page('en', '?view=month&date=2026-11-19')
    expect(document.querySelector('[data-day="2026-11-19"]')).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
