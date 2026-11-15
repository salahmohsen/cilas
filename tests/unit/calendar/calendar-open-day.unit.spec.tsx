import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '@/components/calendar/ui/calendar'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import en from '../../../messages/en.json'

// A phone: one day at a time.
vi.mock('@/components/calendar/ui/use-narrow', () => ({ useNarrow: () => true }))

const items: CalendarItem[] = [
  {
    id: 's2',
    kind: 'session',
    title: 'Session 2',
    tone: 'green',
    cancelled: false,
    version: 'v',
    blocks: [{ id: 'thu', date: '2026-11-19', start_time: '19:00', end_time: '21:00' }],
  },
]

function Host({ day }: { day?: string }) {
  const labels = useCalendarLabels({ kind: () => 'Session', newItem: 'New session' })
  return (
    <Calendar mode="view" items={items} labels={labels} locale="en" day={day} onOpen={vi.fn()} />
  )
}

const view = (day?: string) =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <Host day={day} />
    </NextIntlClientProvider>,
  )

const shownDay = () =>
  screen.getByRole('group', { name: 'Day' }).querySelector('[aria-pressed="true"]')?.textContent

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
// Tuesday 17 November 2026.
beforeEach(() => vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] }))
afterEach(() => vi.useRealTimers())

describe('the day a narrow calendar opens on', () => {
  it('is the day it is given, so a marked block shows on a phone', () => {
    view('2026-11-19')
    expect(shownDay()).toBe('Thu 19')
  })

  it('is today without one', () => {
    view()
    expect(shownDay()).toBe('Tue 17')
  })
})
