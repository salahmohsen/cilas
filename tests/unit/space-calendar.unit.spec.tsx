// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'

import { loadCalendarItems } from '@/actions/load-calendar-items'
import { SpaceCalendar } from '@/components/space/space-calendar'
import { SpaceViews } from '@/components/space/space-views'
import { openingDay, type CalendarItem } from '@/lib/calendar-items'
import en from '../../messages/en.json'
import ar from '../../messages/ar.json'
import { stubPopupDom } from '../helpers/popup-dom'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))
vi.mock('@/actions/load-calendar-items', () => ({ loadCalendarItems: vi.fn() }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: keyof typeof en.Spaces) => en.Spaces[key],
}))

const item = (id: string, date: string, extra: Partial<CalendarItem> = {}): CalendarItem => ({
  id,
  kind: 'session',
  title: id,
  tone: 'blue',
  cancelled: false,
  version: 'v1',
  blocks: [{ id, date, start_time: '19:00', end_time: '21:00' }],
  ...extra,
})
const items = [
  item('old', '2026-11-03'),
  item('next', '2026-11-17'),
  item('last', '2026-11-24'),
  item('space-event:42', '2026-11-18', {
    kind: 'space-event',
    title: 'Gathering',
    tone: 'neutral',
    readOnly: true,
    blocks: [{ id: '42', date: '2026-11-18', start_time: '17:00', end_time: '18:00' }],
  }),
]
const wrap = (children: React.ReactNode, locale = 'en') => (
  <NextIntlClientProvider
    locale={locale}
    messages={locale === 'ar' ? ar : en}
    timeZone="Africa/Cairo"
  >
    {children}
  </NextIntlClientProvider>
)
beforeAll(stubPopupDom)
beforeEach(() => {
  // Each test, not once: under --no-isolate another file's environment can drop it between tests.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  localStorage.clear()
  push.mockReset()
  vi.useFakeTimers({ now: new Date('2026-11-15T10:00:00Z'), toFake: ['Date'] })
  vi.mocked(loadCalendarItems).mockResolvedValue({ ok: true, items, canEdit: true })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('offers Calendar next to Syllabus only for a course and navigates with tab=calendar', () => {
  render(wrap(<SpaceViews path="/en/spaces/course/probe" value="calendar" hasCourse />))
  const calendar = screen.getByRole('button', { name: 'Calendar' })
  expect(calendar).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Syllabus' })).toBeInTheDocument()
  fireEvent.click(calendar)
  expect(push).toHaveBeenCalledWith('/en/spaces/course/probe?tab=calendar', { scroll: false })
  cleanup()
  render(wrap(<SpaceViews path="/en/spaces/cohort/probe" value="all" hasCourse={false} />))
  expect(screen.queryByRole('button', { name: 'Calendar' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Syllabus' })).toBeNull()
})

it('server renders the next week and both legend kinds in view mode, with Edit for an editor', async () => {
  const node = wrap(
    await SpaceCalendar({ id: 7, courseId: 3, locale: 'en', spaceHref: '/en/spaces/course/probe' }),
  )
  const html = renderToString(node)
  expect(html).toContain('Nov 14 to Nov 20, 2026')
  expect(html).toContain('Gathering')
  render(node)
  expect(loadCalendarItems).toHaveBeenCalledWith({ kind: 'space', id: '7' }, 'en')
  expect(screen.getByRole('group', { name: 'Calendar' })).toBeInTheDocument()
  // The Edit button sits in the calendar's toolbar; the colour key in its side panel.
  expect(screen.getByRole('button', { name: 'Edit' }).closest('header')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: en.CalendarUi.panel }))
  const key = screen.getByRole('group', { name: en.CalendarUi.legend })
  expect(within(key).getByText(en.SpacePost.scheduleKind)).toBeInTheDocument()
  expect(within(key).getByText(en.Spaces.calendarEvents)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Save/ })).toBeNull()
  expect(document.querySelector('[data-mode="edit"]')).toBeNull()
  window.history.replaceState(null, '', '/en/spaces/course/probe?tab=calendar')
  fireEvent.click(screen.getByRole('button', { name: /^next, Tuesday/ }))
  // Decision 17: a press on a session opens the drawer at once, with no details popover.
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(push).not.toHaveBeenCalled()
  expect(window.location.search).toBe('?tab=calendar&open=next')
  // A space event opens its post.
  fireEvent.click(screen.getByRole('button', { name: /^Gathering, Wednesday/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(push).toHaveBeenLastCalledWith('/en/spaces/course/probe/posts/42')
})

it('opens the last meeting week after the course ends and ignores later space events', async () => {
  vi.setSystemTime(new Date('2027-01-01T10:00:00Z'))
  vi.mocked(loadCalendarItems).mockResolvedValue({
    ok: true,
    canEdit: false,
    items: [...items, item('space-event:99', '2027-02-01', { kind: 'space-event' })],
  })
  render(wrap(await SpaceCalendar({ id: 7, courseId: 3, locale: 'en', spaceHref: '/probe' })))
  expect(screen.getByText('Nov 21 to Nov 27, 2026')).toBeInTheDocument()
  // A reader (canEdit false) gets no Edit in the toolbar; a press opens the drawer, not a popover.
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^last, Tuesday/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(window.location.search).toContain('open=last')
})

it('renders Arabic calendar controls and both legend names in RTL', async () => {
  render(
    <div dir="rtl">
      {wrap(
        await SpaceCalendar({ id: 7, courseId: 3, locale: 'ar', spaceHref: '/ar/probe' }),
        'ar',
      )}
    </div>,
  )
  expect(screen.getByRole('group', { name: /^التقويم$/ }).closest('[dir]')).toHaveAttribute(
    'dir',
    'rtl',
  )
  fireEvent.click(screen.getByRole('button', { name: ar.CalendarUi.panel }))
  const key = screen.getByRole('group', { name: ar.CalendarUi.legend })
  expect(within(key).getByText(ar.SpacePost.scheduleKind)).toBeInTheDocument()
  expect(within(key).getByText(ar.Spaces.calendarEvents)).toBeInTheDocument()
})

it('shows a visible load failure', async () => {
  vi.mocked(loadCalendarItems).mockResolvedValue({ ok: false, error: { code: 'forbidden' } })
  render(wrap(await SpaceCalendar({ id: 7, courseId: 3, locale: 'en', spaceHref: '/probe' })))
  expect(screen.getByText(en.Spaces.calendarFailed)).toBeInTheDocument()
})

it('chooses the next held day, including today, then the last held day; empty has no preference', () => {
  const meetings = [
    item('late', '2026-12-01'),
    item('early', '2026-11-01'),
    item('cancelled', '2026-11-16', { cancelled: true }),
  ]
  expect(openingDay(meetings, '2026-11-15')).toBe('2026-12-01')
  expect(openingDay(meetings, '2026-12-01')).toBe('2026-12-01')
  expect(openingDay(meetings, '2027-01-01')).toBe('2026-12-01')
  expect(openingDay([], '2026-11-15')).toBeUndefined()
  expect(
    openingDay([item('cancelled', '2026-12-01', { cancelled: true })], '2026-11-15'),
  ).toBeUndefined()
})
