import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CalendarAction } from '@/components/calendar/ui/block-details'
import { Calendar } from '@/components/calendar/ui/calendar'
import type { CalendarView } from '@/components/calendar/ui/calendar-views'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import en from '../../../../messages/en.json'
import { stubPopupDom } from '../../../../testing/popup-dom.test-utils'

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

let phone = false
vi.mock('@/lib/use-narrow', () => ({ useNarrow: () => phone }))

const item = (id: string, title: string, extra: Partial<CalendarItem>): CalendarItem => ({
  id,
  kind: 'session',
  title,
  tone: 'blue',
  cancelled: false,
  version: `v-${id}`,
  blocks: [],
  ...extra,
})

// The week of Saturday 14 November 2026.
const items: CalendarItem[] = [
  item('maps', 'Maps', {
    caption: 'Session 3',
    place: 'In person · Darb 1718',
    summary: 'We read the atlas together.',
    blocks: [{ id: 'tue', date: '2026-11-17', start_time: '12:30', end_time: '18:05' }],
  }),
  item('field', 'Field days', {
    blocks: [
      { id: 'mon', date: '2026-11-16', start_time: null, end_time: null },
      { id: 'tue', date: '2026-11-17', start_time: null, end_time: null },
      { id: 'wed', date: '2026-11-18', start_time: null, end_time: null },
    ],
  }),
  item('guest', 'Guest lecture', {
    cancelled: true,
    blocks: [{ id: 'wed', date: '2026-11-18', start_time: '13:00', end_time: '15:00' }],
  }),
  item('review', 'Final review', {}),
]

function Host({
  mode = 'view',
  view,
  actions,
  onOpen,
}: {
  mode?: 'view' | 'edit'
  view?: CalendarView
  actions: CalendarAction[]
  onOpen: (itemId: string, blockId: string | null) => void
}) {
  const labels = useCalendarLabels({ kind: () => 'Session', newItem: 'New session' })
  const shared = {
    items,
    labels,
    locale: 'en',
    day: '2026-11-17',
    view,
    onOpen,
    actionsOf: () => actions,
  }
  return mode === 'view' ? (
    <Calendar mode="view" {...shared} />
  ) : (
    <Calendar mode="edit" {...shared} onSave={vi.fn()} />
  )
}

const show = (props: Partial<Parameters<typeof Host>[0]> = {}) => {
  const open = vi.fn()
  const edit = vi.fn()
  const onOpen = vi.fn()
  const actions: CalendarAction[] = props.actions ?? [
    { id: 'edit', label: 'Edit', run: edit },
    { id: 'open', label: 'Open', run: open },
  ]
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <Host onOpen={onOpen} {...props} actions={actions} />
    </NextIntlClientProvider>,
  )
  return { open, edit, onOpen }
}

const maps = () => screen.getByRole('button', { name: /^Maps, Tuesday/ })
const details = () => screen.queryByRole('dialog')

