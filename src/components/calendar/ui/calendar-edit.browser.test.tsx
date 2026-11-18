import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '@/components/calendar/ui/calendar'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'

import ar from '../../../../messages/ar.json'
import en from '../../../../messages/en.json'
import { mouse, centerOf, visibleCenterOf } from '../../../../testing/pointer.test-utils'
import { emulateMedia } from '../../../../testing/media.test-utils'

const item = (
  id: string,
  title: string,
  blocks: CalendarItem['blocks'],
  extra: Partial<CalendarItem> = {},
) =>
  ({
    id,
    kind: 'session',
    title,
    tone: 'yellow',
    cancelled: false,
    version: `v-${id}`,
    blocks,
    ...extra,
  }) satisfies CalendarItem

const items: CalendarItem[] = [
  item('week-3', 'Week 3', [
    { id: 'tue', date: '2026-11-17', start_time: '19:00', end_time: '21:00' },
  ]),
  item('lab', 'Studio lab', [
    { id: 'sat', date: '2026-11-14', start_time: '10:00', end_time: '13:00' },
  ]),
  item('week-4', 'Week 4', []),
]

type Save = (changes: CalendarChange[]) => void | CalendarItem[] | Promise<void | CalendarItem[]>

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

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
})
afterEach(() => vi.useRealTimers())

