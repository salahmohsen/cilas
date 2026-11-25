import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Calendar } from '@/components/calendar/ui/calendar'
import type { CalendarView } from '@/components/calendar/ui/calendar-views'
import { useCalendarLabels } from '@/components/calendar/ui/use-calendar-labels'
import type { CalendarItem } from '@/lib/calendar-items'

import ar from '../../../../messages/ar.json'
import en from '../../../../messages/en.json'
import { emulateMedia, resetMedia } from '../../../../testing/media.test-utils'

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

const TONES = ['neutral', 'pink', 'blue']

const KIND_NAMES: Record<string, string> = {
  'course:mine': 'Your courses',
  'course:other': 'Other courses',
  'event:talk': 'Talks',
}

const at = (id: string, date: string) => ({
  id,
  date,
  start_time: '19:00',
  end_time: '21:00',
})

const item = (id: string, title: string, extra: Partial<CalendarItem>) =>
  ({
    id,
    kind: 'course:mine',
    title,
    tone: 'pink',
    cancelled: false,
    version: `v-${id}`,
    blocks: [],
    ...extra,
  }) satisfies CalendarItem

const mine = item('mine', 'Mine', {
  edge: 'solid',
  blocks: [at('b', '2026-11-17')],
})
const other = item('other', 'Other', {
  kind: 'course:other',
  tone: 'neutral',
  edge: 'double',
  blocks: [at('b', '2026-11-18')],
})
const talk = item('talk', 'Talk', {
  kind: 'event:talk',
  tone: 'blue',
  blocks: [at('b', '2026-11-19')],
})
const cancelledOther = item('gone', 'Gone', {
  kind: 'course:other',
  tone: 'neutral',
  edge: 'double',
  cancelled: true,
  blocks: [at('b', '2026-11-18')],
})
const cancelledMine = item('cancelled-mine', 'Cancelled mine', {
  edge: 'solid',
  cancelled: true,
  blocks: [at('b', '2026-11-17')],
})

type HostProps = {
  items: CalendarItem[]
  defaultHiddenKinds?: readonly string[]
  view?: CalendarView
  locale?: 'en' | 'ar'
  details?: boolean
}

function Host({ items, defaultHiddenKinds, view = 'week', locale = 'en', details }: HostProps) {
  const labels = useCalendarLabels({ kind: (kind) => KIND_NAMES[kind] ?? kind, newItem: 'New' })
  return (
    <Calendar
      mode="view"
      items={items}
      labels={labels}
      locale={locale}
      day="2026-11-17"
      view={view}
      defaultHiddenKinds={defaultHiddenKinds}
      onOpen={vi.fn()}
      actionsOf={details ? () => [{ id: 'open', label: 'Open', href: '/page' }] : undefined}
    />
  )
}

const tree = (props: HostProps) => (
  <NextIntlClientProvider
    locale={props.locale ?? 'en'}
    messages={props.locale === 'ar' ? ar : en}
    timeZone="Africa/Cairo"
  >
    <Host {...props} />
  </NextIntlClientProvider>
)

const show = (props: HostProps) => {
  const view = render(tree(props))
  return { rerender: (next: HostProps) => view.rerender(tree(next)) }
}

const openPanel = (name = 'Side panel') => {
  const button = screen.getByRole('button', { name })
  if (button.getAttribute('aria-expanded') !== 'true') fireEvent.click(button)
}
const legend = () => screen.getByRole('group', { name: 'Colour key' })
const toggle = (name: string) => within(legend()).getByRole('button', { name })
const block = (title: string) => screen.queryByRole('button', { name: new RegExp(`^${title}, `) })

beforeAll(() => {
  globalThis.__UI_SDK_STRICT__ = true
})
beforeEach(() => {
  for (const tone of TONES)
    document.documentElement.style.setProperty(`--calendar-${tone}-line`, 'rgb(90, 90, 90)')
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
})
afterEach(async () => {
  cleanup()
  vi.useRealTimers()
  document.documentElement.removeAttribute('dir')
  for (const tone of TONES) document.documentElement.style.removeProperty(`--calendar-${tone}-line`)
  await resetMedia()
})

