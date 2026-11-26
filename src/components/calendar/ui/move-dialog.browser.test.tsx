import { render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import en from '../../../../messages/en.json'
import '../../arc/foundation.css'
import { MoveDialog } from './move-dialog'
import { useCalendarLabels } from './use-calendar-labels'

function MoveAllDayBlock() {
  const labels = useCalendarLabels({ kind: () => 'Session', newItem: 'New session' })
  return (
    <MoveDialog
      block={{
        id: 'session/day',
        itemId: 'session',
        blockId: 'day',
        track: '2026-11-17',
        start: 0,
        end: 0,
        allDay: true,
      }}
      labels={labels}
      locale="en"
      range={{ min: 0, max: 1440 }}
      onApply={vi.fn()}
      onCancel={vi.fn()}
      finalFocus={() => null}
    />
  )
}

it('shows the scroll track on hover when opening the date picker adds overflow', async () => {
  await page.viewport(390, 330)
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <MoveAllDayBlock />
    </NextIntlClientProvider>,
  )

  const dialog = await screen.findByRole('dialog')
  const day = within(dialog).getByRole('button', { name: 'Day' })
  const viewport = dialog.querySelector<HTMLElement>('[tabindex="-1"]')!
  const track = dialog.querySelector<HTMLElement>('[data-axis="y"]')!
  expect(track).toHaveAttribute('data-hidden')

  await userEvent.click(page.elementLocator(day))
  const calendar = within(dialog).getByRole('dialog', { name: 'Day calendar' })
  await expect.poll(() => viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight)
  expect(viewport.scrollTop).toBe(0)
  await expect.poll(() => track.hasAttribute('data-hidden')).toBe(false)
  await expect.poll(() => Number(getComputedStyle(track).opacity)).toBeGreaterThan(0)

  await userEvent.keyboard('{Escape}')
  await expect.poll(() => calendar.isConnected).toBe(false)
  await expect.poll(() => track.hasAttribute('data-hidden')).toBe(true)
})
