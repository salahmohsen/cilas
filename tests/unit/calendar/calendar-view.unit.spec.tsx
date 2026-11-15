import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '@/components/calendar/ui/calendar'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'

const item = (
  id: string,
  title: string,
  tone: CalendarItem['tone'],
  blocks: CalendarItem['blocks'],
  extra: Partial<CalendarItem> = {},
): CalendarItem => ({
  id,
  kind: 'session',
  title,
  tone,
  cancelled: false,
  version: 'v1',
  blocks,
  ...extra,
})

// The week of Saturday 14 November 2026.
const items: CalendarItem[] = [
  item('week-3', 'Week 3', 'yellow', [
    { id: 'tue', date: '2026-11-17', start_time: '19:00', end_time: '21:00' },
  ]),
  item('lab', 'Studio lab', 'green', [
    { id: 'sat', date: '2026-11-14', start_time: '10:00', end_time: '13:00' },
  ]),
  item(
    'open',
    'Open day',
    'pink',
    [{ id: 'wed', date: '2026-11-18', start_time: null, end_time: null }],
    {
      kind: 'event',
    },
  ),
  item(
    'film',
    'Film night',
    'blue',
    [{ id: 'fri', date: '2026-11-20', start_time: '17:00', end_time: '18:30' }],
    { kind: 'event', cancelled: true },
  ),
  item('week-4', 'Week 4', 'yellow', []),
]

const kind = (value: string) => (value === 'session' ? 'Session' : 'Event')

function Host({
  onOpen,
  locale,
  shown = items,
}: {
  onOpen: (itemId: string, blockId: string | null) => void
  locale: string
  shown?: CalendarItem[]
}) {
  const labels = useCalendarLabels({ kind, newItem: 'New session' })
  return (
    <Calendar
      items={shown}
      mode="view"
      labels={labels}
      locale={locale}
      day="2026-11-17"
      onOpen={onOpen}
    />
  )
}

const openPanel = (name = 'Side panel') => fireEvent.click(screen.getByRole('button', { name }))

const view = (locale = 'en', onOpen = vi.fn()) =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ar' ? ar : en}
      timeZone="Africa/Cairo"
    >
      <Host locale={locale} onOpen={onOpen} />
    </NextIntlClientProvider>,
  )

beforeAll(() => {
  // jsdom has no Web Animations; the panel waits on none.
  Element.prototype.getAnimations ??= () => []
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
})

afterEach(() => vi.useRealTimers())

