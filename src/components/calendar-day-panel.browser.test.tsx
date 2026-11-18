import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

import type { CalendarAction } from '@/components/calendar/ui/block-details'
import { Calendar } from '@/components/calendar/ui/calendar'
import type { CalendarView } from '@/components/calendar/ui/calendar-views'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

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
const at = (id: string, date: string, start: string, end: string) => ({
  id,
  date,
  start_time: start,
  end_time: end,
})

const items: CalendarItem[] = [
  item('tue-a', 'Tuesday talk', [at('a', '2026-11-17', '15:15', '18:00')], {
    caption: 'Session 1',
    place: 'In person · Darb el-Labbana',
    summary: 'What we owe each other.',
  }),
  item('tue-b', 'Evening seminar', [at('b', '2026-11-17', '18:00', '20:30')]),
  item('thu', 'Thursday class', [at('t', '2026-11-19', '17:30', '19:00')], {
    image: { url: '/media/street.jpg', alt: 'A street', position: '20% 80%' },
  }),
  ...['09:00', '11:00', '13:00', '15:00'].map((time, index) =>
    item(`busy-${index}`, `Busy ${index + 1}`, [
      at(`m${index}`, '2026-11-23', time, `${Number(time.slice(0, 2)) + 1}:00`),
    ]),
  ),
]

const run = vi.fn()
const navigate = vi.fn()
const onOpen = vi.fn()

function Host({
  view = 'month',
  locale = 'en',
  actions = [{ id: 'open', label: 'View course', href: '/course' }],
  panelOpenInMonth = true,
  mode = 'view',
}: {
  view?: CalendarView
  locale?: string
  actions?: CalendarAction[]
  panelOpenInMonth?: boolean
  mode?: 'view' | 'edit'
}) {
  const labels = useCalendarLabels({ kind: () => 'Session', newItem: 'New session' })
  const shared = {
    items,
    labels,
    locale,
    day: '2026-11-17',
    today: '2026-11-17',
    view,
    panelOpenInMonth,
    onNavigate: navigate,
    onOpen,
    actionsOf: () => actions,
  }
  return mode === 'view' ? (
    <Calendar mode="view" {...shared} />
  ) : (
    <Calendar mode="edit" {...shared} onSave={vi.fn()} newItemKind="session" />
  )
}
const tree = (props: Parameters<typeof Host>[0] = {}) => (
  <NextIntlClientProvider
    locale={props.locale ?? 'en'}
    messages={props.locale === 'ar' ? ar : en}
    timeZone="Africa/Cairo"
  >
    <Host {...props} />
  </NextIntlClientProvider>
)
const show = (props: Parameters<typeof Host>[0] = {}) => render(tree(props))

const day = (date: string) =>
  screen.getByRole('grid').querySelector<HTMLElement>(`[data-day="${date}"]`)!
const layout = () => document.querySelector<HTMLElement>('[class*="layout"]')!
const panel = () => document.querySelector<HTMLElement>('[class*="panelBody"]')!
const status = () => screen.getByRole('status')
const key = (name: string, target: Element = document.activeElement!) =>
  fireEvent.keyDown(target, { key: name })

