import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '@/components/calendar/ui/calendar'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import en from '../../../messages/en.json'

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

/**
 * An item marked `readOnly` (a space's event in the course space) shows in
 * edit mode and opens, and nothing on the page changes it: no drag, no
 * resize, no key, no menu action, no place from the tray. The component
 * reads only the flag, never the item's kind.
 */
const item = (id: string, title: string, extra: Partial<CalendarItem>): CalendarItem => ({
  id,
  kind: 'thing',
  title,
  tone: 'neutral',
  cancelled: false,
  version: `v-${id}`,
  blocks: [],
  ...extra,
})

// The week of Saturday 14 November 2026.
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
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  HTMLElement.prototype.showPopover = function () {}
  HTMLElement.prototype.hidePopover = function () {}
  Element.prototype.getAnimations = () => []
  Element.prototype.scrollIntoView = function () {}
  Element.prototype.checkVisibility = () => true
  document.head.append(
    Object.assign(document.createElement('style'), {
      textContent: '[popover] { display: block !important }',
    }),
  )
})
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('a readOnly item in edit mode', () => {
  it('refuses keyboard moves and resizes, while a session beside it moves', () => {
    const { onUnsavedChange } = show()
    talk().focus()
    for (const key of ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'])
      fireEvent.keyDown(talk(), { key })
    fireEvent.keyDown(talk(), { key: 'ArrowDown', shiftKey: true })
    expect(talk()).toHaveAccessibleName('Open talk, Saturday, November 14, 10:00 to 12:00')
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
    // jsdom has no layout: seven days 100px wide, 1px a minute over the grid's hours.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const track = this.closest<HTMLElement>('[data-track]')
      const days = [...document.querySelectorAll<HTMLElement>('[data-track]')].map(
        (el) => el.dataset.track,
      )
      const index = Math.max(0, days.indexOf(track?.dataset.track))
      return new DOMRect(index * 100, 0, 100, 780)
    })
    const dayAt = (x: number) =>
      document.querySelectorAll<HTMLElement>('[data-track]')[Math.floor(x / 100)] ?? null
    document.elementFromPoint = (x) => dayAt(x)
    document.elementsFromPoint = (x) => [dayAt(x)].filter((el): el is HTMLElement => el !== null)
    const { onUnsavedChange } = show()
    const pointer = (type: string, x: number, y: number, buttons = 1) =>
      fireEvent(
        type === 'pointerdown' ? talk() : document,
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons,
          clientX: x,
          clientY: y,
        }),
      )
    const frame = () =>
      act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    pointer('pointerdown', 20, 60)
    pointer('pointermove', 120, 160)
    await frame()
    pointer('pointermove', 320, 260)
    await frame()
    expect(talk()).not.toHaveAttribute('data-dragging')
    pointer('pointerup', 320, 260, 0)
    await frame()
    expect(talk().closest('[data-track]')).toHaveAttribute('data-track', '2026-11-14')
    expect(talk()).toHaveAccessibleName('Open talk, Saturday, November 14, 10:00 to 12:00')
    noChanges(onUnsavedChange)
  })

  it('has a menu with Open alone, while a session keeps its changing actions', async () => {
    show()
    expect(await menuNames(talk())).toEqual(['Open'])
    expect(await menuNames(fair())).toEqual(['Open'])
    expect(await menuNames(week3())).toEqual([
      'Open',
      'Add meeting',
      'New session next week',
      'Delete meeting',
    ])
  })

  it('opens on a click and on the first tap, from an enabled button', () => {
    const { onOpen } = show()
    fireEvent.click(talk())
    expect(onOpen).toHaveBeenLastCalledWith('talk', 'sat')
    // Enter on a button is the browser's click; jsdom does not make it, so the e2e presses it.
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
    expect(week3()).toHaveAttribute('aria-describedby')
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
