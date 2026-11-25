import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '@/components/arc/foundation.css'
import { SpaceSettings } from '@/components/space/space-settings'

import messages from '../../../messages/en.json'
import { IntlProvider } from '../../../testing/intl.test-utils'
import { renderWithNavigation } from '../../../testing/navigation.test-utils'

const mount = (
  aiButtons?: { space: boolean; site: boolean },
  archived = false,
  outcome: 'ok' | 'error' = 'ok',
) => {
  const changes: boolean[] = []
  const saved: FormData[] = []
  const sheet = (stored: typeof aiButtons, open: boolean) => (
    <IntlProvider>
      <SpaceSettings
        space={1}
        posting="open"
        events="members"
        archived={archived}
        about=""
        aboutDefault="Default about"
        rules=""
        rulesDefault="Default rules"
        aiButtons={stored}
        open={open}
        onOpenChange={(next) => changes.push(next)}
        anchor={<span>anchor</span>}
        save={async (form) => {
          saved.push(form)
          return outcome === 'ok' ? { status: 'ok' } : { status: 'error', error: 'failed' }
        }}
      />
    </IntlProvider>
  )
  const { rerender } = renderWithNavigation(sheet(aiButtons, true))
  const showStored = (space: boolean, open = true) => rerender(sheet({ space, site: true }, open))
  return { changes, saved, showStored }
}

const aiSwitch = () => screen.queryByRole('switch', { name: messages.Spaces.aiButtons })
const aiInfo = () => screen.getByRole('button', { name: messages.Spaces.aiButtonsInfo })
const tooltip = () => screen.queryByRole('tooltip')
const describedBy = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join('')
const middle = (el: Element) => {
  const box = el.getBoundingClientRect()
  return box.top + box.height / 2
}
const nextFrames = () =>
  new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: messages.Spaces.saveSettings }))

afterEach(cleanup)