beforeAll(async () => {
  globalThis.__UI_SDK_STRICT__ = true
  await import('@/components/confirm-dialog')
})
beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
  run.mockReset()
  navigate.mockReset()
  onOpen.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('the side panel in the Month view', () => {
  it('is open by default beside the grid and shows today first, from the server render', () => {
    const html = renderToString(tree())
    expect(html).toContain('data-panel="auto"')
    expect(html).toContain('Tuesday, November 17')
    expect(html).toContain('Tuesday talk')
    expect(html).toContain('2 meetings')
  })

  it('shows the selected day with a Today mark, a count and a row for each meeting', () => {
    show()
    expect(layout().getAttribute('data-panel')).toBe('auto')
    const section = screen.getByRole('region', { name: 'Tuesday, November 17' })
    expect(within(section).getByText('Today')).toBeInTheDocument()
    expect(within(section).getByText('2 meetings')).toBeInTheDocument()
    const rows = within(section).getAllByRole('button')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Tuesday talk'),
      expect.stringContaining('Evening seminar'),
    ])
    expect(rows[0]).toHaveTextContent('In person · Darb el-Labbana')
  })

  it('says nothing on an empty day and offers the next item, which selects its day', () => {
    show()
    fireEvent.click(day('2026-11-18'))
    const section = screen.getByRole('region', { name: 'Wednesday, November 18' })
    expect(within(section).getByText('Nothing on Wednesday, November 18')).toBeInTheDocument()
    expect(within(section).queryByText(/meetings/)).toBeNull()
    const next = within(section).getByRole('button', { name: /Thursday class/ })
    expect(next).toHaveTextContent('Thu, Nov 19')
    fireEvent.click(next)
    expect(screen.getByRole('region', { name: 'Thursday, November 19' })).toBeInTheDocument()
    expect(day('2026-11-19')).toHaveAttribute('aria-selected', 'true')
  })

  it('has no busy strip, no booked or free time and no free-slot rows', () => {
    show()
    expect(panel().textContent).not.toMatch(/free|booked|busy/i)
  })

  it('stays closed by default in the other views, and where the host does not ask', () => {
    show({ view: 'week' })
    expect(layout().getAttribute('data-panel')).toBeNull()
    cleanup()
    show({ panelOpenInMonth: false })
    expect(layout().getAttribute('data-panel')).toBeNull()
  })

  it('does not open beside a grid that is too narrow, and a person can still open it', async () => {
    await page.viewport(800, 900)
    show()
    expect(layout().getAttribute('data-panel')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.CalendarUi.panel }))
    expect(layout().getAttribute('data-panel')).toBe('open')
  })

  it('shows Up next, not a day, in the Week view', () => {
    show({ view: 'week' })
    fireEvent.click(screen.getByRole('button', { name: en.CalendarUi.panel }))
    expect(within(panel()).getByText('Up next')).toBeInTheDocument()
    expect(within(panel()).queryByText('Nothing on')).toBeNull()
  })
})

