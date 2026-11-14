import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '@/components/calendar/ui/calendar'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'

import en from '../../../messages/en.json'

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

const items: CalendarItem[] = [
  {
    id: 'week-3',
    kind: 'session',
    title: 'Week 3',
    tone: 'yellow',
    cancelled: false,
    version: 'v-week-3',
    blocks: [
      { id: 'tue', date: '2026-11-17', start_time: '19:00', end_time: '21:00' },
      { id: 'thu', date: '2026-11-19', start_time: '19:00', end_time: '21:00' },
    ],
  },
  {
    id: 'archive',
    kind: 'session',
    title: 'Archive week',
    tone: 'blue',
    cancelled: false,
    version: 'v-archive',
    blocks: [{ id: 'wed', date: '2026-11-18', start_time: null, end_time: null }],
  },
]

const menuWords = {
  addNextDay: 'Add meeting',
  copyNextWeek: 'New session next week',
  deleteBlock: 'Delete meeting',
  addedNextDay: (day: string) => `Added a meeting on ${day}`,
  copiedNextWeek: (day: string) => `Made a new session starting ${day}`,
}
const host = { kind: () => 'Session', newItem: 'New session' }

type Props = {
  mode?: 'edit' | 'view'
  menu?: boolean
  onSave?: (changes: CalendarChange[]) => void
  onOpen?: (itemId: string, blockId: string | null) => void
}

function Host({ mode = 'edit', menu = true, onSave = vi.fn(), onOpen = vi.fn() }: Props) {
  const labels = useCalendarLabels(menu ? { ...host, menu: menuWords } : host)
  const shared = { items, labels, locale: 'en', day: '2026-11-17', onOpen }
  return mode === 'edit' ? (
    <Calendar {...shared} mode="edit" newItemKind="session" onSave={onSave} />
  ) : (
    <Calendar {...shared} mode="view" />
  )
}

const show = (props: Props = {}) =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <Host {...props} />
    </NextIntlClientProvider>,
  )

const tuesday = () => screen.getByRole('button', { name: /^Week 3, Tuesday/ })
const menu = () => screen.queryByRole('menu')
const names = () =>
  within(menu()!)
    .getAllByRole('menuitem')
    .map((el) => el.textContent)
const saved = () => screen.getByRole('button', { name: 'Save' })

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
  vi.useRealTimers()
})

const open = async () => {
  fireEvent.contextMenu(tuesday(), { clientX: 200, clientY: 300 })
  await waitFor(() => expect(menu()).not.toBeNull())
}
const item = (name: string) => within(menu()!).getByRole('menuitem', { name })
const pick = async (name: string) => {
  await open()
  fireEvent.click(item(name))
  await waitFor(() => expect(menu()).toBeNull())
}
const status = () =>
  screen
    .getAllByRole('status')
    .map((el) => el.textContent)
    .join(' ')

describe('opening the menu', () => {
  it('opens on right-click with the four actions of edit mode', async () => {
    show()
    await open()
    expect(names()).toEqual(['Open', 'Add meeting', 'New session next week', 'Delete meeting'])
    expect(within(menu()!).getByRole('group')).toHaveAccessibleName('Actions for Week 3')
  })

  it.each([
    ['Shift+F10', { key: 'F10', shiftKey: true }],
    ['the Menu key', { key: 'ContextMenu' }],
  ])('opens from %s on a focused block and puts focus in the menu', async (_name, key) => {
    show()
    tuesday().focus()
    fireEvent.keyDown(tuesday(), key)
    await waitFor(() => expect(menu()).not.toBeNull())
    await waitFor(() => expect(menu()!.contains(document.activeElement)).toBe(true))
  })

  it('opens from the "⋯" on a block', async () => {
    show()
    const more = tuesday().querySelector<HTMLElement>('[data-block-menu]')!
    fireEvent.click(more)
    await waitFor(() => expect(menu()).not.toBeNull())
    expect(names()).toHaveLength(4)
  })

  it('opens on a long press with touch', async () => {
    vi.useRealTimers()
    show()
    fireEvent.pointerDown(tuesday(), {
      pointerType: 'touch',
      pointerId: 1,
      button: 0,
      isPrimary: true,
      clientX: 200,
      clientY: 300,
    })
    await waitFor(() => expect(menu()).not.toBeNull(), { timeout: 2000 })
  })

  it('shows only Open in view mode', async () => {
    show({ mode: 'view' })
    await open()
    expect(names()).toEqual(['Open'])
  })

  it('has no menu and no "⋯" when the host gives no words for it', () => {
    show({ menu: false })
    fireEvent.contextMenu(tuesday())
    expect(menu()).toBeNull()
    expect(tuesday().querySelector('[data-block-menu]')).toBeNull()
  })
})