describe('edit mode', () => {
  it('keeps the blocks of a kind the legend hides through a move, and saves only the move', async () => {
    const onSave = vi.fn()
    const kinds = items.map((one) => (one.id === 'lab' ? { ...one, kind: 'lab' } : one))
    function Kinds() {
      const labels = useCalendarLabels({
        kind: (value) => (value === 'lab' ? 'Lab' : 'Session'),
        newItem: 'New session',
      })
      return (
        <Calendar
          items={kinds}
          mode="edit"
          labels={labels}
          locale="en"
          day="2026-11-17"
          onOpen={vi.fn()}
          onSave={onSave}
        />
      )
    }
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
        <Kinds />
      </NextIntlClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Side panel' }))
    const lab = within(screen.getByRole('group', { name: 'Colour key' })).getByRole('button', {
      name: 'Lab',
    })
    fireEvent.click(lab)
    expect(screen.queryByRole('button', { name: /^Studio lab/ })).toBeNull()

    week3().focus()
    fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    fireEvent.click(lab)
    expect(screen.getByRole('button', { name: /^Studio lab, Saturday/ })).toBeInTheDocument()

    fireEvent.click(save())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ op: 'move-block', itemId: 'week-3', start_time: '19:15' }),
    ])
  })

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
    const saves: CalendarChange[][] = []
    const onSave = async (changes: CalendarChange[]) => {
      saves.push(changes)
      if (saves.length === 1) throw new Error('Someone else changed Week 3.')
    }
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
    await waitFor(() => expect(saves).toHaveLength(2))
    expect(saves[1]).toEqual(saves[0])
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
    const saves: CalendarChange[][] = []
    const onSave = async (changes: CalendarChange[]) => {
      saves.push(changes)
      return saves.length === 1 ? saved : undefined
    }
    edit({ onSave })
    week3().focus()
    fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    fireEvent.click(save())
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
    expect(week3()).toHaveAccessibleName('Week 3, Tuesday, November 17, 7:15 PM to 9 PM')

    fireEvent.keyDown(week3(), { key: 'ArrowDown' })
    fireEvent.click(save())
    await waitFor(() => expect(saves).toHaveLength(2))
    expect(saves[1]).toEqual([
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
        itemId: expect.any(String),
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
    const tray = screen.getByRole('group', { name: 'Unscheduled' })
    const entry = within(tray).getByRole('group', { name: 'Week 4' })
    const menu = within(entry).getByRole('button', { name: 'Place on day' })
    menu.focus()
    fireEvent.keyDown(menu, { key: 'Enter' })
    const day = await screen.findByRole('menuitem', { name: 'Thursday, November 19' })
    day.focus()
    fireEvent.keyDown(day, { key: 'Enter' })

    const placed = screen.getByRole('button', { name: /^Week 4, Thursday, November 19/ })
    expect(placed).toHaveAccessibleName('Week 4, Thursday, November 19, 9 AM to 10 AM, Unsaved')
    expect(screen.queryByRole('group', { name: 'Unscheduled' })).toBeNull()
    expect(onSave).not.toHaveBeenCalled()

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

  it.each(['en', 'ar'])('removes the hint and its references in %s', (locale) => {
    const { container } = edit({ onSave: vi.fn() }, locale)
    expect(screen.queryByText(/Draw on an empty slot|ارسم على خانة فارغة/)).toBeNull()
    expect(screen.queryByText(/Keyboard help/)).toBeNull()
    expect(container.querySelector('[aria-describedby]')).toBeNull()
    expect(screen.getByRole('button', { name: /^Week 3/ })).toHaveAccessibleName(/Week 3/)
  })

  it('shows exactly one tray with the panel closed and keeps it when the panel opens', () => {
    edit({ onSave: vi.fn() })
    const toggle = screen.getByRole('button', { name: 'Side panel' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const tray = screen.getByRole('group', { name: 'Unscheduled' })
    expect(tray).toBeVisible()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(panel).not.toBeNull()
    expect(panel).toBeVisible()
    expect(panel!.contains(tray)).toBe(false)
    expect(screen.getAllByRole('group', { name: 'Unscheduled' })).toEqual([tray])
    expect(screen.getAllByRole('button', { name: /^Week 4$/ })).toHaveLength(1)
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
    expect(onOpen).toHaveBeenCalledWith('week-3', 'tue', expect.objectContaining({ id: 'week-3' }))
  })

  it('opens a block at once on a mouse click', () => {
    const onOpen = vi.fn()
    edit({ onSave: vi.fn(), onOpen })
    fireEvent.click(week3())
    expect(onOpen).toHaveBeenCalledWith('week-3', 'tue', expect.objectContaining({ id: 'week-3' }))
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
  it('draws the block in the day under the pointer while it moves, not only on drop', async () => {
    edit({ onSave: vi.fn() })
    const block = () => screen.getByRole('button', { name: /^Studio lab/ })
    const dayOf = () => block().closest('[data-track]')!.getAttribute('data-track')
    expect(dayOf()).toBe('2026-11-14')
    const target = document.querySelector<HTMLElement>('[data-track="2026-11-17"]')!
    const from = centerOf(block())
    const to = { x: centerOf(target).x, y: from.y }
    await mouse.down(from)
    await mouse.move({ x: from.x + 20, y: from.y })
    await mouse.move(to)
    await waitFor(() => expect(block()).toHaveAttribute('data-dragging'))
    await waitFor(() => expect(dayOf()).toBe('2026-11-17'))
    await mouse.up(to)
    await waitFor(() =>
      expect(block()).toHaveAccessibleName(/^Studio lab, Tuesday, November 17.*Unsaved$/),
    )
  })
})

describe('the Unscheduled tray with a pointer', () => {
  it('opens Place on day with a click and places the item on the day chosen', async () => {
    edit({ onSave: vi.fn() })
    const entry = within(screen.getByRole('group', { name: 'Unscheduled' })).getByRole('group', {
      name: 'Week 4',
    })
    const menu = within(entry).getByRole('button', { name: 'Place on day' })
    fireEvent.pointerDown(menu, { pointerType: 'mouse', button: 0 })
    fireEvent.pointerUp(menu, { pointerType: 'mouse', button: 0 })
    fireEvent.click(menu)
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Friday, November 20' }))
    expect(
      screen.getByRole('button', { name: /^Week 4, Friday, November 20/ }),
    ).toHaveAccessibleName('Week 4, Friday, November 20, 9 AM to 10 AM, Unsaved')
  })

  it('places an item where it is dropped on a day', async () => {
    edit({ onSave: vi.fn() })
    const chip = within(screen.getByRole('group', { name: 'Unscheduled' })).getByRole('button', {
      name: 'Week 4',
    })
    const thursday = document.querySelector<HTMLElement>('[data-track="2026-11-19"]')!
    const from = centerOf(chip)
    const to = visibleCenterOf(thursday)
    await mouse.down(from)
    await mouse.move({ x: from.x + 20, y: from.y + 20 })
    await mouse.move(to)
    await waitFor(() => expect(thursday).toHaveAttribute('data-over'))
    await mouse.up(to)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /^Week 4, Thursday, November 19/ }),
      ).toHaveAccessibleName(/Unsaved$/),
    )
    expect(screen.queryByRole('group', { name: 'Unscheduled' })).toBeNull()
  })
})

describe('edit mode scroll', () => {
  it('shows the hours in a grid that scrolls, not in view mode', () => {
    edit({ onSave: vi.fn() })
    const [head, rows] = document.querySelector('[data-scroll]')!.children
    expect(head!.querySelector('[data-day]')).not.toBeNull()
    expect(head!.querySelector('[data-track]')).toBeNull()
    expect(rows!.querySelectorAll('[data-track]')).toHaveLength(7)
  })

  it('scrolls on open, instantly, and on a week change smoothly', () => {
    const scrolls = vi.spyOn(Element.prototype, 'scrollTo')
    edit({ onSave: vi.fn() })
    expect(scrolls).toHaveBeenCalledTimes(1)
    expect(scrolls).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'instant' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(scrolls).toHaveBeenCalledTimes(2)
    expect(scrolls).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'smooth' }))
    scrolls.mockRestore()
  })

  it('does not scroll smoothly when the viewer asks for less motion', async () => {
    await emulateMedia({ 'prefers-reduced-motion': 'reduce' })
    const scrolls = vi.spyOn(Element.prototype, 'scrollTo')
    edit({ onSave: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(scrolls).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'instant' }))
    scrolls.mockRestore()
  })
})
