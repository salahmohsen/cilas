import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '@/components/calendar/ui/calendar'
import type { CalendarView } from '@/components/calendar/ui/calendar-views'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import en from '../../../messages/en.json'

// The width the calendar measures: null before it is measured, as on the server.
let narrow: boolean | null = false
vi.mock('@/components/calendar/ui/use-narrow', () => ({ useNarrow: () => narrow }))

const item = (
  id: string,
  title: string,
  blocks: CalendarItem['blocks'],
  extra: Partial<CalendarItem> = {},
): CalendarItem => ({
  id,
  kind: 'session',
  title,
  tone: 'yellow',
  cancelled: false,
  version: `v-${id}`,
  blocks,
  ...extra,
})

// The week of Saturday 14 November 2026; today is Tuesday 17.
const items: CalendarItem[] = [
  item('week-3', 'Week 3', [
    { id: 'tue', date: '2026-11-17', start_time: '19:00', end_time: '21:00' },
  ]),
  item('lab', 'Studio lab', [
    { id: 'sat', date: '2026-11-14', start_time: '10:00', end_time: '13:00' },
    { id: 'sat-2', date: '2026-11-14', start_time: '08:30', end_time: '09:30' },
  ]),
  item('open', 'Open day', [{ id: 'wed', date: '2026-11-18', start_time: null, end_time: null }]),
  item(
    'film',
    'Film night',
    [{ id: 'fri', date: '2026-11-20', start_time: '17:00', end_time: '18:30' }],
    { cancelled: true },
  ),
  item('week-5', 'Week 5', [
    { id: 'next', date: '2026-11-26', start_time: '19:00', end_time: '21:00' },
  ]),
]

function Host({
  mode = 'view',
  onOpen = vi.fn(),
  view,
}: {
  mode?: 'view' | 'edit'
  onOpen?: (itemId: string, blockId: string | null) => void
  view?: CalendarView
}) {
  const labels = useCalendarLabels({ kind: () => 'Session', newItem: 'New session' })
  const shared = { items, labels, locale: 'en', day: '2026-11-17', view, onOpen }
  return mode === 'edit' ? (
    <Calendar {...shared} mode="edit" onSave={vi.fn()} />
  ) : (
    <Calendar {...shared} mode="view" />
  )
}

const tree = (props: Parameters<typeof Host>[0] = {}) => (
  <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
    <Host {...props} />
  </NextIntlClientProvider>
)
const show = (props: Parameters<typeof Host>[0] = {}) => render(tree(props))

const viewSwitch = () => screen.getByRole('group', { name: 'View' })
const options = () =>
  within(viewSwitch())
    .getAllByRole('button')
    .map((button) => [button.textContent, button.getAttribute('aria-pressed')])
const pick = (name: string) => fireEvent.click(within(viewSwitch()).getByRole('button', { name }))
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
/** The days the grid shows, by their names. */
const shownDays = () =>
  [...document.querySelectorAll('[data-track]')].map((track) => track.getAttribute('aria-label'))

