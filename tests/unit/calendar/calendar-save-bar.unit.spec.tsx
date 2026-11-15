import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { useState } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '@/components/calendar/ui/calendar'
import { CalendarSaveRefusal } from '@/components/calendar/ui/save-refusal'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'

import en from '../../../messages/en.json'

const week3 = (version: string): CalendarItem => ({
  id: 'week-3',
  kind: 'session',
  title: 'Week 3',
  tone: 'yellow',
  cancelled: false,
  version,
  blocks: [{ id: 'tue', date: '2026-11-17', start_time: '19:00', end_time: '21:00' }],
})

type Save = (changes: CalendarChange[]) => void | Promise<void>

/** A host that can reload: `reload` swaps in the item as another person saved it. */
function Host({
  onSave,
  saveNote,
  onSaveIntent,
}: {
  onSave: (reload: () => void) => Save
  saveNote?: string
  onSaveIntent?: () => void
}) {
  const [items, setItems] = useState([week3('v1')])
  const labels = useCalendarLabels({ kind: () => 'Session', newItem: 'New session', saveNote })
  return (
    <Calendar
      items={items}
      mode="edit"
      labels={labels}
      locale="en"
      day="2026-11-17"
      onOpen={vi.fn()}
      onSave={onSave(() => setItems([week3('v2')]))}
      onSaveIntent={onSaveIntent}
    />
  )
}

const edit = (props: Parameters<typeof Host>[0]) =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <Host {...props} />
    </NextIntlClientProvider>,
  )

const block = () => screen.getByRole('button', { name: /^Week 3, Tuesday/ })
const move = () => {
  block().focus()
  fireEvent.keyDown(block(), { key: 'ArrowDown' })
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

describe('the save bar', () => {
  it('shows the host’s line while changes wait, and not after Cancel', () => {
    edit({ onSave: () => vi.fn(), saveNote: 'The course’s Save does not save the schedule.' })
    expect(screen.queryByText('The course’s Save does not save the schedule.')).toBeNull()
    move()
    expect(screen.getByText('The course’s Save does not save the schedule.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('The course’s Save does not save the schedule.')).toBeNull()
  })

  it('shows no line when the host gives none', () => {
    edit({ onSave: () => vi.fn() })
    move()
    expect(document.querySelectorAll('[class*="barNote"]')).toHaveLength(0)
  })

  it('tells the host when the pointer or focus reaches Save', () => {
    const onSaveIntent = vi.fn()
    edit({ onSave: () => vi.fn(), onSaveIntent })
    move()
    const save = screen.getByRole('button', { name: 'Save' })
    fireEvent.pointerEnter(save)
    fireEvent.pointerDown(save)
    fireEvent.focus(save)
    expect(onSaveIntent).toHaveBeenCalledTimes(3)
  })

  it('offers a refusal’s way out: it drops the changes, then runs it, and leaves no bar', async () => {
    const then = vi.fn()
    edit({
      onSave: (reload) => () => {
        throw new CalendarSaveRefusal('Someone else changed Week 3.', {
          label: 'Reload and lose my changes',
          then: () => {
            then()
            reload()
          },
        })
      },
    })
    move()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone else changed Week 3.')
    // The changes stay on screen until the person chooses to lose them.
    expect(block()).toHaveAccessibleName(/19:15 to 21:15, Unsaved$/)

    fireEvent.click(screen.getByRole('button', { name: 'Reload and lose my changes' }))
    expect(then).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(block()).toHaveAccessibleName(/19:00 to 21:00$/))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })

  it('shows a plain refusal with no way out', async () => {
    edit({
      onSave: () => () => {
        throw new Error('Something went wrong.')
      },
    })
    move()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
    expect(screen.getAllByRole('button').filter((b) => /Reload/.test(b.textContent ?? ''))).toEqual(
      [],
    )
  })
})
