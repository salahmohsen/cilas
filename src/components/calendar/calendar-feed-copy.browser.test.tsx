import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { CalendarFeed } from '@/components/calendar/calendar-tools'
import { setClipboardAccess } from '../../../testing/fan0-clipboard.test-utils'
import { messagesOf, renderWithIntl } from '../../../testing/intl.test-utils'

afterEach(async () => {
  cleanup()
  vi.useRealTimers()
  await setClipboardAccess('prompt')
})

const show = (locale: 'en' | 'ar') => {
  renderWithIntl(<CalendarFeed feedPath={`/${locale}/calendar.ics`} />, { locale })
  return messagesOf[locale].Calendar
}

const openMenu = (words: { feed: string }) =>
  userEvent.click(page.getByRole('button', { name: words.feed }))

const chooseCopy = async (words: { feed: string; copyFeed: string }) => {
  await openMenu(words)
  await userEvent.click(page.getByRole('menuitem', { name: words.copyFeed }))
}

describe('feed copy feedback', () => {
  it.each(['en', 'ar'] as const)(
    'shows success in %s, keeps the live status, then resets',
    async (locale) => {
      await setClipboardAccess('granted')
      const words = show(locale)
      await openMenu(words)
      const item = await page.getByRole('menuitem', { name: words.copyFeed }).findElement()
      vi.useFakeTimers({ toFake: ['setTimeout'] })
      await act(async () => {
        fireEvent.click(item)
        await navigator.clipboard.readText()
      })
      expect(screen.getByRole('status')).toHaveTextContent(words.copied)
      expect(await navigator.clipboard.readText()).toBe(
        `${window.location.origin}/${locale}/calendar.ics`,
      )
      expect(screen.getByRole('status')).not.toHaveClass('sr-only')
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
      expect(screen.getByRole('menu')).toHaveAccessibleName(expect.stringContaining(words.copied))
      await act(async () => {
        vi.advanceTimersByTime(2501)
      })
      vi.useRealTimers()
      await waitFor(() =>
        expect(screen.getByRole('button', { name: words.feed })).toBeInTheDocument(),
      )
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    },
  )

  it('shows a selectable URL when the browser refuses clipboard access', async () => {
    await setClipboardAccess('denied')
    const words = show('en')
    await chooseCopy(words)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(words.copyFailed))
    const field = screen.getByRole('textbox', { name: words.feedUrl }) as HTMLInputElement
    expect(field).toHaveAttribute('readonly')
    expect(field.value).toBe(`${window.location.origin}/en/calendar.ics`)
    field.focus()
    expect(field.selectionStart).toBe(0)
    expect(field.selectionEnd).toBe(field.value.length)
  })
})