describe('the week view', () => {
  it('names the calendar, its week and its seven days from Saturday', () => {
    view()
    expect(screen.getByRole('group', { name: 'Calendar' })).toBeInTheDocument()
    expect(screen.getByText('Nov 14 to Nov 20, 2026')).toBeInTheDocument()
    const days = screen
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-label'))
      .filter((name) => /day,/.test(name ?? ''))
    expect(days).toEqual([
      'Saturday, November 14',
      'Sunday, November 15',
      'Monday, November 16',
      'Tuesday, November 17',
      'Wednesday, November 18',
      'Thursday, November 19',
      'Friday, November 20',
    ])
  })

  it('puts each block as a named button in its day', () => {
    view()
    const tuesday = screen.getByRole('group', { name: 'Tuesday, November 17' })
    expect(within(tuesday).getByRole('button')).toHaveAccessibleName(
      'Week 3, Tuesday, November 17, 7 PM to 9 PM',
    )
  })

  it('shows hours from the earliest start to the latest end of the week', () => {
    const { container } = view()
    const hours = [...container.querySelectorAll('[data-hour]')].map((hour) => hour.textContent)
    expect(hours[0]).toBe('10 AM')
    expect(hours.at(-1)).toBe('8 PM')
    expect(hours).toHaveLength(11)
    expect(container.querySelector('[data-hour]')!.parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('puts a block with no time in the all-day row', () => {
    view()
    expect(
      screen.getByRole('button', { name: 'Open day, Wednesday, November 18, All day' }),
    ).toBeVisible()
  })

  it('shows an item on days in a row as one all-day bar, named by its first and last day', () => {
    const onOpen = vi.fn()
    const allDay = (id: string, date: string) => ({ id, date, start_time: null, end_time: null })
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
        <Host
          locale="en"
          onOpen={onOpen}
          shown={[
            item('fair', 'Book fair', 'green', [
              allDay('sun', '2026-11-15'),
              allDay('mon', '2026-11-16'),
              allDay('tue', '2026-11-17'),
            ]),
          ]}
        />
      </NextIntlClientProvider>,
    )
    const bar = screen.getByRole('button', { name: /^Book fair/ })
    expect(bar).toHaveAccessibleName(
      'Book fair, Sunday, November 15 to Tuesday, November 17, All day',
    )
    expect(screen.getAllByRole('button', { name: /^Book fair/ })).toHaveLength(1)
    expect(bar.style.getPropertyValue('--from')).toBe('3')
    expect(bar.style.getPropertyValue('--to')).toBe('6')
    fireEvent.click(bar)
    expect(onOpen).toHaveBeenCalledWith('fair', 'sun')
  })

  it('says a block is cancelled in words, in its name and on its face', () => {
    view()
    const film = screen.getByRole('button', {
      name: 'Film night, Friday, November 20, 5 PM to 6:30 PM, Cancelled',
    })
    expect(within(film).getByText('Cancelled')).toBeInTheDocument()
    openPanel()
    expect(screen.getByRole('list', { name: 'Colour key' })).toHaveTextContent('Cancelled')
  })

  it('lists one legend entry per kind and the unscheduled items in the side panel', () => {
    view()
    expect(screen.queryByRole('list', { name: 'Colour key' })).toBeNull()
    openPanel()
    const legend = screen.getByRole('list', { name: 'Colour key' })
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((entry) => entry.textContent),
    ).toEqual(['Session', 'Event', 'Cancelled'])
    const tray = screen.getByRole('group', { name: 'Unscheduled' })
    expect(within(tray).getByRole('button', { name: 'Week 4' })).toBeInTheDocument()
  })

  it('marks today in Cairo', () => {
    view()
    expect(document.querySelectorAll('[data-today]')).toHaveLength(1)
    expect(document.querySelector('[data-today]')).toHaveTextContent('Tue17')
  })

  it('opens a block with its own button, so Enter and Space work as on any button', () => {
    const onOpen = vi.fn()
    view('en', onOpen)
    const block = screen.getByRole('button', { name: /^Week 3, Tuesday/ })
    expect(block.tagName).toBe('BUTTON')
    expect(block).toHaveAttribute('type', 'button')
    fireEvent.click(block)
    expect(onOpen).toHaveBeenCalledWith('week-3', 'tue')
    openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Week 4' }))
    expect(onOpen).toHaveBeenLastCalledWith('week-4', null)
  })

  it('moves a week at a time and back to today', () => {
    view()
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(screen.getByText('Nov 21 to Nov 27, 2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Week 3/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(screen.getByText('Nov 7 to Nov 13, 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByText('Nov 14 to Nov 20, 2026')).toBeInTheDocument()
  })

  it('leaves blocks fixed: arrow keys and Delete change nothing', () => {
    view()
    const block = screen.getByRole('button', { name: /^Week 3, Tuesday/ })
    block.focus()
    fireEvent.keyDown(block, { key: 'ArrowDown' })
    fireEvent.keyDown(block, { key: 'Delete' })
    expect(
      screen.getByRole('button', { name: /^Week 3, Tuesday.*7 PM to 9 PM/ }),
    ).toBeInTheDocument()
  })
})

describe('the toolbar and the day headers', () => {
  it('names the month and year, and no week when the host gives none', () => {
    view()
    const heading = screen.getByText('November 2026').parentElement!
    expect(heading).toHaveTextContent(/^November 2026$/)
  })

  it('shows one time format: no 24h or 12h switch, and 12-hour times on blocks', () => {
    view()
    expect(screen.queryByRole('button', { name: /^(24h|12h)$/ })).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Time format' })).toBeNull()
    const tuesday = screen.getByRole('group', { name: 'Tuesday, November 17' })
    expect(within(tuesday).getByText('7 – 9 PM')).toBeInTheDocument()
  })

  it('puts the short day name above the date, and today in its own mark', () => {
    view()
    const today = document.querySelector('[data-today]')!
    expect([...today.children].map((part) => part.textContent)).toEqual(['Tue', '17'])
    expect(document.querySelectorAll('[data-weekend]').length).toBeGreaterThan(0)
    for (const day of document.querySelectorAll('[data-weekend][data-day]'))
      expect(day.getAttribute('data-day')).toBe('6')
  })

  it('opens and closes the side panel from its toggle, closed at first', () => {
    view()
    const toggle = screen.getByRole('button', { name: 'Side panel' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Up next')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Up next')).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: 'Colour key' })).toBeNull()
  })

  it('names the next meeting in Up next and opens it', () => {
    // 10:00 UTC is 12:00 in Cairo on Tuesday 17 November: Week 3 at 19:00 is next.
    const onOpen = vi.fn()
    view('en', onOpen)
    openPanel()
    const next = within(screen.getByRole('region', { name: 'Up next' })).getByRole('button')
    expect(next).toHaveTextContent('Tue, Nov 17 · 7 – 9 PM')
    fireEvent.click(next)
    expect(onOpen).toHaveBeenCalledWith('week-3', 'tue')
  })
})

