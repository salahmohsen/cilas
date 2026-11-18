import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { Calendar } from '@/components/calendar/ui/calendar'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import en from '../../../../messages/en.json'

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

const item = (id: string, title: string, extra: Partial<CalendarItem>) =>
  ({
    id,
    kind: 'thing',
    title,
    tone: 'neutral',
    cancelled: false,
    version: `v-${id}`,
    blocks: [],
    ...extra,
  }) satisfies CalendarItem

const items: CalendarItem[] = [
  item('week-3', 'Week 3', {
    tone: 'yellow',
    blocks: [{ id: 'tue', date: '2026-11-17', start_time: '19:00', end_time: '21:00' }],
  }),
  item('talk', 'Open talk', {
    readOnly: true,
    blocks: [{ id: 'sat', date: '2026-11-14', start_time: '10:00', end_time: '12:00' }],
  }),
  item('fair', 'Book fair', {
    readOnly: true,
    blocks: [{ id: 'mon', date: '2026-11-16', start_time: null, end_time: null }],
  }),
  item('later', 'Later talk', { readOnly: true }),
  item('week-4', 'Week 4', { tone: 'yellow' }),
]

const menuWords = {
  addNextDay: 'Add meeting',
  copyNextWeek: 'New session next week',
  deleteBlock: 'Delete meeting',
  addedNextDay: (day: string) => `Added a meeting on ${day}`,
  copiedNextWeek: (day: string) => `Made a new session starting ${day}`,
}

function Host({
  onOpen,
  onUnsavedChange,
}: {
  onOpen: (itemId: string, blockId: string | null) => void
  onUnsavedChange: (count: number) => void
}) {
  const labels = useCalendarLabels({ kind: () => 'Thing', newItem: 'New', menu: menuWords })
  return (
    <Calendar
      items={items}
      mode="edit"
      labels={labels}
      locale="en"
      day="2026-11-17"
      newItemKind="thing"
      onOpen={onOpen}
      onSave={vi.fn()}
      onUnsavedChange={onUnsavedChange}
    />
  )
}

const show = () => {
  const onOpen = vi.fn()
  const onUnsavedChange = vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <Host onOpen={onOpen} onUnsavedChange={onUnsavedChange} />
    </NextIntlClientProvider>,
  )
  return { onOpen, onUnsavedChange }
}

const talk = () => screen.getByRole('button', { name: /^Open talk, Saturday/ })
const fair = () => screen.getByRole('button', { name: /^Book fair, Monday/ })
const week3 = () => screen.getByRole('button', { name: /^Week 3, Tuesday/ })
const noChanges = (onUnsavedChange: ReturnType<typeof vi.fn>) => {
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  expect(onUnsavedChange).toHaveBeenLastCalledWith(0)
  expect(onUnsavedChange).not.toHaveBeenCalledWith(1)
}
const menuNames = async (block: HTMLElement) => {
  fireEvent.contextMenu(block, { clientX: 200, clientY: 300 })
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeNull())
  const names = within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((el) => el.textContent)
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  return names
}

beforeAll(() => {
  globalThis.__UI_SDK_STRICT__ = true
})
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('a readOnly item in edit mode', () => {
  it('refuses keyboard moves and resizes, while a session beside it moves', () => {
    const { onUnsavedChange } = show()
    talk().focus()
    for (const key of ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'])
      fireEvent.keyDown(talk(), { key })
    fireEvent.keyDown(talk(), { key: 'ArrowDown', shiftKey: true })
    expect(talk()).toHaveAccessibleName('Open talk, Saturday, November 14, 10 AM to 12 PM')
    noChanges(onUnsavedChange)

    week3().focus()
    fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    expect(onUnsavedChange).toHaveBeenLastCalledWith(1)
  })

  it('refuses Delete and Backspace, timed and all day', () => {
    const { onUnsavedChange } = show()
    for (const block of [talk, fair]) {
      block().focus()
      fireEvent.keyDown(block(), { key: 'Delete' })
      fireEvent.keyDown(block(), { key: 'Backspace' })
      expect(block()).not.toHaveAttribute('data-deleted')
    }
    expect(screen.queryByRole('button', { name: /^Restore/ })).toBeNull()
    noChanges(onUnsavedChange)
  })

  it('refuses a pointer drag', async () => {
    const { onUnsavedChange } = show()
    const days = document.querySelectorAll<HTMLElement>('[data-track]')
    await userEvent.dragAndDrop(page.elementLocator(talk()), page.elementLocator(days[3]!))
    expect(talk()).not.toHaveAttribute('data-dragging')
    expect(talk().closest('[data-track]')).toHaveAttribute('data-track', '2026-11-14')
    expect(talk()).toHaveAccessibleName('Open talk, Saturday, November 14, 10 AM to 12 PM')
    noChanges(onUnsavedChange)
    await userEvent.dragAndDrop(page.elementLocator(week3()), page.elementLocator(days[4]!))
    expect(onUnsavedChange).toHaveBeenLastCalledWith(1)
  })

  it('has a menu with Open alone, while a session keeps its changing actions', async () => {
    show()
    expect(await menuNames(talk())).toEqual(['Open'])
    expect(await menuNames(fair())).toEqual(['Open'])
    expect(await menuNames(week3())).toEqual([
      'Open',
      'Move to…',
      'Add meeting',
      'New session next week',
      'Delete meeting',
    ])
  })

  it('opens on a click and on the first tap, from an enabled button', () => {
    const { onOpen } = show()
    fireEvent.click(talk())
    expect(onOpen).toHaveBeenLastCalledWith('talk', 'sat')
    expect(talk().tagName).toBe('BUTTON')
    expect(talk()).not.toBeDisabled()
    onOpen.mockClear()
    act(() => {
      talk().dispatchEvent(new PointerEvent('click', { bubbles: true, pointerType: 'touch' }))
    })
    expect(onOpen).toHaveBeenCalledWith('talk', 'sat')
    expect(talk()).not.toHaveAttribute('data-selected')
    fireEvent.click(fair())
    expect(onOpen).toHaveBeenLastCalledWith('fair', 'mon')
  })

  it('shows no resize handles and no edit hint', () => {
    show()
    expect(talk().querySelector('[data-span-edge]')).toBeNull()
    expect(talk()).not.toHaveAttribute('aria-describedby')
    expect(fair()).not.toHaveAttribute('aria-describedby')
    expect(week3().querySelectorAll('[data-span-edge]')).toHaveLength(2)
    expect(week3()).not.toHaveAttribute('aria-describedby')
  })

  it('cannot be placed from the Unscheduled tray', () => {
    show()
    const tray = screen.getByRole('group', { name: 'Unscheduled' })
    expect(within(tray).getByRole('group', { name: 'Later talk' })).toBeInTheDocument()
    expect(
      within(within(tray).getByRole('group', { name: 'Later talk' })).queryAllByRole('button'),
    ).toHaveLength(1)
    expect(
      within(within(tray).getByRole('group', { name: 'Week 4' })).getAllByRole('button').length,
    ).toBeGreaterThan(1)
  })
})
