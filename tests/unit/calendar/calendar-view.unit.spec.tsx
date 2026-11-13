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
  tone: string,
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
}: {
  onOpen: (itemId: string, blockId: string | null) => void
  locale: string
}) {
  const labels = useCalendarLabels({ kind, newItem: 'New session' })
  return (
    <Calendar
      items={items}
      mode="view"
      labels={labels}
      locale={locale}
      day="2026-11-17"
      onOpen={onOpen}
    />
  )
}

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
      'Week 3, Tuesday, November 17, 19:00 to 21:00',
    )
  })

  it('shows hours from the earliest start to the latest end of the week', () => {
    const { container } = view()
    const hours = [...container.querySelectorAll('[aria-hidden="true"] > span')].map(
      (hour) => hour.textContent,
    )
    expect(hours[0]).toBe('10:00')
    expect(hours.at(-1)).toBe('20:00')
    expect(hours).toHaveLength(11)
  })

  it('puts a block with no time in the all-day row', () => {
    view()
    expect(
      screen.getByRole('button', { name: 'Open day, Wednesday, November 18, All day' }),
    ).toBeVisible()
  })

  it('says a block is cancelled in words, in its name and on its face', () => {
    view()
    const film = screen.getByRole('button', {
      name: 'Film night, Friday, November 20, 17:00 to 18:30, Cancelled',
    })
    expect(within(film).getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Colour key' })).toHaveTextContent('Cancelled')
  })

  it('lists one legend entry per kind and the unscheduled items', () => {
    view()
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
      screen.getByRole('button', { name: /^Week 3, Tuesday.*19:00 to 21:00/ }),
    ).toBeInTheDocument()
  })
})

describe('24-hour and 12-hour times', () => {
  it('switches the labels and keeps the choice for the viewer', () => {
    view()
    fireEvent.click(screen.getByRole('button', { name: '12h' }))
    expect(
      screen.getByRole('button', { name: /^Week 3, Tuesday.*7:00 PM to 9:00 PM/ }),
    ).toBeInTheDocument()
    expect(localStorage.getItem('calendar-hour-format')).toBe('12')
  })

  it('opens in 12 hours for a viewer who chose it', async () => {
    localStorage.setItem('calendar-hour-format', '12')
    view()
    expect(await screen.findByRole('button', { name: /7:00 PM to 9:00 PM/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '12h' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('still switches when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    view()
    expect(screen.getByRole('button', { name: '24h' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '12h' }))
    expect(screen.getByRole('button', { name: /7:00 PM to 9:00 PM/ })).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})

describe('the now line', () => {
  it('draws it in the browser under the blocks and moves it each minute', () => {
    vi.useFakeTimers({ now: new Date('2026-11-17T17:30:00Z') }) // 19:30 in Cairo
    const { container } = view()
    const line = container.querySelector<HTMLElement>('[style*="--now"]')
    expect(line).not.toBeNull()
    expect(line!.style.getPropertyValue('--now')).toBe(String((19.5 * 60 - 600) / 660))
    act(() => vi.advanceTimersByTime(60 * 60_000))
    expect(
      container.querySelector<HTMLElement>('[style*="--now"]')!.style.getPropertyValue('--now'),
    ).toBe(String((20.5 * 60 - 600) / 660))
  })

  it('is not in the markup the server sends', () => {
    const html = renderToString(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
        <Host locale="en" onOpen={vi.fn()} />
      </NextIntlClientProvider>,
    )
    expect(html).not.toContain('--now')
    expect(html).toContain('Week 3, Tuesday, November 17, 19:00 to 21:00')
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
    expect(within(tuesday).getByRole('button')).toHaveAccessibleName(
      /Week 3، .*، من ١٩:٠٠ إلى ٢١:٠٠$/,
    )
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