beforeAll(() => {
  Element.prototype.getAnimations ??= () => []
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
beforeEach(() => {
  narrow = false
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
})
afterEach(() => vi.useRealTimers())

describe('the view switch', () => {
  it.each([false, true])(
    'keeps the server switch and its IDs when width becomes %s',
    (measured) => {
      narrow = null
      const page = show()
      const selector = `[data-width="${measured ? 'narrow' : 'wide'}"] button`
      const button = page.container.querySelector(selector)
      const id = button?.id
      narrow = measured
      page.rerender(tree())
      expect(page.container.querySelector(selector)).toBe(button)
      expect(page.container.querySelector(selector)?.id).toBe(id)
    },
  )
  it('offers Month, Week, Day and Agenda on a wide calendar, the week selected', () => {
    show()
    expect(options()).toEqual([
      ['Month', 'false'],
      ['Week', 'true'],
      ['Day', 'false'],
      ['Agenda', 'false'],
    ])
    expect(shownDays()).toHaveLength(7)
  })

  it('is one tab stop, and arrow keys choose and focus the next view', () => {
    show()
    const [month, week, day, agenda] = within(viewSwitch()).getAllByRole('button')
    expect([month, week, day, agenda].map((button) => button!.tabIndex)).toEqual([-1, 0, -1, -1])
    week!.focus()
    fireEvent.keyDown(week!, { key: 'ArrowRight' })
    expect(day).toHaveFocus()
    expect(day).toHaveAttribute('aria-pressed', 'true')
    expect(shownDays()).toEqual(['Tuesday, November 17'])
    fireEvent.keyDown(day!, { key: 'End' })
    expect(agenda).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('list', { name: 'Tuesday Nov 17' })).toBeInTheDocument()
  })

  it('offers 3 days, Day and Agenda on a phone, and opens on the Day', () => {
    narrow = true
    show()
    expect(options()).toEqual([
      ['3 days', 'false'],
      ['Day', 'true'],
      ['Agenda', 'false'],
    ])
    expect(shownDays()).toEqual(['Tuesday, November 17'])
  })

  it('opens in the view the host asks for', () => {
    show({ view: 'agenda' })
    expect(options()[3]).toEqual(['Agenda', 'true'])
  })
})

describe('the day and 3 days views', () => {
  it('moves the Day view one day at a time, and Today goes back', () => {
    show()
    pick('Day')
    press('Next day')
    expect(shownDays()).toEqual(['Wednesday, November 18'])
    expect(screen.getByRole('button', { name: /^Open day, Wednesday/ })).toBeInTheDocument()
    press('Previous day')
    press('Previous day')
    expect(shownDays()).toEqual(['Monday, November 16'])
    press('Today')
    expect(shownDays()).toEqual(['Tuesday, November 17'])
    expect(screen.getByText('Tuesday, Nov 17, 2026')).toBeInTheDocument()
  })

  it('shows three days from the day on a phone and moves three days at a time', () => {
    narrow = true
    show()
    pick('3 days')
    expect(shownDays()).toEqual([
      'Tuesday, November 17',
      'Wednesday, November 18',
      'Thursday, November 19',
    ])
    press('Next 3 days')
    expect(shownDays()).toEqual([
      'Friday, November 20',
      'Saturday, November 21',
      'Sunday, November 22',
    ])
    expect(screen.getByRole('button', { name: /^Film night, Friday/ })).toBeInTheDocument()
  })

  it('takes the week back on a wide calendar after 3 days on a phone', () => {
    narrow = true
    const { rerender } = show()
    pick('3 days')
    narrow = false
    rerender(tree())
    expect(options()[1]).toEqual(['Week', 'true'])
    expect(shownDays()).toHaveLength(7)
  })
})

describe('the agenda', () => {
  it('lists the week by day, each day in time order, all day first', () => {
    show({ view: 'agenda' })
    expect(document.querySelectorAll('ul[aria-labelledby]')).toHaveLength(4)
    expect(
      within(screen.getByRole('list', { name: 'Saturday Nov 14' }))
        .getAllByRole('button')
        .map((row) => row.getAttribute('aria-label')),
    ).toEqual([
      'Studio lab, Saturday, November 14, 8:30 AM to 9:30 AM',
      'Studio lab, Saturday, November 14, 10 AM to 1 PM',
    ])
    expect(
      within(screen.getByRole('list', { name: 'Wednesday Nov 18' })).getByRole('button'),
    ).toHaveTextContent('All day')
    expect(screen.queryByText('Week 5')).toBeNull()
  })

  it('opens an item from its row, as a block does', () => {
    const onOpen = vi.fn()
    show({ view: 'agenda', onOpen })
    press('Week 3, Tuesday, November 17, 7 PM to 9 PM')
    expect(onOpen).toHaveBeenCalledWith('week-3', 'tue')
  })

  it('says a cancelled item is cancelled, in words and in its name', () => {
    show({ view: 'agenda' })
    const film = screen.getByRole('button', {
      name: 'Film night, Friday, November 20, 5 PM to 6:30 PM, Cancelled',
    })
    expect(film).toHaveAttribute('data-cancelled')
    expect(film).toHaveTextContent('Cancelled')
  })

  it('says only a short line when the range is empty, and moves a week at a time', () => {
    show({ view: 'agenda' })
    press('Next week')
    expect(screen.getByText('Week 5')).toBeInTheDocument()
    press('Next week')
    expect(screen.getByText('Nothing scheduled this week')).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('runs two weeks from the day on a phone', () => {
    narrow = true
    show()
    pick('Agenda')
    expect(screen.getByText('Week 5')).toBeInTheDocument()
    expect(screen.queryByText('Studio lab')).toBeNull()
    press('Next 2 weeks')
    expect(screen.getByText('Nothing scheduled in these 2 weeks')).toBeInTheDocument()
  })

  it('in edit mode shows unsaved changes and moves nothing', () => {
    show({ mode: 'edit' })
    const block = screen.getByRole('button', { name: /^Week 3, Tuesday/ })
    block.focus()
    fireEvent.keyDown(block, { key: 'ArrowDown' })
    pick('Agenda')
    expect(document.querySelector('[data-track]')).toBeNull()
    const row = screen.getByRole('button', {
      name: 'Week 3, Tuesday, November 17, 7:15 PM to 9:15 PM, Unsaved',
    })
    expect(row).toHaveAttribute('data-unsaved')
    fireEvent.keyDown(row, { key: 'ArrowDown' })
    expect(row).toHaveAccessibleName('Week 3, Tuesday, November 17, 7:15 PM to 9:15 PM, Unsaved')
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })
})

describe('the first render', () => {
  it('sends both switches from the server, the week for wide and the Day for a phone', () => {
    narrow = null
    const html = renderToString(tree())
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const pressed = [...doc.querySelectorAll('[data-width]')].map((switcher) => [
      switcher.getAttribute('data-width'),
      switcher.querySelector('[aria-pressed="true"]')?.textContent,
    ])
    expect(pressed).toEqual([
      ['wide', 'Week'],
      ['narrow', 'Day'],
    ])
    expect(
      doc
        .querySelector('[data-view="week"] [data-track][data-selected]')
        ?.getAttribute('data-track'),
    ).toBe('2026-11-17')
  })

  it('hydrates the server markup with no mismatch', async () => {
    narrow = null
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const host = document.createElement('div')
    host.innerHTML = renderToString(tree())
    document.body.append(host)
    await act(async () => {
      hydrateRoot(host, tree())
    })
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
    host.remove()
  })
})