describe('using the menu', () => {
  it('moves with the arrow keys, and Escape closes it and gives focus back to the block', async () => {
    show()
    tuesday().focus()
    fireEvent.keyDown(tuesday(), { key: 'F10', shiftKey: true })
    await waitFor(() => expect(menu()!.contains(document.activeElement)).toBe(true))
    expect(document.activeElement).toHaveTextContent('Open')

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toHaveTextContent('Add meeting')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement).toHaveTextContent('Delete meeting')
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(document.activeElement).toHaveTextContent('Open')

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(menu()).toBeNull())
    expect(tuesday()).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('Open opens the item, like a click, with focus on the block', async () => {
    const onOpen = vi.fn()
    show({ onOpen })
    await pick('Open')
    expect(onOpen).toHaveBeenCalledExactlyOnceWith('week-3', 'tue')
    expect(tuesday()).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('Open works with Enter from the keyboard', async () => {
    const onOpen = vi.fn()
    show({ onOpen })
    tuesday().focus()
    fireEvent.keyDown(tuesday(), { key: 'ContextMenu' })
    await waitFor(() => expect(menu()!.contains(document.activeElement)).toBe(true))
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('week-3', 'tue'))
  })
})

describe('Add meeting', () => {
  it('adds a block at the same time on the next day, and Save sends an add-block', async () => {
    const onSave = vi.fn()
    show({ onSave })
    await pick('Add meeting')

    const added = screen.getByRole('button', { name: /^Week 3, Wednesday, November 18/ })
    expect(added).toHaveAccessibleName('Week 3, Wednesday, November 18, 19:00 to 21:00, Unsaved')
    expect(status()).toContain('1 unsaved change')
    expect(status()).toContain('Added a meeting on Wednesday, November 18')
    // Shown too, since the block can be on a day or week that is not in view.
    expect(screen.getByText('Added a meeting on Wednesday, November 18')).toBeVisible()

    fireEvent.click(saved())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]![0]).toEqual([
      {
        op: 'add-block',
        itemId: 'week-3',
        version: 'v-week-3',
        blockId: expect.any(String),
        date: '2026-11-18',
        start_time: '19:00',
        end_time: '21:00',
      },
    ])
  })

  it('adds the next day even when it is in another week, and shows it there', async () => {
    const onSave = vi.fn()
    show({ onSave })
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    // Nothing on that week yet; go back and use the Thursday block 19 Nov, then Friday via the keyboard.
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    const thursday = screen.getByRole('button', { name: /^Week 3, Thursday/ })
    fireEvent.contextMenu(thursday)
    await waitFor(() => expect(menu()).not.toBeNull())
    fireEvent.click(item('Add meeting'))
    await waitFor(() => expect(menu()).toBeNull())
    // Friday 20 is the last day of the week (Saturday to Friday), so add again from it.
    const friday = screen.getByRole('button', { name: /^Week 3, Friday, November 20/ })
    fireEvent.contextMenu(friday)
    await waitFor(() => expect(menu()).not.toBeNull())
    fireEvent.click(item('Add meeting'))
    await waitFor(() => expect(menu()).toBeNull())

    expect(screen.queryByRole('button', { name: /^Week 3, Saturday, November 21/ })).toBeNull()
    expect(status()).toContain('Added a meeting on Saturday, November 21')
    expect(status()).toContain('2 unsaved changes')
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(
      screen.getByRole('button', {
        name: 'Week 3, Saturday, November 21, 19:00 to 21:00, Unsaved',
      }),
    ).toBeInTheDocument()
  })
})

