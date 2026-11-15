import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '@/components/calendar/ui/calendar'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'

import ar from '../../../messages/ar.json'
import en from '../../../messages/en.json'

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

// The week of Saturday 14 November 2026. Meetings run 10 AM to 9 PM.
const items: CalendarItem[] = [
  item('week-3', 'Week 3', [
    { id: 'tue', date: '2026-11-17', start_time: '19:00', end_time: '21:00' },
  ]),
  item('lab', 'Studio lab', [
    { id: 'sat', date: '2026-11-14', start_time: '10:00', end_time: '13:00' },
  ]),
  item('week-4', 'Week 4', []),
]

type Save = (changes: CalendarChange[]) => void | Promise<void>

function Host({
  onSave,
  onOpen = vi.fn(),
  onUnsavedChange,
  kind = 'session',
  locale = 'en',
}: {
  onSave: Save
  onOpen?: (itemId: string, blockId: string | null) => void
  onUnsavedChange?: (count: number) => void
  kind?: string
  locale?: string
}) {
  const labels = useCalendarLabels({
    kind: () => 'Session',
    newItem: 'New session',
    create: 'New session',
  })
  return (
    <Calendar
      items={items}
      mode="edit"
      labels={labels}
      locale={locale}
      day="2026-11-17"
      newItemKind={kind || undefined}
      onOpen={onOpen}
      onSave={onSave}
      onUnsavedChange={onUnsavedChange}
    />
  )
}

const edit = (props: Parameters<typeof Host>[0], locale = 'en') =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'ar' ? ar : en}
      timeZone="Africa/Cairo"
    >
      <Host {...props} locale={locale} />
    </NextIntlClientProvider>,
  )

const week3 = () => screen.getByRole('button', { name: /^Week 3, Tuesday/ })
const status = () =>
  screen
    .getAllByRole('status')
    .map((el) => el.textContent)
    .join(' ')
const save = () => screen.getByRole('button', { name: 'Save' })

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

