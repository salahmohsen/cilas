import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { useState } from 'react'
import { flushSync } from 'react-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '@/components/calendar/ui/calendar'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import en from '../../../../messages/en.json'

const item = (id: string, title: string, version: string, date: string): CalendarItem => ({
  id,
  kind: 'session',
  title,
  tone: 'yellow',
  cancelled: false,
  version,
  blocks: [{ id: `${id}-m`, date, start_time: '10:00', end_time: '12:00' }],
})

const first = (version = 'v1') => item('one', 'Session one', version, '2026-11-17')
const second = (version = 'v1') => item('two', 'Session two', version, '2026-11-18')

function Host({ items }: { items: CalendarItem[] }) {
  const labels = useCalendarLabels({ kind: () => 'Session', newItem: 'New session' })
  return (
    <Calendar
      items={items}
      mode="edit"
      labels={labels}
      locale="en"
      day="2026-11-17"
      newItemKind="session"
      onOpen={vi.fn()}
      onSave={vi.fn()}
    />
  )
}

const view = (items: CalendarItem[]) => (
  <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
    <Host items={items} />
  </NextIntlClientProvider>
)
const block = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}, `) })
const status = () =>
  screen
    .getAllByRole('status')
    .map((el) => el.textContent)
    .join(' ')
const moveDown = (title: string) => {
  block(title).focus()
  fireEvent.keyDown(block(title), { key: 'ArrowDown' })
}

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

describe('items that load while the viewer has unsaved changes', () => {
  it('keeps the changes to other sessions, and drops and names the one that changed', () => {
    const { rerender } = render(view([first(), second()]))
    moveDown('Session one')
    moveDown('Session two')
    expect(status()).toContain('2 unsaved changes')

    // Session one was saved in its drawer: new version, new time.
    const saved = {
      ...first('v2'),
      blocks: [{ ...first().blocks[0]!, start_time: '14:00', end_time: '16:00' }],
    }
    rerender(view([saved, second()]))

    expect(block('Session one')).toHaveAccessibleName(/2 PM to 4 PM$/)
    expect(block('Session two')).toHaveAccessibleName(/Unsaved$/)
    expect(status()).toContain('1 unsaved change')
    expect(status()).toContain(
      'Your unsaved changes to Session one were dropped, because it changed somewhere else.',
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('says it with a Dismiss when no change is left, and Dismiss closes the bar', () => {
    const { rerender } = render(view([first(), second()]))
    moveDown('Session one')
    rerender(view([first('v2'), second()]))

    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(status()).toContain('Your unsaved changes to Session one were dropped')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(status()).not.toContain('dropped')
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })

  it('says nothing when a session that changed had no unsaved change', () => {
    const { rerender } = render(view([first(), second()]))
    moveDown('Session two')
    rerender(view([first('v2'), second()]))
    expect(status()).not.toContain('dropped')
    expect(block('Session two')).toHaveAccessibleName(/Unsaved$/)
  })
})

describe('a save of the viewer', () => {
  it('is not reported as dropped when the host shows the saved items too', async () => {
    function Saving() {
      const [items, setItems] = useState([first(), second()])
      const labels = useCalendarLabels({ kind: () => 'Session', newItem: 'New session' })
      return (
        <Calendar
          items={items}
          mode="edit"
          labels={labels}
          locale="en"
          day="2026-11-17"
          newItemKind="session"
          onOpen={vi.fn()}
          onSave={async () => {
            await Promise.resolve()
            const saved = [first('v2'), second()]
            // The host shows the items before the save returns them, so a render comes between.
            flushSync(() => setItems(saved))
            return saved
          }}
        />
      )
    }
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
        <Saving />
      </NextIntlClientProvider>,
    )
    moveDown('Session one')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
    expect(status()).not.toContain('dropped')
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })
})
