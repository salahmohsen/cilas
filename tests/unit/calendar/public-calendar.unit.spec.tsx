import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  calendarQuery,
  holds,
  loadedRange,
  readCalendarUrl,
} from '@/components/calendar/calendar-url'
import { PublicCalendar } from '@/components/calendar/public-calendar'
import { publicItems } from '@/components/calendar/public-items'
import type { CalendarMeeting } from '@/lib/calendar'

import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'
import { stubPopupDom } from '../../helpers/popup-dom'

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

vi.mock('@/components/calendar/ui/use-narrow', () => ({ useNarrow: () => false }))
vi.mock('@/lib/use-narrow', () => ({ useNarrow: () => false }))

const navigation = vi.hoisted(() => {
  const push = vi.fn()
  const replace = vi.fn()
  return { params: new URLSearchParams(), push, replace, router: { push, replace } }
})
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useSearchParams: () => navigation.params,
  useRouter: () => navigation.router,
  usePathname: () => '/en/calendar',
}))

describe('the calendar URL', () => {
  const today = '2026-11-17'

  it('reads the old views and the new ones', () => {
    expect(readCalendarUrl({ view: 'month', date: '2026-03-11' }, today)).toEqual({
      view: 'month',
      day: '2026-03-11',
    })
    expect(readCalendarUrl({ view: 'week', date: '2026-03-11' }, today).view).toBe('week')
    expect(readCalendarUrl({ view: 'agenda', date: '2026-03-11' }, today).view).toBe('agenda')
    expect(readCalendarUrl({ view: 'day', date: '2026-03-11' }, today).view).toBe('day')
    expect(readCalendarUrl({ view: '3days', date: '2026-03-11' }, today).view).toBe('threeDays')
  })

  it('falls back to the month of today for what it cannot read', () => {
    expect(readCalendarUrl({}, today)).toEqual({ view: 'month', day: today })
    expect(readCalendarUrl({ view: 'year', date: 'soon' }, today)).toEqual({
      view: 'month',
      day: today,
    })
    expect(readCalendarUrl({ view: ['week', 'day'], date: '2026-02-30' }, today)).toEqual({
      view: 'month',
      day: today,
    })
  })

  it('writes every view back to a URL that reads the same', () => {
    for (const view of ['month', 'week', 'day', 'threeDays', 'agenda'] as const) {
      const params = new URLSearchParams(calendarQuery(view, '2026-03-11'))
      expect(
        readCalendarUrl({ view: params.get('view'), date: params.get('date') }, today),
      ).toEqual({ view, day: '2026-03-11' })
    }
    expect(calendarQuery('threeDays', '2026-03-11')).toBe('?view=3days&date=2026-03-11')
  })

  it("loads the month's whole weeks and two weeks from the day", () => {
    // March 2026 starts on a Sunday: its grid starts on Saturday 28 February.
    expect(loadedRange('2026-03-11')).toEqual({ from: '2026-02-28', to: '2026-04-03' })
    expect(loadedRange('2026-03-30')).toEqual({ from: '2026-02-28', to: '2026-04-12' })
  })

  it('knows which views the loaded days hold', () => {
    const range = loadedRange('2026-03-11')
    expect(holds(range, 'week', '2026-03-28')).toBe(true)
    expect(holds(range, 'week', '2026-04-04')).toBe(false)
    expect(holds(range, 'month', '2026-04-01')).toBe(false)
    expect(holds(range, 'agenda', '2026-03-20')).toBe(true)
    expect(holds(range, 'agenda', '2026-03-25')).toBe(false)
  })
})

const meeting = (over: Partial<CalendarMeeting>): CalendarMeeting => ({
  key: 's1-2026-11-17-1900',
  item: 's1',
  kind: 'course',
  title: 'Reading the city',
  href: '/study/reading-the-city',
  date: '2026-11-17',
  start: '19:00',
  end: '21:00',
  session: 3,
  type: 'thematic',
  place: 'Online',
  ...over,
})