describe('New session next week', () => {
  it('makes one untitled session with all the meetings, 7 days later', async () => {
    const onSave = vi.fn()
    show({ onSave })
    await pick('New session next week')

    expect(status()).toContain('Made a new session starting Tuesday, November 24')
    expect(status()).toContain('1 unsaved change')
    fireEvent.click(saved())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]![0]).toEqual([
      {
        op: 'create-item',
        kind: 'session',
        blocks: [
          {
            blockId: expect.any(String),
            date: '2026-11-24',
            start_time: '19:00',
            end_time: '21:00',
          },
          {
            blockId: expect.any(String),
            date: '2026-11-26',
            start_time: '19:00',
            end_time: '21:00',
          },
        ],
      },
    ])
  })

  it('shows the new session in the next week, with its two meetings, and its block cannot be opened yet', async () => {
    show()
    await pick('New session next week')
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(screen.getAllByRole('button', { name: /^New session, / })).toHaveLength(2)

    fireEvent.contextMenu(screen.getAllByRole('button', { name: /^New session, / })[0]!)
    await waitFor(() => expect(menu()).not.toBeNull())
    expect(item('Open')).toHaveAttribute('aria-disabled', 'true')
  })

  it('copies the live meetings: one that is deleted is left out, one that moved is copied where it is', async () => {
    const onSave = vi.fn()
    show({ onSave })
    const thursday = screen.getByRole('button', { name: /^Week 3, Thursday/ })
    fireEvent.keyDown(thursday, { key: 'Delete' })
    tuesday().focus()
    fireEvent.keyDown(tuesday(), { key: 'ArrowDown' })
    await pick('New session next week')
    fireEvent.click(saved())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const changes = onSave.mock.calls[0]![0] as CalendarChange[]
    const created = changes.find((change) => change.op === 'create-item')
    expect(created).toMatchObject({
      blocks: [{ date: '2026-11-24', start_time: '19:15', end_time: '21:15' }],
    })
  })
})

describe('Delete meeting', () => {
  it('turns the block into a ghost with Restore, and Save sends one delete-block', async () => {
    const onSave = vi.fn()
    show({ onSave })
    await pick('Delete meeting')

    const ghost = screen.getByRole('button', { name: /^Restore Week 3, Tuesday/ })
    expect(ghost).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Week 3, Thursday/ })).toBeInTheDocument()

    fireEvent.click(saved())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]![0]).toEqual([
      { op: 'delete-block', itemId: 'week-3', version: 'v-week-3', blockId: 'tue' },
    ])
  })

  it('leaves no change when the ghost is restored', async () => {
    show()
    await pick('Delete meeting')
    fireEvent.click(screen.getByRole('button', { name: /^Restore Week 3, Tuesday/ }))
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('has no menu on a ghost', async () => {
    show()
    await pick('Delete meeting')
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Restore Week 3, Tuesday/ }))
    expect(menu()).toBeNull()
  })
})

