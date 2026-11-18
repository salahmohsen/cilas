import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CalendarFeed } from '@/components/calendar/calendar-tools'
import en from '../../../messages/en.json'
import ar from '../../../messages/ar.json'

vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }))
vi.mock('@/components/arc/dropdown-menu/dropdown-menu', () => ({
  DropdownMenu: ({
    label,
    items,
  }: {
    label: string
    items: { label: string; onSelect: () => void }[]
  }) => (
    <div>
      <button>{label}</button>
      {items.map((item) => (
        <button key={item.label} onClick={item.onSelect}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  Reflect.deleteProperty(navigator, 'clipboard')
})

const show = (locale: 'en' | 'ar') => {
  const messages = locale === 'ar' ? ar : en
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CalendarFeed feedPath={`/${locale}/calendar.ics`} />
    </NextIntlClientProvider>,
  )
  return messages.Calendar
}

describe('feed copy feedback', () => {
  it.each(['en', 'ar'] as const)(
    'shows success in %s, keeps the live status, then resets',
    async (locale) => {
      vi.useFakeTimers()
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
      const words = show(locale)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: words.copyFeed }))
      })
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/${locale}/calendar.ics`)
      expect(screen.getByRole('status')).toHaveTextContent(words.copied)
      expect(screen.getByRole('status')).not.toHaveClass('sr-only')
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
      expect(screen.getAllByRole('button', { name: words.copied })).toHaveLength(2)
      await act(async () => {
        vi.advanceTimersByTime(2501)
      })
      expect(screen.getByRole('button', { name: words.feed })).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    },
  )

  it.each(['absent', 'rejected'])(
    'shows a selectable URL when clipboard access is %s',
    async (mode) => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value:
          mode === 'absent'
            ? undefined
            : { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      })
      const words = show('en')
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: words.copyFeed }))
      })
      expect(screen.getByRole('status')).toHaveTextContent(words.copyFailed)
      const field = screen.getByRole('textbox', { name: words.feedUrl }) as HTMLInputElement
      expect(field).toHaveAttribute('readonly')
      expect(field.value).toBe(`${window.location.origin}/en/calendar.ics`)
      fireEvent.focus(field)
      expect(field.selectionStart).toBe(0)
      expect(field.selectionEnd).toBe(field.value.length)
    },
  )
})