describe('selecting a day', () => {
  it('selects with a pointer press, says it, and writes the day for the host to put in its URL', () => {
    show()
    expect(day('2026-11-17')).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(day('2026-11-19'))
    expect(day('2026-11-19')).toHaveAttribute('aria-selected', 'true')
    expect(day('2026-11-17')).toHaveAttribute('aria-selected', 'false')
    expect(status()).toHaveTextContent('Thursday, November 19: 1 meeting')
    expect(navigate).toHaveBeenLastCalledWith('month', '2026-11-19')
  })

  it('selects with Enter and Space, and focus stays on the cell', () => {
    show()
    day('2026-11-19').focus()
    key('Enter')
    expect(day('2026-11-19')).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(day('2026-11-19'))
    day('2026-11-18').focus()
    key(' ')
    expect(day('2026-11-18')).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(day('2026-11-18'))
  })

  it('moves focus with the arrows and leaves the selection where it is', () => {
    show()
    day('2026-11-17').focus()
    key('ArrowRight')
    key('ArrowDown')
    expect(document.activeElement).not.toBe(day('2026-11-17'))
    expect(day('2026-11-17')).toHaveAttribute('aria-selected', 'true')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('goes into the day’s chips with F2', () => {
    show()
    day('2026-11-17').focus()
    key('F2')
    expect(document.activeElement).toHaveAttribute('data-block-id')
    expect(day('2026-11-17')).toHaveAttribute('aria-selected', 'true')
  })

  it('names each day with its count', () => {
    show()
    expect(day('2026-11-17')).toHaveTextContent('Tuesday, November 17, 2 meetings')
    expect(day('2026-11-18')).toHaveTextContent('Wednesday, November 18, 0 meetings')
  })

  it('makes "N more" select the day and stay in the month', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: /more on Monday, November 23/ }))
    expect(day('2026-11-23')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Monday, November 23' })).toBeInTheDocument()
    expect(navigate).toHaveBeenLastCalledWith('month', '2026-11-23')
  })

  it('keeps "N more" opening the Day view where the panel is not beside the grid', async () => {
    await page.viewport(800, 900)
    show()
    fireEvent.click(screen.getByRole('button', { name: /more on Monday, November 23/ }))
    expect(navigate).toHaveBeenLastCalledWith('day', '2026-11-23')
    expect(screen.queryByRole('grid')).toBeNull()
  })

  it('does not select or mark days when the panel is closed', () => {
    show({ panelOpenInMonth: false })
    expect(day('2026-11-17')).not.toHaveAttribute('aria-selected')
    fireEvent.click(day('2026-11-19'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('moves a month to its default day: today, else the first day with an item, else the first', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(navigate).toHaveBeenLastCalledWith('month', '2026-12-01')
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(navigate).toHaveBeenLastCalledWith('month', '2026-11-17')
  })

  it('keeps a press on an empty day in edit mode as it was: it opens the Day view', async () => {
    await page.viewport(800, 900)
    show({ mode: 'edit' })
    fireEvent.click(day('2026-11-18'))
    expect(navigate).toHaveBeenLastCalledWith('day', '2026-11-18')
  })
})

describe('details in the panel', () => {
  const press = () => fireEvent.click(day('2026-11-17').querySelector('[data-block-id]')!)

  it('replaces the day with one layout, and moves focus to the heading', () => {
    show()
    press()
    expect(screen.queryByRole('dialog')).toBeNull()
    const details = screen.getByRole('region', { name: 'Tuesday talk' })
    const heading = within(details).getByRole('heading', { name: 'Tuesday talk' })
    expect(document.activeElement).toBe(heading)
    expect(within(details).getByText('Session 1')).toBeInTheDocument()
    expect(within(details).getByText(/3:15 – 6 PM/)).toBeInTheDocument()
    expect(within(details).getByText(/2 hr 45 min/)).toBeInTheDocument()
    expect(within(details).getByText('In person · Darb el-Labbana')).toBeInTheDocument()
    expect(within(details).getByText('What we owe each other.')).toBeInTheDocument()
    expect(within(details).getByRole('link', { name: 'View course' })).toHaveAttribute(
      'href',
      '/course',
    )
    expect(status()).toHaveTextContent('Details of Tuesday talk')
  })

  it('has a real Back button named for the day, and Back returns focus to the chip', () => {
    show()
    const chip = day('2026-11-17').querySelector<HTMLElement>('[data-block-id]')!
    fireEvent.click(chip)
    const back = screen.getByRole('button', { name: 'Back to Tuesday, November 17' })
    expect(back).toHaveTextContent('Tue, Nov 17')
    fireEvent.click(back)
    expect(screen.getByRole('region', { name: 'Tuesday, November 17' })).toBeInTheDocument()
    return waitFor(() => expect(document.activeElement).toBe(chip))
  })

  it('closes on Escape from the panel and returns focus to the chip', async () => {
    show()
    const chip = day('2026-11-17').querySelector<HTMLElement>('[data-block-id]')!
    fireEvent.click(chip)
    key('Escape')
    expect(screen.getByRole('region', { name: 'Tuesday, November 17' })).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(chip))
  })

  it('does not close on Escape from the grid', () => {
    show()
    press()
    key('Escape', day('2026-11-17'))
    expect(screen.getByRole('region', { name: 'Tuesday talk' })).toBeInTheDocument()
  })

  it('returns focus to the row after Back when the details came from a row', async () => {
    show()
    const section = screen.getByRole('region', { name: 'Tuesday, November 17' })
    fireEvent.click(within(section).getByRole('button', { name: /Evening seminar/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Back to/ }))
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-row-id', 'tue-b/b'))
  })

  it('selects the day of a pressed chip, and the day shows again after Back', () => {
    show()
    fireEvent.click(day('2026-11-19').querySelector('[data-block-id]')!)
    expect(day('2026-11-19')).toHaveAttribute('aria-selected', 'true')
    expect(navigate).toHaveBeenLastCalledWith('month', '2026-11-19')
    fireEvent.click(screen.getByRole('button', { name: 'Back to Thursday, November 19' }))
    expect(screen.getByRole('region', { name: 'Thursday, November 19' })).toBeInTheDocument()
  })

  it('goes back to Up next, not a day, in the Week view', () => {
    show({ view: 'week' })
    fireEvent.click(screen.getByRole('button', { name: en.CalendarUi.panel }))
    fireEvent.click(within(panel()).getByRole('button', { name: /Tuesday talk/ }))
    expect(screen.getByRole('button', { name: 'Back to Up next' })).toBeInTheDocument()
  })

  it('shows the cover above the title as the popover does, and no picture area without one', () => {
    show()
    fireEvent.click(day('2026-11-19').querySelector('[data-block-id]')!)
    const covered = screen.getByRole('region', { name: 'Thursday class' })
    const picture = within(covered).getByRole('img', { name: 'A street' })
    expect(picture.closest('[class*="detailsImage"]')).not.toBeNull()
    expect(
      picture.compareDocumentPosition(within(covered).getByRole('heading')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Back to/ }))
    fireEvent.click(day('2026-11-17').querySelector('[data-block-id]')!)
    const plain = screen.getByRole('region', { name: 'Tuesday talk' })
    expect(within(plain).queryByRole('img')).toBeNull()
    expect(plain.querySelector('[class*="detailsImage"]')).toBeNull()
  })

  it('hides the colour key while details show, and shows it again after Back', () => {
    show()
    const key = () => screen.queryByRole('group', { name: en.CalendarUi.legend })
    expect(key()).not.toBeNull()
    fireEvent.click(day('2026-11-17').querySelector('[data-block-id]')!)
    expect(key()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Back to/ }))
    expect(key()).not.toBeNull()
  })

  it('keeps the popover where the panel is not open beside the grid', async () => {
    show({ view: 'week' })
    fireEvent.click(screen.getByRole('button', { name: /^Tuesday talk, Tuesday/ }))
    expect(await screen.findByRole('dialog', { name: 'Tuesday talk' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Back to/ })).toBeNull()
  })

  it('keeps the popover at 56rem or less', async () => {
    await page.viewport(800, 900)
    show()
    fireEvent.click(screen.getByRole('button', { name: en.CalendarUi.panel }))
    fireEvent.click(day('2026-11-17').querySelector('[data-block-id]')!)
    expect(await screen.findByRole('dialog', { name: 'Tuesday talk' })).toBeInTheDocument()
  })

  it('drops the details when a selected day is pressed in the grid', () => {
    show()
    press()
    fireEvent.click(day('2026-11-19'))
    expect(screen.queryByRole('region', { name: 'Tuesday talk' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Thursday, November 19' })).toBeInTheDocument()
  })

  it('mirrors in Arabic: Back by the day, in Arabic words', () => {
    show({ locale: 'ar' })
    fireEvent.click(day('2026-11-17').querySelector('[data-block-id]')!)
    expect(
      screen.getByRole('button', { name: new RegExp(`^${ar.CalendarUi.backTo.split('{')[0]}`) }),
    ).toBeInTheDocument()
  })
})

describe('actions that ask first', () => {
  const cancel: CalendarAction = {
    id: 'cancel',
    label: 'Cancel session',
    menu: true,
    danger: true,
    confirm: { title: 'Cancel this session?', keep: 'Keep session' },
    run,
  }
  const restore: CalendarAction = { id: 'restore', label: 'Restore session', menu: true, run }
  const open = (actions: CalendarAction[]) => {
    show({
      actions: [{ id: 'open', label: 'View course', href: '/course' }, ...actions],
    })
    fireEvent.click(day('2026-11-17').querySelector('[data-block-id]')!)
  }
  const menu = async () => {
    const trigger = screen.getByRole('button', { name: 'More actions' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    return screen.findByRole('menu')
  }

  it('shows no menu when no action sits in it', () => {
    open([])
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
  })

  it('puts Cancel session in the More actions menu, after the buttons', async () => {
    open([cancel])
    const links = screen.getAllByRole('link', { name: 'View course' })
    expect(links.length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Cancel session' })).toBeNull()
    const list = await menu()
    expect(
      within(list)
        .getAllByRole('menuitem')
        .map((entry) => entry.textContent),
    ).toEqual(['Cancel session'])
  })

  it('asks first, with Keep session focused, and does nothing on Keep', async () => {
    open([cancel])
    fireEvent.click(within(await menu()).getByRole('menuitem', { name: 'Cancel session' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this session?' })
    const keep = within(dialog).getByRole('button', { name: 'Keep session' })
    await waitFor(() => expect(document.activeElement).toBe(keep))
    expect(within(dialog).getByRole('button', { name: 'Cancel session' })).toBeInTheDocument()
    fireEvent.click(keep)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(run).not.toHaveBeenCalled()
  })

  it('closes on Escape without running the action', async () => {
    open([cancel])
    fireEvent.click(within(await menu()).getByRole('menuitem', { name: 'Cancel session' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this session?' })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(run).not.toHaveBeenCalled()
  })

  describe('in the details popover', () => {
    const popover = async () => {
      show({
        view: 'week',
        actions: [{ id: 'open', label: 'View course', href: '/course' }, cancel],
      })
      const block = screen.getByRole('button', { name: /^Tuesday talk, Tuesday/ })
      fireEvent.click(block)
      return { block, dialog: await screen.findByRole('dialog', { name: 'Tuesday talk' }) }
    }

    it('stays open when "⋯" is pressed, and shows the menu inside it', async () => {
      const { dialog } = await popover()
      const more = within(dialog).getByRole('button', { name: 'More actions' })
      fireEvent.keyDown(more, { key: 'Enter' })
      const list = await screen.findByRole('menu')
      expect(screen.getByRole('dialog', { name: 'Tuesday talk' })).toBeInTheDocument()
      expect(dialog.contains(list)).toBe(true)
      expect(within(list).getAllByRole('menuitem')).toHaveLength(1)
    })

    it('closes the menu on Escape and returns focus to "⋯"; a second Escape closes the popover', async () => {
      const { block, dialog } = await popover()
      const more = within(dialog).getByRole('button', { name: 'More actions' })
      more.focus()
      fireEvent.keyDown(more, { key: 'Enter' })
      const list = await screen.findByRole('menu')
      key('Escape', list)
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      expect(screen.getByRole('dialog', { name: 'Tuesday talk' })).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
      await waitFor(() => expect(document.activeElement).toBe(more))
      key('Escape', more)
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tuesday talk' })).toBeNull())
      await waitFor(() => expect(document.activeElement).toBe(block))
    })

    it('asks first when an item is chosen, with the popover closed and Keep focused', async () => {
      const { dialog } = await popover()
      fireEvent.keyDown(within(dialog).getByRole('button', { name: 'More actions' }), {
        key: 'Enter',
      })
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Cancel session' }))
      const ask = await screen.findByRole('dialog', { name: 'Cancel this session?' })
      expect(screen.queryByRole('dialog', { name: 'Tuesday talk' })).toBeNull()
      await waitFor(() =>
        expect(document.activeElement).toBe(
          within(ask).getByRole('button', { name: 'Keep session' }),
        ),
      )
    })
  })

  it('runs the action once on the dangerous answer', async () => {
    open([cancel])
    fireEvent.click(within(await menu()).getByRole('menuitem', { name: 'Cancel session' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this session?' })
    const danger = within(dialog).getByRole('button', { name: 'Cancel session' })
    fireEvent.click(danger)
    fireEvent.click(danger)
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith('tue-a', 'a')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('runs an action with no confirm at once, such as Restore session', async () => {
    open([restore])
    fireEvent.click(within(await menu()).getByRole('menuitem', { name: 'Restore session' }))
    expect(run).toHaveBeenCalledWith('tue-a', 'a')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