describe('edit mode', () => {
  it('moves a block from the keyboard and Save sends one move-block', async () => {
    const onSave = vi.fn()
    edit({ onSave })
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()

    week3().focus()
    fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    fireEvent.keyDown(week3(), { key: 'ArrowDown', shiftKey: true })
    expect(week3()).toHaveAccessibleName(
      'Week 3, Tuesday, November 17, 7:15 PM to 9:30 PM, Unsaved',
    )
    expect(status()).toContain('1 unsaved change')

    fireEvent.click(save())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith([
      {
        op: 'move-block',
        itemId: 'week-3',
        version: 'v-week-3',
        blockId: 'tue',
        date: '2026-11-17',
        start_time: '19:15',
        end_time: '21:30',
      },
    ])
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
  })

  it('tells the host how many changes wait, and 0 after Save, Cancel and when it leaves', async () => {
    const onUnsavedChange = vi.fn()
    const view = edit({ onSave: vi.fn(), onUnsavedChange })
    expect(onUnsavedChange).toHaveBeenLastCalledWith(0)

    week3().focus()
    fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    expect(onUnsavedChange).toHaveBeenLastCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: 'Add a block on Sunday, November 15' }))
    expect(onUnsavedChange).toHaveBeenLastCalledWith(2)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onUnsavedChange).toHaveBeenLastCalledWith(0)

    fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    expect(onUnsavedChange).toHaveBeenLastCalledWith(1)
    fireEvent.click(save())
    await waitFor(() => expect(onUnsavedChange).toHaveBeenLastCalledWith(0))

    fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    expect(onUnsavedChange).toHaveBeenLastCalledWith(1)
    view.unmount()
    expect(onUnsavedChange).toHaveBeenLastCalledWith(0)
  })

  it('keeps focus on a block that moves to another day', () => {
    edit({ onSave: vi.fn() })
    week3().focus()
    fireEvent.keyDown(week3(), { key: 'ArrowRight' })
    const moved = screen.getByRole('button', { name: /^Week 3, Wednesday/ })
    expect(moved).toHaveFocus()
  })

  it('deletes into a dashed ghost with Restore, which Save sends as one delete-block', async () => {
    const onSave = vi.fn()
    edit({ onSave })
    week3().focus()
    fireEvent.keyDown(week3(), { key: 'Delete' })

    const ghost = screen.getByRole('button', { name: /^Restore Week 3, Tuesday/ })
    expect(ghost).toHaveFocus()
    expect(ghost).toHaveAttribute('data-deleted')
    expect(within(ghost).getByText('Restore')).toBeInTheDocument()
    fireEvent.keyDown(ghost, { key: 'ArrowDown' })
    expect(ghost).toHaveAccessibleName(/7 PM to 9 PM/)

    fireEvent.click(save())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith([
      { op: 'delete-block', itemId: 'week-3', version: 'v-week-3', blockId: 'tue' },
    ])
  })

  it('restores a ghost and leaves nothing to save', () => {
    edit({ onSave: vi.fn() })
    week3().focus()
    fireEvent.keyDown(week3(), { key: 'Delete' })
    fireEvent.click(screen.getByRole('button', { name: /^Restore Week 3/ }))
    expect(week3()).toHaveAccessibleName('Week 3, Tuesday, November 17, 7 PM to 9 PM')
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('drops every change on Cancel and sends nothing', () => {
    const onSave = vi.fn()
    edit({ onSave })
    week3().focus()
    fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByRole('button', { name: /^Studio lab/ }), { key: 'Delete' })
    expect(status()).toContain('2 unsaved changes')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(week3()).toHaveAccessibleName('Week 3, Tuesday, November 17, 7 PM to 9 PM')
    expect(screen.getByRole('button', { name: /^Studio lab/ })).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps the changes and shows the error when the save fails, then saves them again', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('Someone else changed Week 3.'))
      .mockResolvedValue(undefined)
    edit({ onSave })
    week3().focus()
    fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    fireEvent.click(save())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The changes were not saved. They are still here. Someone else changed Week 3.',
    )
    expect(week3()).toHaveAccessibleName(/7:15 PM to 9:15 PM, Unsaved/)
    expect(status()).toContain('1 unsaved change')

    fireEvent.click(save())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[1]![0]).toEqual(onSave.mock.calls[0]![0])
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('shows the items a save returns, so the next save carries their new versions', async () => {
    const saved: CalendarItem[] = items.map((entry) =>
      entry.id === 'week-3'
        ? {
            ...entry,
            version: 'v-week-3-saved',
            blocks: [{ id: 'tue', date: '2026-11-17', start_time: '19:15', end_time: '21:00' }],
          }
        : entry,
    )
    const onSave = vi.fn().mockResolvedValueOnce(saved).mockResolvedValue(undefined)
    edit({ onSave })
    week3().focus()
    fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    fireEvent.click(save())
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
    expect(week3()).toHaveAccessibleName('Week 3, Tuesday, November 17, 7:15 PM to 9 PM')

    fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    fireEvent.click(save())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[1]![0]).toEqual([
      expect.objectContaining({ op: 'move-block', version: 'v-week-3-saved', start_time: '19:30' }),
    ])
  })

  it('adds a new item from the toolbar on the day in view, marked unsaved with a dashed edge', () => {
    edit({ onSave: vi.fn() })
    expect(week3()).not.toHaveAttribute('data-unsaved')
    fireEvent.click(screen.getByRole('button', { name: 'New session' }))
    const drawn = screen.getByRole('button', { name: /^New session, Tuesday, November 17/ })
    expect(drawn).toHaveAccessibleName('New session, Tuesday, November 17, 9 AM to 10 AM, Unsaved')
    expect(drawn).toHaveAttribute('data-unsaved')
    expect(drawn).toHaveFocus()
  })

  it('has no New session button without a kind for new items', () => {
    edit({ onSave: vi.fn(), kind: '' })
    expect(screen.queryByRole('button', { name: 'New session' })).toBeNull()
  })

  it('draws from the "+" of a day: a block of a new item in the first free hour', async () => {
    const onSave = vi.fn()
    edit({ onSave })
    fireEvent.click(screen.getByRole('button', { name: 'Add a block on Sunday, November 15' }))
    const drawn = screen.getByRole('button', { name: /^New session, Sunday, November 15/ })
    expect(drawn).toHaveAccessibleName('New session, Sunday, November 15, 9 AM to 10 AM, Unsaved')
    expect(drawn).toHaveFocus()

    fireEvent.click(save())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]![0]).toEqual([
      {
        op: 'create-item',
        kind: 'session',
        blocks: [
          {
            blockId: expect.any(String),
            date: '2026-11-15',
            start_time: '09:00',
            end_time: '10:00',
          },
        ],
      },
    ])
  })

  it('removes a block it drew when that block is deleted, with no change left', () => {
    edit({ onSave: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'Add a block on Sunday, November 15' }))
    const drawn = screen.getByRole('button', { name: /^New session, / })
    fireEvent.keyDown(drawn, { key: 'Delete' })
    expect(screen.queryByRole('button', { name: /^New session, / })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('has no "+" and draws nothing when the host names no kind for new items', () => {
    edit({ onSave: vi.fn(), kind: '' })
    expect(screen.queryByRole('button', { name: /^Add a block on/ })).toBeNull()
  })

  it('puts an unscheduled item on a day from its menu, as one add-block', async () => {
    const onSave = vi.fn()
    edit({ onSave })
    fireEvent.click(screen.getByRole('button', { name: 'Side panel' }))
    const tray = screen.getByRole('group', { name: 'Unscheduled' })
    const entry = within(tray).getByRole('group', { name: 'Week 4' })
    const menu = within(entry).getByRole('button', { name: 'Place on day' })
    fireEvent.pointerDown(menu, { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Thursday, November 19' }))

    const placed = screen.getByRole('button', { name: /^Week 4, Thursday, November 19/ })
    expect(placed).toHaveAccessibleName('Week 4, Thursday, November 19, 9 AM to 10 AM, Unsaved')
    expect(screen.queryByRole('group', { name: 'Unscheduled' })).toBeNull()

    fireEvent.click(save())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]![0]).toEqual([
      expect.objectContaining({
        op: 'add-block',
        itemId: 'week-4',
        version: 'v-week-4',
        date: '2026-11-19',
        start_time: '09:00',
        end_time: '10:00',
      }),
    ])
  })

  it('shows 6 AM to 11 PM and keeps the hours when a block moves', () => {
    const { container } = edit({ onSave: vi.fn() })
    const hours = [...container.querySelectorAll('[data-hour]')].map((hour) => hour.textContent)
    expect(hours[0]).toBe('6 AM')
    expect(hours.at(-1)).toBe('11 PM')
    week3().focus()
    for (let step = 0; step < 4; step++) fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    const after = [...container.querySelectorAll('[data-hour]')].map((hour) => hour.textContent)
    expect(after).toEqual(hours)
  })

  it('names how to edit and points each block at it', () => {
    edit({ onSave: vi.fn() })
    const hint = screen.getByText(/^Draw on an empty slot/)
    expect(week3()).toHaveAttribute('aria-describedby', hint.id)
  })

  it('selects a block on the first touch tap and opens it on the second', () => {
    const onOpen = vi.fn()
    edit({ onSave: vi.fn(), onOpen })
    const tap = () =>
      act(() => {
        week3().dispatchEvent(new PointerEvent('click', { bubbles: true, pointerType: 'touch' }))
      })
    tap()
    expect(week3()).toHaveAttribute('data-selected')
    expect(onOpen).not.toHaveBeenCalled()
    tap()
    expect(onOpen).toHaveBeenCalledWith('week-3', 'tue')
  })

  it('opens a block at once on a mouse click', () => {
    const onOpen = vi.fn()
    edit({ onSave: vi.fn(), onOpen })
    fireEvent.click(week3())
    expect(onOpen).toHaveBeenCalledWith('week-3', 'tue')
    expect(week3()).not.toHaveAttribute('data-selected')
  })

  it('speaks Arabic: words, digits and the same changes', async () => {
    const onSave = vi.fn()
    edit({ onSave }, 'ar')
    const block = screen.getByRole('button', { name: /^Week 3/ })
    block.focus()
    fireEvent.keyDown(block, { key: 'ArrowDown' })
    expect(status()).toContain('تغيير واحد غير محفوظ')
    expect(
      screen.getByRole('button', { name: /^Week 3.*٧:١٥ م إلى ٩:١٥ م، غير محفوظ$/ }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  })
})

describe('dragging a block to another day', () => {
  // jsdom has no layout: seven days 100px wide, 1px a minute over the grid's hours.
  const layout = () =>
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const track = this.closest<HTMLElement>('[data-track]')
      const days = [...document.querySelectorAll<HTMLElement>('[data-track]')].map(
        (el) => el.dataset.track,
      )
      const index = Math.max(0, days.indexOf(track?.dataset.track))
      if (this === track) return new DOMRect(index * 100, 0, 100, 780)
      const style = this.getAttribute('style') ?? ''
      const percent = (name: string) =>
        Number(new RegExp(`${name}:\\s*([\\d.]+)%`).exec(style)?.[1] ?? 0)
      return new DOMRect(
        index * 100,
        (percent('top') * 780) / 100,
        100,
        (percent('height') * 780) / 100,
      )
    })

  it('draws the block in the day under the pointer while it moves, not only on drop', async () => {
    layout()
    const dayAt = (x: number) =>
      document.querySelectorAll<HTMLElement>('[data-track]')[Math.floor(x / 100)] ?? null
    document.elementFromPoint = (x) => dayAt(x)
    document.elementsFromPoint = (x) => [dayAt(x)].filter((el): el is HTMLElement => el !== null)
    edit({ onSave: vi.fn() })
    const block = () => screen.getByRole('button', { name: /^Studio lab/ })
    const dayOf = () => block().closest('[data-track]')!.getAttribute('data-track')
    expect(dayOf()).toBe('2026-11-14')

    const pointer = (type: string, x: number, y: number, buttons = 1) =>
      fireEvent(
        type === 'pointerdown' ? block() : document,
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
    pointer('pointermove', 120, 80)
    await frame()
    pointer('pointermove', 320, 80)
    await frame()
    expect(block()).toHaveAttribute('data-dragging')
    expect(dayOf()).toBe('2026-11-17')
    pointer('pointerup', 320, 80, 0)
    await frame()
    expect(block()).toHaveAccessibleName(/^Studio lab, Tuesday, November 17.*Unsaved$/)
  })
})

describe('touch handles', () => {
  it('are at least 24px, on selected blocks only', async () => {
    const { readFile } = await import('node:fs/promises')
    const css = await readFile('src/components/calendar/ui/calendar.module.css', 'utf8')
    const coarse = css.slice(css.indexOf('@media (pointer: coarse)'))
    expect(coarse).toMatch(/\.block\[data-selected\] \.edge \{[^}]*block-size: 1\.75rem/)
    expect(coarse).toMatch(/\.edge \{\s*display: none;/)
    expect(css).not.toMatch(/\.track[^{]*\{[^}]*touch-action: none/)
  })
})

describe('edit mode scroll', () => {
  const scrolls = vi.fn()

  beforeEach(() => {
    scrolls.mockClear()
    Element.prototype.scrollTo = scrolls as unknown as typeof Element.prototype.scrollTo
  })

  it('shows the hours in a grid that scrolls, not in view mode', () => {
    edit({ onSave: vi.fn() })
    // Only the day headers and the all-day row stay on top; the hours scroll under them.
    const [head, rows] = document.querySelector('[data-scroll]')!.children
    expect(head!.querySelector('[data-day]')).not.toBeNull()
    expect(head!.querySelector('[data-track]')).toBeNull()
    expect(rows!.querySelectorAll('[data-track]')).toHaveLength(7)
  })

  it('scrolls on open, instantly, and on a week change smoothly', () => {
    edit({ onSave: vi.fn() })
    expect(scrolls).toHaveBeenCalledTimes(1)
    expect(scrolls).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'instant' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(scrolls).toHaveBeenCalledTimes(2)
    expect(scrolls).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'smooth' }))
  })

  it('does not scroll smoothly when the viewer asks for less motion', () => {
    const matchMedia = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia
    try {
      edit({ onSave: vi.fn() })
      fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
      expect(scrolls).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'instant' }))
    } finally {
      window.matchMedia = matchMedia
    }
  })
})