const meetings: CalendarMeeting[] = [
  meeting({
    cover: { url: '/media/city.jpg', alt: 'A street', focalX: 20, focalY: 80 },
  }),
  meeting({ key: 's1-2026-11-19-1900', date: '2026-11-19' }),
  meeting({ key: 's1-2026-11-21-1900', date: '2026-11-21', cancelled: true }),
  meeting({
    key: 'e4-0',
    item: 'e4',
    kind: 'event',
    title: 'Film night',
    href: '/events/film-night',
    date: '2026-11-18',
    start: '18:00',
    end: '20:00',
    session: undefined,
    type: 'screening',
    place: undefined,
  }),
  meeting({
    key: 's7-2026-11-18-1000',
    item: 's7',
    type: 'core',
    title: 'Core seminar',
    date: '2026-11-18',
    start: '10:00',
    end: '12:00',
    session: 1,
  }),
]

describe('publicItems', () => {
  const items = publicItems(meetings, { locale: 'en', session: (n) => `Session ${n}` })

  it('makes a session one item with its meetings as blocks, its cancelled ones apart', () => {
    const held = items.find((item) => item.id === 's1')!
    expect(held.blocks.map((block) => block.date)).toEqual(['2026-11-17', '2026-11-19'])
    expect(held).toMatchObject({
      kind: 'course:thematic',
      title: 'Reading the city',
      caption: 'Session 3',
      place: 'Online',
      tone: 'blue',
      cancelled: false,
      readOnly: true,
      href: '/en/study/reading-the-city',
      image: { url: '/media/city.jpg', alt: 'A street', position: '20% 80%' },
    })
    expect(items.find((item) => item.id === 's1-cancelled')).toMatchObject({
      cancelled: true,
      blocks: [
        { id: 's1-2026-11-21-1900', date: '2026-11-21', start_time: '19:00', end_time: '21:00' },
      ],
    })
  })

  it('lists courses before events, each by type', () => {
    expect(items.map((item) => item.kind)).toEqual([
      'course:core',
      'course:thematic',
      'course:thematic',
      'event:screening',
    ])
    expect(items.at(-1)).toMatchObject({ href: '/en/events/film-night', title: 'Film night' })
    expect(items.at(-1)).not.toHaveProperty('caption')
  })
})

const kinds = (locale: 'en' | 'ar') => {
  const words = (locale === 'ar' ? ar : en).Calendar
  return {
    'course:core': { name: 'Core course', open: words.viewCourse },
    'course:thematic': { name: 'Thematic course', open: words.viewCourse },
    'event:screening': { name: 'Screening', open: words.viewEvent },
  }
}

const page = (locale: 'en' | 'ar' = 'en', query = '?view=week&date=2026-11-17') => {
  navigation.params = new URLSearchParams(query)
  const tree = () => (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ar' ? ar : en}
      timeZone="Africa/Cairo"
    >
      <PublicCalendar
        items={publicItems(meetings, { locale, session: (n) => `Session ${n}` })}
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
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
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
          items={publicItems(meetings, { locale: 'en', session: (n) => `Session ${n}` })}
          range={loadedRange('2026-11-17')}
          today="2026-11-17"
          kinds={kinds('en')}
          months={['2026-11']}
        />
      </NextIntlClientProvider>,
    )
    expect(html).toContain('Reading the city')
    expect(html).toContain('href="/en/study/reading-the-city"')
    expect(html).toContain('href="/en/events/film-night"')
  })

  it('opens the details on a plain press of a block, with a link to the course', async () => {
    page()
    const block = screen.getByRole('link', { name: /^Reading the city, Tuesday/ })
    expect(block).toHaveAttribute('href', '/en/study/reading-the-city')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    block.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    const details = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(within(details).getByText('Session 3')).toBeInTheDocument()
    expect(within(details).getByText('Online')).toBeInTheDocument()
    expect(within(details).getByRole('img', { name: 'A street' })).toBeInTheDocument()
    expect(within(details).getByRole('link', { name: 'View course' })).toHaveAttribute(
      'href',
      '/en/study/reading-the-city',
    )
    expect(within(details).queryByRole('button', { name: /Edit/ })).toBeNull()
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
    expect(navigation.push).toHaveBeenCalledWith('/en/calendar?view=month&date=2026-12-17', {
      scroll: false,
    })
    push.mockRestore()
  })

  it('follows the URL when Back changes it', () => {
    const { rerender, tree } = page()
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    navigation.params = new URLSearchParams('?view=day&date=2026-11-18')
    rerender(tree())
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: /^Film night, Wednesday/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Reading the city, Tuesday/ })).toBeNull()
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