beforeAll(() => {
  globalThis.__UI_SDK_STRICT__ = true
  stubPopupDom()
})
beforeEach(() => {
  phone = false
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('a block’s details in view mode', () => {
  it('open on a press, named by the title, with when, how long, where and what', async () => {
    const { onOpen } = show()
    fireEvent.click(maps())
    const panel = await screen.findByRole('dialog', { name: 'Maps' })
    expect(onOpen).not.toHaveBeenCalled()
    expect(panel).toHaveTextContent('Session 3')
    expect(panel).toHaveTextContent('Tuesday, November 17')
    expect(panel).toHaveTextContent('12:30 – 6:05 PM · 5 hr 35 min')
    expect(panel).toHaveTextContent('In person · Darb 1718')
    expect(panel).toHaveTextContent('We read the atlas together.')
    expect(panel).not.toHaveTextContent(en.CalendarUi.cancelled)
    const buttons = within(panel).getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toHaveAccessibleName(en.CalendarUi.close)
    expect(buttons[1]).toHaveAccessibleName('Edit')
    expect(buttons[2]).toHaveAccessibleName('Open')
    // One group of segments, named by the item.
    expect(within(panel).getByRole('group', { name: 'Maps' })).toBeInTheDocument()
  })

  it('open from a native button, so Enter and Space open them, and Escape closes them with focus back on the block', async () => {
    show()
    expect(maps().tagName).toBe('BUTTON')
    maps().focus()
    // jsdom does not turn Enter into a click as browsers do; the e2e presses the real key.
    fireEvent.click(maps())
    const panel = await screen.findByRole('dialog', { name: 'Maps' })
    fireEvent.keyDown(panel, { key: 'Escape' })
    await waitFor(() => expect(details()).toBeNull())
    expect(maps()).toHaveFocus()
  })

  it('close from the named close button, with focus back on the block', async () => {
    show()
    maps().focus()
    fireEvent.click(maps())
    const panel = await screen.findByRole('dialog', { name: 'Maps' })
    fireEvent.click(within(panel).getByRole('button', { name: en.CalendarUi.close }))
    await waitFor(() => expect(details()).toBeNull())
    expect(maps()).toHaveFocus()
  })

  it('run an action on the item and its block, closed and with focus on the block', async () => {
    const { open, edit } = show()
    fireEvent.click(maps())
    const panel = await screen.findByRole('dialog', { name: 'Maps' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Open' }))
    expect(open).toHaveBeenCalledWith('maps', 'tue')
    expect(edit).not.toHaveBeenCalled()
    expect(maps()).toHaveFocus()
    await waitFor(() => expect(details()).toBeNull())
  })

  it('show only the actions the host gives, such as no Edit for a reader', async () => {
    show({ actions: [{ id: 'open', label: 'Open', run: vi.fn() }] })
    fireEvent.click(maps())
    const panel = await screen.findByRole('dialog', { name: 'Maps' })
    expect(within(panel).queryByRole('button', { name: 'Edit' })).toBeNull()
  })

  it('say Cancelled for a cancelled item', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: /^Guest lecture, Wednesday/ }))
    const panel = await screen.findByRole('dialog', { name: 'Guest lecture' })
    expect(panel).toHaveTextContent(en.CalendarUi.cancelled)
  })

  it('give the days of an all-day bar across days', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: /^Field days, Monday/ }))
    const panel = await screen.findByRole('dialog', { name: 'Field days' })
    expect(panel).toHaveTextContent('Monday, November 16 to Wednesday, November 18')
    expect(panel).toHaveTextContent(en.CalendarUi.allDay)
  })

  it('open from an agenda row', async () => {
    show({ view: 'agenda' })
    fireEvent.click(screen.getByRole('button', { name: /^Maps, Tuesday/ }))
    expect(await screen.findByRole('dialog', { name: 'Maps' })).toHaveTextContent('5 hr 35 min')
  })

  it('open from an unscheduled item, which has no day', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: en.CalendarUi.panel }))
    const entry = screen.getByRole('group', { name: 'Final review' })
    // A split button with its main part only: nothing to place in view mode.
    expect(within(entry).getAllByRole('button')).toHaveLength(1)
    fireEvent.click(within(entry).getByRole('button', { name: 'Final review' }))
    const panel = await screen.findByRole('dialog', { name: 'Final review' })
    expect(panel).toHaveTextContent(en.CalendarUi.unscheduled)
  })

  it('show as a sheet from the bottom on a phone, and as a panel on a wider screen', async () => {
    show()
    fireEvent.click(maps())
    expect(await screen.findByRole('dialog', { name: 'Maps' })).toHaveAttribute(
      'data-presentation',
      'popover',
    )
    cleanup()
    phone = true
    show()
    fireEvent.click(screen.getByRole('button', { name: /^Maps, Tuesday/ }))
    expect(await screen.findByRole('dialog', { name: 'Maps' })).toHaveAttribute(
      'data-presentation',
      'sheet',
    )
  })
})

describe('a press in edit mode', () => {
  it('opens the item at once, as before', async () => {
    const { onOpen } = show({ mode: 'edit' })
    fireEvent.click(maps())
    expect(onOpen).toHaveBeenCalledWith('maps', 'tue', expect.objectContaining({ id: 'maps' }))
    expect(details()).toBeNull()
  })
})

describe('an all-day item on days in a row', () => {
  const bars = () => screen.getAllByRole('button', { name: /Field days/ })

  it('is one bar across the days in view and in edit mode', () => {
    show()
    expect(bars()).toHaveLength(1)
    expect(bars()[0]).toHaveAccessibleName(
      /^Field days, Monday, November 16 to Wednesday, November 18, All day/,
    )
    cleanup()
    show({ mode: 'edit' })
    expect(bars()).toHaveLength(1)
    expect(bars()[0]).toHaveAccessibleName(
      /^Field days, Monday, November 16 to Wednesday, November 18, All day/,
    )
  })

  it('deletes and restores as one bar in edit mode', () => {
    show({ mode: 'edit' })
    bars()[0]!.focus()
    fireEvent.keyDown(bars()[0]!, { key: 'Delete' })
    expect(bars()).toHaveLength(1)
    expect(bars()[0]).toHaveAccessibleName(
      /^Restore Field days, Monday, November 16 to Wednesday, November 18/,
    )
    expect(bars()[0]).toHaveFocus()
    fireEvent.click(bars()[0]!)
    expect(bars()).toHaveLength(1)
    expect(bars()[0]).toHaveAccessibleName(/^Field days, Monday, November 16 to Wednesday/)
  })
})

describe('an unscheduled item renamed while the calendar shows', () => {
  function Renamed({ title }: { title: string }) {
    const labels = useCalendarLabels({ kind: () => 'Session', newItem: 'New session' })
    return (
      <Calendar
        mode="edit"
        items={[item('review', title, {})]}
        labels={labels}
        locale="en"
        day="2026-11-17"
        onOpen={vi.fn()}
        onSave={vi.fn()}
      />
    )
  }
  const view = (title: string) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <Renamed title={title} />
    </NextIntlClientProvider>
  )

  it('shows the new title whole, to be cut with an ellipsis, not letters that morph', () => {
    const { rerender } = render(view('Session 10'))
    const long = 'Turing, "Computing Machinery and Intelligence" (1950)'
    rerender(view(long))
    const entry = screen.getByRole('group', { name: long })
    const main = within(entry).getByRole('button', { name: long })
    expect(main.querySelector('[class*="glyph"]')).toBeNull()
    expect(main.querySelector('[class*="label"]')).toHaveTextContent(long)
    expect(entry).not.toHaveTextContent('Session 10')
  })
})
