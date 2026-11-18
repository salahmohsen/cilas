import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '@/components/calendar/ui/calendar'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import ar from '../../../../messages/ar.json'
import en from '../../../../messages/en.json'

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
  version: 'v1',
  blocks,
  ...extra,
})

// The week of Saturday 14 November 2026.
const items: CalendarItem[] = [
  item('s3', 'Session 3', [
    { id: 'tue', date: '2026-11-17', start_time: '19:00', end_time: '21:00' },
  ]),
  item('s4', 'Session 4', [
    { id: 'thu', date: '2026-11-19', start_time: '19:00', end_time: '21:00' },
  ]),
  item('s5', 'Session 5', [{ id: 'sat', date: '2026-11-14', start_time: null, end_time: null }], {
    cancelled: true,
  }),
]

function Host({ marked, locale }: { marked?: ReadonlySet<string>; locale: string }) {
  const labels = useCalendarLabels({ kind: () => 'Session', newItem: 'New session' })
  return (
    <Calendar
      items={items}
      mode="view"
      marked={marked}
      labels={labels}
      locale={locale}
      day="2026-11-17"
      onOpen={vi.fn()}
    />
  )
}

const provided = (node: React.ReactNode, locale = 'en') => (
  <NextIntlClientProvider
    locale={locale}
    messages={locale === 'ar' ? ar : en}
    timeZone="Africa/Cairo"
  >
    {node}
  </NextIntlClientProvider>
)

const view = (marked?: ReadonlySet<string>, locale = 'en') =>
  render(provided(<Host marked={marked} locale={locale} />, locale))

beforeAll(() => {
  // jsdom has no Web Animations; the side panel waits on none.
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

describe('marked items', () => {
  it('a marked block says "Changed" in its name and on its face; an unmarked one does not', () => {
    view(new Set(['s3']))
    const marked = screen.getByRole('button', {
      name: 'Session 3, Tuesday, November 17, 7 PM to 9 PM, Changed',
    })
    expect(marked).toHaveAttribute('data-marked')
    expect(within(marked).getByText('Changed')).toBeInTheDocument()
    const plain = screen.getByRole('button', {
      name: 'Session 4, Thursday, November 19, 7 PM to 9 PM',
    })
    expect(plain).not.toHaveAttribute('data-marked')
    expect(within(plain).queryByText('Changed')).toBeNull()
  })

  it('a marked all-day block that is also cancelled says both', () => {
    view(new Set(['s5']))
    const pill = screen.getByRole('button', {
      name: 'Session 5, Saturday, November 14, All day, Cancelled and Changed',
    })
    expect(pill).toHaveAttribute('data-marked')
    expect(within(pill).getByText('Changed')).toBeInTheDocument()
  })

  it('the colour key names the mark only when something is marked', () => {
    const panel = () => fireEvent.click(screen.getByRole('button', { name: 'Side panel' }))
    const { unmount } = view(new Set(['s3']))
    panel()
    expect(screen.getByRole('group', { name: 'Colour key' })).toHaveTextContent('Changed')
    unmount()
    view()
    panel()
    expect(screen.getByRole('group', { name: 'Colour key' })).not.toHaveTextContent('Changed')
    expect(document.querySelector('[data-marked]')).toBeNull()
  })

  it('view mode has no edit controls', () => {
    view(new Set(['s3']))
    expect(screen.queryByRole('button', { name: /^Add a block/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByText(/Draw on an empty slot/)).toBeNull()
    expect(document.querySelector('[data-block-menu]')).toBeNull()
    expect(document.querySelector('[data-span-edge]')).toBeNull()
  })

  it('renders the mark on the server', () => {
    const html = renderToString(provided(<Host marked={new Set(['s3'])} locale="en" />))
    expect(html).toContain('Session 3, Tuesday, November 17, 7 PM to 9 PM, Changed')
    expect(html).toContain('data-marked')
  })

  it('says it in Arabic words in an Arabic page', () => {
    view(new Set(['s3']), 'ar')
    expect(screen.getByRole('button', { name: /^Session 3، .*، تغيّرت$/ })).toHaveAttribute(
      'data-marked',
    )
  })
})