describe('the legend preset', () => {
  it('starts a kind in defaultHiddenKinds unpressed, and its blocks are gone', () => {
    show({ items: [mine, other, talk], defaultHiddenKinds: ['course:other'] })
    openPanel()
    expect(toggle('Other courses')).toHaveAttribute('aria-pressed', 'false')
    expect(block('Other')).toBeNull()
    expect(block('Mine')).not.toBeNull()
  })

  it('shows its blocks when the reader presses it', () => {
    show({ items: [mine, other, talk], defaultHiddenKinds: ['course:other'] })
    openPanel()
    fireEvent.click(toggle('Other courses'))
    expect(toggle('Other courses')).toHaveAttribute('aria-pressed', 'true')
    expect(block('Other')).not.toBeNull()
  })

  it('starts the other kinds pressed', () => {
    show({ items: [mine, other, talk], defaultHiddenKinds: ['course:other'] })
    openPanel()
    expect(toggle('Your courses')).toHaveAttribute('aria-pressed', 'true')
    expect(toggle('Talks')).toHaveAttribute('aria-pressed', 'true')
  })

  it('starts every kind pressed without a preset', () => {
    show({ items: [mine, other, talk] })
    openPanel()
    for (const name of ['Your courses', 'Other courses', 'Talks'])
      expect(toggle(name)).toHaveAttribute('aria-pressed', 'true')
  })

  it('ignores a new defaultHiddenKinds after mount', () => {
    const { rerender } = show({ items: [mine, other, talk], defaultHiddenKinds: ['course:other'] })
    rerender({ items: [mine, other, talk], defaultHiddenKinds: [] })
    openPanel()
    expect(toggle('Other courses')).toHaveAttribute('aria-pressed', 'false')
    expect(block('Other')).toBeNull()
  })

  it('keeps a preset kind with no item in view hidden after another toggle and a new range', () => {
    const { rerender } = show({ items: [mine, talk], defaultHiddenKinds: ['course:other'] })
    openPanel()
    expect(within(legend()).queryByRole('button', { name: 'Other courses' })).toBeNull()
    fireEvent.click(toggle('Talks'))
    expect(toggle('Talks')).toHaveAttribute('aria-pressed', 'false')
    rerender({ items: [mine, talk, other], defaultHiddenKinds: ['course:other'] })
    expect(toggle('Other courses')).toHaveAttribute('aria-pressed', 'false')
    expect(toggle('Talks')).toHaveAttribute('aria-pressed', 'false')
    expect(block('Other')).toBeNull()
  })

  it('moves through the legend with the arrow keys in right to left, in the same order', () => {
    document.documentElement.dir = 'rtl'
    show({ items: [mine, other, talk], locale: 'ar' })
    openPanel('اللوحة الجانبية')
    const toggles = within(screen.getByRole('group', { name: 'دليل الألوان' })).getAllByRole(
      'button',
    )
    expect(toggles.map((button) => button.textContent)).toEqual([
      'Your courses',
      'Other courses',
      'Talks',
    ])
    toggles[0]!.focus()
    fireEvent.keyDown(toggles[0]!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(toggles[1])
    fireEvent.keyDown(toggles[1]!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(toggles[0])
  })
})

describe('the edge bar', () => {
  const edgeOf = (element: Element | null) => element?.getAttribute('data-edge') ?? null

  it('shows on the week block, and not on an event', () => {
    show({ items: [mine, other, talk] })
    expect(edgeOf(block('Mine'))).toBe('solid')
    expect(edgeOf(block('Other'))).toBe('double')
    expect(edgeOf(block('Talk'))).toBeNull()
  })

  it('shows on the month chip', () => {
    show({ items: [mine, other, talk], view: 'month' })
    expect(edgeOf(block('Mine'))).toBe('solid')
    expect(edgeOf(block('Other'))).toBe('double')
    expect(edgeOf(block('Talk'))).toBeNull()
  })

  it('shows on the agenda row', () => {
    show({ items: [mine, other, talk], view: 'agenda' })
    expect(edgeOf(block('Mine'))).toBe('solid')
    expect(edgeOf(block('Other'))).toBe('double')
    expect(edgeOf(block('Talk'))).toBeNull()
  })

  it('shows on the Up next row', () => {
    show({ items: [mine, other, talk] })
    openPanel()
    expect(edgeOf(document.querySelector('[data-row-id][data-edge]'))).toBe('solid')
  })

  it('shows on the legend swatch, pressed or not', () => {
    show({ items: [mine, other, talk], defaultHiddenKinds: ['course:other'] })
    openPanel()
    const swatch = (name: string) => toggle(name).querySelector('[data-edge]')
    expect(edgeOf(swatch('Your courses'))).toBe('solid')
    expect(edgeOf(swatch('Other courses'))).toBe('double')
    expect(toggle('Other courses')).toHaveAttribute('aria-pressed', 'false')
    expect(swatch('Talks')).toBeNull()
  })

  it.each(['none', 'active'])(
    'keeps the course cue in cancelled agenda rows with forced colours %s',
    async (forcedColors) => {
      await emulateMedia({ 'forced-colors': forcedColors })
      show({ items: [mine, other, cancelledMine, cancelledOther], view: 'agenda' })
      const bar = (title: string) =>
        getComputedStyle(block(title)!.querySelector('[class*="agendaBar"]')!)
      for (const [title, width] of [
        ['Mine', '3px'],
        ['Cancelled mine', '3px'],
        ['Other', '2px'],
        ['Gone', '2px'],
      ] as const) {
        const style = bar(title)
        expect(style.width).toBe('6px')
        expect(style.borderInlineStartWidth).toBe(width)
        expect(style.borderInlineEndWidth).toBe(width)
        expect(style.borderInlineStartStyle).toBe('solid')
        expect(style.borderInlineStartColor).not.toBe('rgba(0, 0, 0, 0)')
      }
    },
  )

  it.each(['none', 'active'])(
    'draws a filled or hollow start-edge bar with forced colours %s',
    async (forcedColors) => {
      await emulateMedia({ 'forced-colors': forcedColors })
      const bar = (element: Element | null) => {
        const style = getComputedStyle(element!, '::after')
        expect(style.borderInlineStartColor).not.toBe('rgba(0, 0, 0, 0)')
        return [style.inlineSize, style.borderInlineStartWidth, style.borderInlineEndWidth]
      }
      show({ items: [mine, other, talk], details: true })
      openPanel()
      const solid = ['6px', '3px', '3px']
      const hollow = ['6px', '2px', '2px']
      expect(bar(block('Mine'))).toEqual(solid)
      expect(bar(block('Other'))).toEqual(hollow)
      expect(bar(toggle('Your courses').querySelector('[data-edge]'))).toEqual(solid)
      expect(bar(toggle('Other courses').querySelector('[data-edge]'))).toEqual(hollow)
      expect(bar(document.querySelector('[data-row-id][data-edge]'))).toEqual(solid)
      fireEvent.click(block('Other')!)
      expect(bar(document.querySelector('[class*="detailsMark"]'))).toEqual(hollow)
      cleanup()
      show({ items: [mine, other, talk], view: 'month', details: true })
      expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
      expect(bar(block('Mine'))).toEqual(solid)
      expect(bar(block('Other'))).toEqual(hollow)
    },
  )

  it('draws no bar on an event', () => {
    show({ items: [talk] })
    expect(getComputedStyle(block('Talk')!).borderInlineStartStyle).not.toBe('double')
    expect(getComputedStyle(block('Talk')!).borderInlineStartWidth).toBe('1px')
  })

  it('names a block by its kind after its time', () => {
    show({ items: [mine, other, talk] })
    expect(block('Mine')).toHaveAccessibleName(/, 7 PM to 9 PM, Your courses$/)
    expect(block('Talk')).toHaveAccessibleName(/, 7 PM to 9 PM$/)
  })

  it.each(['week', 'month'] as const)('names side-panel course rows in %s view', (view) => {
    show({ items: [mine], view })
    openPanel()
    expect(screen.getByRole('button', { name: /^Mine .*Your courses$/ })).toBeVisible()
  })
})