describe('the menu on a block made on the page', () => {
  it('offers Open as disabled, and Delete meeting removes the block with no change left', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Add a block on Sunday, November 15' }))
    const drawn = screen.getByRole('button', { name: /^New session, Sunday/ })
    fireEvent.contextMenu(drawn)
    await waitFor(() => expect(menu()).not.toBeNull())
    expect(item('Open')).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(item('Delete meeting'))
    await waitFor(() => expect(menu()).toBeNull())
    expect(screen.queryByRole('button', { name: /^New session, Sunday/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })
})

describe('an all-day meeting', () => {
  const allDay = () => screen.getByRole('button', { name: /^Archive week, Wednesday/ })
  const pickAllDay = async (name: string) => {
    fireEvent.contextMenu(allDay(), { clientX: 200, clientY: 100 })
    await waitFor(() => expect(menu()).not.toBeNull())
    fireEvent.click(item(name))
    await waitFor(() => expect(menu()).toBeNull())
  }

  it('has the same four actions in edit mode, and Open alone in view mode', async () => {
    show()
    fireEvent.contextMenu(allDay())
    await waitFor(() => expect(menu()).not.toBeNull())
    expect(names()).toEqual(['Open', 'Add meeting', 'New session next week', 'Delete meeting'])
    cleanup()
    show({ mode: 'view' })
    fireEvent.contextMenu(allDay())
    await waitFor(() => expect(menu()).not.toBeNull())
    expect(names()).toEqual(['Open'])
  })

  it('opens from the keyboard and from its "⋯", and Open opens the item', async () => {
    const onOpen = vi.fn()
    show({ onOpen })
    allDay().focus()
    fireEvent.keyDown(allDay(), { key: 'F10', shiftKey: true })
    await waitFor(() => expect(menu()!.contains(document.activeElement)).toBe(true))
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(menu()).toBeNull())
    expect(allDay()).toHaveFocus()

    fireEvent.click(allDay().querySelector('[data-block-menu]')!)
    await waitFor(() => expect(menu()).not.toBeNull())
    fireEvent.click(item('Open'))
    await waitFor(() => expect(onOpen).toHaveBeenCalledExactlyOnceWith('archive', 'wed'))
  })

  it('Add meeting puts another all-day meeting on the next day, and Save sends it without times', async () => {
    const onSave = vi.fn()
    show({ onSave })
    await pickAllDay('Add meeting')

    const added = screen.getByRole('button', {
      name: /^Archive week, Thursday, November 19, All day/,
    })
    expect(added).toHaveAccessibleName('Archive week, Thursday, November 19, All day, Unsaved')
    expect(status()).toContain('Added a meeting on Thursday, November 19')
    fireEvent.click(saved())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]![0]).toEqual([
      {
        op: 'add-block',
        itemId: 'archive',
        version: 'v-archive',
        blockId: expect.any(String),
        date: '2026-11-19',
        start_time: null,
        end_time: null,
      },
    ])
  })

  it('New session next week copies it, all day, into one new session', async () => {
    const onSave = vi.fn()
    show({ onSave })
    await pickAllDay('New session next week')
    expect(status()).toContain('Made a new session starting Wednesday, November 25')
    fireEvent.click(saved())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]![0]).toEqual([
      {
        op: 'create-item',
        kind: 'session',
        blocks: [
          { blockId: expect.any(String), date: '2026-11-25', start_time: null, end_time: null },
        ],
      },
    ])
  })

  it('Delete meeting leaves a ghost with Restore, and Save sends one delete-block', async () => {
    const onSave = vi.fn()
    show({ onSave })
    await pickAllDay('Delete meeting')
    const ghost = screen.getByRole('button', { name: /^Restore Archive week, Wednesday/ })
    fireEvent.click(saved())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0]![0]).toEqual([
      { op: 'delete-block', itemId: 'archive', version: 'v-archive', blockId: 'wed' },
    ])
    expect(ghost).toBeDefined()
  })

  it('Delete on the focused pill does the same, and Restore leaves no change', () => {
    show()
    allDay().focus()
    fireEvent.keyDown(allDay(), { key: 'Delete' })
    fireEvent.click(screen.getByRole('button', { name: /^Restore Archive week, Wednesday/ }))
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(allDay()).toBeInTheDocument()
  })
})