describe('the now line', () => {
  it('draws it in the browser with the time at its start, and moves it each minute', () => {
    vi.useFakeTimers({ now: new Date('2026-11-17T17:30:00Z') }) // 19:30 in Cairo
    const { container } = view()
    const tuesday = screen.getByRole('group', { name: 'Tuesday, November 17' })
    expect(tuesday.querySelector('[style*="--now"]')).not.toBeNull()
    expect(screen.getByText('7:30 PM').closest('[aria-hidden="true"]')).not.toBeNull()
    const line = container.querySelector<HTMLElement>('[style*="--now"]')
    expect(line).not.toBeNull()
    expect(line!.style.getPropertyValue('--now')).toBe(String((19.5 * 60 - 600) / 660))
    act(() => vi.advanceTimersByTime(60 * 60_000))
    expect(
      container.querySelector<HTMLElement>('[style*="--now"]')!.style.getPropertyValue('--now'),
    ).toBe(String((20.5 * 60 - 600) / 660))
    expect(screen.getByText('8:30 PM')).toBeInTheDocument()
  })

  it('draws none in a week without today', () => {
    vi.useFakeTimers({ now: new Date('2026-11-17T17:30:00Z') })
    const { container } = view()
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(container.querySelector('[style*="--now"]')).toBeNull()
  })

  it('is not in the markup the server sends', () => {
    const html = renderToString(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
        <Host locale="en" onOpen={vi.fn()} />
      </NextIntlClientProvider>,
    )
    expect(html).not.toContain('--now')
    expect(html).toContain('Week 3, Tuesday, November 17, 7 PM to 9 PM')
    expect(html).toContain('Studio lab')
  })
})

describe('right to left', () => {
  it('writes an Arabic page in Arabic words and digits, days in the same order', () => {
    const { container } = render(
      <div dir="rtl" lang="ar">
        <NextIntlClientProvider locale="ar" messages={ar} timeZone="Africa/Cairo">
          <Host locale="ar" onOpen={vi.fn()} />
        </NextIntlClientProvider>
      </div>,
    )
    expect(screen.getByRole('group', { name: 'التقويم' })).toBeInTheDocument()
    const tuesday = screen.getByRole('group', { name: /^الثلاثاء/ })
    expect(within(tuesday).getByRole('button')).toHaveAccessibleName(/Week 3، .*، من ٧ م إلى ٩ م$/)
    const days = [...container.querySelectorAll('[role="group"][aria-label]')]
      .map((group) => group.getAttribute('aria-label')!)
      .filter((name) => /^(السبت|الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة)/.test(name))
    expect(days[0]).toMatch(/^السبت/)
    expect(days.at(-1)).toMatch(/^الجمعة/)
  })

  it('uses no physical left or right in its styles', async () => {
    const { readFile } = await import('node:fs/promises')
    const css = await readFile('src/components/calendar/ui/calendar.module.css', 'utf8')
    expect(css).not.toMatch(
      /\b(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\b\s*:/,
    )
  })
})