describe('SpaceSettings', () => {
  it('opens as a dialog on wide screens, with every field, a save button and a close button', () => {
    const { changes } = mount()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(messages.Spaces.posting)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.eventsSetting)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.aboutField)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.rulesField)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.saveSettings)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.Spaces.closeSettings }))
    expect(changes).toEqual([false])
  })

  it('opens as a bottom sheet on phones with the same fields', async () => {
    await page.viewport(390, 844)
    mount()
    expect(screen.getByText(messages.Spaces.posting)).toBeTruthy()
    expect(screen.getByText(messages.Spaces.saveSettings)).toBeTruthy()
  })

  it.each([false, true])(
    'keeps the last field clear of the Save footer on phones (archived: %s)',
    async (archived) => {
      await page.viewport(390, 844)
      mount({ space: true, site: true }, archived)
      const footer = document.querySelector('[class*="settingsFooter"]')!
      let body = footer.parentElement!
      while (getComputedStyle(body).overflowY !== 'auto') body = body.parentElement!
      const last = footer.previousElementSibling!.lastElementChild!
      await waitFor(() => {
        body.scrollTop = body.scrollHeight
        expect(body.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight + 1)
        expect(footer.getBoundingClientRect().bottom).toBeCloseTo(
          body.getBoundingClientRect().bottom,
          0,
        )
        expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(
          footer.getBoundingClientRect().top,
        )
      })
      const box = last.querySelector<HTMLElement>('[role="checkbox"], [role="switch"]')!
      body.scrollTop = 0
      box.focus()
      await waitFor(() =>
        expect(box.getBoundingClientRect().bottom).toBeLessThanOrEqual(
          footer.getBoundingClientRect().top,
        ),
      )
    },
  )

  it('shows no AI buttons switch, and sends none, in a space without them', async () => {
    const { saved } = mount()
    expect(aiSwitch()).toBeNull()
    expect(screen.queryByRole('button', { name: messages.Spaces.aiButtonsInfo })).toBeNull()
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]!.has('ai_buttons')).toBe(false)
  })

  it('sends the AI buttons switch the moderator changed, off or on', async () => {
    const { saved } = mount({ space: true, site: true })
    const toggle = aiSwitch()!
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]!.get('ai_buttons')).toBe('false')
    cleanup()

    const again = mount({ space: false, site: true })
    expect(aiSwitch()!.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByText(messages.Spaces.aiButtons))
    save()
    await waitFor(() => expect(again.saved).toHaveLength(1))
    expect(again.saved[0]!.get('ai_buttons')).toBe('true')
  })

  it.each([true, false])(
    'sends no AI buttons value from a save that leaves the switch alone (stored: %s)',
    async (stored) => {
      const { saved } = mount({ space: stored, site: true })
      save()
      await waitFor(() => expect(saved).toHaveLength(1))
      expect(saved[0]!.has('ai_buttons')).toBe(false)
    },
  )

  it('sends no AI buttons value for a switch turned back', async () => {
    const { saved } = mount({ space: true, site: true })
    fireEvent.click(aiSwitch()!)
    fireEvent.click(aiSwitch()!)
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]!.has('ai_buttons')).toBe(false)
  })

  it('shows a newer stored value, and a save of the other settings leaves it alone', async () => {
    const { saved, showStored } = mount({ space: true, site: true })
    showStored(false)
    await waitFor(() => expect(aiSwitch()!.getAttribute('aria-checked')).toBe('false'))
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]!.has('ai_buttons')).toBe(false)
  })

  it('leaves a newer stored value alone after its own change was saved', async () => {
    const { saved, showStored } = mount({ space: true, site: true })
    fireEvent.click(aiSwitch()!)
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    showStored(false)
    showStored(true)
    await waitFor(() => expect(aiSwitch()!.getAttribute('aria-checked')).toBe('true'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(messages.Spaces.saveSettings) }))
    await waitFor(() => expect(saved).toHaveLength(2))
    expect(saved[1]!.has('ai_buttons')).toBe(false)
  })

  it('does not send a saved change again when the refresh brings back another value', async () => {
    const { saved } = mount({ space: false, site: true })
    fireEvent.click(aiSwitch()!)
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]!.get('ai_buttons')).toBe('true')
    await waitFor(() => expect(aiSwitch()!.getAttribute('aria-checked')).toBe('false'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(messages.Spaces.saveSettings) }))
    await waitFor(() => expect(saved).toHaveLength(2))
    expect(saved[1]!.has('ai_buttons')).toBe(false)
  })

  it('keeps the change after a save that failed, and sends it again', async () => {
    const { saved } = mount({ space: true, site: true }, false, 'error')
    fireEvent.click(aiSwitch()!)
    save()
    await screen.findByRole('alert')
    expect(aiSwitch()!.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: new RegExp(messages.Spaces.saveSettings) }))
    await waitFor(() => expect(saved).toHaveLength(2))
    expect(saved[1]!.get('ai_buttons')).toBe('false')
  })

  it('drops an unsaved AI buttons change when the sheet closes', async () => {
    const { saved, showStored } = mount({ space: true, site: true })
    fireEvent.click(aiSwitch()!)
    showStored(true, false)
    await waitFor(() => expect(aiSwitch()).toBeNull())
    showStored(true)
    await waitFor(() => expect(aiSwitch()?.getAttribute('aria-checked')).toBe('true'))
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]!.has('ai_buttons')).toBe(false)
  })

  it('turns the AI buttons switch with the Space key', async () => {
    mount({ space: true, site: true })
    aiSwitch()!.focus()
    await userEvent.keyboard(' ')
    expect(aiSwitch()!.getAttribute('aria-checked')).toBe('false')
  })

  it('locks the AI buttons switch, says why, and sends none, while the site switch is off', async () => {
    const { saved } = mount({ space: true, site: false })
    const toggle = aiSwitch()!
    expect(toggle).toBeDisabled()
    expect(describedBy(toggle)).toBe(messages.Spaces.aiButtonsSiteOff)
    fireEvent.click(screen.getByText(messages.Spaces.aiButtons))
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]!.has('ai_buttons')).toBe(false)
  })

  it('keeps the AI switch help in a tooltip, which keyboard focus opens and Escape closes', async () => {
    const { changes } = mount({ space: true, site: true })
    expect(screen.queryByText(messages.Spaces.aiButtonsHint)).toBeNull()
    aiSwitch()!.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(aiInfo())
    await waitFor(() => expect(tooltip()?.textContent).toContain(messages.Spaces.aiButtonsHint))
    await waitFor(() => expect(describedBy(aiInfo())).toContain(messages.Spaces.aiButtonsHint))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(tooltip()).toBeNull())
    expect(changes).toEqual([])
  })

  it('keeps the tooltip open when keyboard focus has to scroll the sheet to the button', async () => {
    await page.viewport(390, 844)
    mount({ space: true, site: true })
    const saveButton = screen.getByRole('button', { name: messages.Spaces.saveSettings })
    let body = aiInfo().parentElement!
    while (getComputedStyle(body).overflowY !== 'auto') body = body.parentElement!
    await waitFor(() => expect(body.getBoundingClientRect().bottom).toBeLessThanOrEqual(845))
    saveButton.focus()
    body.scrollTop = 0
    await nextFrames()
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(aiInfo())
    await nextFrames()
    expect(body.scrollTop).toBeGreaterThan(0)
    await waitFor(() => expect(tooltip()?.textContent).toContain(messages.Spaces.aiButtonsHint))
    expect(aiInfo().getAttribute('data-state')).not.toBe('closed')
  })

  it('opens the AI switch tooltip on hover, and leaves the switch as it was', async () => {
    mount({ space: true, site: true })
    await userEvent.hover(aiInfo())
    await waitFor(() => expect(tooltip()?.textContent).toContain(messages.Spaces.aiButtonsHint))
    expect(aiSwitch()!.getAttribute('aria-checked')).toBe('true')
  })

  it('opens the AI switch tooltip on a press, and a second press leaves it open', async () => {
    mount({ space: true, site: false })
    await userEvent.click(aiInfo())
    await waitFor(() => expect(tooltip()?.textContent).toContain(messages.Spaces.aiButtonsHint))
    await userEvent.click(aiInfo())
    expect(aiInfo().getAttribute('data-state')).not.toBe('closed')
  })

  it.each([
    [1280, 800],
    [390, 844],
  ])(
    'centres the AI switch on its label, with the info button after it (%i px wide)',
    async (width, height) => {
      await page.viewport(width, height)
      mount({ space: true, site: true })
      const label = screen.getByText(messages.Spaces.aiButtons)
      await waitFor(() => {
        expect(Math.abs(middle(aiSwitch()!) - middle(label))).toBeLessThanOrEqual(1)
        expect(Math.abs(middle(aiInfo()) - middle(label))).toBeLessThanOrEqual(1)
        expect(aiInfo().getBoundingClientRect().left).toBeGreaterThanOrEqual(
          label.getBoundingClientRect().right,
        )
      })
    },
  )
})
