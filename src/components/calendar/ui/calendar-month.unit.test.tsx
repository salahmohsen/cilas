import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CalendarAction } from '@/components/calendar/ui/block-details'
import { Calendar } from '@/components/calendar/ui/calendar'
import { formatShortTime } from '@/components/calendar/ui/calendar-time'
import type { CalendarView } from '@/components/calendar/ui/calendar-views'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import ar from '../../../../messages/ar.json'
import en from '../../../../messages/en.json'
import { stubPopupDom } from '../../../../testing/popup-dom.test-utils'

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

// The calendar's measured width: null before it is measured, as on the server.
let narrow: boolean | null = false
// Whether the side panel sits beside the grid.
const docked: boolean | null = false
vi.mock('@/components/calendar/ui/use-narrow', () => ({
  useNarrow: () => narrow,
  useDocked: () => docked,
}))
vi.mock('@/lib/use-narrow', () => ({ useNarrow: () => false }))

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
const at = (id: string, date: string, start: string, end: string) => ({
  id,
  date,
  start_time: start,
  end_time: end,
})
const allDay = (id: string, date: string) => ({ id, date, start_time: null, end_time: null })

// November 2026: Sunday 1 to Monday 30, five weeks from Saturday 31 October. Today is Tuesday 17.
const items: CalendarItem[] = [
  item('week-3', 'Week 3', [at('tue', '2026-11-17', '19:00', '21:00')]),
  item('lab', 'Studio lab', [at('sat', '2026-11-14', '10:30', '13:00')], { tone: 'green' }),
  // Wednesday 18 to Saturday 21: one bar to Friday, a second in the next week's row.
  item(
    'fair',
    'Book fair',
    ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'].map((day) => allDay(day, day)),
    { kind: 'event', tone: 'pink' },
  ),
  item('film', 'Film night', [at('fri', '2026-11-20', '17:00', '18:30')], { cancelled: true }),
  // Four meetings on Monday 23: two fit, then "2 more".
  ...['09:00', '11:00', '13:00', '15:00'].map((time, index) =>
    item(`busy-${index}`, `Busy ${index + 1}`, [
      at(`m${index}`, '2026-11-23', time, `${Number(time.slice(0, 2)) + 1}:00`),
    ]),
  ),
  item('later', 'December talk', [at('dec', '2026-12-17', '18:00', '19:00')]),
]

function Host({
  mode = 'view',
  view = 'month',
  actions,
  onOpen,
  locale = 'en',
}: {
  mode?: 'view' | 'edit'
  view?: CalendarView
  actions?: CalendarAction[]
  onOpen: (itemId: string, blockId: string | null) => void
  locale?: string
}) {
  const labels = useCalendarLabels({ kind: () => 'Session', newItem: 'New session' })
  const shared = {
    items,
    labels,
    locale,
    day: '2026-11-17',
    view,
    onOpen,
    actionsOf: actions ? () => actions : undefined,
  }
  return mode === 'view' ? (
    <Calendar mode="view" {...shared} />
  ) : (
    <Calendar mode="edit" {...shared} onSave={vi.fn()} newItemKind="session" />
  )
}

const tree = (props: Partial<Parameters<typeof Host>[0]> = {}, onOpen = vi.fn()) => (
  <NextIntlClientProvider
    locale={props.locale ?? 'en'}
    messages={props.locale === 'ar' ? ar : en}
    timeZone="Africa/Cairo"
  >
    <Host onOpen={onOpen} {...props} />
  </NextIntlClientProvider>
)
const show = (props: Partial<Parameters<typeof Host>[0]> = {}) => {
  const onOpen = vi.fn()
  render(tree(props, onOpen))
  return { onOpen }
}

const grid = () => screen.getByRole('grid')
const day = (date: string) => grid().querySelector<HTMLElement>(`[data-day="${date}"]`)!
const viewSwitch = (name = 'View') => screen.getByRole('group', { name })
const choices = (name?: string) =>
  within(viewSwitch(name))
    .getAllByRole('button')
    .map((button) => button.textContent)
const chosen = () =>
  within(viewSwitch())
    .getAllByRole('button')
    .find((button) => button.getAttribute('aria-pressed') === 'true')?.textContent
const pressKey = (key: string) => fireEvent.keyDown(document.activeElement!, { key })

