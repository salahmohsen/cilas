import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { SpaceCalendarTab } from '@/components/space/space-calendar-tab'
import { SpaceViews } from '@/components/space/space-views'
import { cairoDay } from '@/lib/cairo-day'
import { openingDay, type CalendarItem } from '@/lib/calendar-items'

import { IntlProvider, messagesOf } from '../../../testing/intl.test-utils'
import {
  NavigationProvider,
  createMemoryRouter,
  renderWithNavigation,
} from '../../../testing/navigation.test-utils'

const en = messagesOf.en
const ar = messagesOf.ar

const item = (id: string, date: string, extra: Partial<CalendarItem> = {}) =>
  ({
    id,
    kind: 'session',
    title: id,
    tone: 'blue',
    cancelled: false,
    version: 'v1',
    blocks: [{ id, date, start_time: '19:00', end_time: '21:00' }],
    ...extra,
  }) satisfies CalendarItem
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

const tab = (
  tabItems: CalendarItem[],
  { canEdit, spaceHref = '/en/spaces/course/probe' }: { canEdit: boolean; spaceHref?: string },
) => (
  <SpaceCalendarTab
    spaceId="7"
    courseId="3"
    items={tabItems}
    canEdit={canEdit}
    day={openingDay(
      tabItems.filter((entry) => entry.kind === 'session'),
      cairoDay(new Date())!,
    )}
    spaceHref={spaceHref}
  />
)

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', window.location.pathname)
  vi.useFakeTimers({ now: new Date('2026-11-15T10:00:00Z'), toFake: ['Date'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('offers Calendar next to Syllabus only for a course and navigates with tab=calendar', () => {
  const { memory } = renderWithNavigation(
    <IntlProvider>
      <SpaceViews path="/en/spaces/course/probe" value="calendar" hasCourse />
    </IntlProvider>,
  )
  const calendar = screen.getByRole('button', { name: 'Calendar' })
  expect(calendar).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Syllabus' })).toBeInTheDocument()
  fireEvent.click(calendar)
  expect(memory.visits).toEqual([
    {
      method: 'push',
      href: '/en/spaces/course/probe?tab=calendar',
      options: { scroll: false },
    },
  ])
  cleanup()
  renderWithNavigation(
    <IntlProvider>
      <SpaceViews path="/en/spaces/cohort/probe" value="all" hasCourse={false} />
    </IntlProvider>,
  )
  expect(screen.queryByRole('button', { name: 'Calendar' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Syllabus' })).toBeNull()
})

it('server renders the next week and both legend kinds in view mode, with Edit for an editor', () => {
  const node = <IntlProvider>{tab(items, { canEdit: true })}</IntlProvider>
  const html = renderToString(
    <NavigationProvider memory={createMemoryRouter('/')}>{node}</NavigationProvider>,
  )
  expect(html).toContain('Nov 14 to Nov 20, 2026')
  expect(html).toContain('Gathering')
  const { memory } = renderWithNavigation(node)
  expect(screen.getByRole('group', { name: 'Calendar' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit' }).closest('header')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: en.CalendarUi.panel }))
  const key = screen.getByRole('group', { name: en.CalendarUi.legend })
  expect(within(key).getByText(en.SpacePost.scheduleKind)).toBeInTheDocument()
  expect(within(key).getByText(en.Spaces.calendarEvents)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Save/ })).toBeNull()
  expect(document.querySelector('[data-mode="edit"]')).toBeNull()
  window.history.replaceState(null, '', '?tab=calendar')
  fireEvent.click(screen.getByRole('button', { name: /^next, Tuesday/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(memory.visits).toEqual([])
  expect(window.location.search).toBe('?tab=calendar&open=next')
  fireEvent.click(screen.getByRole('button', { name: /^Gathering, Wednesday/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(memory.visits.at(-1)).toMatchObject({
    method: 'push',
    href: '/en/spaces/course/probe/posts/42',
  })
})

it('opens the last meeting week after the course ends and ignores later space events', () => {
  vi.setSystemTime(new Date('2027-01-01T10:00:00Z'))
  renderWithNavigation(
    <IntlProvider>
      {tab([...items, item('space-event:99', '2027-02-01', { kind: 'space-event' })], {
        canEdit: false,
        spaceHref: '/probe',
      })}
    </IntlProvider>,
  )
  expect(screen.getByText('Nov 21 to Nov 27, 2026')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^last, Tuesday/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(window.location.search).toContain('open=last')
})

it('renders Arabic calendar controls and both legend names in RTL', () => {
  renderWithNavigation(
    <div dir="rtl">
      <IntlProvider locale="ar">
        {tab(items, { canEdit: true, spaceHref: '/ar/probe' })}
      </IntlProvider>
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
