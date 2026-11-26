import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../foundation.css'
import { Dialog, DialogContent, DialogTrigger } from './dialog'

it('scrolls tall content inside the rounded surface and keeps keyboard focus reachable', async () => {
  await page.viewport(390, 450)
  render(
    <Dialog>
      <DialogTrigger>Open details</DialogTrigger>
      <DialogContent title="Details" description="Scrollable details">
        {Array.from({ length: 30 }, (_, index) => (
          <p key={index}>Detail {index + 1}</p>
        ))}
        <button type="button">Save changes</button>
      </DialogContent>
    </Dialog>,
  )

  const trigger = page.getByRole('button', { name: 'Open details' })
  await trigger.click()
  const dialog = await screen.findByRole('dialog', { name: 'Details' })
  const close = within(dialog).getByRole('button', { name: 'Close dialog' })
  await expect.poll(() => document.activeElement).toBe(close)

  const scrollArea = dialog.querySelector<HTMLElement>('[data-orientation]')!
  const viewport = scrollArea.querySelector<HTMLElement>('[tabindex="-1"]')!
  const track = scrollArea.querySelector<HTMLElement>('[data-axis="y"]')!
  await expect.poll(() => track.hasAttribute('data-hidden')).toBe(false)
  expect(getComputedStyle(viewport).scrollbarWidth).toBe('none')
  expect(getComputedStyle(scrollArea).borderRadius).toBe(getComputedStyle(dialog).borderRadius)
  expect(getComputedStyle(scrollArea).overflow).toBe('hidden')
  expect(dialog.scrollHeight).toBe(dialog.clientHeight)

  await userEvent.tab()
  const save = within(dialog).getByRole('button', { name: 'Save changes' })
  expect(save).toHaveFocus()
  await expect.poll(() => viewport.scrollTop).toBeGreaterThan(0)
  expect(save.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    dialog.getBoundingClientRect().bottom,
  )
  await userEvent.keyboard('{Escape}')
  await expect.element(trigger).toHaveFocus()
})