beforeAll(() => {
  globalThis.__UI_SDK_STRICT__ = true
  stubPopupDom()
})
beforeEach(() => {
  narrow = false
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('the month view', () => {
  it('comes first in the wide switch and is not offered on a phone', () => {
    show()
    expect(choices()).toEqual(['Month', 'Week', 'Day', 'Agenda'])
    expect(chosen()).toBe('Month')
    cleanup()
    narrow = true
    show()
    expect(choices()).toEqual(['3 days', 'Day', 'Agenda'])
  })

  it('shows a month a phone opens in as the agenda of that month', () => {
    narrow = true
    show()
    expect(screen.queryByRole('grid')).toBeNull()
    expect(chosen()).toBe('Agenda')
    expect(screen.getByRole('button', { name: /^Studio lab, Saturday/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Busy 4, Monday/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^December talk/ })).toBeNull()
  })

  it('is a named grid of weeks from Saturday, with the month and year and no week label', () => {
    show()
    expect(grid()).toHaveAccessibleName('November 2026')
    expect(screen.getByText('November 2026', { selector: 'span' })).toBeInTheDocument()
    const rows = within(grid()).getAllByRole('row')
    expect(rows).toHaveLength(6)
    expect(
      within(rows[0]!)
        .getAllByRole('columnheader')
        .map((head) => head.textContent),
    ).toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    const cells = within(grid()).getAllByRole('gridcell')
    expect(cells).toHaveLength(35)
    expect(cells[0]).toHaveAttribute('data-outside')
    expect(cells[0]).toHaveTextContent('Saturday, October 31')
    expect(cells.at(-1)).toHaveTextContent('Friday, December 4')
    expect(day('2026-11-17')).toHaveAttribute('aria-current', 'date')
    expect(day('2026-11-20')).toHaveAttribute('data-weekend')
  })

  it('is one tab stop, on the day it opens on; its chips are reached from the day', () => {
    show()
    const stops = within(grid())
      .getAllByRole('gridcell')
      .filter((cell) => cell.tabIndex === 0)
    expect(stops).toEqual([day('2026-11-17')])
    for (const button of within(grid()).getAllByRole('button')) expect(button.tabIndex).toBe(-1)
  })

  it('moves a day with Left and Right and a week with Up and Down', () => {
    show()
    act(() => day('2026-11-17').focus())
    pressKey('ArrowRight')
    expect(day('2026-11-18')).toHaveFocus()
    pressKey('ArrowDown')
    expect(day('2026-11-25')).toHaveFocus()
    pressKey('ArrowLeft')
    expect(day('2026-11-24')).toHaveFocus()
    pressKey('ArrowUp')
    expect(day('2026-11-17')).toHaveFocus()
    expect(day('2026-11-17').tabIndex).toBe(0)
  })

  it('turns the month with Page Down, Page Up and an arrow past the edge, focus on the day', () => {
    show()
    act(() => day('2026-11-17').focus())
    pressKey('PageDown')
    expect(grid()).toHaveAccessibleName('December 2026')
    expect(day('2026-12-17')).toHaveFocus()
    pressKey('PageUp')
    expect(grid()).toHaveAccessibleName('November 2026')
    expect(day('2026-11-17')).toHaveFocus()
    act(() => day('2026-11-03').focus())
    pressKey('ArrowUp')
    expect(grid()).toHaveAccessibleName('October 2026')
    expect(day('2026-10-27')).toHaveFocus()
  })

  it('goes on to the next row past a row’s end, and turns the month past the last day', () => {
    show()
    act(() => day('2026-11-20').focus())
    pressKey('ArrowRight')
    expect(day('2026-11-21')).toHaveFocus()
    pressKey('ArrowLeft')
    expect(day('2026-11-20')).toHaveFocus()
    act(() => day('2026-12-04').focus())
    pressKey('ArrowRight')
    expect(grid()).toHaveAccessibleName('December 2026')
    expect(day('2026-12-05')).toHaveFocus()
  })

  it('turns the month with Page Down from a chip too', () => {
    show()
    act(() => day('2026-11-14').focus())
    pressKey('Enter')
    pressKey('PageDown')
    expect(grid()).toHaveAccessibleName('December 2026')
    expect(day('2026-12-14')).toHaveFocus()
  })

  it('turns from the month shown, also from a muted day of another month', () => {
    show()
    act(() => day('2026-10-31').focus())
    pressKey('PageDown')
    expect(grid()).toHaveAccessibleName('December 2026')
    expect(day('2026-12-31')).toHaveFocus()
  })

  it('moves the tab stop to the day of a chip pressed with a pointer, and arrows go on from there', () => {
    show()
    const chip = within(day('2026-11-14')).getByRole('button', { name: /^Studio lab/ })
    fireEvent.pointerDown(chip)
    act(() => chip.focus())
    expect(day('2026-11-14').tabIndex).toBe(0)
    pressKey('ArrowRight')
    expect(day('2026-11-15')).toHaveFocus()
  })

  it('takes focus only once after the keyboard turns the month', () => {
    show()
    act(() => day('2026-11-17').focus())
    pressKey('PageDown')
    const choice = (name: string) =>
      within(viewSwitch())
        .getAllByRole('button')
        .find((button) => button.textContent === name)!
    fireEvent.click(choice('Week'))
    act(() => choice('Month').focus())
    fireEvent.click(choice('Month'))
    expect(choice('Month')).toHaveFocus()
  })

  it('moves a month with previous and next, and Today comes back to this month', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(grid()).toHaveAccessibleName('December 2026')
    expect(screen.getByRole('button', { name: /^December talk/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(grid()).toHaveAccessibleName('October 2026')
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(grid()).toHaveAccessibleName('November 2026')
  })

  it('shows a timed item as a chip with its short start time and title, named in full', () => {
    show()
    const chip = within(day('2026-11-14')).getByRole('button', { name: /^Studio lab/ })
    expect(chip).toHaveAccessibleName(/^Studio lab, Saturday, November 14, 10:30 AM/)
    expect(chip).toHaveTextContent('10:30aStudio lab')
    expect(chip).toHaveAttribute('data-tone', 'green')
    const film = within(day('2026-11-20')).getByRole('button', { name: /^Film night/ })
    expect(film).toHaveAttribute('data-cancelled')
    expect(film).toHaveAccessibleName(/Cancelled/)
  })

  it('writes the short time in Arabic words and digits', () => {
    expect(formatShortTime(19 * 60, 'en')).toBe('7p')
    expect(formatShortTime(10 * 60 + 30, 'en')).toBe('10:30a')
    expect(formatShortTime(19 * 60, 'ar')).toBe('٧ م')
  })

  it('shows an all-day item on days in a row as one bar, split where the week row ends', () => {
    show()
    const bars = within(grid()).getAllByRole('button', { name: /^Book fair/ })
    expect(bars).toHaveLength(2)
    expect(day('2026-11-18')).toContainElement(bars[0]!)
    expect(bars[0]!.style.getPropertyValue('--span')).toBe('3')
    expect(bars[0]).toHaveAccessibleName(/Wednesday, November 18 to Friday, November 20/)
    expect(day('2026-11-21')).toContainElement(bars[1]!)
    expect(bars[1]!.style.getPropertyValue('--span')).toBe('1')
  })

  it('folds what does not fit into "N more", which opens the Day view of that day', () => {
    show()
    const monday = day('2026-11-23')
    expect(within(monday).getAllByRole('button', { name: /^Busy/ })).toHaveLength(2)
    const more = within(monday).getByRole('button', { name: '2 more on Monday, November 23' })
    expect(more).toHaveTextContent('2 more')
    fireEvent.click(more)
    expect(screen.queryByRole('grid')).toBeNull()
    expect(chosen()).toBe('Day')
    expect(screen.getByRole('button', { name: /^Busy 4, Monday, November 23/ })).toBeInTheDocument()
  })

  it('enters a day with Enter, moves through its chips with Up and Down, and Escape leaves', () => {
    show()
    act(() => day('2026-11-23').focus())
    pressKey('Enter')
    expect(screen.getByRole('button', { name: /^Busy 1/ })).toHaveFocus()
    pressKey('ArrowDown')
    expect(screen.getByRole('button', { name: /^Busy 2/ })).toHaveFocus()
    pressKey('ArrowDown')
    expect(screen.getByRole('button', { name: /^2 more/ })).toHaveFocus()
    pressKey('Escape')
    expect(day('2026-11-23')).toHaveFocus()
  })

  it('opens the same details as the week from a chip', async () => {
    const run = vi.fn()
    show({ actions: [{ id: 'open', label: 'Open', run }] })
    fireEvent.click(within(day('2026-11-17')).getByRole('button', { name: /^Week 3/ }))
    const panel = await screen.findByRole('dialog', { name: 'Week 3' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Open' }))
    expect(run).toHaveBeenCalledWith('week-3', 'tue')
  })

  it('in edit mode opens an item from its chip, and an empty day in the Day view', () => {
    const { onOpen } = show({ mode: 'edit' })
    fireEvent.click(within(day('2026-11-14')).getByRole('button', { name: /^Studio lab/ }))
    expect(onOpen).toHaveBeenCalledWith('lab', 'sat', expect.objectContaining({ id: 'lab' }))
    fireEvent.click(day('2026-11-11'))
    expect(screen.queryByRole('grid')).toBeNull()
    expect(chosen()).toBe('Day')
  })

  it('lays out right to left in Arabic, in its own words', () => {
    show({ locale: 'ar' })
    expect(grid()).toHaveAccessibleName('نوفمبر ٢٠٢٦')
    expect(choices(ar.CalendarUi.view)[0]).toBe('شهر')
    expect(within(day('2026-11-17')).getByRole('button', { name: /^Week 3/ })).toHaveTextContent(
      '٧ م',
    )
  })

  it('sends the month from the server, and a phone’s agenda of it, and hydrates with no mismatch', async () => {
    narrow = null
    const html = renderToString(tree())
    expect(html).toContain('role="grid"')
    expect(html).toContain('aria-label="November 2026"')
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => {
      hydrateRoot(container, tree())
    })
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
    container.remove()
  })
})
