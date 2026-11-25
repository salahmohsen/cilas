import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import '@/components/arc/foundation.css'
import { SpaceSettings } from '@/components/space/space-settings'

import messages from '../../../messages/en.json'
import { IntlProvider } from '../../../testing/intl.test-utils'
import { renderWithNavigation } from '../../../testing/navigation.test-utils'

const mount = (aiButtons?: { space: boolean; site: boolean }, archived = false) => {
  const changes: boolean[] = []
  const saved: FormData[] = []
  renderWithNavigation(
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
        aiButtons={aiButtons}
        open
        onOpenChange={(next) => changes.push(next)}
        anchor={<span>anchor</span>}
        save={async (form) => {
          saved.push(form)
          return { status: 'ok' }
        }}
      />
    </IntlProvider>,
  )
  return { changes, saved }
}

const aiCheckbox = () => screen.queryByRole('checkbox', { name: messages.Spaces.aiButtons })
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
      const box = last.querySelector<HTMLElement>('[role="checkbox"]')!
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
    expect(aiCheckbox()).toBeNull()
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]!.has('ai_buttons')).toBe(false)
  })

  it('sends the AI buttons switch as it stands, off and on', async () => {
    const { saved } = mount({ space: true, site: true })
    const box = aiCheckbox()!
    expect(box.getAttribute('aria-checked')).toBe('true')
    const hint = document.getElementById(box.getAttribute('aria-describedby')!)
    expect(hint?.textContent).toBe(messages.Spaces.aiButtonsHint)
    fireEvent.click(box)
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]!.get('ai_buttons')).toBe('false')
    cleanup()

    const again = mount({ space: false, site: true })
    expect(aiCheckbox()!.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(aiCheckbox()!)
    save()
    await waitFor(() => expect(again.saved).toHaveLength(1))
    expect(again.saved[0]!.get('ai_buttons')).toBe('true')
  })

  it('locks the AI buttons switch, says why, and sends none, while the site switch is off', async () => {
    const { saved } = mount({ space: true, site: false })
    const box = aiCheckbox()!
    expect(box).toBeDisabled()
    expect(box.getAttribute('aria-checked')).toBe('true')
    const hint = document.getElementById(box.getAttribute('aria-describedby')!)
    expect(hint?.textContent).toBe(messages.Spaces.aiButtonsSiteOff)
    save()
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]!.has('ai_buttons')).toBe(false)
  })
})
